---
title: Filtering, Sorting, Includes — the Query Vocabulary
description: The spatie/laravel-query-builder v7 conventions the fleet adopts — filter[x], sort=-field, include=, fields[type] — deny-by-default allow-lists, the v7 breaking changes that shape our layering (QueryBuilder no longer extends Builder), and the 400 error contract.
tags: [stack, api, laravel, spatie, query-builder, filtering, sorting]
type: stack
status: reference
updated: 2026-07-30
related: [fleet-api-specification, api-pagination, spatie-laravel-data, query-builders, repositories]
---

# Filtering, Sorting, Includes — the Query Vocabulary

Fleet norms → [[fleet-api-specification]] API-504/505/506. Package:
**`spatie/laravel-query-builder` v7** (7.3.x — PHP ^8.3, Laravel ^12|^13). The query-string
vocabulary is JSON:API's — the part of that spec worth borrowing.

## The vocabulary

```
GET /users?filter[name]=john&filter[id]=1,2,3        # comma = OR within one filter
GET /users?sort=-created_at,name                     # `-` prefix = descending
GET /users?include=posts.comments,postsCount         # dot paths; Count/Exists implied
GET /posts?fields[posts]=id,title&include=author&fields[authors]=id,name
```

Everything is **deny-by-default**: `allowedFilters()` / `allowedSorts()` /
`allowedIncludes()` / `allowedFields()` (all variadic in v7; the `'*'` wildcard was removed
precisely to prevent accidental column/relation exposure). Bare-string filters are `LIKE`
partials; `AllowedFilter::exact|beginsWith|endsWith|scope|callback|custom|operator|trashed`
cover the rest; v7 adds `groupOr()`/`groupAnd()` and aggregate includes
(`AllowedInclude::sum('postsViewsSum', 'posts', 'views')`).

**Sparse fieldsets caveat:** `fields[...]` fully overrides the SELECT — include the foreign
keys yourself or eager loading silently breaks.

## Layering — where the wrapper lives

v7's `QueryBuilder` **no longer extends** `Illuminate\Database\Eloquent\Builder`, which locks
in the fleet composition (and matches [[repositories]]/[[query-builders]]):

```php
// repository/query-builder layer: tenancy, authorization, base scoping — returns Builder
$base = $this->playbooks->visibleTo($user);          // : Builder

// HTTP edge (controller): request-driven shaping only
$page = QueryBuilder::for($base)
    ->allowedFilters(AllowedFilter::exact('status'), 'name')
    ->allowedSorts('name', '-created_at')
    ->allowedIncludes('steps')
    ->defaultSort('-created_at')
    ->paginate($request->perPage())
    ->withQueryString();
```

A repository method typed `: Builder` returning a `QueryBuilder` breaks under v7 — never let
the wrapper leak inward. Allow-lists mirror the resource: an `allowedInclude` implies the
Resource renders it via `whenLoaded()` ([[api-resources]]).

## The `include` collision

laravel-data's `allowedRequestIncludes()` claims the same `?include=` param for
serialization-layer partials — a different meaning under the same name. Fleet ruling
(API-505): **query-builder owns `include`**; laravel-data request-partials are forbidden.
Exposure and eager-loading then align by construction.

## Error contract

Disallowed members throw `InvalidFilterQuery` / `InvalidSortQuery` / `InvalidIncludeQuery` /
`InvalidFieldQuery` (all extend `InvalidQuery`, all **400**). The fleet renderer converts
them to problem+json ([[problem-details]]) with a `type` of `invalid-query`. Keep the
`disable_invalid_*_query_exception` flags `false` — suppression silently ignores bad params
and hides client bugs (API-506). The allowed-values enumeration in the message is fine to
keep: the allow-list is documented in the OpenAPI spec anyway; it is a contract, not a secret.
