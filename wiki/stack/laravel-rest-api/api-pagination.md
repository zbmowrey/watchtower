---
title: API Pagination — Offset, Cursor, and the Guardrails
description: paginate vs simplePaginate vs cursorPaginate — exact envelopes, when cursor pagination is mandatory territory, the per_page cap, withQueryString, and the Link header. Includes the bare-paginator shape divergence that breaks envelope consistency.
tags: [stack, api, laravel, pagination, performance]
type: stack
status: reference
updated: 2026-07-30
related: [fleet-api-specification, api-resources, api-filtering-sorting]
---

# API Pagination

Fleet norms → [[fleet-api-specification]] §5: default 25, hard cap 100, validated `per_page`,
resource-collection envelope only, `withQueryString()` mandatory.

## The three paginators

| Method | Query shape | Total? | Wire affordance |
|---|---|---|---|
| `paginate(25)` | limit/offset **+ COUNT query** | ✅ | numbered pages — the default |
| `simplePaginate(25)` | limit/offset, no COUNT | ❌ | prev/next only |
| `cursorPaginate(25)` | `WHERE` on ordered cols | ❌ | opaque `?cursor=` prev/next |

**When cursor is the right call** (official guidance + mechanics): large or unbounded sets
(offset scans everything before it — `OFFSET 100000` reads 100k rows), and **write-heavy
collections**, where offset pagination *skips or duplicates rows* as inserts land between
page fetches. Cursor builds `WHERE id > ?` against an indexed order — the most efficient form
Laravel offers. Constraints: ordering must be on a unique column (or unique combo), no NULLs
in order columns, prev/next only. Feeds and infinite scroll: cursor. Bounded admin tables:
offset is fine. Don't return totals on unbounded sets (they cost a COUNT and lie immediately).

## The envelope

Through a resource collection (the only permitted path — API-401/503):

```json
{
  "data": [ { "...": "..." } ],
  "links": { "first": "...", "last": "...", "prev": null, "next": "..." },
  "meta": { "current_page": 1, "per_page": 25, "total": 91, "..." : "..." }
}
```

A **bare paginator** serializes to a totally different flat shape (`data` alongside
`total`/`current_page`/`*_page_url` at top level) — mixing the two across endpoints is the
most common consistency defect in Laravel APIs, hence the ban.

## Guardrails

- **`per_page` is client input → validate it**: `['integer', 'min:1', 'max:100']`. No
  "all"-style sentinels, ever — an uncapped list is a self-DoS (API-501).
- **`->withQueryString()`** on every paginated query — otherwise `links.next` silently drops
  the live `filter`/`sort` params and page 2 of a filtered list is unfiltered.
- A `Link` header (RFC 8288, `rel="next|prev|first|last"`, absolute URIs) SHOULD mirror the
  body links — GitHub's canonical pattern, free to emit, and lets header-only clients walk
  pages without parsing bodies.
- Cursor params: `cursor` (opaque base64 — clients MUST NOT parse it) + the same `per_page`.
