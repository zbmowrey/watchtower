---
title: spatie/laravel-data — the Typed Carrier (and Its Limits)
description: Where laravel-data fits the fleet API (typed DTO between FormRequest and domain, TypeScript generation) and where it is deliberately not used (validation owner, output layer) — the two-step validation quirk, Optional PATCH semantics, performance obligations, and the v4 class split.
tags: [stack, api, laravel, spatie, laravel-data, dto, validation]
type: stack
status: reference
updated: 2026-07-30
related: [fleet-api-specification, form-requests, data-transfer-objects, api-resources, api-filtering-sorting]
---

# spatie/laravel-data — the Typed Carrier (and Its Limits)

v4 (4.23.x; PHP ^8.1, Laravel 10–13). Fleet position (API-302, spec tail): **DTO carrier and
TypeScript source — not the validator, not the API output layer.** The evidence, so the
debate never reruns from scratch:

## The v4 class split (the fact that frames everything)

| Class | Creates | Validates | Transforms | Fleet use |
|---|---|---|---|---|
| `Data` | ✅ | ✅ | ✅ | avoid — the do-everything class blurs the boundary |
| `Dto` | ✅ | ✅ | ❌ | the inbound carrier (attributes still forbidden — below) |
| `Resource` | ✅ | ❌ | ✅ | not used for API output ([[api-resources]] owns that) |

## Why it doesn't own validation

1. **Two-step validation** (maintainer-confirmed, discussion #470): step 1 checks the payload
   can *construct* the PHP object (presence, types, nullability) before step 2 applies your
   attributes. Consequence: verb-conditional rules are structurally impossible — you cannot
   make `public string $city` optional on PATCH via an attribute, because step 1 already
   required it. The community's only working answer is one class per operation
   (`CreateXData`/`UpdateXData`), accepted as duplication.
2. **Validation silently doesn't run** on `new FooData(...)`, and `from(array)` behaves
   differently from `from(Request)`. A "the Data class enforces the contract" doctrine is
   therefore false in exactly the paths that look safest.
3. Spatie's own docs hedge: *"the Laravel validator was not written to be used in this way…
   there are some limitations and quirks."*

Hence API-301/302: **FormRequest validates** (verb-conditional rules are trivial there),
`toData()` hands a typed object inward, and **validation attributes on those Data classes are
forbidden** — under `from($request->validated())` they never run, so they'd be decorative
contract theater.

## Why it doesn't own API output

- Reflection overhead is real and the mitigation is operational: `data:cache-structures`
  MUST run on deploy — and it is **auto-disabled in tests**, so a green suite proves nothing
  about it. The maintainer's own v4 pre-release benchmark showed ~50% regression vs v3;
  community reports of multi-second large-collection serialization.
- Scramble's free tier cannot infer laravel-data output (that is **Scramble PRO**), while it
  reads `JsonResource` natively — a decisive argument given the contract chain
  ([[openapi-scramble]]).
- Its paginated envelope is `data` + `meta` with **no `links`**, diverging from the mandated
  resource-collection envelope ([[api-pagination]]).
- `allowedRequestIncludes()` collides with query-builder's `include` param — forbidden
  (API-505, [[api-filtering-sorting]]).

## What it IS for

- **The typed boundary object**: constructor-promoted, enum/date-casted, nested — everything
  [[data-transfer-objects]] wants, with `Data::from($request->validated())` or a hand-rolled
  `toData()` as the assembly point.
- **`Optional` for PATCH semantics**: `string|Optional $artist` distinguishes *absent* from
  *null* — absent properties stay unset and drop out of `toArray()` — the clean carrier for
  merge-PATCH into an action.
- **TypeScript generation** (`spatie/laravel-typescript-transformer`, `typescript:transform`):
  Data classes become the shared TS types for Inertia/web-plane payloads; `Lazy`/`Optional`
  render as TS-optional. Run in CI with a drift check where adopted.
- v4 mechanics worth remembering: `collect()` replaced `collection()` (type-preserving);
  docblock `@var SongData[]` now preferred over `#[DataCollectionOf]`; magic `fromX()`
  creation methods; Eloquent casting via `$casts`.
