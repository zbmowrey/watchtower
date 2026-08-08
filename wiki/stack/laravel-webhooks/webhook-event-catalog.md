---
title: Webhook Event Catalog — the Attribute, Wire Types, and the Envelope
description: How webhookable events declare themselves and become the registry the whole system reads — the normative #[WebhookEvent] attribute surface, reflection discovery with the production cache command, the mechanical class-name-to-wire-type derivation and its pinning test, the past-tense law, wildcard resolution, the reserved ping type, the envelope shape, and the global schema_version policy. This page owns the catalog and envelope facts; the rule of record is fleet-webhook-specification, storage is webhook-data-model, delivery mechanics are webhook-delivery-model.
tags: [stack, webhooks, laravel, events, attributes, registry, envelope]
type: stack
status: reference
updated: 2026-08-08
related: [fleet-webhook-specification, webhook-data-model, webhook-delivery-model, webhook-templating, webhook-receiver-guide, data-transfer-objects, spatie-laravel-data, fleet-testing-doctrine]
---

# Webhook Event Catalog — the attribute, wire types, and the envelope

The deep reference behind the event-taxonomy rules in [[fleet-webhook-specification]]. The
catalog is the single registry every other part of the system reads: the subscription-picker UI
lists it, wildcard resolution resolves against it, test-fire prefills from it, template
validation checks token paths against it ([[webhook-templating]]), and the generated public
event reference is rendered from it. One registry, five consumers, zero hand-maintained lists.

## The naming law

Webhook events are **facts, stated in the past tense** — never intents, never commands. A
webhook says "this happened", and a receiver that gets it twice or late must still be reading
history, not instructions.

- Class names: `{Entity}{PastTenseVerb}Event` — `InvoicePaidEvent`,
  `ServiceRequestCreatedEvent`. The suffix is enforced by arch test
  (`toHaveSuffix('Event')`).
- Long-running operations get **`started`/`completed` pairs** (`ReportGenerationStartedEvent`,
  `ReportGenerationCompletedEvent`) — each end of the operation is itself a past-tense fact.
- Verbs are **single words** by construction (the derivation below depends on it). A compound
  verb is a naming smell: fold it into the entity (`ReportGeneration` + `completed`) or pick a
  stronger verb.
- Acronyms are written PascalCase (`PdfGeneratedEvent`, never `PDFGeneratedEvent`) so the
  camel-case split is unambiguous.

## Wire-type derivation and the pinning test

The wire type is derived **mechanically** from the class name — there is no second name to keep
in sync, so there is nothing to drift:

1. Strip the `Event` suffix.
2. Split the remainder on camel-case boundaries.
3. The final word, lowercased, is the **verb**.
4. The remaining words, lowercased and joined with `_`, are the **entity** (snake_case).
5. Wire type = `entity.verb` — Stripe-style dot notation.

The pre-suffix class name MUST split into at least **two** camel-case words — a one-plus-word
entity and a one-word verb. A single-word name (`PaidEvent`) has no entity to derive, and the
registry build rejects the violation.

`InvoicePaidEvent` → `invoice.paid` · `ServiceRequestCreatedEvent` → `service_request.created`
· `ReportGenerationCompletedEvent` → `report_generation.completed`.

The derivation function is a pure function with branch-complete unit coverage, and the resulting
map is **pinned by test** so a rename is always a deliberate, reviewable diff — a renamed class
silently renaming a wire type would break every subscriber:

```php
test('wire types are pinned', function () {
    expect(WebhookEventRegistry::wireMap())->toBe([
        InvoicePaidEvent::class            => 'invoice.paid',
        ServiceRequestCreatedEvent::class  => 'service_request.created',
        // every #[WebhookEvent] class in the app, exhaustively
    ]);
});
```

Renaming a shipped event type is a **breaking contract change** — receivers subscribe to wire
types. Treat it like removing an API field: it does not happen inside a schema version (see
versioning, below).

## The attribute

A concrete event class opts into the catalog by bearing `#[WebhookEvent]`. The normative
constructor surface — minimal, three parameters, nothing speculative:

```php
#[Attribute(Attribute::TARGET_CLASS)]
final class WebhookEvent
{
    /**
     * @param string       $description   One sentence, shown in the picker UI and generated docs.
     * @param class-string $payloadSchema The payload DTO class; its typed properties ARE the schema.
     * @param array<string, mixed> $samplePayload Literal sample for test-fire prefill and doc examples.
     */
    public function __construct(
        public readonly string $description,
        public readonly string $payloadSchema,
        public readonly array $samplePayload = [],
    ) {}
}
```

```php
#[WebhookEvent(
    description: 'An invoice was paid in full.',
    payloadSchema: InvoicePayload::class,
    samplePayload: ['invoice' => ['id' => '0198f3f2-…', 'total_minor' => 1999, 'currency' => 'USD']],
)]
final class InvoicePaidEvent
{
    public function __construct(public readonly InvoicePayload $payload) {}
}
```

Notes that carry weight:

- **There is no wire-type parameter.** The wire type is derived (above); an override knob would
  reintroduce exactly the drift the derivation exists to prevent.
- `payloadSchema` names a typed payload DTO ([[data-transfer-objects]], carried as a
  [[spatie-laravel-data]] object). The registry derives the token-path schema for template
  validation and the documented payload shape from its typed properties — one class, three
  consumers.
- PHP requires attribute arguments to be **constant expressions**, so `samplePayload` is a
  frozen literal by construction — it cannot lazily compute, query, or leak runtime state.
- A partial or empty `samplePayload` is safe: the save-time render check resolves
  schema-valid paths that are structurally absent from the sample as null placeholders
  ([[webhook-templating]]), so a sparse sample never blocks a valid template from saving — it
  only thins test-fire prefill and doc examples.
- The event class captures its payload DTO at construction: the **snapshot at emission**. The
  frozen snapshot is what the outbox stores ([[webhook-data-model]]) and what every retry and
  replay sends ([[webhook-delivery-model]]). Staleness is by design; determinism is the payoff.

## Discovery and the production cache

The registry is built by **reflection**: enumerate the application's classes via the composer
classmap (or a configured directory scan), reflect each candidate, keep concrete classes
bearing `#[WebhookEvent]` (abstract classes and interfaces are ignored), derive wire
types, and index by both class and type. In local and dev the registry builds lazily per process
and memoizes.

In production, reflection at boot is dead weight, so the registry follows the
`route:cache`/`event:cache` pattern:

- `php artisan webhooks:cache` — compiles the full registry (wire map, descriptions, schema
  references, sample payloads) to `bootstrap/cache/webhooks.php`; the runtime loads the compiled
  file and never reflects.
- `php artisan webhooks:clear` — deletes the compiled file.

Deploys run `webhooks:cache` alongside `config:cache` and `route:cache`; the standard failure
mode is a stale cache after adding an event, and the standard fix is the same as for routes:
re-cache on every deploy. Both commands ship in
[`standards/laravel/webhooks/`](../../../standards/laravel/webhooks/) (bundle, future pass).

The registry powers, exhaustively: the subscription-picker UI
([[webhook-management-surface]]), wildcard resolution at dispatch (below), the single auto-wired
outbox subscriber ([[webhook-data-model]]), test-fire samples ([[webhook-delivery-model]]),
save-time template validation ([[webhook-templating]]), and the generated public event
reference. The full catalog snapshot is itself pinned by test, so adding, removing, or renaming
an event is always a visible diff.

## The reserved `ping` type

Every catalog contains one engine-owned type: **`ping`**. It is not app-authored, does not
follow `entity.verb`, carries an empty `data` object, and never enters fan-out — it is only sent
directly, for Target verification and connectivity checks ([[webhook-delivery-model]] owns those
semantics). A collision with `ping` is structurally impossible — every derived type carries a
dot and `ping` has none; what the registry build rejects is the degenerate case behind that
guarantee, the single-word class name that would derive an empty entity (the two-word rule,
above).

## Wildcards

A Webhook's event selection may contain explicit wire types, patterns, or both. Exactly two
pattern forms exist:

- `entity.*` — every current and future type of that entity (`invoice.*`).
- `*` — every current and future type in the catalog.

Nothing else globs: `*.created` and partial-segment patterns are rejected at save time against
the catalog. Resolution happens **at dispatch time**: fan-out tests the concrete wire type
against each webhook's selection, which is what makes wildcards forward-inclusive — a newly
added `invoice.voided` event flows to existing `invoice.*` and `*` subscribers with zero
configuration changes. `ping` is never dispatched through fan-out, so no wildcard ever matches
it.

## The envelope

The envelope is both the internal carrier and the **default delivery body** — a webhook with no
template configured sends it as-is ([[webhook-templating]] owns the override rules):

```json
{
  "id": "0198f3f2-7d1e-7b2a-9d55-3f6a1c2b4d5e",
  "type": "invoice.paid",
  "schema_version": 1,
  "occurred_at": "2026-08-08T14:21:07.123456Z",
  "data": { "invoice": { "id": "…", "total_minor": 1999, "currency": "USD" } }
}
```

- `id` — the **UUIDv7 event id**, minted once at emission and identical across every attempt,
  retry, and replay. It is the receiver's dedupe key ([[webhook-receiver-guide]]) and the outbox
  row's identity ([[webhook-data-model]]).
- `type` — the wire type.
- `schema_version` — the global envelope version (below), an integer.
- `occurred_at` — when the fact occurred: RFC 3339, UTC, `Z` suffix, fixed microsecond
  precision, matching the fleet timestamp pin ([[fleet-api-specification]] API-404).
- `data` — the frozen payload snapshot, shaped by the event's payload DTO.

**No tenancy field, ever.** Tenancy is handled entirely by scoping
([[webhook-data-model]]) — a payload that names its tenant is a payload that can leak one.

## Schema versioning

One **global envelope `schema_version`**, starting at 1:

- **Additive** payload changes — new fields, new event types, new enum values — never bump it.
  Receivers are tolerant readers; additive change is the normal evolution mode, exactly as
  [[fleet-api-specification]] API-802 rules for the REST surface.
- **Breaking** changes — removing or renaming a field or event type, retyping, re-meaning —
  bump it. Bumping is a fleet-level decision, rare and deliberate, and requires notifying
  webhook owners.
- A Webhook **pins the version current at its creation** (a column on the webhook row,
  [[webhook-data-model]]).

v1 performs **no per-version payload transformation**: envelopes always carry the version they
were emitted under, and replays carry their original `schema_version` untouched. The pin exists
to make drift *detectable*, not invisible — when the global version moves past a webhook's pin,
the management surface flags the webhook for review ([[webhook-management-surface]]), and a
receiver comparing each envelope's `schema_version` against its pin knows precisely when it is
reading a shape it was not built for.

**The flag has a lifecycle, not just an onset.** While flagged, list and detail views show the
pinned and current versions side by side. The one exit is an explicit acknowledgment: the
owner confirms the receiver handles the current shape and re-pins —
`POST /webhooks/{webhook}/repin` ([[webhook-management-surface]]) — which updates the pin to
the current global version and clears the flag. `schema_version` is never silently writable
through an ordinary PATCH; the dedicated action is the confirmation semantics. Ignoring the
flag changes nothing on the wire — v1 does no payload transformation — so the flag is
information and the re-pin is the receipt, never a migration.
