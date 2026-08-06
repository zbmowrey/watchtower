---
title: HTTP Status Codes for APIs (RFC 9110 §15, RFC 6585)
description: The CRUD-relevant status registry with companion-header obligations — what each code means, which headers are RFC-MUSTs (Allow on 405, WWW-Authenticate on 401), the 400-vs-422 line, and the heuristic-cacheability trap on 404/405/410.
tags: [ stack, api, rest, http, status-codes, rfc ]
type: stack
status: reference
updated: 2026-07-30
related: [ fleet-api-specification, http-method-semantics, problem-details, conditional-requests-etags ]
---

# HTTP Status Codes for APIs

Primary sources: RFC 9110 §15, RFC 6585. Fleet norms → [[fleet-api-specification]] API-410/605. All 4xx/5xx bodies are
problem+json ([[problem-details]]).

## Success

| Code | Use                                          | Obligations                                                                                                        |
|------|----------------------------------------------|--------------------------------------------------------------------------------------------------------------------|
| 200  | GET, PUT/PATCH returning the representation  | GET SHOULD carry validators (strong ETag preferred) where adopted                                                  |
| 201  | create (POST; PUT-create is an RFC MUST)     | `Location` names the new resource — RFC SHOULD, **fleet MUST**. `JsonResource` defaults to 200; set 201 explicitly |
| 202  | accepted, processing later (queued work)     | body points at a status monitor                                                                                    |
| 204  | success, nothing to say — the DELETE default | empty body; headers still describe post-action state                                                               |

## Client errors — and the lines between them

| Code | Meaning                                                                       | Obligations / notes                                                                   |
|------|-------------------------------------------------------------------------------|---------------------------------------------------------------------------------------|
| 400  | malformed: unparseable JSON, bad framing, rejected reserved-query members     | the *syntax* bucket                                                                   |
| 401  | missing/invalid credentials                                                   | **MUST send `WWW-Authenticate`** (§15.5.2) — fleet: `Bearer`                          |
| 403  | authenticated, denied (authorization, entitlement)                            | MAY 404 instead to conceal existence                                                  |
| 404  | absent or concealed                                                           | **heuristically cacheable** — send explicit `Cache-Control`                           |
| 405  | method not allowed here                                                       | **MUST send `Allow`** (§15.5.6) — Laravel's router does; also heuristically cacheable |
| 406  | Accept excludes everything we serve                                           | fleet: JSON-only policy, [[content-negotiation]]                                      |
| 409  | conflict with current resource state                                          | body SHOULD explain the conflict source                                               |
| 410  | gone permanently — sunset surfaces                                            | heuristically cacheable                                                               |
| 412  | precondition (If-Match) failed                                                | [[conditional-requests-etags]]                                                        |
| 413  | payload too large                                                             | SHOULD `Retry-After` if temporary                                                     |
| 415  | unsupported media type                                                        | fleet: non-JSON bodies                                                                |
| 422  | syntactically valid, semantically unprocessable — **all validation failures** | RFC 9110 §15.5.21 (moved into core HTTP from WebDAV)                                  |
| 428  | request must be conditional (missing If-Match)                                | RFC 6585 §3 — the correct answer, not 400; MUST NOT be cached                         |
| 429  | throttled                                                                     | `Retry-After` is RFC-MAY, **fleet MUST**; MUST NOT be cached                          |

**The 400 vs 422 line, precisely:** 400 = the request could not be *read* (syntax, framing, malformed JSON, disallowed
`filter[...]` members); 422 = the request was read fine and the *content* fails semantic rules (every Laravel validation
failure). Keeping the line sharp is what lets clients branch: 400 = fix your request construction, 422 = show field
errors.

## Server errors

| Code | Use                                                              | Obligations                            |
|------|------------------------------------------------------------------|----------------------------------------|
| 500  | unmapped exception — "I forgot to decide" (correct failure mode) | never leaks internals (API-606)        |
| 503  | overload / maintenance                                           | **fleet MUST `Retry-After`** (RFC MAY) |

## Two traps

1. **Heuristic cacheability** (§15.1): 200, 204, 301, 308, **404, 405, 410**, 414, 501 can be cached by intermediaries
   *with no Cache-Control at all*. A bare API 404 can get cached. Hence API-704: explicit `Cache-Control` on **every**
   response.
2. **Error bodies are still SHOULD-required** (§15.5/§15.6): *"the server SHOULD send a representation containing an
   explanation of the error situation"* — an empty 4xx is hostile; problem+json satisfies this uniformly.
