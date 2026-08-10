---
title: Inbound Webhook & Integration Pattern (guidance — receiving third-party events)
description: The reusable pattern for the other direction — a fleet app receiving webhooks from a provider it does not control. Covers the pipeline shape (dedicated CSRF-free route, host constraint, verify raw bytes before parsing, constant-time compare, replay window), persist-then-ACK with async processing, the (provider, event_id) dedupe floor and out-of-order convergence, tenant resolution from stored provider references with the park-don't-drop ruling, the anti-corruption adapter that quarantines the provider SDK, per-integration secrets and dual-accept rotation, failure surfaces, and replay-from-stored-payload testing. Guidance, not spec — inbound is per-app, per-integration. Outbound is [[fleet-webhook-specification]]; Paddle specifics stay in [[cashier-paddle-integration]].
tags: [ standard, webhooks, inbound, integration, security, idempotency, anti-corruption, laravel ]
type: standard
status: reference
updated: 2026-08-08
related: [ fleet-webhook-specification, fleet-queue-doctrine, fleet-api-specification, fleet-app-specification, fleet-testing-doctrine, idempotency-keys, cashier-paddle-integration, webhook-receiver-guide, notifications-standard, encryption-at-rest-doctrine ]
---

# Inbound Webhook & Integration Pattern

**Guidance, not mandate.** Inbound integration is inherently **per-app, per-integration** — the
provider picks the signature scheme, the id semantics, the retry policy, and whether ordering means
anything at all. So the fleet artifact is a **pattern** to instantiate per provider, not a spec to
conform to. Three things repeat across every integration and only those carry **MUST**: **signature
verification**, **replay protection and idempotency**, and an **anti-corruption adapter behind an
app-owned interface**. The rest is a stated default with its trade-off.

**Boundary, stated once.** This page is us as the **receiver** of somebody else's events; us as the
**sender** — event catalog, signing scheme, delivery engine, management surface — is owned entirely
by [[fleet-webhook-specification]]. The mirror reads both ways: [[webhook-receiver-guide]] is the
guide we publish to people receiving *our* webhooks, and every trap it warns them about is one we hit
in this seat. Generalized prior art is Paddle via Cashier; the worked specifics stay at
[[cashier-paddle-integration]].

## §1 The four laws

1. **Verify before you parse.** The signature covers *bytes*. Anything touching the body first — a
   parser, a `FormRequest`, a gateway that re-encodes — has destroyed what is being authenticated.
2. **The request is a receipt, not the work.** Verify, persist, acknowledge; domain work happens on a
   queue, on our clock, not inside the provider's timeout budget.
3. **Delivery is at-least-once and unordered.** Duplicates and inversions are normal traffic, not
   incidents. Converge on current state; never replay the provider's story as a state machine.
4. **The provider's vocabulary stops at the adapter.** A payload shape, SDK type, or provider status
   word in domain code is a defect independent of whether it works.

## §2 The receive pipeline

- **One route per integration — SHOULD:** `POST /integrations/<provider>/webhook`, registered in a
  provider (or dedicated routes file) **outside the `web` group** — no session, no CSRF token, no
  cookies. A machine-to-machine POST has no session to protect, and never opting into `web` is a
  cleaner statement than CSRF-exempting a route inside it. A single `/webhooks` endpoint dispatching
  internally is rejected (§10).
- **Host constraint — MUST in multi-tenant apps:** pin the route to the central host. Unconstrained
  in a subdomain-per-tenant app it answers on **every customer's domain**, handing each tenant a live
  copy of your billing endpoint to probe. Where a package registers its own route, disable that
  registration and re-register it pinned — worked case at [[cashier-paddle-integration]].
- **Verify on the raw bytes, first — MUST:** middleware reads the raw body (`$request->getContent()`)
  and verifies before any decode, binding, or validation. The classic bug is verifying a
  parsed-then-re-serialized body — key order, whitespace, unicode escaping and float formatting all
  change the bytes — and it fails *closed on legitimate traffic*, so it gets "fixed" by weakening the
  check. Where the provider signs the request target too, capture it ahead of any proxy rewrite. The
  **signature is the authentication**: no token middleware, and source-IP allowlisting is defense in
  depth where the provider publishes ranges, never a substitute.
- **Constant-time comparison — MUST:** `hash_equals()`, never `===`. Prefer the provider SDK's
  verifier over a reimplementation, quarantined per §6.
- **Timestamp / replay window — MUST where the provider supplies one:** reject outside the documented
  tolerance (five minutes is the common floor), and do **not** widen it for retries — a provider worth
  integrating signs each retry afresh, so a wide window only buys an attacker a longer capture-replay
  runway.
- **Answer in the provider's dialect — SHOULD:** read their retry table before choosing a status.
  Invalid signatures are **terminal** (`400`/`401`); anything transient — clock skew, a secret
  mid-rotation, our datastore down — is **retryable** (`5xx`), because their retry schedule is free
  repair time. Our own response envelope does not apply here: [[fleet-api-specification]] governs
  *our* API's problem+json, and a provider's receiver is not our API.

## §3 Persist, acknowledge, then process

- **Store the verified event, then ACK — SHOULD (MUST where it moves money or entitlements):** one row
  per delivery — `provider`, `event_id`, `type`, the **raw payload as received**, `received_at`, plus
  `processed_at` / `failed_at` / resolution columns. The raw copy is what makes replay-as-fixture (§9)
  and future reprocessing possible; a normalized copy is not that artifact.
- **No domain work in the request — MUST:** provider budgets run in seconds. Verify, insert, dispatch,
  return `2xx`. Opening a tenant database, calling the provider's API back, sending mail, recomputing
  entitlements all belong in a queued job whose shape, retry policy and `failed()` obligations are
  owned by [[fleet-queue-doctrine]] — on `default` unless the work is genuinely heavy. The fleet's
  `after_commit: true` default is what makes "the job always finds its row" true instead of a race.
- **Unknown types are stored and ignored, never rejected — SHOULD.** The provider's catalog grows on
  the provider's schedule; a `4xx` on an unrecognized type makes their next release your incident,
  while a stored row marked ignored makes it a query.
- **Payloads are PII until proven otherwise:** encrypt at rest per [[encryption-at-rest-doctrine]]
  where the provider sends personal or payment data; prune on a stated retention (30–90 days is the
  usual band — long enough to outlive the provider's own replay window).

## §4 Idempotency, dedupe, and out-of-order delivery

- **A unique constraint on (`provider`, `event_id`) is the floor — MUST.** Database-level, not a
  `firstOrCreate`-shaped check-then-insert: two concurrent retries both pass the check and both
  insert. Catch the violation, return `2xx`, stop. Where a provider sends no id, synthesize a
  deterministic one (hash of raw body + type + occurred-at) and record the omission as a
  provider-quality signal — it usually travels with weak retry semantics elsewhere.
- **This is the [[idempotency-keys]] machinery pointed the other way.** There a client supplies a key
  on our API and we replay the stored outcome; here the *provider* is the client, `event_id` is the
  key, the stored row is the outcome. Same principle — a key plus durable storage turns "did this
  already happen?" into a lookup — different mechanism, which is why that middleware is the wrong tool
  for this route (§10).
- **Dedupe does not excuse the handler.** Two at-least-once channels are stacked: the provider
  redelivers *deliveries*, the queue redelivers *jobs*. The constraint covers the first;
  [[fleet-queue-doctrine]] §1 law 1 binds the second.
- **Converge on state; don't trust order — SHOULD.** Where the provider exposes a fetch API, a
  state-changing job's first act is to **re-read current state from the provider** and reconcile: the
  event is a hint that something changed, not the truth about what it is now. That one ruling
  dissolves most ordering bugs. Where no fetch exists, gate the write on the event's own sequence or
  occurred-at and drop it when the stored value is newer. Back both with a **scheduled reconcile** — a
  dropped or never-sent webhook leaves a wrong record in either direction, and neither is one a
  customer should find before you do.

## §5 Tenant and entity resolution

- **Resolve through references we stored — MUST.** Match the payload's identifiers against provider
  references written when *we* created the object at the provider. A verified signature proves *the
  provider sent this*; it never proves *this belongs to whoever the payload names*. Passthrough or
  custom-metadata fields echoed back are hints to confirm against a stored reference, not identity to
  act on.
- **The static-lookup trap — MUST in multi-tenant apps.** Webhook resolution is a **static** lookup
  with no parent model to inherit a connection from, so a model that follows "whatever connection is
  current" lands wherever the request left it. Pin the connection on every model the receiver resolves
  through, and mind the test trap: a test written through relations passes with or without the pin and
  proves nothing — assert through the provider identifier ([[cashier-paddle-integration]]). Enter
  tenant context inside the job, not the request: the request resolves an id, the job resolves the
  world.
- **Unresolvable events park — they do not drop — MUST.** Mark the row unresolved with a reason, keep
  the payload, alert. The genuine causes are all things you want to see: an object created in the
  provider's dashboard we never mirrored, a race where the webhook beat our own write, a key pointed
  at the wrong provider account. Retry parked rows on a schedule (the race self-heals) and alert on
  their **age**. Silently `2xx`-ing and discarding makes every one of these invisible until a customer
  reports it.

## §6 The anti-corruption adapter

- **Provider payloads never reach domain code — MUST.** A thin per-provider adapter maps the payload
  onto an app-owned DTO or command and calls an [[actions|action]]. Domain code names *our* concepts;
  a provider status word inside an action is the seam leaking.
- **The interface is ours, and a method exists because the app needs to ask the question** — not
  because the provider offers the answer. That rule is what stops the seam becoming a transcription of
  the vendor's API surface.
- **Quarantine the SDK — MUST:** imported only in its adapter namespace, enforced by an arch test
  (`toOnlyBeUsedIn(...)`, per [[pest-architecture-testing]]) rather than by discipline — that test is
  what makes the boundary survive the third engineer.
- **Map types to commands, not "handlers to webhooks."** Several provider types may collapse into one
  domain command; some map to none. Model **the states the app needs**, not the provider's — five
  provider statuses hiding the two distinctions that decide access is worked at
  [[cashier-paddle-integration]]. **The payoff test:** adding or swapping a provider touches the
  adapter and its config and nothing else. If a second provider's arrival edits an action, the seam is
  in the wrong place.

## §7 Secrets and rotation

- **Standard env → config path — MUST:** read as `config('integrations.<provider>.webhook_secret')`,
  injected from a k8s Secret, never `env()` at the call site. **Unset means reject, never skip** — a
  receiver treating a missing secret as "verification disabled" is an unauthenticated write endpoint
  that passes all its tests. Secrets are **per integration and per environment**: sandbox and
  production never share a value, and one integration's leak must never verify another's.
- **Rotation — SHOULD, dual-accept where supported:** hold a *list* in config and accept a match
  against any entry; rotate by appending the new secret, updating the provider, then dropping the old.
  Where only one secret can be active, rotation is a brief window of verification failures — schedule
  it, and let §2's "transient → `5xx`" ruling turn the provider's retries into automatic repair. A
  rotation answering suspected compromise takes the outage and has no overlap by design.
- **Log the event id and type — never the secret, never the payload body.** The raw payload is stored
  (§3), a different surface with different access control from the log stream.

## §8 Failure surfaces

- **Signature failures are an alert — SHOULD.** A healthy integration produces approximately zero, so
  a non-zero rate means one of exactly three things: a secret drifted (a half-applied rotation), a
  proxy is mutating the body or request target, or someone is probing. Alert on rate, not per event,
  so a scan does not page anyone.
- **Processing failures follow [[fleet-queue-doctrine]]'s `failed()` law** — report plus whatever
  compensation the domain needs. Do not build a bespoke retry ladder beside the queue's; the stored
  event row is a ledger, not a second scheduler.
- **Age is the alert here too — SHOULD:** oldest unprocessed and oldest parked event, per provider.
  Add the one alert an error rate can never fire — an **events-received floor**. A provider that
  disabled our endpoint, or a DNS change that stopped delivery, is perfectly silent; the integration
  just quietly stops being true. Where an event fans out into telling a person, that hand-off is
  [[notifications-standard]].

## §9 Local development and testing

- **Tunnel plus the provider's simulator.** A public tunnel to the local app and the provider's CLI or
  dashboard test-fire cover the wiring; a sandbox account covers the live handshake. What genuinely
  needs the real provider is smaller than it looks — verification, dedupe, resolution and the whole
  adapter are exercisable without one.
- **Fixtures come from stored raw payloads — SHOULD.** The strongest inbound corpus is real verified
  deliveries captured in sandbox, scrubbed and committed; replay them through the adapter as bootless
  unit tests ([[fleet-testing-doctrine]]). That corpus is also the regression suite for the day the
  provider changes a field.
- **Test what verification *rejects*, not what it accepts** — tampered body, stale timestamp, wrong
  secret, missing header. Every broken implementation accepts legitimate traffic, including the
  parsed-then-verified one that also accepts forgeries. One feature test proves the wiring: host
  constraint honored, no session started, a second delivery of the same event id returns `2xx` and
  does the work once. Do not test the provider's SDK. The failure modes themselves are already
  tabulated from the receiver's seat in [[webhook-receiver-guide]] — read it as our own runbook.

## §10 Considered and rejected

- **A rigid fleet-wide inbound spec** — providers disagree on signature construction, id semantics,
  ordering and retry policy; a spec fixed to one provider's shape earns a deviation entry per
  integration and stops being read. **Revisit trigger:** three apps on the *same* provider — the
  answer then is a shipped adapter in `standards/laravel/`, still not a spec.
- **Processing inline in the request** — spends the provider's timeout budget on our downstream's
  worst day, converts slowness into failed deliveries and a retry storm, and hides domain errors
  behind a route that must not `500` for the wrong reason.
- **`Idempotency-Key` middleware on the receiver route** — that mechanism ([[idempotency-keys]]) keys
  on a *client-supplied header* to our own API and replays a stored HTTP response; a provider supplies
  an event id, and the artifact worth storing is the event, not a response.
- **Trusting event order (or a provider sequence number) as a state machine** — at-least-once delivery
  plus retries means an old event can land after a new one; §4's convergence rule stands.
- **One shared `/webhooks` route dispatching internally** — fuses every integration's verification
  path, secret and blast radius into one handler, so a change for one provider is a change for all.
- **Polling instead of webhooks** — *not* rejected. Where a provider's hooks are unsigned or
  unreliable, the scheduled reconcile **is** the integration and the webhook only a latency
  optimization. Choose that deliberately rather than discovering it during an incident.
