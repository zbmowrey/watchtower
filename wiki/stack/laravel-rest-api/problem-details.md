---
title: Problem Details — RFC 9457 in Laravel
description: The application/problem+json error contract — members, type URIs, the spec's own 422 validation shape with JSON Pointers, and how the fleet renderer replaces Laravel's {message, errors} default in bootstrap/app.php without leaking internals.
tags: [ stack, api, rest, errors, rfc9457, problem-json, laravel ]
type: stack
status: reference
updated: 2026-07-30
related: [ fleet-api-specification, http-status-codes, content-negotiation ]
---

# Problem Details — RFC 9457 in Laravel

RFC 9457 (obsoletes 7807; only three changes, so 7807 knowledge transfers). Media type **`application/problem+json`**.
Fleet norms → [[fleet-api-specification]] §6.

## The members

| Member     | Rule                                                                                                                                                                                                                                 |
|------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `type`     | URI identifying the problem *class* — the primary identifier consumers MUST key on. Defaults to `about:blank` ("no semantics beyond the status code"). Fleet shape: `https://<host>/problems/<kebab-slug>`, resolving to human docs. |
| `title`    | short summary of the *type* — fixed per type, never per occurrence (localization aside)                                                                                                                                              |
| `status`   | advisory copy of the HTTP code — **MUST equal the actual response status**                                                                                                                                                           |
| `detail`   | occurrence-specific, *corrective* ("ought to focus on helping the client correct the problem, rather than giving debugging information"); consumers SHOULD NOT parse it                                                              |
| `instance` | URI identifying this occurrence — the natural home for a request correlation id                                                                                                                                                      |

**Extensions** are first-class: unknown members MUST be ignored by clients, which is what makes the format additively
evolvable. Extension names: start alpha, `[A-Za-z0-9_]`, ≥3 chars.

## Validation errors — the shape is in the RFC itself

RFC 9457 §3's second example is a 422 carrying exactly the mapping Laravel needs:

```json
{
  "type": "https://app.example/problems/validation-error",
  "title": "Your request is not valid.",
  "status": 422,
  "errors": [
    {
      "detail": "must be a positive integer",
      "pointer": "#/age"
    },
    {
      "detail": "must be a valid email address",
      "pointer": "#/users/2/email"
    }
  ]
}
```

Laravel's `ValidationException::errors()` is `field => string[]` with dot-flattened keys (`users.2.email`); the renderer
maps each dot path to a JSON Pointer (`#/users/2/email`) and each message to one `errors[]` entry. That is API-603.

## The Laravel wiring

Laravel ships `{message, errors?}` — **no problem+json anywhere in the framework** (verified against the 12.x docs and
`Handler` source). The fleet renderer lives in `bootstrap/app.php`
`withExceptions()` (canonical artifact in `standards/laravel/`):

1. `shouldRenderJsonWhen()` covers `api/*` so exceptions never render HTML on the API plane.
2. A single `respond()`/`render()` layer converts every Throwable to problem+json:
   framework exceptions by class (`AuthenticationException` → 401 + `WWW-Authenticate`,
   `ValidationException` → 422 + `errors[]`, `ThrottleRequestsException` → 429 +
   `Retry-After`, binding misses → 404), domain exceptions via the explicit contract below.
3. **Domain exceptions declare their own mapping** (API-604): implement the fleet
   `ProblemDetails` contract exposing `status()` + `problemType()` (+ optional extensions). Explicit beats name-suffix
   matching — a suffix scheme silently 500s any exception whose name misses the list *and* invites drive-by renames to
   change behavior. An unmapped exception **should** 500: that is "nobody decided", surfaced loudly.

## Discipline

- **Never leak**: no `exception`, `file`, `line`, `trace`, SQL, or allow-list dumps in any problem body. Note Laravel's
  `APP_DEBUG=true` JSON bodies carry all of those — the renderer must not fall through to them even in debug.
- **When not to mint a type** (RFC 9457 §4): a plain 403 on a PUT needs no custom type —
  `about:blank` + status is enough. Mint types where the client can *act* on the distinction (`entitlement-required` vs
  plain denial; `quota-exceeded` vs generic 429).
- Problem types are an **immutable contract** (Azure's error-code rule): never renamed, never re-meant; retire by
  minting a successor.
- RFC 9457 explicitly blesses returning problem+json even when Accept didn't list it.
