---
title: OpenAPI & the Contract Chain — Scramble, oasdiff, Spectator
description: The four-link enforcement chain that makes the API contract undriftable — Scramble generates OpenAPI 3.1 from FormRequests/Resources, the export is committed and diff-gated in CI, oasdiff fails builds on breaking changes, Spectator validates runtime behavior against the spec in Pest.
tags: [stack, api, laravel, openapi, scramble, spectator, oasdiff, ci, contract]
type: stack
status: reference
updated: 2026-07-30
related: [fleet-api-specification, api-resources, api-versioning, forgejo-ci]
---

# OpenAPI & the Contract Chain

Fleet norms → [[fleet-api-specification]] §11. The doctrine: **code is the source of truth,
and four mechanical links make drift impossible** — no hand-maintained spec artifact
anywhere.

## Link 1 — Scramble generates the spec from code

**`dedoc/scramble`** (pin **exact**, e.g. `0.13.36` — it is 0.x and minors have carried
behavior changes): static analysis + type inference over the AST, zero annotations. It reads
route registrations, **FormRequest rules**, **JsonResource `toArray()`** field-by-field,
route-model bindings, backed enums, and `abort()`/policy/validation paths (→ documented
403/404/422). This is exactly why the spec mandates FormRequests (API-301) and JsonResources
(API-401): **the mandated primitives are the statically legible ones.** laravel-data
inference is Scramble PRO (paid) — another reason data classes aren't the output layer.

- Per-version registration: `Scramble::registerApi('v1', ['api_path' => 'api/v1', ...])`;
  docs UI at `/docs/api` (Stoplight Elements), **gated by the `viewApiDocs` gate**; the JSON
  document itself may be public — it is the contract, not a secret.
- Known limits (the honest caveat): genuinely dynamic output — `when()`/`mergeWhen()`
  conditionals, loop-built arrays, computed `response()->json($arr)` — is best-effort.
  Those blind spots are precisely what Link 4 exists to catch.
- Alternatives rejected: l5-swagger (hand-written annotations = drift by construction),
  vyuldashev/laravel-openapi (dead, Laravel ≤10), scribe (annotation-dependent; revisit only
  if a public try-it-out docs site becomes a deliverable).

## Link 2 — the committed export + drift gate

```
php artisan scramble:export --path=docs/openapi-v1.json --api=v1   # committed artifact
# CI (static job): re-export, then
git diff --exit-code docs/openapi-v1.json
```

The build fails if the committed contract disagrees with what the code now generates —
**every contract change becomes a reviewable PR diff**. This also breaks the circularity
objection (generator and validator sharing one source): the committed file is the reviewed,
human-approved snapshot the other links judge against.

## Link 3 — oasdiff, the breaking-change gate

`oasdiff` compares `origin/main`'s committed spec against the PR's, `--fail-on ERR` (213
breaking-change checks; warnings/informational don't block). This is the **mechanical
enforcement of additive-only evolution** (API-802/803): adding fields passes, removing or
narrowing fails, and "we accidentally shipped a v2 inside v1" becomes structurally
impossible. Runs in CI's `static` job; judge against the contract,
not against what the server happens to tolerate.

## Link 4 — Spectator, the runtime observer

**`hotmeteor/spectator`** (v3; PHP ^8.3, Laravel ≥12) in the Pest API tests:

```php
Spectator::using('docs/openapi-v1.json');

$this->postJson('/api/v1/quotes', $payload)
    ->assertValidRequest()
    ->assertValidResponse(201);
```

Middleware-intercepts each test request/response and validates both against the spec —
catching what static inference can't: conditional fields that didn't render, computed
payload drift, **undocumented status codes** (the 404 nobody asserted). v3 adds contract-
coverage tracking with a minimum-threshold PHPUnit extension — a ratchetable number in the
spirit of the fleet's one-way ratchets. Every endpoint's happy-path test carries the pair
(API-1202).

## OpenAPI conventions (API-1106)

`operationId`: camelCase `<verb><Resource>` (`listQuotes`, `createQuote`) and **immutable**
— SDK generators hang method names off it, so renaming is a client-breaking change invisible
on the wire. Tags: declared top-level with descriptions, one per resource.
`components.securitySchemes`: the Bearer scheme, with each operation listing its required
ability ([[sanctum-token-auth]]) in the description. OpenAPI **3.1** (JSON Schema 2020-12
alignment; `type: ["string","null"]`, not `nullable:`).
