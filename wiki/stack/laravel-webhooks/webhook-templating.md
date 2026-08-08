---
title: Webhook Templating — Tokens, Formatters, and Sections
description: The template language for outbound webhook requests — {{ dot.path }} tokens resolved against the event envelope, the closed v1 formatter set (date, number, upper, lower, truncate, count, default), Mustache-style sections for conditionals and iteration, the four token locations and their per-location encoding, the three content types, the verb/body matrix, and the standard-envelope zero-config default. Owns the two-stage validation contract — the six save-time checks, including the rejection of any configuration lacking a signed copy of the event id, plus the no-retry template-error backstop at delivery time. Sister pages, webhook-template-library owns the shipped template classes and webhook-event-catalog owns the envelope and payload schemas this language renders against. Depth behind the WH-3xx rows of fleet-webhook-specification.
tags: [stack, webhooks, laravel, templating]
type: stack
status: reference
updated: 2026-08-08
related: [fleet-webhook-specification, webhook-template-library, webhook-event-catalog, webhook-delivery-model, webhook-signing-scheme, webhook-egress-guards, webhook-management-surface]
---

# Webhook Templating — Tokens, Formatters, and Sections

This page owns the template language: token grammar and resolution, the formatter set, section
semantics, where tokens render and how each location encodes, content types, the verb/body
matrix, the no-template default, and the validation contract. The rule rows are the WH-3xx
section of [[fleet-webhook-specification]]; this page carries the depth. The shipped template
classes written *in* this language live at [[webhook-template-library]]; the envelope the
language renders against is owned by [[webhook-event-catalog]]; the Webhook entity that stores a
template is owned by [[webhook-data-model]]. The renderer and save-time validator are bundle
artifacts at [`standards/laravel/webhooks/`](../../../standards/laravel/webhooks/) (bundle,
future pass).

The language is deliberately small: substitution, a closed formatter set, and Mustache-style
sections. **No user-authored code, ever** — no JavaScript, no expressions, no arithmetic
(scripting was considered and rejected; see the tail of [[fleet-webhook-specification]]). The
constraint that shaped it: powerful enough to feed Slack, Discord, form-encoded, and raw-XML
receivers, simple enough that the management UI can offer a plain insert-token mode and reserve
sections and formatter chains for the raw editor ([[webhook-management-surface]] owns the UI
requirements).

## The language at a glance

An envelope instance (normative shape → [[webhook-event-catalog]]):

```json
{
  "id": "01912f6e-2c1a-7d3e-9f4b-8a2d5c1e0b7a",
  "type": "invoice.paid",
  "schema_version": 1,
  "occurred_at": "2026-08-08T14:03:22.481902Z",
  "data": {
    "invoice": {
      "number": "INV-2041",
      "total_minor": 129900,
      "currency": "USD",
      "customer": { "name": "Acme Fabrication" },
      "lines": [
        { "sku": "PLAN-PRO", "quantity": 1 },
        { "sku": "SEAT-ADDON", "quantity": 4 }
      ]
    }
  }
}
```

A raw-text body template:

```
Invoice {{ data.invoice.number }} for {{ data.invoice.customer.name | upper }}
was paid at {{ occurred_at | date:'H:i' }} UTC ({{ data.invoice.lines | count }} lines).
```

renders as:

```
Invoice INV-2041 for ACME FABRICATION
was paid at 14:03 UTC (2 lines).
```

On its own this body would be rejected at save time by check 6 below — it carries no
unconditional `{{ id }}`; it saves only alongside a formatter-free `{{ id }}` placement in the
body, path extension, or query string.

## Tokens

Grammar (save-time enforced):

```
token     = "{{" ws pipeline ws "}}"
pipeline  = path *( ws "|" ws formatter )
path      = "." / segment *( "." segment )
segment   = 1*( a-z / 0-9 / "_" )
formatter = name [ ":" arg *( "," arg ) ]
name      = 1*( a-z )
arg       = non-negative-integer / "'" *( any character except "'" ) "'"
```

- A path resolves against the envelope root: `{{ id }}`, `{{ type }}`, `{{ occurred_at }}`,
  `{{ schema_version }}`, `{{ data }}`, and any dot descent into `data`. Segments traverse
  objects by key and arrays by zero-based numeric segment (`data.invoice.lines.0.sku`).
- Paths are case-sensitive and snake_case by construction — payload fields are snake_case per
  [[webhook-event-catalog]].
- `{{` always opens a token. There is no escape sequence in v1; a template that needs a literal
  `{{` cannot express it, and an unclosed or malformed token is a save-time error, never a
  silently-passed-through string.
- Whitespace inside the delimiters is insignificant: `{{data.total_minor}}` and
  `{{ data.total_minor }}` are identical.
- The bare dot path `.` means the current section scope and is valid only inside a section.
- **Null versus unresolvable** is the distinction the whole validation story hangs on. A path
  that exists in the event schema but holds `null` renders by the null rules below and is never
  an error. A path that is **structurally absent** from the payload at render time is
  unresolvable and fails the Delivery through the runtime backstop (below).

Null rendering: in a JSON value position a null renders as literal `null`; in every other
context (inside a JSON string, form value, raw text, header, path, query) it renders as the
empty string. A header whose rendered value is empty is omitted from the request entirely.

## Formatters

Formatters attach with `|` and chain left to right: `{{ data.title | truncate:60 | upper }}`.
Arguments are single-quoted string literals or bare non-negative integers; there is no escape
sequence inside a quoted argument in v1. The v1 set is **closed** — seven formatters, no
app-local additions. Extending it is an engine change that lands by amending this page and the
bundle renderer fleet-wide, never by patching one app.

| Formatter | Form | Input | Semantics | Example |
|---|---|---|---|---|
| `date` | `date:'<pattern>'` | RFC 3339 datetime string | Formats in UTC using PHP `DateTimeInterface::format()` pattern syntax. `date:'U'` yields Unix seconds — no separate `unix` formatter exists. | `{{ occurred_at \| date:'Y-m-d' }}` → `2026-08-08` |
| `number` | `number:<decimals>[,'<dec>'[,'<thousands>']]` | int, float, numeric string | PHP `number_format()` semantics. Defaults: 0 decimals, `.` decimal separator, `,` thousands separator. | `{{ data.invoice.total_minor \| number:0 }}` → `129,900` |
| `upper` | bare | string | Unicode-aware uppercase (`mb_strtoupper`). | `{{ data.invoice.currency \| upper }}` |
| `lower` | bare | string | Unicode-aware lowercase (`mb_strtolower`). | `{{ type \| lower }}` |
| `truncate` | `truncate:<n>` | string | First *n* characters, grapheme-safe; appends `…` (U+2026) only when the input was actually cut. | `{{ data.note \| truncate:80 }}` |
| `count` | bare | array or string | Element count for arrays, character count (graphemes) for strings, as an integer. | `{{ data.invoice.lines \| count }}` → `2` |
| `default` | `default:'<literal>'` | anything, including null | Passes a non-null input through unchanged; substitutes the literal string when the input is null. | `{{ data.coupon \| default:'none' }}` |

Two cross-cutting rules:

- **Null propagates.** A null input passes through every formatter untouched except `default`,
  which is the only formatter that consumes it. `{{ data.paid_at | date:'Y-m-d' }}` on a null
  `paid_at` renders as null (then the null rendering rules apply); it does not crash.
- **Types are checked twice.** Save-time validation rejects a formatter whose input type
  contradicts the event schema (`date` on a non-datetime field, `number` on a string field,
  `count` on a scalar). The runtime backstop catches value-level failures the schema cannot see.

The language has no arithmetic and no money formatter by design: currency exponent tables are
business logic. When a template needs a display-ready amount, put it in the payload DTO at
emission — the snapshot payload model ([[webhook-event-catalog]]) means the app fully controls
what the envelope carries, and money representation follows [[fleet-api-specification]] API-406.

## Sections

Mustache-style blocks provide conditionals and iteration. A section head is a **bare path** —
no formatter pipeline — and the closing tag repeats it:

```
{{#path}} rendered when truthy, once per element for arrays {{/path}}
{{^path}} rendered when falsy — the else branch {{/path}}
```

- **Truthiness:** `null`, `false`, the empty array, and a structurally absent path are falsy.
  Everything else is truthy, including `0`, `""`, and empty objects. Note the deliberate
  asymmetry with substitution tokens: an absent path inside `{{ … }}` is a template error, but
  an absent section head is simply falsy — sections are the guard construct, so absence must be
  expressible, not fatal.
- **Behavior by value:** an array iterates the block once per element with the element pushed as
  the current scope; an object renders the block once with the object pushed as scope; a truthy
  scalar renders the block once with the scalar as scope. Falsy skips the block (and renders the
  matching inverted section instead, if present).
- **Context stack:** inside a section, paths resolve against the innermost scope first, then
  outward, ending at the envelope root — `{{ occurred_at }}` works anywhere. `{{ . }}` is the
  current element itself, for arrays of scalars.
- Sections nest arbitrarily and must be properly balanced; save-time validation rejects
  overlapping or unclosed blocks.
- **Sections are body-only.** Header values, the path extension, and the query string accept
  substitution tokens with formatters and nothing more; a section outside the body is rejected
  at save time. This keeps the simple locations simple, and keeps the insert-token UI honest.

```
{{#data.invoice}}
Paid: {{ number }} ({{ currency }})
{{#lines}}- {{ quantity }} x {{ sku }}
{{/lines}}
{{^lines}}No line items.
{{/lines}}
{{/data.invoice}}
```

In JSON bodies, use sections to assemble **text inside string literals** (chat messages, line
summaries), not to emit JSON syntax — iterating out raw brackets and commas produces the classic
trailing-comma parse failure. To embed structured data in a JSON body, place a token in value
position and let native injection (below) carry the whole array or object. The save-time render
check catches any section that breaks the JSON structure before the template can be saved.

## Where tokens render

Tokens apply in exactly four locations. Everything else about the request — scheme, host, port —
comes from the Target ([[webhook-data-model]]) and **can never be altered by a token**. The fully
rendered URL still passes the egress guards on every attempt ([[webhook-egress-guards]]).

| Location | Available on | Encoding of resolved values |
|---|---|---|
| Body template | POST, PUT, PATCH | Per content type (next section). |
| Header values | all verbs | CR, LF, and NUL are stripped from the rendered value (header-injection guard), then the value is trimmed; a header that renders empty is omitted. Header *names* are static — tokens never appear in a name. |
| Path extension | all verbs | RFC 3986 path-segment percent-encoding; `/` inside a token value is encoded, so a token can never add path segments beyond what the Webhook's path extension literally spells. |
| Query string | all verbs | Query-component percent-encoding; `&`, `=`, and `#` inside values are encoded. |

In non-JSON contexts (headers, path, query, form values, raw bodies) a token that resolves to an
array or object renders as its compact JSON encoding — deterministic, and occasionally exactly
what a receiver wants in a query parameter. Reserved `X-Webhook-*` headers are set by the engine
and cannot be overridden by configured headers — the signature header, the always-present
`X-Webhook-Id`, and the test/replay markers ([[webhook-delivery-model]] owns the engine header
inventory; [[webhook-signing-scheme]] owns the signature header).

## Content types

Declared per Webhook; three are supported.

**`application/json` (the default).** Rendering is structure-aware, which is what makes the
insert-token UI safe without user-managed escaping:

- A token that constitutes the **entire JSON value** (`"count": {{ data.count }}`) injects the
  native JSON encoding of the resolved value — numbers stay numbers, booleans stay booleans,
  arrays and objects embed as JSON, null becomes `null`, strings are quoted and escaped.
- A token **embedded inside a JSON string literal** (`"text": "Invoice {{ data.number }} paid"`)
  interpolates the value with full JSON string escaping.

**`application/x-www-form-urlencoded`.** The template is the literal body text
(`invoice={{ data.invoice.number }}&total={{ data.invoice.total_minor }}`); resolved values are
form-percent-encoded on insertion, and structural characters typed by the author (`=`, `&`) pass
through literally.

**Raw.** The template is sent byte-for-byte with tokens substituted and no escaping of any kind
— this is the XML path. The default `Content-Type` is `text/plain; charset=utf-8`; a configured
`Content-Type` header on the Webhook overrides it (e.g. `application/xml`). Raw mode disables
all output encoding, so any token whose value carries untrusted content passes verbatim into
the receiver's document — markup injection included; the template author owns escaping and
should constrain which fields feed a raw body. The structure-aware safety guarantee of the JSON
content type does not extend to raw.

**A configured `Content-Type` header is honored in raw mode only.** For `application/json` and
`application/x-www-form-urlencoded`, the engine sets `Content-Type` from the declared content
type, and a configured `Content-Type` header is rejected at save time (check 5 below); should
one slip through anyway, the engine's value authoritatively replaces it at send time — the
same twice-enforced, case-insensitively matched pattern as the reserved `X-Webhook-*`
namespace ([[webhook-delivery-model]]).

## The verb/body matrix

| Verb | Body | Token locations | Signature |
|---|---|---|---|
| POST, PUT, PATCH | The rendered template, or the standard envelope when no template is configured. | body, headers, path extension, query | the unified construction — body segment carries the rendered body → [[webhook-signing-scheme]] |
| GET, DELETE | None. Configuring a body template on these verbs is a save-time error. | headers, path extension, query | the same construction — body segment empty → [[webhook-signing-scheme]] |
| HEAD, OPTIONS | Unsupported; rejected at save time. | — | — |

Method, path extension, and query string all sit inside the signed material on every verb
([[webhook-signing-scheme]]), which is what lets a query-borne `{{ id }}` satisfy the
signed-id rule below regardless of verb.

## No template: the standard envelope

Templates are an override, not a requirement. A Webhook on POST, PUT, or PATCH with **no body
template** sends the standard envelope verbatim as `application/json` — the zero-config path,
and the recommended one for machine consumers, because the envelope is versioned and documented
([[webhook-event-catalog]]) while a custom template is the owner's own contract. Because the
envelope default is always JSON, declaring `application/x-www-form-urlencoded` or raw content
type **requires** a body template; the combination of a non-JSON content type and no template is
rejected at save time.

## Rendering is pure — and happens per Attempt

The renderer is a pure function of (envelope, configuration): no clock, no randomness, no
environment access, no I/O. `occurred_at` is the event's time, never render time. Each
**Attempt renders at its point of work**, passing the Delivery's frozen envelope
([[webhook-event-catalog]]) through the Webhook's **current** template, headers, path
extension, and query string and the Target's current URL and auth. Purity keeps determinism:
unchanged configuration renders byte-identical output on every attempt, with only the signature
timestamp varying ([[webhook-signing-scheme]]) — and an edited configuration reaches the very
next scheduled attempt, which is the heal-mid-retry path the W4 story models
([[webhook-product-requirements]]). A `template_error` remains **terminal all the same**
(the runtime backstop, below): the frozen snapshot cannot change, so within an unchanged
configuration a re-render is guaranteed to fail identically, and after a template fix the
explicit replay — a new Delivery rendering the same frozen envelope — is how the corrected
rendering reaches the receiver. Replay and retry mechanics are owned by
[[webhook-delivery-model]].

## Save-time validation

A template is validated when the Webhook is saved, against the schemas and sample payloads the
event catalog publishes ([[webhook-event-catalog]]). All six checks must pass; a failure
rejects the save and surfaces as a 422 problem-details response on the management API
([[webhook-management-surface]], error mechanics per [[fleet-api-specification]]).

1. **Syntax.** Every token parses under the grammar; sections are balanced, properly nested, and
   appear only in the body; every formatter exists in the v1 set with correct arity and argument
   types.
2. **Path resolution.** Envelope-level paths (`id`, `type`, `occurred_at`, `schema_version`,
   `data`) are always valid. Every `data.*` substitution-token path must resolve in the payload
   schema of **every** event type the Webhook selects. A section head must resolve in **at least
   one** selected type (typo protection) and may be absent in others — absence is its falsy
   case. Validation walks the scope tree: tokens inside a section are checked only against the
   selected types in which that section's head resolves.
3. **Formatter/type compatibility.** Each formatter's input type is checked against the
   schema-declared type of its path (`date` demands a datetime field, `number` a numeric one,
   `count` an array or string).
4. **Render check (JSON content type).** The template is rendered against each selected event
   type's sample payload from the catalog, and the output must parse as JSON. This is what
   catches section constructions that break structure — trailing commas die here, not at a
   customer's endpoint. A path that resolves in the payload schema but is structurally absent
   from the sample resolves as a **null placeholder** for this check — samples are optional
   and may be partial ([[webhook-event-catalog]]), and the check proves structural JSON
   validity, never sample completeness; genuinely schema-unknown paths already died in
   check 2. TL5's rendered preview inherits the same rule.
5. **Matrix, content-type, and namespace coherence.** A body template on GET/DELETE, any use
   of HEAD/OPTIONS, or a non-JSON content type without a body template is rejected. So is a
   configured header whose name falls in the reserved `X-Webhook-*` namespace — the match is
   **case-insensitive** (header names compare case-insensitively per HTTP), so `x-webhook-test`
   is rejected exactly like `X-Webhook-Test` — mirroring the
   template-registry rule ([[webhook-template-library]]); should one slip through anyway, the
   engine's values authoritatively replace reserved-name headers at send time, matched
   case-insensitively there too ([[webhook-delivery-model]]). A configured `Content-Type`
   header on a JSON or form-encoded Webhook is rejected the same way — the engine owns that
   header outside raw mode (Content types, above) — matched case-insensitively, with the same
   send-time replacement backstop.
6. **A signed copy of the event id.** Every configuration must carry the envelope `id` inside
   the signed material somewhere, and only an **unconditional, bare** placement satisfies the
   rule: a formatter-free `{{ id }}` token that, when it lives in the body template, sits
   **outside every section** — the path extension and query string are section-free by
   construction, but a placement there must be formatter-free all the same. A section-guarded
   id (`{{#data.optional}}…{{ id }}…{{/data.optional}}`) does not count — the section head can
   be falsy at render time and the delivery then carries no signed id; a formatter-piped id
   (`{{ id | truncate:5 }}`) does not count — a mangled dedupe key is no dedupe key. The check
   is about what **renders**, not what the template text mentions. A configuration with no
   qualifying placement is **rejected** — the envelope
   `id` is the receiver's dedupe key, and the engine's `X-Webhook-Id` header
   ([[webhook-delivery-model]]) does not satisfy the rule, because headers sit outside the
   signature ([[webhook-signing-scheme]]). Under the unified construction the method, request
   target, and body are all signed on every verb, so any of the three placements counts — a
   query-borne id covers GET and DELETE exactly as a body-borne id covers POST. The
   zero-config path passes trivially: the standard envelope carries `id` unconditionally at
   the top level.

One check warns rather than rejects (SHOULD-level): a configured header whose name matches a
credential pattern (`Authorization`, `*-api-key`, `*-token`, `*-secret`) warns and steers the
user to the Target's custom-secret-header auth option, which is masked in history — an
ordinary configured header value is stored and displayed as sent
([[webhook-management-surface]]).

**Wildcard subscriptions** (`invoice.*`, `*`) validate `data.*` paths against every event type
the wildcard *currently* matches. An event type registered later that matches the wildcard but
lacks a referenced path will fail at delivery time through the runtime backstop — this is the
one gap save-time validation cannot close, and it is why wildcard subscriptions pair best with
the no-template default, envelope-only tokens, or section-guarded payload access, while
per-type `data.*` paths belong on explicit event lists. Narrowing a selection mid-schedule is
the sibling hole, closed at the point of work: a pending Delivery for a now-deselected type
terminates as `skipped` rather than retrying through a template whose validation guarantee no
longer covers it ([[webhook-delivery-model]]).

**Additive schema evolution** opens the third gap, on the sanctioned evolution path itself. An
additive payload change never bumps `schema_version` ([[webhook-event-catalog]]), payloads are
frozen at emission, and save-time validation checks the *current* schema — so a template
edited to reference a newly added field passes validation, while every retry or replay of an
event emitted **before** the addition renders a structurally-absent path: terminal
`template_error`, counting toward auto-disable ([[webhook-delivery-model]]). The `default:`
formatter does not rescue it — it consumes null, and absent is not null. Templates that must
serve pre-addition replays should section-guard newly added fields
(`{{#data.new_field}}…{{/data.new_field}}` — an absent section head is simply falsy).

## The runtime backstop

Save-time validation cannot prove everything (wildcard drift above; value-level formatter
failures), so the renderer carries a terminal backstop. A render fails the Delivery with failure
class `template_error` when a substitution-token path is structurally absent from the payload, a
formatter receives an incompatible value, or a JSON body renders to output that does not parse.
One relaxation exists: on a `ping` test-fire, the ping envelope's empty payload makes a
structurally-absent `data.*` path resolve as null (the null rendering rules then apply) instead
of failing — the ping-only relaxation, defined with the ping semantics in
[[webhook-delivery-model]].

The failed Delivery records the offending token and reason in delivery history, where the owner
sees it ([[webhook-management-surface]]); the Delivery/Attempt records themselves are owned by
[[webhook-delivery-model]]. A template error is **never retried**: the payload is a frozen
snapshot and the renderer is pure, so a re-render is guaranteed to produce the same failure —
retrying is noise. It cannot self-heal; the fix is always an edit to the template or the event
selection. The failure is emitted to structured logs per the observability rules in
[[fleet-webhook-specification]]. It is not a Sentry event — a template error is the owner's
configuration failing in its designed failure mode; Sentry is reserved for the renderer itself
throwing unexpectedly, which is an engine defect.

## Testing

The renderer, each formatter, section truthiness and iteration, the context stack, per-location
encoding, and the runtime error taxonomy are pure functions and get bootless, branch-complete
unit tests; the save-time validator is unit-tested against catalog schemas the same way. This is
the doctrine's home turf ([[fleet-testing-doctrine]]); the obligations are pinned in the testing
section of [[fleet-webhook-specification]].
