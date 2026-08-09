---
title: Notifications Standard (v1 — channels, the in-app model, preferences, providers)
description: The normative rule set for notifying a *person* in every fleet Laravel app — the four-channel set (database, broadcast, mail, SMS) and the decision rule for each, the `notifications` table as the durable store with read/archive/delete semantics, the mandated flyout + inbox surfaces, dedupe-key collapsing so event storms don't become notification storms, the per-category preference matrix, and the per-app inert-when-unset provider convention. Queue mechanics defer to [[fleet-queue-doctrine]], websocket mechanics to [[broadcasting-realtime-guidance]], UI architecture to [[fleet-frontend-specification]]; outbound webhooks are a different capability entirely.
tags: [ spec, standard, notifications, laravel, realtime, mail, sms, mandate ]
type: standard
status: normative
updated: 2026-08-08
related: [ fleet-app-specification, fleet-queue-doctrine, fleet-frontend-specification, fleet-webhook-specification, fleet-testing-doctrine, broadcasting-realtime-guidance, laravel-sail ]
---

# Notifications Standard — v1

The **requirement of record for telling a person something happened**. Written against Laravel 13
Notifications on PHP 8.5 / Postgres, delivered into an Inertia + React 19 front end. Normative
language per [[fleet-app-specification]]: **MUST / SHOULD / MAY / ACCEPTED-DEVIATION**, deviations
recorded there, never silent.

**Governs:** the channel set and routing decision (§2), the in-app data model (§3), the mandated UI
surfaces (§4), dedupe (§5), preferences (§6), provider config (§7), testing (§8).

**Does NOT govern — pointers, not restatements:** queue partitioning, job shape, retries and
workers ([[fleet-queue-doctrine]]); websocket transport, channel naming and authorization
([[broadcasting-realtime-guidance]]); React component architecture and the mechanical/expressive
tiers ([[fleet-frontend-specification]]); marketing and lifecycle email ([the growth
corpus](../growth/_index.md) — a different discipline under different consent law); and **outbound
webhooks** ([[fleet-webhook-specification]]).

## §1 The four laws

1. **A notification is addressed to a person. A webhook is addressed to a system.** Never substitutes
   for each other: a notification is preference-gated, human-readable, and lands in a mailbox; a
   webhook is a signed contract with an integrator's endpoint. The webhook engine's own owner-facing
   alerts ([[fleet-webhook-specification]] WH-506, WH-608) are **consumers** of this page — that is
   the whole of the relationship.
2. **The database row is the truth; the broadcast is an accelerator.** Realtime makes the fact
   *arrive fast*; it never makes the fact *exist*. Any design where a missed websocket frame loses
   a notification is a defect.
3. **One Notification class, many channels.** The class owns the fact and its rendering; `via()`
   owns where it goes. A per-channel class hierarchy for one business fact is a modeling error.
4. **Storms are collapsed at the source.** A thousand identical failures are one notification with
   a count, not a thousand rows. Deduplication is the sender's obligation, not the reader's.

## §2 The channel set and the decision rule

Exactly four channels are sanctioned. A fifth needs an ACCEPTED-DEVIATION entry.

| Channel | What it is | When it applies |
|---|---|---|
| `database` | The durable row in `notifications` (§3) — the system of record for the in-app inbox. | **MUST, on every user-facing notification, unconditionally.** If a fact is worth telling a user, it is worth being findable later. This is the only channel that is never preference-gated (§6). |
| `broadcast` | The same fact pushed over the realtime substrate to populate the flyout without a reload ([[broadcasting-realtime-guidance]]). | **MUST accompany `database`** wherever the app runs the realtime substrate. It is a delivery optimization on an already-durable row, never a standalone channel. |
| `mail` | A transactional email via the app's configured provider (§7). | **SHOULD** when the user plausibly is not looking at the app and the fact is actionable or time-sensitive. Preference-gated (§6). |
| `sms` | A text via the app's configured SMS provider (§7). | **MAY**, per app, reserved for genuinely urgent or security-critical facts. Preference-gated (§6). SMS is expensive, interruptive, and unbranded — the bar is "the user would want to be woken up". |

- **Fan-out is `via()` — MUST:** one Notification class returns the channel list for one notifiable,
  resolved through the single first-party preference resolver (§6) — never hand-rolled preference
  or config checks per class.
- **`ShouldQueue` — MUST:** every Notification class is queued; all queue law
  ([[fleet-queue-doctrine]]) applies unchanged and is not restated. One notification-specific ruling:
  since one queued job carries all of a notifiable's channels, the provider-dependent ones **MUST**
  be split with `viaQueues()` — `database`/`broadcast` on `default`, `mail`/`sms` on `outbound` — so
  a provider outage cannot delay the inbox row §1 law 2 makes authoritative. Handlers are queue
  handlers: law 1 there binds them, and §5's key makes a re-delivered send converge, not duplicate.

## §3 The in-app data model

The `database` channel writes Laravel's published `notifications` table. The fleet shape extends it;
the extensions are normative.

- **Columns — MUST:** the published `id` (UUID), `type`, `notifiable_type`/`notifiable_id`, `data`,
  `read_at`, timestamps, **plus** `archived_at` (nullable timestamp) and `dedupe_key` (nullable
  string, §5). `data` **MUST** be `jsonb` on Postgres, not the published `text` — the inbox filters
  and searches inside it.
- **The `data` contract — MUST:** every `toArray()` returns at minimum
  `{ title, body, url, category, severity }`, plus whatever the type needs. This is what lets one
  flyout item and one inbox row render *any* notification without a per-type React branch; a payload
  that only makes sense to a bespoke component has failed the contract.
- **Three states, two timestamps.** Unread = `read_at` null; read = `read_at` set; archived =
  `archived_at` set. **Ruling: archiving MUST also set `read_at` if unset** — "archived but unread"
  is a state no user can reason about and a badge count cannot honestly express.
- **Archive is a user-facing state, not a lifecycle stage — MUST** be that nullable timestamp: not a
  boolean, not a separate table, not `SoftDeletes`. Archived rows stay in the same table, excluded
  from the default inbox scope; "Archived" is a filter, not a different query path.
- **Delete is a real delete — MUST.** The inbox is a mailbox, not an audit log: the durable record of
  the fact is the domain event and the structured log ([[fleet-app-specification]]), while the
  user's *copy* is theirs to destroy. Clearing a copy is not retracting the fact.
- **Retention — SHOULD:** a scheduled prune of read-or-archived rows past an app-configured age
  (default 180 days) alongside the queue doctrine's hygiene tasks; unread rows are never pruned.
- **Indexes — MUST:** the published notifiable index, plus a partial index on the unread scope
  (`WHERE read_at IS NULL`) — the badge count runs on every page load and MUST NOT scan the mailbox.
- **Search — MUST stay in Postgres:** an `ILIKE`/expression-index query over `data->>'title'` and
  `data->>'body'` — a per-user mailbox is a few thousand rows; a search service is over-engineering.
- **Reconciliation — MUST:** the broadcast payload carries the row's `id` and the same `data`
  shape, so the flyout renders without a fetch and the client reconciles **by `id`** on the next
  page load. A broadcast-only item with no row id is a bug, not an optimization.

## §4 The two mandated UI surfaces

Both are **Tier E expressive** per [[fleet-frontend-specification]] §1 — look, motion, and copy are
each app's own. Mandated is that they exist and what they can do.

- **The flyout — MUST:** an animated panel anchored to the app chrome, populated in realtime from the
  broadcast channel and seeded on load from the unread scope; it shows recent unread items, supports
  inline mark-read, and links each item through to its `url`.
- **The inbox — MUST:** a paginated page over the same rows with **filter** (category, read state,
  archived), **search** (§3), **mark read/unread**, **archive**, **delete**, and bulk selection for
  all four. This is the surface that makes §1 law 2 pay off.
- **The unread badge — MUST NOT be polled.** It is a shared Inertia page prop, adjusted by the
  broadcast tick and re-seeded on each visit; a `setInterval` fetching a count is the anti-pattern
  the realtime substrate exists to remove.
- **Realtime wiring — MUST** route through a single shared `hooks/use-*` per
  [[fleet-frontend-specification]] §2/§3, never a copy-pasted `useEffect` per surface. Subscription,
  channel naming, auth, and reconnect behavior are [[broadcasting-realtime-guidance]]'s.
- **Flash toasts are not notifications.** `use-flash-toast` is one-shot feedback on *the request the
  user just made* — ephemeral, no row. Never render a durable notification as a toast-only artifact;
  never persist a flash message into `notifications`.

## §5 Dedupe and debounce — the key + window convention

- **`dedupeKey()` — SHOULD on every class whose trigger can repeat**, a stable
  `<domain>.<event>:<subject-id>` string (e.g. `webhook.delivery-failed:<uuid>`) persisted to the
  row's `dedupe_key`; `null` opts out. **`dedupeWindow()` — SHOULD** alongside it: how long a repeat
  collapses for.
- **Collapse semantics — MUST:** within the window a repeat **updates the existing open row** (touch
  `updated_at`, increment an occurrence counter in `data`) instead of inserting. If the match is
  already read or archived a **new** row is created — the user dealt with it, so a recurrence is news.
- **Enforced before send, not inside a channel — MUST.** Dedupe runs in the first-party dispatch seam
  ahead of `Notification::send`, because suppressing a duplicate must suppress the *mail and SMS legs
  too*, not merely skip an insert. Dedupe as a database-channel concern silently ships duplicate mail.
- **The database backstop — MUST:** a Postgres **partial unique index** on
  `(notifiable_type, notifiable_id, dedupe_key) WHERE read_at IS NULL AND archived_at IS NULL` —
  "at most one open row per key per recipient", enforced where a race cannot argue with it.
- **Burst collapsing is the queue's job**, not a second mechanism here: the queue doctrine's
  `#[DebounceFor]` on the sending job lets a storm settle before one notification is produced. Key
  dedupe and job debouncing compose; neither replaces the other.

## §6 Preferences — the per-category opt-out matrix

- **Category, not class — MUST:** every Notification declares `category()` (a per-app backed enum —
  the vocabulary is each app's own) and `isCritical(): bool`; preferences are expressed per
  **category × channel**, never per class.
- **The in-app store is never gated — MUST.** The `database` row is always written; what a user can
  mute is the **interruption**, not the record. A muted category still lands in the inbox and still
  appears in search; it simply does not raise the flyout. This is what keeps the inbox honest.
- **`mail` and `sms` are gated — MUST**, per category, resolved as: user preference if a row
  exists, else the category default from `config/notifications.php`.
- **Critical overrides preference — MUST:** a notification declaring `isCritical()` ignores
  preferences on every channel its `via()` names. Account security, credential changes, and
  destructive-action confirmations are not opinions to mute.
- **Storage — MUST:** a `notification_preferences` table keyed `(user, category)` with nullable
  per-channel booleans. **Absent row means "the config default"** — never backfill rows at user
  creation, so changing a default actually reaches everyone who never expressed an opinion.
- **The resolver is one seam — MUST:** a single first-party service answers "which channels for this
  notification and this notifiable", consumed by `via()`. Preference logic MUST NOT be duplicated
  into notification classes, controllers, or the settings UI.

## §7 Providers and configuration

- **Provider choice is per-app, not a fleet mandate.** Mail goes through **a transactional email
  provider (Postmark/SES-class)**; SMS through **an SMS provider (Twilio-class)**. This page
  mandates the *shape* of the integration, never the vendor.
- **env → config, always — MUST:** driver and credentials are read in `config/mail.php` /
  `config/notifications.php`; application code MUST NOT call `env()`, and provider secrets follow
  the fleet secrets law ([[fleet-app-specification]]).
- **Inert when unset — MUST:** with no credentials configured the channel **drops out of `via()`**
  and emits one structured log line. It MUST NOT throw and MUST NOT fail the queued job — a missing
  provider degrades a notification to its remaining channels (the `database` row always survives).
  Same pattern as the scheduler heartbeat and the queue liveness canary
  ([[fleet-queue-doctrine]] §5).
- **Local development — MUST:** the Sail stack's **Mailpit** (Mailhog-class) captures all outbound
  mail for developer review ([[laravel-sail]]) — no app ever needs live provider credentials to
  develop or run its suite. Non-production also carries the `Mail::alwaysTo` redirect guard of
  [[fleet-app-specification]] §5. SMS has no local capture appliance; the local and CI default is a
  log/null driver, which inert-when-unset already produces for free.
- **Exposure over the REST API — MAY:** an app serving its inbox to a client outside Inertia
  conforms to [[fleet-api-specification]] like any other resource; nothing here overrides it.

## §8 Testing

- **`Notification::fake()` is an outgoing-command assertion**, legitimate only inside a real Feature
  test at a genuine boundary — never as a whole-test substitute for testing the decision
  ([[fleet-testing-doctrine]] §5).
- **The decision is a bootless unit.** Which channels apply, whether a dedupe key matches, whether a
  category is muted, and what `toArray()` renders are pure logic over plain objects — tested without
  the framework, per [[fleet-testing-doctrine]] §2/§3.

## §9 Troubleshooting — symptom → cause → fix

| Symptom | Likely causes, in order | Fix |
|---|---|---|
| Flyout shows it; a reload loses it | `via()` returned `broadcast` without `database`; broadcast payload carried no row id | Restore the §2 pairing — broadcast never ships alone (§1 law 2) |
| Duplicate inbox rows for one incident | No `dedupeKey()`; key varies per occurrence (timestamp/attempt embedded); partial unique index missing | Stabilize the key on the *subject*, not the occurrence; add the §5 index |
| Duplicate emails despite a deduped inbox | Dedupe implemented inside the database channel | Move it to the pre-send seam (§5) |
| Inbox row appears minutes after the event | `mail`/`sms` sharing a partition with the durable channels behind a slow provider | Split with `viaQueues()` (§2); partition law → [[fleet-queue-doctrine]] |
| Badge count wrong or expensive | Polled instead of broadcast-driven; unread partial index missing | §4 badge rule; §3 index |
| Archived items still counted unread | Archive path didn't set `read_at` | §3 — archive implies read |
| A security notice never reached the user | `isCritical()` not declared, so the preference gate applied | §6 |
| SMS throws in local or CI | Provider config not inert-when-unset | §7 |

## §10 Considered and rejected

- **Toast-only in-app notifications (no durable store)** — a notification the user was away for never
  existed, and support can't see what a user was told. Store-first, interrupt-second (§1 law 2, §4).
- **A hosted notification-inbox service or drop-in package (Novu-class)** — a second source of truth
  for a table Laravel already ships, plus a vendor in the path of security notices; the fleet's
  inbox is one migration and two React surfaces. **Revisit trigger:** cross-app inboxes, or a push
  fleet-out that makes routing infrastructure a real problem rather than a purchase.
- **Polling for the unread count** — per-user constant load for a number that is usually unchanged;
  the realtime substrate exists precisely to delete this (§4).
- **A separate `archived_notifications` table** — turns a state change into a cross-table move and
  every "all notifications" query into a union, for no isolation benefit (§3).
- **Soft-deleting notifications** — conflates "the user cleared their copy" with "the fact is
  retracted"; the audit record belongs to the domain event and the log, never a mailbox row.
- **Per-notification-class preference toggles** — cardinality grows with every feature, and a
  settings page with forty switches is not a preference UI. The category is the unit (§6).
- **Push channels (web push / APNs / FCM)** — deferred, not condemned: credential lifecycle,
  per-platform delivery semantics, and a device registry the current surfaces don't need. **Revisit
  trigger:** a fleet app shipping a mobile client, or a real wake-them-when-closed requirement.
- **Reusing the operator error channel (the Discord leg) as a user notification channel** — that leg
  is operator-facing alerting per [[fleet-app-specification]] §5; overloading it mixes customer
  messages into an on-call stream and makes both worse.
