---
title: Fleet Queue Doctrine (v1 — partitioning, coding, operating, observing)
description: The normative rule set for background work on every fleet Laravel app — how queues are defined and partitioned (and when to shard), how job code is written (thin envelopes over actions, idempotent, attribute-declared retry policy), how workers run in k8s, how queues are observed (age over depth), and how failures are diagnosed. Owns everything queue-shaped; [[fleet-app-specification]] §5 keeps only the boot-time after_commit default.
tags: [ spec, standard, queues, jobs, workers, redis, mandate, laravel ]
type: standard
status: normative
updated: 2026-08-08
related: [ fleet-app-specification, fleet-testing-doctrine, fleet-webhook-specification, actions, laravel-runtime-traps, laravel-runtime-guardrails, observability ]
---

# Fleet Queue Doctrine — v1

The **requirement of record for background work**. Written against Laravel 13's queue surface
(attribute-declared job config, `Queue::route`, debounced jobs, the size-inspection contract
methods). Normative language per [[fleet-app-specification]]: **MUST / SHOULD / MAY /
ACCEPTED-DEVIATION**, deviations recorded there, never silent.

## §1 The four laws

1. **A queue delivers at-least-once. Every handler is idempotent.** Retries, timeouts racing
   `retry_after`, and worker restarts all re-deliver; a handler that can't safely run twice is a
   defect independent of any configuration.
2. **Jobs are envelopes.** The job class carries data + queue policy (attributes); the *logic*
   lives in an [[actions|action]] the job's `handle()` resolves and calls — unit-tested bootless
   per [[fleet-testing-doctrine]]. If a job's `handle()` has branches worth testing, extract.
3. **Partition by latency class and blast radius, never by model.** Queues exist so one slow or
   failing workload can't starve an urgent one — that's the only reason to add one.
4. **Age is the alert; depth is context.** A deep queue draining fast is healthy; a shallow
   queue whose oldest job is twenty minutes old is an outage.

## §2 Topology — defining, partitioning, sharding

- **Backend — MUST:** Valkey/Redis (`redis` driver) for every app that queues. The `database`
  driver is rejected (polling load on the app's own Postgres, table bloat, no blocking pop);
  `sync` is forbidden outside tests and local experiments.
- **Connection config — MUST:** `after_commit: true` (the [[fleet-app-specification]] §5 row);
  `retry_after` **greater than the largest job timeout on that connection** (§3 law below);
  a small `block_for` (1–5s) so workers long-poll instead of hammering.
- **The standard partitions — SHOULD:** start with at most: `default` (user-facing async:
  notifications, small syncs), `heavy` (exports, imports, media, anything minutes-long),
  `outbound` (third-party provider APIs and other non-engine outbound calls — the partition
  that absorbs someone else's outage; webhook-engine deliveries get their own partition,
  below). Add `mail` only when a real incident shows mail competing with
  `default`. **Every added queue is a standing operational cost** (a worker deployment, a
  dashboard row, an alert) — a new partition needs a latency-class or blast-radius argument,
  not a taxonomy itch. Apps shipping the webhook engine mount delivery jobs on a dedicated
  `webhooks` partition per [[fleet-webhook-specification]] WH-508 — the recorded blast-radius
  case.
- **Routing — MUST:** central, via `Queue::route(Job::class, connection: …, queue: …)` in the
  per-domain provider — one file answers "what runs where", exactly like the bindings provider
  answers "what resolves to what". Per-job `onQueue()` scattered through dispatch sites is
  forbidden for standing routes (a dispatch-site override is fine for a one-off priority).
- **Sharding = worker replicas, not more queues.** Redis queues are safe under competing
  consumers; scale a hot queue by raising its worker deployment's replicas. Corollary — **MUST
  NOT depend on ordering**: competing consumers + retries destroy FIFO. A flow that needs strict
  order chains its jobs (`Bus::chain`) or redesigns to idempotent state convergence. (SQS FIFO
  `onGroup()`/`deduplicationId()` exists in 13 but is SQS-only — considered-and-rejected below.)
- **Tenant fairness — SHOULD (multi-tenant apps):** one noisy tenant must not starve the rest.
  First tool: the `RateLimited` job middleware keyed per tenant on the abusable job classes.
  Per-tenant queue *names* are a last resort (unbounded cardinality = unbounded worker/alert
  sprawl) and need an ACCEPTED-DEVIATION entry.

## §3 Coding against queues

- **Payloads — MUST:** constructor takes IDs or DTOs; when a model is captured, `SerializesModels`
  stores the key and **re-fetches fresh state at handle time** — internalize that the handler
  sees *current* state, not dispatch-time state, and a deleted model throws
  `ModelNotFoundException` unless `#[DeleteWhenMissingModels]` says skipping is correct.
  `#[WithoutRelations]` is the default posture on captured models (relation graphs bloat
  payloads and go stale); note collections of models never restore relations by design.
  `ShouldBeEncrypted` **MUST** where a payload carries PII or secrets — the queue is a datastore.
- **Retry policy — MUST be declared on the job, as attributes** (the 13 idiom — policy visible
  at the class head, not buried in properties): fleet defaults `#[Tries(3)]` +
  `#[Backoff([10, 60, 300])]`; `#[Timeout]` per class with the invariant **timeout <
  `retry_after`** — the classic double-processing bug is a 120s job on a 90s `retry_after`
  connection; `#[MaxExceptions]` where releases are expected (lock contention); `retryUntil()`
  for deadline-bounded work. `#[FailOnTimeout]` on jobs where a timeout means "don't retry".
  One recorded exception: the webhook engine's `DeliverWebhook` declares no
  `#[Tries]`/`#[Backoff]` — it schedules every hop itself from domain state, computing each
  jittered delay from its Delivery row's authoritative counter and re-queuing each
  counter-advancing hop as a **fresh delayed dispatch** (a driver release re-queues the
  original payload, which cannot re-capture the advanced counter its duplicate-job fence
  checks), the normative mechanism per [[fleet-webhook-specification]]
  WH-508 (domain-state scheduling, not driver-scheduled retries, so those two attributes do
  not apply) — while `#[Timeout]` and `retryUntil()` are **retained**: the timeout <
  `retry_after` invariant binds it like any job, and time-based expiry via `retryUntil()` is
  what lets §4's default single-try workers accept its throttle path's genuine, unboundedly
  repeatable driver releases (without it, the driver fails a released job on its second
  pickup).
- **Failure is an event, not a table row — MUST:** every job implements `failed(Throwable $e)`
  with at minimum `report($e)` (→ Sentry + the Discord error leg, per spec §5), plus whatever
  compensation the domain needs. A silent `failed_jobs` row is the queue-world equivalent of the
  file log nobody reads. One sanctioned exception: the webhook engine's `DeliverWebhook::failed()`
  reports only unexpected engine exceptions, never deadline or receiver-class outcomes —
  [[fleet-webhook-specification]] WH-902 rules a customer endpoint's failures out of Sentry.
- **Exactly-once-ish dispatch — pick the right primitive:** `ShouldBeUnique` (+ `#[UniqueFor]`,
  `uniqueId()`) **rejects at dispatch** — "one refresh in flight, drop the rest";
  `#[DebounceFor(30, maxWait: 120)]` (13.6+) **collapses at execution, last write wins** —
  "recompute once after the burst settles". They are mutually exclusive; uniqueness does not
  apply inside batches; a debounced job *runs* (rather than being lost) if its cache entry is
  evicted — both degrade safe, neither replaces handler idempotency.
- **Job middleware — SHOULD, by name:** `WithoutOverlapping(...)->expireAfter(<timeout>)` for
  serialized access to an aggregate; `RateLimited` for third-party budgets and tenant fairness;
  `ThrottlesExceptions` as the circuit breaker on flaky providers (pairs with the `outbound`
  partition). Long-running jobs that hold a cache lock refresh it per unit of work
  (`$lock->refresh()`, 13) instead of taking a pessimistic long TTL.
- **Batches/chains:** `handle()` in a batch opens with `if ($this->batch()?->cancelled()) return;`;
  chains carry `->catch()`; batch storage stays on the default connection.
- **Queued closures — MUST NOT** outside local spikes: a serialized closure is invalidated by
  the next deploy mid-flight. Every production job is a named class.
- **Testing:** `Queue::fake()`/`Bus::fake()` only as outgoing-command assertions inside
  legitimate Feature tests ([[fleet-testing-doctrine]] §5); the job's logic is the action's
  bootless unit suite; one wiring smoke proves dispatch→handle→effect where the seam warrants it.

## §4 Operating workers (k8s)

- **One Deployment per queue partition — MUST**, on the `console` image:
  `php artisan queue:work redis --queue=<partition> --max-time=3600 --max-jobs=1000 --memory=<fits pod limit>`.
  The recycling flags are mandatory: a worker is a long-lived PHP process; bounded lifetime is
  the memory-hygiene *and* code-freshness mechanism.
- **Deploys:** the GitOps image roll replaces worker pods — that *is* the fleet's
  `queue:restart`. The standing trap ([[laravel-runtime-traps]] §7) is local/dev: after editing
  a queued class, restart the queue container — the running worker holds the old code.
- **Termination — MUST:** `terminationGracePeriodSeconds` **exceeds the largest `#[Timeout]` on
  that partition**; `queue:work` finishes the in-flight job on SIGTERM. A grace shorter than the
  longest job converts every deploy into a retry (safe only because of §1 law 1 — don't lean on it).
- **Priority inside a worker:** `--queue=high,default` order-lists queues; the fleet prefers
  separate deployments per partition over intra-worker priority except where a partition is too
  small to justify its own pod.
- **Hygiene — MUST:** schedule `queue:prune-failed --hours=168` and (where batches exist)
  `queue:prune-batches` — the scheduler already carries the heartbeat; these ride alongside.

## §5 Observing queues

- **Age + depth exporter — MUST:** a scheduled task (every minute, named like the heartbeat
  entry) reads each partition's `pendingSize()` and `creationTimeOfOldestPendingJob()` — contract
  methods as of Laravel 13, driver-guaranteed — and emits one structured log line / metric per
  partition. Grafana alerts on **oldest-job age** per partition (thresholds per latency class:
  `default` minutes, `heavy` tens of minutes, `outbound` provider-SLA-shaped, `webhooks`
  receiver-SLA-shaped per [[fleet-webhook-specification]] WH-508); depth is a
  dashboard panel, not an alert.
- **Failure visibility:** `failed()`→`report()` makes every failure a Sentry event with the
  Discord leg for storms; a `failed_jobs` row-count growth alert is the belt-and-suspenders.
- **Correlation — SHOULD:** Laravel's `Context` dehydrates into queued jobs automatically —
  request-id set at the HTTP edge flows into every job's structured logs. This is the piece that
  makes "which request queued this?" answerable in Loki ([[observability]]).
- **Liveness canary — MAY** (business-critical queues): a trivial job dispatched every 5 minutes
  whose handler pings a healthchecks.io check — the queue-plane twin of the scheduler heartbeat,
  same inert-when-unset config pattern.

## §6 Troubleshooting — symptom → cause → fix

| Symptom | Likely causes, in order | Fix |
|---|---|---|
| Partition not draining, workers "running" | Worker pods crashlooping (env/image); worker listening on the wrong queue name (dispatch routed to a queue no deployment serves); poison job at head retrying | Check pod status, then `Queue::route` vs deployment `--queue` args; poison job → `#[Tries]` caps it into `failed_jobs`, fix, `queue:retry` |
| Duplicate side effects | `timeout` ≥ `retry_after` (double-processing); non-idempotent handler meeting a legitimate retry | Fix the invariant; make the handler idempotent (§1 law 1) — both, not either |
| Job "never ran" | Dispatched inside a rolled-back transaction (after_commit working as designed); unique lock orphaned by a crashed worker (until `#[UniqueFor]` expires); routed to an unserved queue | Confirm the transaction committed; set/verify `#[UniqueFor]`; routing check as above |
| Handler sees "wrong" data | Expecting dispatch-time state — `SerializesModels` re-fetches at handle time | Pass the values that must be dispatch-time-frozen as scalars/DTOs, not via the model |
| `ModelNotFoundException` storms | Model deleted between dispatch and handle | `#[DeleteWhenMissingModels]` where skipping is correct; otherwise treat as the real bug it is |
| Worker memory creep | Unbounded worker lifetime; static accumulation | `--max-jobs`/`--max-time` recycling (§4); hunt the static per Octane rules |
| Jobs lost at deploy | Grace period shorter than longest job → SIGKILL mid-flight | Raise `terminationGracePeriodSeconds` above the partition's `#[Timeout]` |
| Mutation-test / local runs hammering the queue DB | Orphaned `pest --mutate` children (see [[pest-testing]]) | `pkill` per that page; not a queue defect |

## §7 Considered and rejected

- **Horizon** — supervision, scaling, and dashboards are already owned by k8s Deployments +
  Grafana; Horizon duplicates the supervisor, pins Redis semantics, and adds an authed web UI to
  harden. Its per-job metrics are replaced by §5's exporter + Context logs. **Revisit trigger:**
  worker topology outgrowing "one Deployment per partition" (auto-balancing across many queues),
  or a real need for per-job throughput dashboards Grafana can't derive.
- **Database queue driver** — polls the app's own Postgres, bloats under backlog, no blocking
  pop. Valkey is already fleet infra.
- **SQS (incl. FIFO groups/dedup)** — first-class in 13 (`onGroup`, `deduplicationId`) but buys
  strict ordering at the cost of an AWS dependency the fleet doesn't otherwise carry. Revisit if
  ordering ever becomes contractual; until then §2's "design out ordering" rule stands.
- **Queued closures** — deploy-fragile by construction (§3).
- **Per-model queues** ("emails queue, invoices queue, users queue…") — partitioning by noun
  instead of latency class; produces N queues with identical operational behavior and no
  isolation payoff.
