---
title: HTTP Method Semantics (RFC 9110 §9, RFC 5789)
description: The method properties table — safety, idempotency, cacheability — plus the exact PUT/POST/PATCH/DELETE rules APIs get wrong, with RFC section citations. PUT's two MUSTs, PATCH atomicity, the no-mutating-GET rule, proxy retry behavior, and the new QUERY method (RFC 10008, watch-item).
tags: [stack, api, rest, http, methods, rfc, query]
type: stack
status: reference
updated: 2026-07-30
related: [fleet-api-specification, http-status-codes, conditional-requests-etags, idempotency-keys]
---

# HTTP Method Semantics

Primary sources: RFC 9110 §9; PATCH is RFC 5789; QUERY is RFC 10008 (June 2026). Fleet
norms → [[fleet-api-specification]] §2/§4.

| Method | Safe | Idempotent | Cacheable | Notes |
|---|---|---|---|---|
| GET | ✅ | ✅ | ✅ | request bodies "have no generally defined semantics" — never read one (unchanged by RFC 10008; the body-carrying safe method is QUERY, below) |
| HEAD | ✅ | ✅ | ✅ | Laravel auto-answers HEAD for GET routes — free conformance |
| POST | ❌ | ❌ | only w/ explicit freshness + `Content-Location` | process-at-resource semantics |
| PUT | ❌ | ✅ | ❌ (invalidates) | full replacement of the target |
| PATCH | ❌ | ❌ | ❌ | RFC 5789; idempotency recoverable via `If-Match` |
| DELETE | ❌ | ✅ | ❌ (invalidates) | request bodies: SHOULD NOT |
| OPTIONS | ✅ | ✅ | ❌ | CORS preflight answered by `HandleCors` |
| QUERY (RFC 10008) | ✅ | ✅ | ✅ (cache key MUST incorporate request content) | the "safe GET with a body" — **not adopted by the fleet yet**, see below |

**The rules that actually bite:**

- **Safe means read-only, by MUST** (§9.2.1): *"If the purpose of such a resource is to
  perform an unsafe action, then the resource owner MUST disable or disallow that action when
  it is accessed using a safe request method."* `GET /orders/1/cancel` is a spec violation,
  not a style choice. Lifecycle transitions are `POST` to a sub-path.
- **Proxies auto-retry idempotent methods** (§9.2.2: *"A proxy MUST NOT automatically retry
  non-idempotent requests"* — implying they may retry idempotent ones). A PUT/DELETE handler
  must genuinely tolerate replays; for POST, that's what [[idempotency-keys]] exist for.
- **PUT has two hard MUSTs** (§9.3.4): created → **201**; replaced → **200 or 204**. And the
  trap: *"MUST NOT send a validator field (ETag/Last-Modified) in a successful response to PUT
  unless the request's representation data was saved without any transformation"* — an
  endpoint that normalizes input and still returns an ETag is non-conformant. If the server
  transforms, prefer PATCH + returning the canonical representation.
- **PUT vs POST** (§9.3.4): the server choosing the URI ⇒ POST. PUT payload violating
  resource constraints ⇒ 409 or 415.
- **POST create** (§9.3.3): SHOULD send 201 + `Location` — the fleet hardens this to MUST
  (API-410).
- **PATCH is atomic by MUST** (RFC 5789 §2): *"The server MUST apply the entire set of
  changes atomically"* — all changes or none, and never expose a half-applied representation
  to a concurrent GET. Error mapping: malformed patch doc → 400; unsupported patch type →
  415; well-formed but unprocessable → 422; precondition → 412; conflicting state → 409.
  Fleet PATCH is merge-semantics: only fields present in the body change.
- **DELETE** (§9.3.5): 204 when enacted with nothing to say (the fleet default), 202 if
  deferred, 200 with a status body if you must narrate.
- **405 vs 501** (§9.1): method recognized but unsupported on this resource → 405 (+ `Allow`,
  a MUST); method unrecognized entirely → 501. *"All general-purpose servers MUST support
  GET and HEAD."*

## QUERY — RFC 10008 (June 2026), the watch-item

The first new general-purpose HTTP method since PATCH (2010): **safe, idempotent,
cacheable**, with the query carried in the **request body** — resolving the ancient "GET
with a body" problem without touching GET (RFC 10008 does *not* update RFC 9110; GET stays
body-less). *"As with POST, the input to the query operation is passed as the content of
the request rather than as part of the request URI. Unlike POST, however, the method is
explicitly safe and idempotent"* (§1). Mechanics worth knowing:

- **Caching** (§2.7): responses are cacheable, but *"the cache key for a QUERY request MUST
  incorporate the request content"*; caches MAY normalize semantically insignificant
  differences first — mis-normalization is a new cache-poisoning surface (§4).
- **Discovery**: the `Accept-Query` response header (Structured Fields list of media types,
  §3) advertises support per path.
- **CORS**: every browser QUERY triggers a preflight (§4).

**Fleet position: noted, not adopted** ([[fleet-api-specification]], considered-and-rejected
tail). One month post-publication there is no end-to-end support in the chain we run
(ingress-nginx, CDNs, PHP-FPM/FrankenPHP, Laravel's router, Scramble/OpenAPI tooling), and
the fleet's `filter[...]`/`sort` vocabulary ([[api-filtering-sorting]]) keeps query
complexity comfortably inside URL limits. Revisit when a real consumer hits URL-length
walls **and** the toolchain speaks it; adopting then would be additive (a new method beside
GET, discoverable via `Accept-Query`), not breaking.
