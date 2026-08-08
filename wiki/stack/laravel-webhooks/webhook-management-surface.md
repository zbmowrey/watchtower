---
title: Webhook Management Surface — API, Permissions, Lifecycle, and Reporting
description: Owns the management-plane facts of the fleet webhook system — the /api/v1 endpoint register for Targets, Webhooks, Deliveries, the persisted event stream, replay, test-fire, secret rotation (with the 0–24h overlap parameter), and the recycle bin; the webhooks:manage permission and its guard placement (operator plane where one exists, web guard otherwise), token abilities, policy model, and the /control read plane; the Webhook and Target lifecycle state machines; history, reporting, and CSV-export requirements; audit fields and stderr audit logging; quotas; the generated event-reference SHOULD and in-app failure notifications MAY. HTTP law stays with fleet-api-specification — this page cites API-### IDs rather than restating them. Sister pages own delivery semantics (webhook-delivery-model), entities and retention (webhook-data-model), and the user stories (webhook-product-requirements).
tags: [stack, webhooks, laravel, api, permissions, lifecycle, reporting]
type: stack
status: reference
updated: 2026-08-08
related: [fleet-webhook-specification, fleet-api-specification, webhook-delivery-model, webhook-data-model, webhook-signing-scheme, webhook-product-requirements]
---

# Webhook Management Surface

The management plane of the fleet webhook system: what a webhook manager (and their API tokens)
can see and do with Targets, Webhooks, Deliveries, and Attempts, and what the product must
report.
The normative anchor is [[fleet-webhook-specification]] §6–§7; this page carries the mechanics.
The HTTP surface is an ordinary fleet REST API and inherits every rule of
[[fleet-api-specification]] — this page cites its IDs (API-###) and re-legislates nothing. The
domain vocabulary (Target, Webhook, Delivery, Attempt) and persistence model belong to
[[webhook-data-model]]; retry, replay, and test-fire semantics to [[webhook-delivery-model]].
The React UI's behavior is bound by [[webhook-product-requirements]], never by pixels
(Tier E per [[fleet-frontend-specification]]).

## The management API

Mounted at `/api/v1` (API-201), route-named `api.v1.*`; MT (stancl) apps register the group in
the tenant route file with the same URL shape. Everything below rides the standard fleet stack:
Sanctum bearer auth (API-901), UUIDv7 string IDs (API-405), JsonResource output with wrapping ON
(API-401/402), snake_case fields and RFC 3339 timestamps (API-403/404), problem+json errors
(API-601), the reserved query families with deny-by-default allow-lists (API-501–506), the
fleet `throttle:api` limiter (API-1001), and a Scramble-generated, committed, CI-gated OpenAPI
contract (API-1101/1102). All paths below are relative to `/api/v1`. The **Ability** column is
the one required token ability per route (API-903).

### Targets

| Endpoint | Ability | Purpose |
|---|---|---|
| `GET /webhook-targets` | `webhooks:read` | List Targets. `filter[trashed]=only` lists the Target side of the recycle bin. |
| `POST /webhook-targets` | `webhooks:write` | Create a Target (scheme, host, optional base path, auth mode, throughput settings). 201 + `Location` (API-410). The response carries the signing `secret` — the first of exactly two responses that ever do. Destination validation applies at entry ([[webhook-egress-guards]]). |
| `GET /webhook-targets/{target}` | `webhooks:read` | Show one Target. Never includes the secret. |
| `PATCH /webhook-targets/{target}` | `webhooks:write` | Edit. Changing scheme, host, or base path reverts the Target to `unverified` and system-pauses its active Webhooks (see the state machines below); name/auth/throughput edits preserve state. |
| `DELETE /webhook-targets/{target}` | `webhooks:write` | Soft delete → recycle bin; cascade-soft-deletes the Target's Webhooks ([[webhook-data-model]]). 204. |
| `POST /webhook-targets/{target}/verify` | `webhooks:write` | Fire the bare verification ping — a signed POST of the ping envelope to the Target's base URL. Success → `active` (200 with the resource); failure → 409 problem `webhook-target-verification-failed` with the probe outcome in the detail (the outcome is ephemeral — returned and logged, never persisted → [[webhook-data-model]]). A successful `ping` test-fire through any Webhook on the Target verifies it equally ([[webhook-delivery-model]]). Named limiter `webhook-verify` — a synchronous outbound request to a user-supplied host, the same abuse shape as test-fire. |
| `POST /webhook-targets/{target}/rotate-secret` | `webhooks:write` | Rotate the signing secret. Accepts an optional `overlap` parameter (hours, 0–24, default 24); `overlap: 0` expires the old secret immediately — the documented compromise-response procedure ([[webhook-signing-scheme]]). 200 with the new `secret` (the second and last secret-bearing response) and the overlap expiry timestamp; overlap mechanics → [[webhook-signing-scheme]]. |
| `POST /webhook-targets/{target}/restore` | `webhooks:write` | Restore from the recycle bin (binds trashed rows). The restore counts the Target **and** all cascade Webhooks against both quotas atomically; if either would be exceeded, the whole restore is refused 422 `webhook-quota-exceeded` carrying both counts — no partial restore. Cascade-restore semantics → [[webhook-data-model]]. |
| `POST /webhook-targets/{target}/purge` | `webhooks:write` | Hard delete now, cascading; irreversible. 204. Binds trashed rows only. |
| `GET /webhook-targets/{target}/summary` | `webhooks:read` | The per-Target rollup (see History and reporting). |

### Webhooks

| Endpoint | Ability | Purpose |
|---|---|---|
| `GET /webhook-targets/{target}/webhooks` | `webhooks:read` | List the Target's Webhooks (scoped binding, API-205). `filter[trashed]=only` for the bin view; `filter[status]=` for state chips. |
| `POST /webhook-targets/{target}/webhooks` | `webhooks:write` | Create a Webhook: event selection (explicit types and/or wildcards → [[webhook-event-catalog]]), verb, path extension, query string, headers, content type, optional body template (validation at save → [[webhook-templating]]). 201. Initial state depends on the Target (see state machines). |
| `GET /webhooks/{webhook}` | `webhooks:read` | Show one Webhook (shallow member route, API-204). |
| `PATCH /webhooks/{webhook}` | `webhooks:write` | Edit. Template and token changes — body template, headers, path extension, query string — re-validate at save; 422 with JSON Pointers on bad token paths (API-603). |
| `DELETE /webhooks/{webhook}` | `webhooks:write` | Soft delete → recycle bin. 204. |
| `POST /webhooks/{webhook}/pause` | `webhooks:write` | User-chosen pause. 200. |
| `POST /webhooks/{webhook}/activate` | `webhooks:write` | Activate from `paused` or `disabled` (the manual heal). Guard: the Target must be `active`, else 409 `webhook-target-unverified`. Resets the auto-disable streak to zero ([[webhook-delivery-model]]), so "consecutive" counts from the heal. 200. |
| `POST /webhooks/{webhook}/test` | `webhooks:write` | Test-fire: caller picks an event type — the picker offers the Webhook's subscribed types plus `ping`, never the whole catalog — and MAY supply payload values; a `ping` renders through the template with relaxed resolution (semantics → [[webhook-delivery-model]]). Runs synchronously; 201 with the created, test-flagged Delivery. Named limiter `webhook-test-fire`. Allowed in every lifecycle state — it is the diagnostic tool for the heal path, and on an unverified Target a successful ping test-fire is itself a verification path. |
| `POST /webhooks/{webhook}/restore` | `webhooks:write` | Restore from the bin. 409 `webhook-target-deleted` when the parent Target is itself trashed; quota re-checked. |
| `POST /webhooks/{webhook}/purge` | `webhooks:write` | Hard delete now. 204. |
| `GET /webhooks/{webhook}/summary` | `webhooks:read` | Per-Webhook success-rate and latency summary. |
| `POST /webhooks/{webhook}/repin` | `webhooks:write` | Acknowledge a schema-version drift flag: re-pins the Webhook's `schema_version` to the current global version and clears the flag (lifecycle → [[webhook-event-catalog]]). 200. |

### Deliveries, history, and replay

| Endpoint | Ability | Purpose |
|---|---|---|
| `GET /webhooks/{webhook}/deliveries` | `webhooks:read` | The per-Webhook delivery list. Cursor pagination (API-502 — a write-heavy unbounded set); filters below, plus `filter[event_id]` for the event-to-deliveries pivot. |
| `GET /webhooks/{webhook}/deliveries/export` | `webhooks:read` | Streamed CSV export of the same filtered set. Always `text/csv` — the URL selects the representation, no negotiation: the recorded file-download carve-out to [[fleet-api-specification]] API-701's JSON-only rule. Every cell is neutralized against formula injection (History and reporting, below). Named limiter `webhook-export`. |
| `GET /webhook-events` | `webhooks:read` | The persisted event stream ([[webhook-data-model]]): `filter[type]`, `filter[from]`/`filter[to]`, `filter[test]`. Cursor-paginated, newest first. |
| `GET /webhook-events/{event}` | `webhooks:read` | One event: envelope metadata plus the per-Webhook delivery rollup; `include=deliveries` embeds the fan-out set — the "here is the event, here is everywhere it went" lookup. |
| `GET /deliveries/{delivery}` | `webhooks:read` | One Delivery; `include=attempts` (API-504/505) embeds the attempt set. |
| `GET /deliveries/{delivery}/attempts` | `webhooks:read` | The attempt drill-down rows (masking rules below). |
| `POST /deliveries/{delivery}/replay` | `webhooks:write` | Single replay: runs synchronously, 201 with the new Delivery (same event id, replay-marked; eligibility matrix → [[webhook-delivery-model]]). 409 `webhook-not-active` when the Webhook is not `active`; 409 `webhook-delivery-not-replayable` when the Delivery is `pending` (still in flight) or is a test Delivery; 410 `webhook-event-pruned` when the event row has aged out ([[webhook-data-model]]). Named limiter `webhook-replay`. |
| `POST /webhooks/{webhook}/bulk-replays` | `webhooks:write` | Bulk replay of failed or skipped Deliveries in a date range ([[webhook-delivery-model]]); queued. Requires the Webhook `active`, else 409 `webhook-not-active` with guidance to activate first, matching the single-replay row. 202 + `Location` (API-410). Named limiter `webhook-bulk-replay`. |
| `GET /bulk-replays/{bulk_replay}` | `webhooks:read` | Bulk-replay progress (backed by the `webhook_bulk_replays` row → [[webhook-data-model]]): state (`queued`/`running`/`completed`/`failed`), matched/replayed/failed/skipped counts — a pruned-event row counts as skipped-with-reason. The counters are dispatch-scoped; `completed` means enumeration and dispatch finished, and `failed` that the enumeration itself exhausted its tries; the spawned Deliveries then run their own schedules, and their terminal outcomes are read from ordinary delivery history, never from this row ([[webhook-delivery-model]] owns the semantics and the convergence rule). |

### Catalog, templates, and the recycle bin

| Endpoint | Ability | Purpose |
|---|---|---|
| `GET /webhook-event-types` | `webhooks:read` | The event catalog for the subscription picker and test-fire prefill: wire type, description, payload schema, sample payload — served from the registry ([[webhook-event-catalog]]). |
| `GET /webhook-templates` | `webhooks:read` | The code-defined template library: name, description, verb, content type, applicable event types, required token mappings, target suggestions. Apply-is-copy semantics → [[webhook-template-library]]. |
| `GET /webhook-recycle-bin` | `webhooks:read` | Combined trashed listing (Targets and Webhooks) with `deleted_at`, who deleted (the `deleted_by` stamp → [[webhook-data-model]]), and days until auto-purge. The singular container noun is a deliberate, recorded exception to API-202's plural rule: the bin is one container view, and its contents stay reachable through the two `filter[trashed]=only` list views. |

### Surface-wide notes

- Nested resources use scoped bindings (API-205); member routes are shallow (API-204). The
  `restore`/`purge` routes and the recycle-bin listing bind soft-deleted rows (`withTrashed()`
  on the binding); every other binding excludes them.
- Lifecycle transitions are `POST` to a sub-path (API-202), never a `PATCH` of a status field —
  `status` is read-only in every resource.
- Exactly two responses ever contain a Target secret: Target create and secret rotation. It is
  absent from every subsequent read, list, export, and audit surface, API and UI alike. Both
  secret-bearing responses MUST carry `Cache-Control: no-store`, MUST be excluded from any
  request/response body logging, and MUST NOT be captured by APM body recording — the
  shown-once lifecycle ([[webhook-signing-scheme]]) is only as strong as the quietest capture
  path.
- Named limiters (API-1003): `webhook-test-fire`, `webhook-bulk-replay`, `webhook-export`,
  `webhook-replay`, `webhook-verify`. 429s carry `Retry-After` per API-1002. Synchronous attempts additionally
  consume the per-Target throughput keys ([[webhook-delivery-model]]) — a hot Target cap also
  answers 429 with `Retry-After`, **before any Delivery is created**: the refused request
  leaves no Delivery and no Attempt behind.
- Problem types minted by this surface, under the app's `/problems/` namespace (API-602):
  `webhook-quota-exceeded` (422), `webhook-target-unverified` (409),
  `webhook-target-verification-failed` (409), `webhook-target-deleted` (409, restore refused),
  `webhook-delivery-not-replayable` (409 — a `pending` or test Delivery),
  `webhook-not-active` (409 — replay or bulk replay refused because the Webhook is not
  `active`), `webhook-event-pruned` (410).
  Template validation failures use the standard 422 pointer shape (API-603).
- `Idempotency-Key` (API-307) is not required anywhere on this surface: the delivery model is
  at-least-once and a duplicated replay or test-fire simply creates another visible Delivery.
  Create endpoints MAY adopt it per-app.
- Webhook resources expose their pinned `schema_version`; when the global envelope version moves
  past a Webhook's pin, list and detail views flag the Webhook for review, showing pinned and
  current versions side by side. The flag has exactly one exit: the explicit re-pin
  acknowledgment (`POST …/repin`, above). Ignoring it changes nothing on the wire — the pin
  exists to make drift visible, never to transform payloads (lifecycle →
  [[webhook-event-catalog]]).
- The same flagging treatment covers **stale event selections**: list and detail views flag a
  Webhook whose explicit selection names types absent from the current catalog — the
  subscription is partially dead and silence is the failure mode — and save-time validation on
  edit reports the stale types with a 422 pointer (API-603).

## Permissions, policies, and the admin read plane

- **One permission, on the plane that runs the business.** Webhook management is business
  configuration, so the single permission atom **`webhooks:manage`** lives with those who run
  the business: in apps **with an operator plane**, on the **operator guard**; in apps
  **without one**, with tenant users on the **web guard**. Either way it gates the whole
  management surface (`permission:webhooks:manage` on the route group, per
  [[fleet-app-specification]]'s gate-on-permissions rule). Read is implied for managers; there
  is deliberately no separate view, replay, or rotate permission — the surface is one
  responsibility, held whole or not at all.
- **Two token abilities.** API tokens carry `webhooks:read` and/or `webhooks:write` (the
  API-902 `resource:verb` shape — `webhooks:manage` is a guard permission, not a token
  ability), one per route via `abilities:` (API-903). Both clamp to the `webhooks:manage`
  permission at mint time (API-904): a user who cannot manage webhooks in the UI cannot mint a
  token that can.
  The clamp is **entry control, not the standing gate**: the management API route group carries
  the same `permission:webhooks:manage` gate, re-evaluated against the resolved user's
  *current* permission on every token-authenticated request — revoking `webhooks:manage`
  disables that user's webhook tokens immediately, with no token-revocation sweep.
- **Policies still decide the object.** Abilities gate the token; policies authorize the user on
  every Target, Webhook, Delivery, and bulk-replay row (API-905), enforcing org ownership — or
  user ownership under the no-org carve-out ([[webhook-data-model]]). Policy methods are
  unit-tested as plain functions with one gate canary — which also proves a token whose minter
  has since lost `webhooks:manage` is refused — per [[fleet-webhook-specification]] §10;
  every endpoint opens with the two standing negatives (API-1201).
- **Admin read plane.** Administrators get read-only support visibility on `/control`
  ([[fleet-app-specification]] identity planes), gated by a `webhooks:support` permission on the
  `admin` guard: list and inspect Targets, Webhooks, Deliveries, and Attempts (in MT apps,
  within a selected tenant's context). No mutation routes exist on that plane, and secrets and
  masked header values stay masked there too — support reads history, it does not hold keys.

## Lifecycle state machines

Two small machines. Soft deletion is orthogonal — any state can enter the recycle bin, and
restoration re-enters the machine as described below (mechanics → [[webhook-data-model]]).

### Target: `unverified` → `active`

| From | Transition | To | Actor |
|---|---|---|---|
| — | created | `unverified` | manager |
| `unverified` | verification ping succeeds (`POST …/verify`) | `active` | manager |
| `unverified` | `ping` test-fire through an attached Webhook succeeds | `active` | manager |
| `unverified` | verification ping fails | `unverified` (409, probe outcome surfaced) | manager |
| `active` | scheme / host / base path edited | `unverified` — active Webhooks system-pause | manager |
| any | deleted | recycle bin (cascades to Webhooks) | manager |

Verification is soft: one successful signed ping delivery, ever — the bare base-URL probe *or*
a `ping` test-fire through an attached Webhook ([[webhook-delivery-model]]; receivers that
reject the bare envelope, like Slack and Discord, verify through the template path) — but it
must hold for the *current* address, which is why an address-family edit re-opens it. Restoring
a trashed Target returns it in its pre-delete verification state (the address did not change in
the bin).

### Webhook: `active` / `paused` / `disabled`

| From | Transition | To | Actor |
|---|---|---|---|
| — | created on an `active` Target | `active` | manager |
| — | created on an `unverified` Target | `paused`, reason `target_unverified` (activation blocked until the Target verifies) | manager |
| `active` | `POST …/pause` | `paused` | manager |
| `paused` | `POST …/activate` (guard: Target `active`, else 409) | `active` | manager |
| `active` | auto-disable threshold crossed (thresholds → [[webhook-delivery-model]]) | `disabled` — owner emailed | system |
| `disabled` | `POST …/activate` | `active` (the manual heal; the gap is replayable) | manager |
| `active` | its Target's address edited | `paused` (system-initiated, audit-logged) | system |
| any | deleted (directly or by Target cascade) | recycle bin | manager |
| bin | restored | `paused`, reason `restored` — never straight to `active` | manager |

**Invariant:** a Webhook is `active` only while its Target is `active`. Every transition into
`active` checks it; every event that breaks it on the Target side pauses the Webhooks.

**Serialization.** Every transition asserting a cross-row invariant — verification success
flipping a Target to `active`, `POST /webhooks/{webhook}/activate`, and any Target address
edit — runs in a transaction holding `lockForUpdate` on the Target row, the same pattern as
the quota lock (below): unserialized, a probe success could land after a concurrent address
PATCH and activate a Target for an address never probed, and activate's Target-`active` check
could interleave with an edit that pauses only currently-active Webhooks. **Webhook creation
(`POST /webhook-targets/{target}/webhooks`) and Target soft-delete hold the same lock**: both
run in a transaction holding `lockForUpdate` on the Target row — creation re-checks, after
acquiring the lock, that the Target is not trashed (and reads its state for the initial-state
decision), and the delete cascade enumerates the Target's live Webhooks under that same lock —
because unserialized, a create could commit after a concurrent cascade had already enumerated
"the Target's live Webhooks", minting a live Webhook under a trashed Target and violating
[[webhook-data-model]]'s standing invariant. **`POST /webhooks/{webhook}/restore` holds the
same lock**: it runs in a transaction holding `lockForUpdate` on the parent Target row,
re-checking after acquiring the lock that the Target is not trashed (the 409
`webhook-target-deleted` refusal) before lifting `deleted_at` — unserialized, a restore could
commit after a concurrent cascade had already enumerated the Target's live Webhooks (the
restoring row, still trashed at enumeration time, is neither paused nor stamped with the
cascade's `cascade_id`), leaving an un-trashed Webhook under a trashed Target. Verification success
additionally re-checks that scheme, host, and base path are unchanged since the probe was
rendered (an address stamp compared before the flip) — a success against a stale address
verifies nothing.

Every state flip stamps `state_reason` (`user_paused` | `address_change` | `auto_disabled` |
`target_unverified` | `restored` | `activated`) and `state_changed_at` on the Webhook row
([[webhook-data-model]]) — the queryable columns behind every "when and why" display in the
lists and detail views. Creation on an unverified Target stamps `target_unverified`; a restore
from the bin stamps `restored`; manual activation — and creation straight to `active` on an
`active` Target — stamps `activated`, so flips **into** `active` carry a reason exactly like
flips out of it.

**While not active:** a `paused` or `disabled` Webhook makes no HTTP requests, but matching
events are still persisted (the outbox → [[webhook-data-model]]) and appear in history as
skipped — so activate-plus-replay heals any gap ([[webhook-delivery-model]]). In-flight work
follows the same rule: a delivery job that wakes mid-schedule to a non-`active` Webhook or
Target terminates its Delivery as `skipped` at the point of work ([[webhook-delivery-model]]) —
the same enumerable, replayable bookkeeping as a fan-out-time skip. `paused` is
user-chosen (or system-imposed by an address edit, pending re-verification); `disabled` is
system-imposed by sustained failure and only ever exited manually.

## History and reporting

What the product must show; retention and denormalization guarantees live in
[[webhook-data-model]] (history survives deletion — rows carry the webhook name, target URL,
and event type themselves).

- **Delivery list (per Webhook).** Columns: delivery id, event id and wire type, status,
  attempt count, first/last attempt timestamps, next-retry time while pending, last attempt
  duration, and test/replay flags. Newest first; cursor-paginated.
- **Filters.** `filter[status]`, `filter[event_type]`, `filter[from]` / `filter[to]`
  (RFC 3339 instants), `filter[test]`, `filter[replay]`. Unknown members of the reserved
  families are 400s (API-306/506).
- **Attempt drill-down.** For each Attempt: the request as sent — method, URL, headers, body —
  with every header value sourced from Target auth configuration masked (`Authorization`,
  basic-auth userinfo, the custom secret header). **Ordinary configured header values are
  stored and displayed as sent — only auth-sourced values are masked** — so secrets belong in
  the Target's auth options, never in a plain configured header (the save-time warning that
  steers users there → [[webhook-templating]]). The signature header is shown in full: it is
  derived, not reversible ([[webhook-signing-scheme]]). Bodies are shown unmasked as sent —
  templates resolve against the envelope only and structurally cannot reference secrets
  ([[webhook-templating]]). Plus: response status, captured response snippet (capture cap →
  [[webhook-delivery-model]]), duration in ms, attempt number, and scheduled-vs-actual time.
- **Summary (per Webhook).** Over a caller-chosen window: totals by outcome, success rate,
  p50/p95 latency, and the current consecutive-failure streak — read from the same streak
  column the auto-disable counter increments ([[webhook-delivery-model]]), so the number shown
  and the number that trips disable cannot diverge.
- **Per-Target rollup.** One row per Webhook on the Target — state, success rate, p50/p95,
  last delivery time — plus Target-level totals. This is the "is this integration healthy?"
  screen and the summary endpoint pair in the tables above.
- **CSV export.** Streamed `text/csv` honoring the active filters; stable column set:
  `delivery_id, event_id, event_type, webhook_name, target_host, status, attempts,
  first_attempt_at, last_attempt_at, last_status_code, last_duration_ms, test, replay`.
  Every cell is neutralized against formula injection per OWASP CSV-injection guidance: a value
  beginning with `=`, `+`, `-`, `@`, tab, or carriage return is prefixed with a single quote —
  `webhook_name` and `event_type` are attacker-influenceable text, and the spreadsheet that
  opens the export is a cross-trust-boundary victim ([[webhook-threat-model]]).
  Rate-limited (`webhook-export`); bounded by the retention window by construction. The
  `text/csv` representation is the recorded carve-out to [[fleet-api-specification]] API-701 —
  a URL-selected file download, not content negotiation.

## Audit trail

- **Columns.** Targets and Webhooks (the config entities) carry `created_by` / `updated_by`,
  surfaced in detail views. No activity-log package — this is deliberate
  ([[fleet-webhook-specification]] §6).
- **Log line.** Every config mutation and secret rotation emits one structured stderr JSON line
  (the production-logging MUST → [[fleet-app-specification]]). Event names reuse the catalog's
  `entity.verb` past-tense grammar: `webhook_target.created`, `webhook_target.secret_rotated`,
  `webhook.paused`, `webhook.purged`, and kin.
- **Fields.** `event`, `actor_id` + `actor_plane`, `entity` + `entity_id`, denormalized
  `entity_name` and `target_url` (so the line stays meaningful after a purge), `changed`
  (attribute **keys** only — values are never logged), `occurred_at`. Secret material never
  appears in any audit surface. Every attacker-influenceable field on the line —
  `entity_name`, `target_url`, and kin — is emitted through the structured JSON serializer,
  control characters and quotes escaped, never string-concatenated
  ([[webhook-threat-model]] T-7).

```json
{"event":"webhook_target.secret_rotated","actor_id":"0198a7f2-…","actor_plane":"web","entity":"webhook_target","entity_id":"0198a7c1-…","entity_name":"Billing bridge","target_url":"https://hooks.acme.example/in","changed":["secret"],"occurred_at":"2026-08-08T14:03:22.481902Z"}
```

## Quotas

Defaults per WH-803 ([[fleet-webhook-specification]]): **10 Targets per org, 50 Webhooks per
org** — config tune-points, scoped to the org
(to the user under the no-org carve-out → [[webhook-data-model]]). Enforced at create *and* at
restore; exceeding either renders 422 problem `webhook-quota-exceeded`, and the UI disables the
create affordance with the count shown. The quota check runs **atomically with the insert or
restore** — inside a transaction holding a lock on the org's quota scope (`lockForUpdate` on
the org row, or a per-org advisory lock; in MT apps the lock is a per-tenant advisory lock —
there is no org row in the tenant DB) — because quotas are never schema constraints
([[webhook-data-model]]) and an unlocked check-then-act would admit row eleven of ten under
concurrency. Recycle-bin rows do **not** count toward quota — restore
re-checks (a Target restore counts its cascade Webhooks against both quotas, endpoint register
above). There is deliberately no payload size cap and no fan-out cap (non-rules recorded in
the spec's considered-and-rejected tail); delivery volume is governed instead by the per-Target
throughput controls ([[webhook-delivery-model]]).

## Generated event reference — SHOULD

Each app SHOULD auto-generate a public, Stripe-register webhook event reference from the runtime
registry ([[webhook-event-catalog]]): one entry per event type — wire type, description, payload
schema, copy-pastable sample payload — plus signing and verification instructions in the voice
of [[webhook-receiver-guide]]. The published text **embeds the full construction** — secret
format and verbatim usage, canonical strings, tolerance, comparison — rather than linking
internal pages an external reader cannot open; [[webhook-signing-scheme]] remains the internal
normative source the embed is generated against. The generator is an artisan command in the bundle
([`standards/laravel/webhooks/`](../../../standards/laravel/webhooks/) — bundle, future pass)
and is the Scramble analogue (API-1101's doctrine: code is the contract's source of truth) —
the registry is discovery-built and pinned by test, so the reference structurally cannot drift.
The reference MAY be public (it is the contract, not a secret — the API-1105 distinction) at a
stable path such as `/docs/webhooks`, and the subscription picker SHOULD deep-link each event
type to its entry.

## In-app failure notifications — MAY

Apps MAY surface delivery failures as in-app notifications, **deduplicated by webhook + error
signature**: one open notification per pair, its count updated on repeats, cleared on the next
success or on dismissal, click-through landing on the attempt drill-down. Notifications carry a
status line and a link — never secrets, headers, or response bodies. The auto-disable email is a
separate, non-optional channel ([[webhook-delivery-model]]).
