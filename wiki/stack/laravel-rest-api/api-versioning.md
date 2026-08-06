---
title: API Versioning — Path Majors, Additive Evolution, Sunset
description: Why the fleet versions in the URL path with integer majors, the breaking-vs-additive taxonomy that makes versioning cheap, prior art (Stripe/GitHub/Shopify/Azure/Zalando), Laravel mechanics, and the RFC 9745/8594 Deprecation→Sunset→410 retirement sequence.
tags: [stack, api, rest, versioning, deprecation, rfc]
type: stack
status: reference
updated: 2026-07-30
related: [fleet-api-specification, openapi-scramble, rest-maturity-and-doctrine]
---

# API Versioning

Fleet norms → [[fleet-api-specification]] §8.

## Why path majors

Four placements exist: URI path, custom header (GitHub `X-GitHub-Api-Version`), media type
(Zalando's mandate), query param (Azure). The deciding factor is never aesthetics — it is
**CDN cache-key behavior and client ergonomics**. Path versions get distinct cache keys for
free, paste into a browser, and show up in logs unaided; every header/param scheme needs
`Vary` discipline everywhere or serves the wrong version from cache (the classic production
failure). Date-based pinning (Stripe `2026-07-29.dahlia`, GitHub dates, Azure `api-version=`)
solves per-account pinning for thousands of anonymous integrators — machinery a first-party
fleet doesn't need. Shopify is the closest cousin (dated *path* versions, quarterly). Fleet:
**`/api/v1`, integer majors only** — a minor in the URL would contradict the tolerant-reader
rule.

## The taxonomy that makes versioning cheap

Version **only on breaking change**, and define breaking narrowly (consolidated from GitHub,
Azure, Zalando #106–#112):

**Additive (ship to the live major):** new endpoint; new *optional* request field/param; new
response field; new request-enum value; new response-enum value *if declared extensible up
front* (`x-extensible-enum` — this is why API-408 declares them); new optional response
header.

**Breaking (mint v(N+1)):** remove/rename anything; new *required* request field (or
optional→required); narrow a type/format/constraint; change a status code's meaning; change
pagination semantics or observable defaults; flip nullability clients branch on.

Supporting rules worth quoting: Zalando **#108** clients MUST ignore unknown fields;
**#110** top-level responses MUST be JSON objects (a bare array can never grow `meta`).
Enforcement is mechanical, not honor-system: oasdiff in CI fails on breaking diffs
([[openapi-scramble]]).

## Laravel mechanics

```php
// routes/api.php (ST) — MT apps do the same inside the tenant route file
Route::prefix('v1')->name('api.v1.')->group(base_path('routes/api/v1.php'));
```

**Only the transport layer is versioned**: `App\Http\Api\V1\{Controllers,Requests,Resources}`
over a shared, unversioned domain (API-103). A v2 that only reshapes responses is a new
Resource directory + route file — cheap. A v2 that changes domain semantics means the domain
was wrong, not the API. Never edit a v1 Resource to serve v2; v1 stays byte-identical after
v2 mounts. Both majors mount simultaneously; there is no in-place upgrade.

## Retirement — the two-header sequence

1. **Announce:** every response from the superseded major adds `Deprecation` (RFC 9745 — a
   Structured-Field **Date**: `Deprecation: @1688169599`) plus
   `Link: <migration-doc>; rel="deprecation"`.
2. **Schedule:** once a shutdown date exists, add `Sunset` (RFC 8594 — an **HTTP-date**:
   `Sunset: Sat, 31 Dec 2026 23:59:59 GMT`). **Two different date formats by design** — a
   real implementation trap. Sunset MUST NOT precede Deprecation (RFC 9745 §4).
3. **Retire:** after the sunset instant, the surface answers **410 Gone** (GitHub's
   behavior) — not 404; the resource existed and is deliberately gone.

Minimum overlap: **6 months** first-party-only, **12 months** with any external consumer
(prior art: Shopify ≥9, GitHub ≥24). `X-Api-Version` on every response (API-806) is what
makes "who is still on v1" answerable from logs.
