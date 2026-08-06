---
title: Conditional Requests, ETags & API Caching
description: The lost-update protection pattern — strong ETags, If-Match on writes, 428 for missing preconditions, 412 for failed ones, 304 revalidation — plus the RFC 9111 Cache-Control discipline for authenticated APIs (private/no-cache vs no-store, and why explicit beats heuristic).
tags: [stack, api, rest, http, caching, etag, concurrency, rfc]
type: stack
status: reference
updated: 2026-07-30
related: [fleet-api-specification, http-status-codes, http-method-semantics]
---

# Conditional Requests, ETags & API Caching

Fleet position (API-704 MUST / API-705 SHOULD): explicit `Cache-Control` everywhere, always;
ETag + If-Match optimistic concurrency as the upgrade path for mutable resources that warrant
lost-update protection — adopted whole or not at all. Sources: RFC 9110 §8.8/§13, RFC 9111,
RFC 6585 §3.

## Cache-Control — the MUST tier

- Default for authenticated GETs: **`private, no-cache`** — storable by the browser, *never
  reused without revalidation*, never shared. (`no-cache` permits storage; it forbids reuse
  without a revalidation round-trip — the right directive to pair with ETags. `no-store`
  forbids storage entirely — use it for credential/PII-bearing bodies.)
- **Never rely on defaults**: 404/405/410 are heuristically cacheable with no Cache-Control
  at all ([[http-status-codes]]). Explicit on every response, success and error.
- **`public` / `s-maxage` MUST NOT appear on authenticated responses** — RFC 9111 §3.5 names
  exactly three directives (`public`, `s-maxage`, `must-revalidate`) that *unlock* shared
  caching of Authorization-bearing requests. Bearer APIs are safe from shared caches by
  default precisely until someone adds `public`.

## Optimistic concurrency — the SHOULD tier, specified exactly

The lost-update problem: A GETs, B GETs, A PUTs, B PUTs — B silently erases A. The RFC
pattern:

1. GET emits a **strong ETag** (`ETag: "v7"`; content-derived or a version/updated-at
   discriminator that changes on every write). Strong, because `If-Match` **MUST use strong
   comparison** (§13.1.1); a weak `W/"…"` tag can never satisfy it.
2. Writes (PUT/PATCH/DELETE) **require `If-Match`**. Missing → **428 Precondition Required**
   (RFC 6585 §3 — this exact scenario is the code's stated purpose; not 400). Stale →
   **412 Precondition Failed**, client re-GETs and reconciles.
3. `If-None-Match: *` on PUT-create = "only if it doesn't exist yet" — the create-race guard.
4. Read revalidation: client sends `If-None-Match` with a cached ETag → **304** (no body;
   MUST carry the ETag/Cache-Control/Vary the 200 would have) → client reuses its copy.
   `If-None-Match` uses *weak* comparison; failed on GET/HEAD → 304, on writes → 412.
5. Precondition evaluation order is fixed (§13.2.2): If-Match → If-Unmodified-Since →
   If-None-Match → If-Modified-Since. Evaluate before doing the work.

**The PUT validator trap** (§9.3.4): a successful PUT response MUST NOT carry an ETag unless
the representation was stored untransformed — if the server normalizes, return the canonical
body without a validator and let the client re-GET (see [[http-method-semantics]]).

## Laravel wiring notes

No framework support for If-Match flows — it's a small fleet middleware + a `HasVersionTag`
model concern (artifact in `standards/laravel/` when the first adopter lands). Laravel's
`cache.headers` middleware (`cache.headers:private;max_age=0;etag`) can emit body-MD5 ETags
for cheap GET revalidation, but body-hash tags are computed *after* the query — they save
bandwidth, not database work; real wins come from version-column ETags checked early.
