---
title: Webhook Delivery Model — At-Least-Once, the Retry Schedule, and Replay
description: The delivery engine's contract in full — at-least-once semantics with the explicit non-goals, the fixed 8-attempt retry schedule with jitter, the retry-vs-terminal taxonomy, timeouts and the response-capture cap, auto-disable and heal-by-replay, per-Target throughput protection, the queue topology with the normative counter-driven re-dispatch mechanics and the deadline_at column, replay (synchronous single, queued bulk), and test-fire/ping semantics. The schedule table, jitter, tune-point names, and mechanics live here (the mandated values are the spec's WH-5xx rows); the rule of record is fleet-webhook-specification, entity storage is webhook-data-model, and the envelope is webhook-event-catalog.
tags: [stack, webhooks, laravel, delivery, retry, queues, reliability]
type: stack
status: reference
updated: 2026-08-08
related: [fleet-webhook-specification, webhook-data-model, webhook-event-catalog, webhook-signing-scheme, webhook-egress-guards, webhook-management-surface, webhook-receiver-guide, fleet-queue-doctrine, fleet-testing-doctrine]
---

# Webhook Delivery Model — at-least-once, the retry schedule, and replay

The deep reference behind the delivery-engine rules in [[fleet-webhook-specification]]. The
schedule table, jitter, tune-point names, and engine mechanics live here; the mandated values
are the spec's WH-5xx rows, and other corpus pages point here rather than restating. Prior art:
Stripe's delivery engine is the explicit bar (schedule shape, disable behavior, replay
ergonomics).

## Semantics and non-goals

The engine delivers **at least once, best effort, in no particular order**. It states its
non-goals as loudly as its goals, because receivers build against what we promise:

- **No exactly-once.** A crash between a successful HTTP exchange and recording the outcome
  re-sends the event. The envelope `id` ([[webhook-event-catalog]]) is stable across every
  attempt, retry, and replay of an event, so receivers deduplicate on it — carried in the
  default envelope body and, regardless of template or verb, in the engine-set `X-Webhook-Id`
  header (engine request headers, below). [[webhook-receiver-guide]] carries the receiver-side
  pattern.
- **No ordering.** Fan-out is parallel, retries reshuffle arrival, and replays arrive late by
  definition. Receivers must treat each event as a self-contained fact, never as a sequence
  element.
- **Best effort.** We do not control the receiving system. After the schedule exhausts, the
  Delivery is terminally failed and visible in history; nothing blocks, nothing escalates beyond
  auto-disable (below).

Payloads are **frozen at emission** (snapshot semantics, [[webhook-event-catalog]]): a retry two
days later sends the same frozen envelope through the Webhook's **current** configuration —
rendering happens per Attempt at the point of work ([[webhook-templating]]), so unchanged
configuration yields identical bytes and a mid-schedule configuration fix reaches the very next
attempt. Determinism is the point; staleness is by design.

## The retry schedule

Eight attempts, fixed, **non-configurable in v1** — no per-webhook, per-target, or per-app
tuning. The delays are exponential with jitter:

| Attempt | Delay after previous failure | Elapsed (nominal) |
|---|---|---|
| 1 | — (dispatched `afterCommit`, runs as soon as a worker picks it up) | ~0s |
| 2 | 30s | 30s |
| 3 | 2m | 2m 30s |
| 4 | 10m | 12m 30s |
| 5 | 1h | 1h 12m 30s |
| 6 | 4h | 5h 12m 30s |
| 7 | 12h | 17h 12m 30s |
| 8 | 24h | 41h 12m 30s (≈1.7 days) |

**Jitter:** each delay is multiplied by a uniform random factor in **[0.9, 1.1]** before the job
is released. This spreads synchronized failure herds (a receiver outage fails thousands of
deliveries in the same second; without jitter they all return in the same second too).

A `Retry-After` header on a 429 is recorded on the Attempt for history but does **not** alter
the schedule in v1 — the schedule is fixed, and honoring arbitrary receiver-supplied delays
would make it receiver-configurable by the back door.

When attempt 8 fails, or the 48-hour deadline passes (the Delivery's `deadline_at` column —
queue topology, below), the Delivery is terminally **failed**, the event row's rollup updates
([[webhook-data-model]]), and the failure counts toward auto-disable.

## Retry taxonomy

Classification happens per attempt, on the observed outcome:

- **Success: any 2xx.** Nothing else. The Delivery is `succeeded`; remaining schedule slots are
  discarded.
- **Retryable:** `429`, any `5xx`, and every network-class failure — DNS resolution failure or
  an empty DNS answer (the guard's fail-closed denial for those outcomes classifies here — DNS
  wobbles heal), connect failure, TLS failure, connect/response timeout. A retryable guard
  denial consumes its schedule slot like any HTTP failure — the Attempt row is written
  (`error_class` `network`, no request sent) and the Delivery counter increments, so the
  schedule stays finite and the hop-delay lookup always indexes a consumed position. The
  next attempt schedules per the table.
- **Terminal:** every other `4xx` (the receiver understood us and said no — retrying cannot
  change its mind), and **all `3xx`** — redirects are never followed
  ([[webhook-egress-guards]]), so a redirect status is a misconfigured Target, not a transient.
- **Terminal, engine-side:** a template rendering failure (an unresolvable token at delivery
  time, [[webhook-templating]]) and an egress-guard rejection of a **resolved-but-blocked**
  address ([[webhook-egress-guards]]) — the guard's two deny outcomes split: no answer is
  retryable `network` (above), a blocked answer is terminal `egress`. Neither terminal case can
  self-heal by waiting, so neither retries; both are recorded with their error class and visible
  in history. A third engine-side terminal sits at the data seam: a job that wakes to find its
  event row already pruned terminates the Delivery as failed with error class `event_pruned` —
  never retried, never a Sentry event ([[webhook-data-model]] owns the pruning invariant).

The classifier is a pure function (outcome in, `succeeded | retry | terminal` out) and is
branch-completely unit tested per [[fleet-testing-doctrine]].

## Timeouts and response capture

- **Connect timeout: 5 seconds. Total request timeout: 15 seconds** — the total bound
  includes the connect phase, so the worst-case attempt is 15 seconds. A receiver that needs
  longer should acknowledge fast and process async — that guidance lives in
  [[webhook-receiver-guide]].
- The response read is **bounded at the socket**, not just at storage: the client streams the
  response and hard-aborts the transfer once **64KB** have been read off the socket (tune-point
  `webhooks.delivery.response_read_cap_kb`, default 64), and transparent content decompression
  is **disabled** — the engine never inflates a compressed body, so a decompression bomb cannot
  expand in worker memory. The 16KB history capture below is a storage cap; this read cap is
  what actually stops a hostile receiver streaming gigabytes inside the 15-second window
  (threat → [[webhook-threat-model]] D-5).
- Each Attempt records the response status, duration, and the **first 16KB of the response
  body**; the remainder is discarded and the truncation is flagged. 16KB is enough to carry any
  useful error message and small enough that a chatty receiver cannot bloat history storage.
  Attempt rows and their storage shape belong to [[webhook-data-model]].

## Auto-disable and heal-by-replay

A webhook that only ever fails is load without information. Two thresholds, either one trips:

- **20 consecutive terminally-failed Deliveries**, or
- **3 days all-failing** — the trigger, defined here and restated identically in the mechanics
  below: the evaluator considers only `active` Webhooks, and only Deliveries completed (by
  their `completed_at` stamp → [[webhook-data-model]]) after
  the later of the Webhook's last transition into `active` and its creation; it trips only
  when the oldest completed, non-test, non-`event_pruned` terminal failure since the last
  success (or since that
  activation, whichever is later) is at least `failing_days` old **and** no Delivery has
  succeeded since. Skipped, pending, test, and `event_pruned` Deliveries are excluded from the
  evaluation entirely (mirroring the streak counter's exclusions). A merely-paused Webhook never trips
  it — only `active` Webhooks are evaluated at all — and a new Webhook's first failure must
  itself age `failing_days` before it can trip anything.

Both are config tune-points: `webhooks.auto_disable.consecutive_failures` (default 20) and
`webhooks.auto_disable.failing_days` (default 3). Tripping flips the Webhook to `disabled`
(state taxonomy → [[webhook-management-surface]], stamped with `state_reason` and
`state_changed_at` → [[webhook-data-model]]) and notifies the owner through the app's normal
mailer. Re-enabling is **manual, always** — the engine never re-arms a webhook by itself — and
`POST /webhooks/{webhook}/activate` **resets the streak to zero** (stamping `state_reason`
`activated` and `state_changed_at` as any flip does), so "consecutive" counts from the heal: one failed replay
mid-heal increments from zero, never from the pre-disable twenty.

**The mechanics are completion-ordered and atomic.** A Delivery **completes** when it reaches
`succeeded`, `failed`, or `skipped` — every completing path stamps the Delivery's
`completed_at` column ([[webhook-data-model]]), so completion time is a recorded fact, not an
inference. The streak is an integer column on the
Webhook row, incremented atomically (`UPDATE ... SET streak = streak + 1`) when a Delivery
completes terminally failed, reset to zero when a Delivery completes `succeeded`, and
untouched by `skipped` — so "consecutive" means completion order by construction, and parallel
fan-out or reshuffled retry completions need no further ordering rule. Replay Deliveries count
toward the streak like any other; test deliveries do not (below). Per the rule's letter,
`template_error` terminal failures count toward **both** thresholds — a wildcard subscription
drifting onto an unrenderable event type walks toward disable exactly like a dead endpoint
(the drift warning → [[webhook-templating]]). `event_pruned` completions, by contrast, are
excluded from **both** the streak and the failing-days evaluation: they mark a sender-side
retention seam ([[webhook-data-model]]), not receiver health, and disabling a healthy endpoint
over our own pruning would blame the wrong side. The per-Webhook summary endpoint surfaces this
same streak column ([[webhook-management-surface]]), so the number the UI shows and the number
that trips disable structurally cannot diverge. The **3-days-all-failing** trigger is evaluated
by schedule, not per completion: a dedicated scheduled command — the failing-days evaluator,
its own schedule entry running hourly (tune-point `webhooks.auto_disable.check_cadence`) —
considers only `active` Webhooks, and only Deliveries completed (by `completed_at` →
[[webhook-data-model]]) after the later of the
Webhook's last transition into `active` and its creation; it trips only when the oldest
completed, non-test, non-`event_pruned` terminal failure since the last success (or since that
activation,
whichever is later) is at least `failing_days` old and no Delivery has succeeded since;
skipped, pending, test, and `event_pruned` Deliveries are excluded from the evaluation
entirely. Activation
clips the evaluation window exactly as it resets the streak, so a manual heal with no new
traffic is never instantly re-disabled by pre-heal failures. The evaluator MAY share
a schedule slot with the WH-903 health check but never depends on that check existing — WH-903
is a SHOULD, this trigger is unconditioned spec law. The command ships in the bundle
([[fleet-webhook-specification]] WH-1102).

**The owner is defined**, not assumed — per identity plane, because `webhooks:manage` sits on
the operator guard where one exists ([[webhook-management-surface]]) and operator-guard holders
are not members of the owning org. In apps **with an operator plane**, the auto-disable email
goes to every operator holding `webhooks:manage` (org membership not required — they are the
ones who can open the heal flow), optionally CCing the owning org's owners as an FYI. In
**web-guard apps**, it goes to every current holder of `webhooks:manage` in the owning org,
falling back to the org's owners when no one holds the permission. Under the no-org carve-out
it goes to the owning user. WH-506 and the N1 story point here.

Disable does not lose data: events keep flowing into the outbox and fan-out keeps recording
`skipped` Deliveries for the disabled webhook ([[webhook-data-model]]), so the gap is visible
and enumerable. **Heal-by-replay** is the recovery path: re-enable the webhook, then bulk-replay
the gap window (below). Test-fire deliveries are excluded from both counters — a failed test
must never push a webhook toward disable.

## Per-Target throughput protection

A Target is somebody's production system; the engine must not be a friendly-fire DoS. Each
Target carries a user-configurable **concurrency cap** (default **5** concurrent in-flight
deliveries, tune-point `webhooks.targets.default_max_concurrency`) and an optional **rate
limit** (requests per minute, unset by default). The two caps are two different guarantees and
use two primitives: the **per-minute rate limit** is enforced on the queued path with a **thin
custom job middleware built on the `RateLimiter` primitive** (or a `RateLimited` subclass)
keyed by target id — custom because its release path MUST perform the throttle-release
bookkeeping this page mandates: stamp `next_attempt_at = now() + throttle_repoll_seconds`,
clear `claimed_until`, and leave `attempt_count` untouched. **Stock `RateLimited` unmodified
does not satisfy the throttle-release contract** — it calls `release($delay)` and touches no
Delivery column, so under sustained throttling `next_attempt_at` goes stale past the sweeper's
grace and healthy throttled work is re-dispatched as an orphan. The **concurrency
cap** is enforced with `Redis::funnel` — a per-target lease acquired at the point of work,
released in `finally`, and expiring on its own (`releaseAfter`) after the same fixed 2-minute
claim interval, comfortably above the 15-second worst-case attempt, so a lease leaked by a
hard-killed worker (`finally` never runs on SIGKILL) self-heals on the same clock as a leaked
claim — because a rate window cannot express max-in-flight. The funnel's
unavailable-lease path performs the identical bookkeeping on its release: same stamp, same
claim clear, same untouched counter. Both keys are
**per target id, not per transport**: every synchronous attempt — single replay, test-fire,
the verification ping — consumes the **same keys**, so no path to a Target bypasses its caps
(threat → [[webhook-threat-model]] D-4). A synchronous attempt that finds a cap hot is not
sent: the caller receives **429 with `Retry-After`**. Synchronous paths (single replay,
test-fire, the verification ping) consult the per-Target keys **before creating the Delivery
row** — a hot cap yields the 429 and **no Delivery and no Attempt exists**; the caller was
told nothing was sent, so nothing lingers for the sweeper to fire or fail later
([[webhook-management-surface]] mirrors this on the limiter note).

Be honest about the default posture: the rate limit is **opt-in and unset by default**
(tune-point `webhooks.targets.default_rate_limit_per_minute`, honored when set), so the
amplification bound against a Target is the concurrency cap times the auto-disable duration —
a stronger bound requires opting into the per-minute limit.

A throttle release is **not an attempt**: the job re-queues with the Delivery's schedule
position unchanged, after a fixed re-poll delay of **30 seconds** (tune-point
`webhooks.targets.throttle_repoll_seconds`); every throttle release sets `next_attempt_at` to
now() plus that delay and releases the claim ([[webhook-data-model]]) so the sweeper never
mistakes healthy throttled work for an orphan. The in-flight claim itself (`claimed_until`) is
taken for a fixed **2 minutes** — comfortably above the 15-second worst-case attempt. The
throttle release is the only path that consumes no schedule slot; every recorded Attempt does
(see the authoritative-counter note below).

## State at the point of work

The trash check comes first ([[webhook-data-model]] owns the rule): a delivery job that wakes
to find its Webhook **or its Target** trashed terminates the Delivery as `skipped` — soft
deletion is orthogonal to the state columns, so a trashed Target can still read `active` and
the trash predicate is checked in its own right, never inferred from state. Beside it, one
rule covers every other
mid-schedule state change: a delivery job that wakes to find its Webhook not `active` or its
Target not `active` **terminates the Delivery as `skipped`** — enumerable and bulk-replayable
exactly like a fan-out-time skip. The same check covers **event-selection narrowing**: the job
additionally verifies that its Delivery's event type still matches the Webhook's current
selection and terminates the Delivery as `skipped` when it does not — a pending Delivery for a
now-deselected type must never retry through a template whose save-time validation guarantee
no longer covers it ([[webhook-templating]]). No third fate exists: in-flight work never
pauses in place and never retries against a paused, disabled, re-unverified, or de-selected
configuration. This is what upholds WH-407 for in-flight work after a Target address edit — a
retry never fires at an edited, never-verified address ([[webhook-management-surface]] carries
the state machines).

## Queue topology

Delivery runs on a dedicated **`webhooks` queue** — the partition exists for blast-radius
isolation: a receiver outage must not compete with other outbound provider work
([[webhook-threat-model]] D-1), which is the argument [[fleet-queue-doctrine]] requires before
any partition is added. One job per Delivery; each execution of the delivery pipeline past the
claim — render, egress guard, HTTP — is one Attempt row, with `response_status` and
`attempted_at` null when no request went out and `error_class` naming the stage that failed
([[webhook-data-model]] owns the row shape). Jobs implement `ShouldQueue`, and routing is **central**:
`Queue::route(DeliverWebhook::class, queue: 'webhooks')` in the per-domain provider per
[[fleet-queue-doctrine]] §2 — the job class carries no standing queue assignment of its own.
The retry mechanics are **counter-driven re-dispatch** — the job schedules every hop itself
from domain state, the normative mechanism per [[fleet-webhook-specification]] WH-508:

```php
#[Timeout(30)] // double the 15s worst-case attempt (the total timeout includes connect)
final class DeliverWebhook implements ShouldQueue
{
    /** Counter-driven schedule hop: the next inter-attempt delay is selected
     *  by the Delivery row's authoritative counter — never by the driver's
     *  attempts(); Jitter::apply() multiplies by U(0.9, 1.1). The hop computes
     *  Jitter::apply(SCHEDULE[attempt_count]) EXACTLY ONCE and uses that
     *  single value twice: as the fresh dispatch's ->delay() and as the
     *  next_attempt_at stamp written with the claim clear — so the sweeper's
     *  staleness predicate measures true lateness, never jitter. The hop MUST
     *  NOT use $this->release(): the driver re-queues the ORIGINAL reserved
     *  payload — property mutations during handle() are never re-serialized —
     *  so a release structurally cannot carry the freshly captured counter
     *  the duplicate-job fence requires. A fresh dispatch IS that capture. */
    private function requeueForNextAttempt(): void
    {
        $delay = Jitter::apply(self::SCHEDULE[$this->delivery->attempt_count]);

        // One computation, two consumers: clear the claim and stamp
        // next_attempt_at = now() + $delay, then dispatch with the same $delay.
        $this->delivery->releaseClaim(nextAttemptAt: now()->add($delay));

        self::dispatch($this->delivery->id, $this->delivery->attempt_count)
            ->delay($delay);

        $this->delete(); // this driver job is done; its successor is queued above
    }

    /** Non-authoritative for the deadline VALUE — deadline_at (created_at + 48h,
     *  stamped at creation, checked by the job before every requeue and by the
     *  sweeper) is authoritative — but REQUIRED for the mechanism: throttle and
     *  funnel releases are GENUINE driver releases that can repeat unboundedly
     *  under sustained backpressure, and the fleet's default workers run with
     *  no --tries override (one try), so without retryUntil() the driver fails
     *  a throttle-released job on its second pickup
     *  (MaxAttemptsExceededException). Time-based expiry is what lets the
     *  driver accept unlimited throttle releases; schedule hops are fresh
     *  dispatches and no longer depend on it. The mirror also means a stray
     *  driver retry can never outlive the domain deadline. */
    public function retryUntil(): \DateTimeInterface
    {
        return $this->delivery->deadline_at;
    }
}
```

The `#[Timeout]` keeps [[fleet-queue-doctrine]] §3's invariant — the job timeout stays below
the connection's `retry_after`. Counter-driven re-dispatch is **not a deviation** from that
doctrine's attribute idiom: `#[Backoff]` declares driver-scheduled retry policy, and this job
does not use driver-scheduled retries — it schedules every hop itself from domain state,
because PHP attributes accept only constant expressions and the jittered, counter-selected
delay is computed per hop.

The **Delivery row's attempt counter is authoritative**, not the queue driver's `attempts()`:
throttle releases, sweeper re-dispatches ([[webhook-data-model]]), and worker crashes all touch
the driver's counter without representing a real Attempt. The driver's counter therefore
**never selects a delay** — every hop's delay is computed from the Delivery row's
`attempt_count`, so a polluted driver counter cannot skip the schedule forward or reset it.
The counter is also the **duplicate-job fence**: every dispatch — the initial `afterCommit`
dispatch, a sweeper re-dispatch, and a schedule hop's fresh delayed dispatch — captures the
Delivery's current `attempt_count` into the job payload, and the
atomic claim `UPDATE` ([[webhook-data-model]] owns the claim) additionally requires
`attempt_count = {captured}` — a zero-row match means another job consumed or is consuming
that slot, and the stale twin exits silently without release, so a sweeper-spawned duplicate
that outlives one grace window dies at its first claim after any other job consumes a slot.
**The fence is why the two requeue paths use two different primitives.** A counter-advancing
schedule hop **must not use `$this->release()`**: on every driver, release re-queues the job's
*original* reserved payload — property mutations during `handle()` are never re-serialized —
so a released successor would wake carrying the stale pre-increment counter, match zero rows
at its claim, and exit silently; the schedule would then advance only on the sweeper's
grace-late re-dispatches. The hop therefore dispatches a **fresh delayed `DeliverWebhook`**
carrying the freshly captured counter and deletes the current driver job — a fresh dispatch is
exactly the capture the fence requires. The counter-advancing hop computes
`Jitter::apply(SCHEDULE[attempt_count])` **exactly once** and uses that single value for both
the fresh dispatch's delay and the `next_attempt_at` stamp written with the claim clear
([[webhook-data-model]] outbox step 4 reads the stamp) — the two values are one computation by
construction, so the sweeper's staleness predicate measures true lateness, never jitter. A **throttle or funnel release keeps
`$this->release()`**: it never touches the counter, so the original payload's captured value
is still current and the fence matches healthy throttled work. The
job increments the Delivery counter whenever it writes an Attempt row — a real HTTP try or a
retryable engine-stage failure alike; a throttle release re-queues after its short fixed delay
without consuming a slot. The counter stops at 8, and the job enforces the
**48-hour deadline as a Delivery column**: `deadline_at`, stamped at creation and checked by
the job before every requeue and by the sweeper before every re-dispatch
([[webhook-data-model]]), so job and sweeper share one deadline no matter how often a job is
re-dispatched. `retryUntil()` mirrors that column — non-authoritative for the deadline value,
the last-resort per-job belt, yet **required for the mechanism**: throttle and funnel releases
are genuine driver releases that can repeat unboundedly under sustained backpressure, the
fleet's default `queue:work` invocation runs single-try ([[fleet-queue-doctrine]] §4), and
without `retryUntil()` that driver fails a throttle-released job on its second pickup; the
time-based expiry is what makes unbounded throttle releases acceptable to the driver at all —
schedule hops, being fresh dispatches, no longer depend on it.

`DeliverWebhook::failed()` is specified, not left to the doctrine's blanket `report($e)`: it
terminally fails the Delivery, updates the event rollup and the streak
([[webhook-data-model]]), and emits the structured log line; it calls `report($e)` **only for
unexpected engine exceptions**, never for deadline or receiver-class outcomes — the job records
receiver-class outcomes itself and returns rather than throwing, so they never surface as
queue-level job failures. This is the sanctioned exception to [[fleet-queue-doctrine]] §3's
failure rule, recorded at that rule's owner, and it is what keeps WH-902 true: a dead receiver
is never a Sentry event. Worker count and process supervision are **left to ops** — the spec
constrains the queue name and nothing else. The job class ships in
[`standards/laravel/webhooks/`](../../../standards/laravel/webhooks/) (bundle, future pass).

## Replay

Replay re-delivers a persisted event's frozen envelope as a **new Delivery** with the same
event `id`, rendered through the Webhook's **current** template and signed with the Target's
**current** secret ([[webhook-signing-scheme]]). Every replayed request carries the marker
header `X-Webhook-Replay: true`, and the Delivery row is flagged as a replay in history.

- **Single replay** (one event × one webhook) runs its first attempt **synchronously**, so the
  operator sees the live result in the UI immediately. A retryable outcome hands the remaining
  schedule to the `webhooks` queue like any other Delivery.
- **Bulk replay** (failed or skipped Deliveries in a date range for a Webhook) is **queued**
  end to end — it enumerates matching terminal-failed and `skipped` Deliveries and dispatches a
  fresh Delivery per event through the normal engine. The date range filters on Delivery
  `created_at` — named deliberately, because creation and completion diverge by up to the
  48-hour schedule — and enumeration **deduplicates by event id per Webhook**: at most one
  fresh replay Delivery per event, however many matching terminal or skipped rows fall in the
  range (a failed initial plus a failed earlier replay of the same event yields one replay,
  not two), with `matched` counting distinct events ([[webhook-data-model]] carries the
  counter row). **The progress row's semantics are dispatch-scoped**: status `completed`
  means enumeration and dispatch finished — the spawned Deliveries then live their own
  multi-day schedules; `replayed` counts fresh Deliveries dispatched; `skipped` counts rows
  excluded at enumeration (pruned events and kin); `failed` counts dispatch-time failures
  only. Terminal outcomes of the spawned Deliveries are read from ordinary delivery history,
  never from the bulk-replay row — the row is a progress report on the enumeration, not an
  outcome tracker across the 48-hour tail. **The enumerating job is idempotent across driver
  retries**: every Delivery a bulk replay dispatches is stamped with the row's id in its
  `bulk_replay_id` column ([[webhook-data-model]] owns the column), and the job skips any
  event that already has a `kind = replay` Delivery carrying this bulk-replay row's id —
  deduping against its own prior partial dispatch, and only its own: a concurrent single
  replay or another bulk run carries a different (or null) `bulk_replay_id` and never
  suppresses this run's dispatch — so a re-run after a worker death neither double-dispatches
  nor double-increments, and the `matched`/`replayed` counters converge against the same
  column. And the row cannot stick in `running` forever:
  when the enumeration exhausts its tries, the job's `failed()` stamps the row's **`failed`
  terminal status** (the vocabulary is `queued | running | completed | failed` →
  [[webhook-data-model]]); that `failed()` path — driver retries exhausting into `failed()` —
  is the convergence guarantee that no bulk-replay row outlives a
  bounded staleness window in `running`. It requires the Webhook `active`, exactly like single replay (409
  `webhook-not-active` → [[webhook-management-surface]]) — accepted work against a
  non-active Webhook would only wake to the point-of-work rule and terminate skipped. Its reach
  is bounded by outbox retention ([[webhook-data-model]]).

**Eligibility is a complete matrix.** Single replay is allowed for `failed`, `succeeded`, and
`skipped` Deliveries — skipped mirrors bulk replay, which is how a pause, disable, or
point-of-work skip window heals. A `pending` Delivery is refused with 409
(`webhook-delivery-not-replayable`): work still in
flight is not replayable, and there is deliberately no "attempt now" affordance for it (the
omission is recorded in the spec's considered-and-rejected tail). A `kind = test` Delivery is
refused with 409 for the same reason class — problem type `webhook-delivery-not-replayable`
covers exactly these two causes, pending and test — because the test-fire button is
the re-run, and a replayed test would enter the counters test deliveries are excluded from.
A replay against a non-`active` Webhook is its own problem type, 409 `webhook-not-active`
([[webhook-management-surface]] owns the register).
Bulk replay likewise never enumerates test Deliveries. A Delivery whose event row has been
pruned answers 410 (`webhook-event-pruned`); the pruning invariant that makes this rare is
[[webhook-data-model]]'s.

Because the event `id` is unchanged, a receiver that deduplicates correctly treats an
already-processed replay as a no-op — which is exactly what makes replay safe to offer freely.

## Test-fire and ping

**Test-fire** sends a real, signed HTTP request through the full pipeline. The operator picks an
event type — the picker offers the Webhook's **subscribed types plus `ping`**, never the whole
catalog — may edit the payload values directly (prefilled from the catalog's sample payload,
[[webhook-event-catalog]]), and the engine renders it through the webhook's template and
delivers it with `X-Webhook-Test: true`. The envelope `type` is **unchanged** — no rewrite to a
synthetic ping type, because the entire value of a test is exercising the real template against
the real type. Test deliveries: one synchronous attempt, never retried, flagged as test in
history, excluded from auto-disable counters and success-rate statistics.

**Ping** is the reserved bare event type present in every catalog ([[webhook-event-catalog]]).
A `ping` test-fire **renders through the Webhook's body template with relaxed resolution**: on
the ping envelope's empty payload, a structurally-absent `data.*` substitution path resolves as
null — the null-rendering rules of [[webhook-templating]] then apply — instead of raising
`template_error`. The relaxation is ping-only (the runtime backstop stands for every other
type), so **a ping is never a `template_error`**: its purpose is the pipe, and a template
referencing `data.*` paths must not turn a connectivity check into a rendering failure exactly
where a connectivity check matters most. Ping never enters fan-out; it is only ever sent
directly.

**Target verification** is satisfied by **any successful signed ping delivery to the Target**:
either the bare probe — a signed `POST` of the ping envelope to the Target's base URL, one
synchronous attempt — or a `ping` test-fire routed through any Webhook attached to the Target,
using that Webhook's verb, path, and headers. The first success moves the Target out of
`unverified` ([[webhook-management-surface]]). The widened mechanism matters for receivers that
reject the bare envelope: Slack and Discord 400 anything that is not message-shaped, so their
Targets verify through the template path — a ping renders through the template with relaxed
resolution, so the message shape those receivers demand is exactly what arrives
([[webhook-template-library]]). Webhooks on an
unverified Target sit `paused`, but test-fire is allowed in every lifecycle state, so there is
no chicken-and-egg. Bare-probe outcomes are ephemeral — returned and logged, never persisted;
a verification via test-fire is stored as that test Delivery ([[webhook-data-model]]).

All test and ping traffic passes the egress guards ([[webhook-egress-guards]]) and is signed
normally — there is no "trusted" bypass path, and both consume the per-Target limiter keys
(above).

## Engine request headers

The `X-Webhook-*` namespace is reserved: these headers are engine-set and can never be
overridden by configured headers — enforced twice: save-time validation rejects a configured
header in the reserved namespace ([[webhook-templating]]), and at send time the engine's
values authoritatively replace any reserved-name header that slips through, pinned by a unit
test (defense in depth). At both enforcement points the namespace match is
**case-insensitive** — header names compare case-insensitively per HTTP, so a configured
`x-webhook-test` or `X-WEBHOOK-ID` is as reserved as the canonical casing; a strict prefix
match would wave the forged marker through at save time and fail to replace it at send time.
The pinned unit test for send-time replacement includes a case-variant configured header
among its cases. The inventory:

- **`X-Webhook-Signature`** — every delivery; construction owned by [[webhook-signing-scheme]].
- **`X-Webhook-Id`** — **every delivery, regardless of template or verb**, carrying the
  envelope `id`: the one place a receiver can always find the dedupe key without knowing the
  webhook's configuration. It is a convenience copy, never the only copy — save-time
  validation rejects any configuration with no signed copy of the id
  ([[webhook-templating]]), so the id also always arrives inside the signed material (body,
  path, or query — [[webhook-signing-scheme]]).
- **`X-Webhook-Test: true`** — test-fires only.
- **`X-Webhook-Replay: true`** — replays only.

`X-Webhook-Id` and the two markers are **outside the signed material**; their integrity rides
TLS ([[webhook-signing-scheme]]). Receivers prefer the id from the signed body or query when
present and fall back to the header ([[webhook-receiver-guide]]).

## Observability hooks

Every attempt emits one structured JSON line to stderr — event id, webhook id, target id,
status, duration, attempt number — per the production-logging MUST of
[[fleet-app-specification]].
Sentry receives **engine faults only** (template crash, unexpected exception); a customer
endpoint failing is their news, our log line, and never our alert. The scheduled
failure-rate health check is a spec-level SHOULD; see [[fleet-webhook-specification]].

## Testing obligations

Bootless, branch-complete unit tests pin the backoff math (values, jitter bounds), the retry
taxonomy classifier, and the auto-disable threshold logic. Outbound delivery is asserted with
`Http::fake` in the Feature suite — a legitimate fake for an unmanaged out-of-process dependency
— under the standing `Http::preventStrayRequests()` law. Placement rules →
[[fleet-testing-doctrine]].
