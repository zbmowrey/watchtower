---
title: Fleet Webhook Specification (v1 — the outbound webhook rule of record)
description: The requirement of record for outbound webhooks in fleet Laravel apps — event taxonomy and catalog, domain model and outbox persistence, templating and the template library, HMAC signing and egress guards, the at-least-once delivery engine, the management API and React UI, tenancy and quotas, observability and retention, testing obligations, and what the opt-in bundle will contain. Ratified 2026-08-08 from a full maintainer interrogation plus industry prior art (Stripe, GitHub, Svix); Stripe's webhook DX and documentation quality is the explicit bar. Depth lives in the laravel-webhooks corpus; the sister specs (fleet-api-specification, fleet-app-specification, fleet-testing-doctrine) own the API mechanics, operational law, and test placement this page points at instead of restating.
tags: [spec, standard, webhooks, laravel, mandate]
type: standard
status: normative
updated: 2026-08-08
related: [fleet-app-specification, fleet-api-specification, fleet-queue-doctrine, fleet-testing-doctrine, fleet-frontend-specification, webhook-event-catalog, webhook-data-model, webhook-templating, webhook-template-library, webhook-signing-scheme, webhook-egress-guards, webhook-threat-model, webhook-delivery-model, webhook-management-surface, webhook-product-requirements, webhook-receiver-guide]
---

# Fleet Webhook Specification — v1

The **requirement of record** for outbound webhooks in fleet Laravel apps: how a business fact
becomes an HTTP call to a system you do not control. Sister to [[fleet-api-specification]]
(which owns the HTTP management surface's mechanics — IDs, wrapping, problem+json, token
abilities, OpenAPI), [[fleet-app-specification]] (identity planes, secrets law, runtime
guardrails), [[fleet-queue-doctrine]] (background-work law — queue topology, job shape,
workers), and [[fleet-testing-doctrine]] (test placement and the unit-first boundary). This
page deliberately restates none of them — it points. What it owns is the webhook capability
itself: the event taxonomy and catalog, the domain model, templating, signing and egress
security, the delivery engine, the management surface, tenancy and quotas, observability and
retention, and what the opt-in bundle will contain.

**Provenance.** Ratified 2026-08-08 from a full maintainer interrogation plus industry prior
art — Stripe (the explicit DX and documentation bar), GitHub, and Svix — **not** from any
shipped fleet surface. Where a future implementation disagrees with this page, the
implementation converges to the page, never the reverse. Deep reference for every section →
[the webhook corpus](../stack/laravel-webhooks/_index.md).

## §0 Scope, doctrine, and conformance

- **Governs:** the outbound webhook capability end-to-end — event taxonomy and catalog (§1),
  domain model and persistence (§2), templating and the template library (§3), security (§4),
  the delivery engine (§5), the management API and permissions (§6), UI requirements (§7),
  multi-tenancy and quotas (§8), observability and retention (§9), testing obligations (§10),
  and the contents of the opt-in bundle (§11).
- **Does NOT govern (deliberately free):** which business facts an app emits — the event
  vocabulary is each app's own; UI look-and-feel beyond §7's requirements (Tier E,
  [[fleet-frontend-specification]]); namespace layout ([[fleet-app-specification]] A-04 — this
  page names capabilities and normative class/interface surfaces, never directory shapes);
  worker sizing and ops topology (§5); and the existing **inbound** webhook machinery
  ([[cashier-paddle-integration]] et al.), which is unaffected by everything below.
- **Out of scope in v1 — explicitly.** Inbound webhook receiving is simply **out**: this spec
  is outbound-only. **Deferred** (may return when needed): non-HTTP channels (email,
  Slack-app, queue-to-queue — Slack and Discord are served today as plain HTTP targets via
  templates, WH-307); mTLS and OAuth2 client-credentials auth to targets; PII/sensitivity
  flags on event types. **Rejected** (see the tail): user-authored transformation scripting,
  batch/digest delivery, payload size caps. **Non-goals, stated as such:** exactly-once and
  ordered delivery — the contract is at-least-once, best effort (WH-502).
- **Applies to (opt-in posture):** every fleet Laravel app **that ships outbound webhooks** —
  if you build the capability, you build it this way. No conformance check forces an app to
  adopt webhooks; an app without the capability owes this page nothing. This spec is the first
  pass: it normatively defines the bundle's contents (§11) even though the bundle code lands
  in a later pass.
- **Normative language:** **MUST / MUST NOT / SHOULD / MAY** per RFC 2119;
  **ACCEPTED-DEVIATION** = a justified departure recorded in §12, never silent. Rules carry
  citable IDs (`WH-###`); the hundreds digit is the section.
- **Deviation policy:** identical to [[fleet-app-specification]] — if a control breaks an app,
  refactor the app so the control holds; never weaken the control. A security-relevant
  deviation is additionally risk-registered per [[security-governance]].
- **Enforcement:** conformance mechanisms are aggregated in §10 and named inline where a
  specific pin exists (arch test, pinned unit test, CI gate); the future
  [`standards/laravel/webhooks/`](../../standards/laravel/webhooks/) bundle (§11, bundle,
  future pass) is the reference implementation adopting apps copy from and MUST be kept at the
  values below; departures live only in §12.
- **The doctrine:**
  1. **Stripe is the bar.** The webhook DX and its documentation are held to Stripe's
     standard — the industry's reference implementation. Systems that work like it and read
     like it are the point, not a nice-to-have.
  2. **Facts, not intents.** Events are past-tense statements snapshotted at emission (WH-101,
     WH-107); retries and replays re-deliver the fact exactly as it occurred.
  3. **Honest semantics.** At-least-once, best effort, unordered — printed on the tin
     (WH-502), never discovered in production.
  4. **Zero-config first.** A Webhook with no template delivers the standard envelope
     (WH-305); templating is power layered on top, and it is tokens, never code (WH-301).
  5. **Relax nothing on egress.** Every Target URL is user input aimed at our HTTP client; the
     full SSRF guard set applies, always (WH-405).
  6. **One vocabulary.** Target, Webhook, Delivery, Attempt (WH-201) — in the schema, the API,
     the UI copy, and the docs.

---

## §1 Event taxonomy & catalog

Deep reference → [[webhook-event-catalog]].

| ID | Rule |
|---|---|
| WH-101 | Every emitted business fact is a dedicated event class named `{Entity}{PastTenseVerb}Event` — `InvoicePaidEvent`, `ServiceRequestedEvent`. Names are **past tense only**: webhooks announce facts, never intents; `started`/`completed` pairs are the sanctioned shape for long-running operations. The suffix is arch-test-enforced (`toHaveSuffix('Event')`, WH-1005). |
| WH-102 | The wire type is dot-notation `entity.verb` with snake_case entities — `invoice.paid`, `service_request.created` — Stripe-style. It is derived **mechanically** from the class name, never hand-declared, and the derivation is **pinned by a unit test** (WH-1003) so class name and wire name structurally cannot drift. |
| WH-103 | The event catalog is built at runtime by **reflection discovery of concrete event classes bearing the `#[WebhookEvent]` attribute** (description, payload-schema reference, sample payload) and **MUST be cached in production via an artisan command** — the `event:cache`/`route:cache` pattern. The registry powers the subscription-picker UI, wildcard resolution, test-fire samples, and the generated docs, and is pinned by test (WH-1003). The attribute's normative constructor surface → [[webhook-event-catalog]]. |
| WH-104 | Subscriptions **MAY use wildcards** — `invoice.*` and the bare `*` — resolved against the catalog **at dispatch time**, so a wildcard subscription picks up newly added event types with no user action. |
| WH-105 | The envelope — the internal carrier **and** the default delivery body — is `{id, type, schema_version, occurred_at, data}`: a UUIDv7 event id, the wire type, the global schema version, an RFC 3339 UTC `Z` timestamp, and the payload object. It **MUST NOT** carry a tenancy field — tenancy is handled by scoping (§8), never by the payload. Field-by-field contract → [[webhook-event-catalog]]. |
| WH-106 | `schema_version` is **global to the envelope**: additive payload changes never bump it; breaking changes bump it; a Webhook **pins the version current at its creation**. This is the additive-only doctrine of [[fleet-api-specification]] API-802 applied to the fleet's other contract surface. |
| WH-107 | Payloads are a **snapshot at emission**: the event captures a frozen payload DTO ([[data-transfer-objects]]) at the moment the fact occurs. Retries and replays are therefore deterministic; staleness relative to the live record is by design, not a bug. |

---

## §2 Domain model & persistence

Deep reference → [[webhook-data-model]].

| ID | Rule |
|---|---|
| WH-201 | The vocabulary is locked and used everywhere, UI copy included. A **Target** is the receiving system: scheme + host + optional base path, plus auth/signing configuration and its secrets. A **Webhook** is a subscription belonging to one Target: event selection (explicit list and/or wildcards), path extension, query string, HTTP verb, headers, body template, content type, state. A **Delivery** is the attempt-set for one event × one webhook. An **Attempt** is a single HTTP try within a Delivery. Entity contracts + ERD + table naming → [[webhook-data-model]]. |
| WH-202 | Cardinality: one Target has many Webhooks; a Webhook subscribes to many event types; one event **fans out to every matching Webhook**, with **no fan-out cap**. |
| WH-203 | Emitted events are **persisted** as outbox-style `webhook_events` rows. Deliveries are child rows referencing the event row, and the event row carries an **aggregate delivery rollup** — fan-out is one-to-many, so per-delivery status lives on the Delivery and the summary on the event. |
| WH-204 | Transactional integrity is **outbox-lite**: the event row is written in the **same DB transaction** as the business change; delivery jobs dispatch **`afterCommit`**; a scheduled sweeper re-dispatches pending Deliveries whose next attempt (or claim) is stale past a grace period — at any point in the schedule, the crash-window belt. Mechanics → [[webhook-data-model]]. |
| WH-205 | Events dispatch from [[actions]], never from Models — existing fleet law, unchanged. Apps **MUST NOT** hand-write per-event listeners: the engine registers **one subscriber**, auto-wired from the registry, that performs the outbox write and fan-out for every `#[WebhookEvent]` class. |
| WH-206 | Public identifiers are **UUIDv7 exposed as JSON strings** — [[fleet-api-specification]] API-405 applies unchanged to every webhook entity and to the envelope `id`. |
| WH-207 | Soft deletes are **mandatory** for Targets and Webhooks, with recycle-bin functionality (list, restore, purge) and **auto-purge after 30 days** (config tune-point) via a scheduled command. Purge and hard delete **cascade**; soft-deleting a Target cascade-soft-deletes its Webhooks. Cascade-restore semantics → [[webhook-data-model]]. |
| WH-208 | History and audit rows **denormalize names and key data** — webhook name, target URL, event type — so deletes never orphan log data: a delivery record stays legible after its Webhook is purged. |

---

## §3 Templating & the template library

Deep reference → [[webhook-templating]], [[webhook-template-library]].

| ID | Rule |
|---|---|
| WH-301 | The token language is `{{ dot.path }}` resolved against the envelope — `{{ data.invoice.total }}`, `{{ type }}`, `{{ id }}` — plus a **small formatter set** (`{{ occurred_at \| date:'Y-m-d' }}`; date/number/string basics) and **Mustache-style sections** for conditionals and iteration over arrays. **No user-authored code, ever**: no JS, no expressions beyond formatters and sections. Normative grammar + the exact formatter set → [[webhook-templating]]. |
| WH-302 | Tokens apply in all four render surfaces: request body, header values, path extension, and query string. |
| WH-303 | Content type is declared per Webhook: JSON (the default), `application/x-www-form-urlencoded`, or raw text — XML consumers use raw. |
| WH-304 | The verb/body matrix is fixed: GET and DELETE are **bodyless** (tokens in path/query/headers only); POST, PUT, and PATCH carry the body; HEAD and OPTIONS are **unsupported**. |
| WH-305 | No template configured is the **zero-config path**: POST/PUT/PATCH deliveries send the standard envelope (WH-105) as-is. Templates are an override, never a requirement. |
| WH-306 | Templates are validated **at save time** against the event type's payload schema — unknown token paths are rejected at entry. Save-time validation additionally **REJECTS** any configuration in which no signed copy of the event id exists: an **unconditional, formatter-free** `{{ id }}` token must appear in the body template (outside every section), path extension, or query string — all three sit inside the signed material on every verb (WH-401); a section-guarded or formatter-piped id does not count, and the unsigned `X-Webhook-Id` header does not satisfy the rule. The runtime backstop: an unresolvable token at delivery time fails the Delivery with a template error visible in history, is **NOT retried** (it cannot self-heal), and is logged. Rules → [[webhook-templating]]. |
| WH-307 | The template library is **code-defined**: template classes implement the fleet template interface — name, description, verb, headers, body template, applicable event types, required token mappings, and optional **target suggestions** (e.g. a `hooks.slack.com` host hint), which are hints only and always overrideable. Discovery and registration mirror the event registry (WH-103). The bundle ships generic templates — Slack incoming-webhook, Discord, generic JSON — and each app adds integration-specific ones. The interface's normative method surface + the shipped set → [[webhook-template-library]]. |
| WH-308 | Applying a template is a **copy**: it stamps initial values, the user edits freely, and later template updates **never mutate existing Webhooks**. |

---

## §4 Security

Deep reference → [[webhook-signing-scheme]], [[webhook-egress-guards]], [[webhook-threat-model]].

| ID | Rule |
|---|---|
| WH-401 | Every delivery is signed **HMAC-SHA256** with a per-Target secret over a **single effect-bound, newline-delimited construction for every verb** — `{timestamp}\n{METHOD}\n{request_target}\n{raw_body}`, one join on `"\n"`, the body segment empty for bodyless requests — carried in the `X-Webhook-Signature` header; rotation overlap sends multiple signature values. Binding the method and request target inside the MAC closes cross-endpoint and cross-verb replay under a shared Target secret; the newline join makes the construction **injective** (the timestamp is digits, the method uppercase letters, a request target cannot contain raw CR/LF per RFC 3986, and the body is the final field — no field-boundary splice exists), and one construction leaves no bodied/bodyless ambiguity. The normative segment definitions, header grammar, receiver timestamp tolerance, and constant-time comparison → [[webhook-signing-scheme]]. |
| WH-402 | Signing secrets are **per Target**, generated **server-side only** (never user-supplied): 32 random bytes, presented once as a `whsec_`-prefixed string whose ASCII bytes — never the raw 32 — are the HMAC key, per [[webhook-signing-scheme]]; **shown once** at creation and on rotation, stored via encrypted cast, and **never retrievable afterward** through any surface, API or UI. |
| WH-403 | Rotation is an explicit action with an **overlap parameter (0–24 hours, default 24)** during which both old and new secrets sign every delivery, so receivers rotate without dropping a request. **Overlap 0 — immediate expiry of the old secret — is the documented compromise-response procedure.** Mechanics → [[webhook-signing-scheme]]. |
| WH-404 | Additional per-Target auth options — static bearer token, basic auth, arbitrary custom secret header — are all **encrypted at rest**. mTLS and OAuth2 client-credentials are deferred (§0), not configurable. |
| WH-405 | Egress **relaxes nothing**: HTTPS only in production (HTTP permitted only in local/dev via config); resolution to private/reserved ranges is blocked (RFC 1918, loopback, link-local, cloud metadata, and kin); **DNS-resolution pinning** at request time — resolve, validate, connect to the validated IP; **redirects are never followed**; port 443 only in production — in local/dev, while the `webhooks.egress.allow_local` carve-out is enabled, the allowed ports are the `webhooks.egress.local_ports` list (default `[80, 443]`), a key never consulted in production; raw-IP hosts denied. Guards run at save time as feedback and **authoritatively on every attempt**, fail-closed across every resolved address. The normative guard list + the config-gated local-dev carve-out → [[webhook-egress-guards]]. |
| WH-406 | Secrets configuration follows fleet law unchanged ([[fleet-app-specification]]): config-layer only — no `env()` outside config files — delivered as a `.env` fragment + k8s Secret injection, **inert when blank**. |
| WH-407 | Target verification is **soft**: a test ping MUST succeed once before any Webhook on that Target can activate. An unverified Target can be fully configured but delivers nothing. |
| WH-408 | The threat model is a maintained **STRIDE table** mapping each mitigation to the layers of the fleet's [[defense-in-depth-model]] → [[webhook-threat-model]]. |

---

## §5 Delivery engine

Deep reference → [[webhook-delivery-model]].

| ID | Rule |
|---|---|
| WH-501 | The engine is **bespoke and spec-defined**, built on Laravel queues (queue law → [[fleet-queue-doctrine]]) and the `Http` facade. Third-party webhook-delivery packages **MUST NOT** be substituted (see Considered and rejected). |
| WH-502 | Delivery semantics are **at-least-once, best effort, unordered**. Exactly-once and ordering are explicit **non-goals** — we cannot control external systems. The envelope `id` (WH-105) is the receiver's dedupe key. |
| WH-503 | The retry schedule is **8 attempts** spanning roughly 1.7 days, exponential with jitter, **non-configurable in v1**. The full interval schedule and the counter-driven re-dispatch mechanics (WH-508) → [[webhook-delivery-model]]. |
| WH-504 | Retry taxonomy: **retry** on 429, 5xx, and network errors/timeouts; **every other 4xx is terminal**; 3xx is terminal — redirects are never followed (WH-405). Success is **any 2xx**. Classification detail → [[webhook-delivery-model]]. |
| WH-505 | Timeouts are fixed: **5s connect, 15s total**. The response read **MUST** be bounded at the socket (default **64KB**, tune-point `webhooks.delivery.response_read_cap_kb`) and transparent content decompression **MUST** be disabled — the memory-exhaustion defense of [[webhook-threat-model]] D-5. The **16KB** history capture is a storage cap layered on top, not the read bound; the remainder is discarded. Mechanics → [[webhook-delivery-model]]. |
| WH-506 | Auto-disable: after **20 consecutive terminal-failed Deliveries** OR **3 days all-failing** (both config tune-points), the Webhook flips to `disabled`; the owner (recipient definition → [[webhook-delivery-model]]) is notified via the app's normal mailer; re-enable is **manual**. While disabled, events are still recorded in the outbox, so re-enable plus replay heals the gap. |
| WH-507 | Per-Target throughput protection is **user-configurable**: a rate limit and/or concurrency cap per Target with sane defaults (e.g. 5 concurrent), enforced at the point of work — the per-minute rate limit via `RateLimiter` semantics through a job middleware performing the delivery model's throttle-release bookkeeping, keyed by target id; the concurrency cap via `Redis::funnel` (a per-target lease released on completion; a rate window cannot express max-in-flight). Tune-points. Mechanics → [[webhook-delivery-model]]. |
| WH-508 | Queue topology: a dedicated **`webhooks` queue** — the partition carries the blast-radius argument [[fleet-queue-doctrine]] requires: a receiver outage must not compete with other outbound provider work ([[webhook-threat-model]] D-1). Delivery jobs implement `ShouldQueue`, and the retry schedule is **counter-driven**: the job computes each jittered delay from the **Delivery row's authoritative attempt counter** and re-queues each counter-advancing schedule hop as a **fresh delayed dispatch** carrying the freshly captured counter — never via the driver's release, which re-queues the original payload and structurally cannot re-capture the counter the duplicate-job fence checks; throttle releases remain genuine driver releases with a short fixed delay and never touch the counter; the 48-hour deadline is a **Delivery column** checked by job and sweeper alike; `retryUntil()` is non-authoritative for the deadline **value** — `deadline_at` rules — but **required for the mechanism**: throttle releases can repeat unboundedly, and without `retryUntil()` the fleet's default single-try workers ([[fleet-queue-doctrine]] §4) fail a throttle-released job on its second pickup. Mechanics → [[webhook-delivery-model]]. **Worker sizing is ops' concern** — the spec is silent beyond the queue name. |
| WH-509 | Replay: single-event replay to one Webhook runs **synchronously** (immediate UI feedback) as a **new Delivery** with the same event id and a replay marker header. **Bulk replay** — failed or skipped Deliveries in a date range — is queued. Semantics → [[webhook-delivery-model]]. |
| WH-510 | Test-fire: the user picks an event type and **MAY enter payload values directly**, prefilled from the catalog's sample payload; the result renders through the Webhook's template and is delivered as a **real HTTP request** carrying `X-Webhook-Test: true` — the `type` is unchanged, never rewritten to a ping. A bare **`ping` event type exists in every catalog** for the trivial case. Test deliveries appear in history flagged as test. |

---

## §6 Management API & permissions

Deep reference → [[webhook-management-surface]].

| ID | Rule |
|---|---|
| WH-601 | Webhook management is **business configuration — it lives on the plane that runs the business**. In apps **with an operator plane**, the single **`webhooks:manage`** permission **MUST** sit on the **operator guard**; in apps **without one**, it sits with tenant users on the **web guard**. Read is implied for managers, and there is no separate replay permission. Administrators get read/support visibility on the `/control` plane in every app. Permissions gate routes, never role names — the [[fleet-app-specification]] identity-planes law applies unchanged. |
| WH-602 | **Policies authorize org/user ownership on every object.** API tokens carry Sanctum abilities per [[fleet-api-specification]] API-902–API-905 ([[sanctum-token-auth]]): abilities gate the token; policies still authorize the user. |
| WH-603 | A REST management API is a **MUST**, mounted under `/api/v{major}` and **fully conforming to [[fleet-api-specification]]** — the mount and route shape per API-201, scoped nested bindings per API-205, FormRequest validation per API-302, UUIDv7 string IDs per API-405, RFC 9457 problem+json per API-601, Sanctum bearer auth per API-901 ff., and Scramble-generated OpenAPI per API-1101. None of it is restated here. Endpoint paths → [[webhook-management-surface]]. |
| WH-604 | Expensive or abuse-prone surfaces get **named rate limiters** of their own, per [[fleet-api-specification]] API-1003 ([[api-rate-limiting]]); the register of named limiters (test-fire, bulk replay, CSV export, single replay, the verification ping) → [[webhook-management-surface]], the single owner of the set. |
| WH-605 | Lifecycle states are fixed vocabulary: a Webhook is `active`, `paused` (user-chosen — or system-applied pending re-verification when its Target's address changes; events **skipped-but-recorded**), or `disabled` (system-imposed, WH-506); a Target is `unverified` or `active`, and editing an `active` Target's scheme, host, or base path reverts it to `unverified` (WH-407 holds for the current address). The standing invariant: **a Webhook is `active` only while its Target is `active`**. Soft-deleted items live in the recycle bin (WH-207). The state machines → [[webhook-management-surface]]. |
| WH-606 | Audit: `created_by`/`updated_by` on every config entity, plus a structured stderr JSON line on every config mutation and secret rotation, carrying denormalized names (WH-208). **No activity-log package.** |
| WH-607 | Generated docs are a **SHOULD**: each adopting app auto-generates a public webhook event reference from the registry — types, payload schemas, sample payloads, signing instructions — the [[openapi-scramble]] analogue for the webhook surface, held to the Stripe-quality bar. The customer-facing integration narrative → [[webhook-receiver-guide]]. |
| WH-608 | In-app failure notifications are a **MAY**; when present they are deduplicated by webhook + error. |

---

## §7 UI requirements

Deep reference → [[webhook-management-surface]], [[webhook-product-requirements]].

| ID | Rule |
|---|---|
| WH-701 | A React management UI is a **required deliverable**, **Tier E** — expressive, per-app presentational freedom under [[fleet-frontend-specification]]. It is specified through user stories and acceptance criteria, never pixel prescriptions → [[webhook-product-requirements]]. |
| WH-702 | UI copy uses the locked vocabulary (WH-201) verbatim — Target, Webhook, Delivery, Attempt — and the subscription picker is driven by the catalog registry (WH-103), never a hand-maintained list. |
| WH-703 | The template editor keeps a **simple insert-token mode** as the primary surface; advanced constructs — sections, formatters — live in a **raw template editor**. Template power MUST NOT complicate the default UI path. |
| WH-704 | History and reporting MUST provide: a per-webhook delivery list (status, event type, timestamps, attempt count); attempt drill-down showing the request **as sent** with secret values masked, the response status and body snippet, and duration; filters by status/type/date; a success-rate + latency summary; **CSV export**; and a **per-Target rollup view**. Requirement detail → [[webhook-management-surface]]. |
| WH-705 | The recycle bin is a first-class UI surface: list, restore, and purge for soft-deleted Targets and Webhooks (WH-207). |

---

## §8 Multi-tenancy & quotas

Deep reference → [[webhook-data-model]], [[webhook-management-surface]].

| ID | Rule |
|---|---|
| WH-801 | Multi-tenant apps (stancl, subdomain-per-tenant) keep **all webhook entities in the tenant DB**, and delivery **workers are tenant-aware**. Scoping detail → [[webhook-data-model]]. |
| WH-802 | Single-tenant apps scope every webhook entity to the **organization**; policies enforce the scope on every object (WH-602). |
| WH-803 | Quotas: **10 Targets per org** and **50 Webhooks per org**; there is **no payload size cap**. All quota values are config tune-points. |

> **No-org carve-out (§8):** an app with no organization concept scopes every webhook entity to
> the **user** — every "per org" reading in this section, quotas included, then reads "per
> user". Nothing else changes.

---

## §9 Observability & retention

Deep reference → [[webhook-delivery-model]], [[webhook-data-model]].

| ID | Rule |
|---|---|
| WH-901 | Every Attempt emits a **structured stderr JSON** log line — event id, webhook id, target id, status, duration, attempt number. File channels are forbidden in prod ([[fleet-app-specification]] logging law); this feature adds no channel of its own. |
| WH-902 | Sentry receives **engine faults only** — a template-engine crash, an unexpected exception — and **never** a customer endpoint's failures. A failing receiver is their outage, not our error budget. |
| WH-903 | A health check is a **SHOULD**: a scheduled "X% of deliveries failing in the last hour" check that logs at the error floor and reaches Discord through the app's standard alert channel ([[fleet-app-specification]]). |
| WH-904 | Retention is bounded and pruned on schedule: Deliveries/Attempts with their captured responses and the event outbox rows each default to **30 days** — every window a documented tune-point, the [[idempotency-keys]] retention precedent. The recycle-bin window is WH-207's, stated there once. Per-window detail + pruning mechanics (including the event-row pruning invariant) → [[webhook-data-model]]. |

---

## §10 Testing obligations

Deep reference → [[fleet-testing-doctrine]], [[testing-antipattern-catalog]].

| ID | Rule |
|---|---|
| WH-1001 | **Bootless, branch-complete unit tests** are mandatory for the pure logic: signature generation, backoff math, token rendering (formatters and sections), SSRF guard logic, wire-type derivation, catalog discovery, wildcard resolution, and retry-taxonomy classification. |
| WH-1002 | `Http::fake` assertions on outbound delivery are **legitimate Feature-suite coverage** — the receiving endpoint is an unmanaged out-of-process dependency. `Http::preventStrayRequests()` is already fleet law and applies unchanged. |
| WH-1003 | The registry is **pinned by test**, and a unit test locks the class-name ↔ wire-name derivation (WH-102). Vocabulary drift is a failing test, not a surprise. |
| WH-1004 | Policy methods are unit-tested **as plain functions**, plus **one security canary** proving the gate is actually consulted on the route. |
| WH-1005 | Arch rules: event classes carry the `Event` suffix (WH-101); template classes implement the fleet template interface (WH-307); payload DTOs obey the fleet DTO purity rules ([[data-transfer-objects]]). |

---

## §11 Bundle artifacts

Deep reference → [the webhook corpus](../stack/laravel-webhooks/_index.md).

| ID | Rule |
|---|---|
| WH-1101 | The runnable artifacts land as an **opt-in bundle** at [`standards/laravel/webhooks/`](../../standards/laravel/webhooks/) *(bundle, future pass)* — the `edge-cache/` precedent: its own README states what it costs as well as what it buys. **No conformance check forces an app to adopt webhooks**; once an app ships them, the bundle's values are this spec's values. |
| WH-1102 | The bundle MUST contain the **engine and persistence**: the auto-wired single subscriber (WH-205), outbox write + fan-out, delivery jobs carrying the retry schedule (WH-503), the crash-window sweeper (WH-204), the failing-days evaluator behind auto-disable (WH-506, cadence → [[webhook-delivery-model]]), the auto-purge and retention-pruning commands (WH-207, WH-904), and the migrations. |
| WH-1103 | The bundle MUST contain the **event machinery**: the `#[WebhookEvent]` attribute, the registry with reflection discovery, the production cache command (WH-103), and the `ping` event type (WH-510). |
| WH-1104 | The bundle MUST contain the **security primitives**: the signing implementation (WH-401), the egress guard (WH-405), encrypted-cast secret handling (WH-402, WH-404), and the config file + `.env` fragment, inert when blank (WH-406). |
| WH-1105 | The bundle MUST contain the **templating engine**: the token/formatter/section renderer (WH-301), save-time validation (WH-306), the fleet template interface, and the generic template classes — Slack incoming-webhook, Discord, generic JSON (WH-307). |
| WH-1106 | The bundle MUST contain the **management surface scaffold**: API controllers, FormRequests, JsonResources, policies, and routes per [[fleet-api-specification]] (WH-603), plus the React UI scaffold — a Tier E starting point each app restyles freely (WH-701) — and the SHOULD-tier event-reference generator command (WH-607). |
| WH-1107 | The bundle MUST contain the **test suite fulfilling §10**: the bootless unit suites for the pure logic, the registry and derivation pins, the policy tests plus security canary, and the arch rules — ready to run in an adopting app. |

---

## §12 Accepted-deviations register

This register records justified departures (§0 deviation policy). No fleet-level deviation is
recorded at ratification; adopting apps append their own rows below the illustrative one.

| ID | App(s) | Deviation | Why |
|---|---|---|---|
| *W-0x* | *(illustrative — replace)* | *(what departs, naming the WH-### it departs from)* | *(the justification that earned the exception)* |

Any new deviation **MUST** be added here with a justification before it ships.

---

**Considered and rejected** (one line each, so the next debate starts from evidence):
**spatie/laravel-webhook-server** — POST-JSON-centric: it fights the verb matrix, templating,
and history requirements this product is made of; a bespoke engine on queues + `Http` is
smaller than the fight. **The Stripe-exact signing recipe (`{t}.{raw_body}`)** — rejected after
adversarial review: it leaves the method and request target unsigned, so any captured request
replays against every other endpoint sharing the Target secret, and bodyless verbs would force
a second construction carrying domain-separation ambiguity between the two; the single
effect-bound construction (WH-401) closes both while keeping Stripe's `t=`/`v1=` header DX.
**The dot-delimited unified string (`{t}.{METHOD}.{request_target}.{raw_body}`)** — rejected as
non-injective: a request target and a raw body may both contain periods, so distinct requests
can splice into the identical signed string — `(GET, /sync?rate=1.25, empty body)` and
`(GET, /sync?rate=1, body "25.")` sign identically — falsifying any closed-by-construction
claim; the newline join (WH-401) restores injectivity because none of the three leading fields
can contain a raw newline and the body is the final field.
**User-authored transformation scripting (JS/expressions)** — tokens
only, ever: a sandboxed script runtime is an attack surface and a support burden, not a
feature. **Batch/digest delivery** — one event, one delivery; receivers that want digests
aggregate on their side. **Ordered / exactly-once delivery** — promises no sender can keep
across other people's HTTP endpoints; at-least-once plus the envelope `id` dedupe key is the
honest contract. **Payload size caps** — the payload is a snapshot of a fact the receiver
subscribed to; handling its size is their side's concern. **Envelope tenancy field** —
tenancy is scoping (WH-801), never payload; a tenant id in the body is a leak waiting for a
copy-paste. **Activity-log package** — `created_by`/`updated_by` plus structured stderr audit
lines (WH-606) cover the need without adopting a package's schema. **Ping-rewrite on
test-fire** — test deliveries keep their real `type` (WH-510); a header flags the test, so the
receiver code path being exercised is the real one. **An "attempt now" action for pending
Deliveries** — a mid-schedule Delivery whose configuration was just fixed waits out its next
schedule slot; single replay of a terminal row is the immediate-feedback path, and a second
"send it now" affordance would split replay semantics for a saving measured in hours.
