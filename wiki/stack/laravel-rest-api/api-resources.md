---
title: Eloquent API Resources — the Output Layer
description: JsonResource/ResourceCollection as the response contract — wrapping facts (why unwrapping guarantees inconsistency), the full conditional-attribute method inventory, pagination integration, the 201 and withQueryString traps, and the whenLoaded N+1 rule.
tags: [stack, api, laravel, resources, serialization, json]
type: stack
status: reference
updated: 2026-07-30
related: [fleet-api-specification, api-pagination, spatie-laravel-data, openapi-scramble]
---

# Eloquent API Resources — the Output Layer

The fleet's mandated success-response layer (API-401): framework-native, fast (thin array
building), and **statically inferable by Scramble's free tier** — which laravel-data output
is not ([[openapi-scramble]], [[spatie-laravel-data]]). Source: Laravel docs
`eloquent-resources` + `ConditionallyLoadsAttributes`/`JsonResource` framework source.

## Wrapping — the three facts behind API-402

`JsonResource::$wrap = 'data'` by default. Verified behavior:

1. `withoutWrapping()` affects **only the outermost** resource; manually added `data` keys
   survive. Laravel **never double-wraps**.
2. **Paginated responses are wrapped even after `withoutWrapping()`** — they must carry
   sibling `meta`/`links`. So unwrapping produces `{...}` on show and `{"data":[...]}` on
   index: an inconsistent envelope *by construction*. That mechanical fact, plus
   Zalando #110 (top-level must be an object, or it can never grow), is why wrapping is
   mandatory fleet-wide.
3. A dedicated `ResourceCollection` subclass is needed only for custom collection-level
   `toArray()`; `XResource::collection($items)` covers the normal case, and `additional()` /
   `with()` add top-level `meta` without a subclass.

## Conditional attributes — the working set

A `MissingValue` removes the key entirely (not nulled — see API-407 for when that's allowed:
sparse/include mechanics only). Closures defer expensive computation.

| Documented | Undocumented but public (verified from source) |
|---|---|
| `when`, `mergeWhen`, `whenHas`, `whenNotNull`, `whenLoaded`, `whenCounted`, `whenAggregated`, `whenPivotLoaded`, `whenPivotLoadedAs` | `unless`, `mergeUnless`, `merge`, `whenNull`, `whenAppended`, `whenExistsLoaded` (pairs with `withExists()`), `attributes`, `transform` |

**The N+1 rule (API-409):** a resource that touches `$this->relation` directly triggers a
lazy load per row when the controller forgot to eager-load. `whenLoaded('relation')` +
`whenCounted()` push that decision to the controller/query layer, where eager loading is
explicit — and under the fleet's `Model::shouldBeStrict()` runtime guardrails a violation
throws instead of silently querying.

```php
'posts'       => PostResource::collection($this->whenLoaded('posts')),
'posts_count' => $this->whenCounted('posts'),
'secret'      => $this->when($request->user()->tokenCan('admin:read'), fn () => ...),
```

`mergeWhen` caveat from the docs: never inside arrays mixing string/numeric keys.

## Pagination integration

Passing a paginator to `collection()` adds `links` + `meta` automatically and guarantees your
own additions merge rather than collide (`paginationInformation()` to customize). The two
traps ([[api-pagination]] for the full story):

- **`->withQueryString()` is not on by default** — without it every pagination link drops the
  current `filter`/`sort` params (API-503).
- A **bare paginator** returns a completely different flat JSON shape than a resource-wrapped
  one — the single most common API-consistency defect, and why API-401 bans bare paginators.

## Status codes and headers

`JsonResource` responses are always **200** unless told otherwise — `store()` must return
`->response()->setStatusCode(201)` plus a `Location` header (API-410). Customize outbound
headers via `->response()->header(...)` or `withResponse()`. Convention-magic discovery
(`$model->toResource()`) is avoided: the explicit `XResource::make()` / `::collection()` call
keeps the contract visible at the call site and Scramble-legible.
