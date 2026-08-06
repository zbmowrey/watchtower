---
title: Content Negotiation — JSON-Only, Forced, and Vary-Correct
description: The fleet's one-representation policy — Accept handling and the 406 ruling, the ForceJsonResponse middleware + shouldRenderJsonWhen pair Laravel doesn't ship, 415 on non-JSON bodies, Vary obligations, and charset/language positions.
tags: [stack, api, rest, http, content-negotiation, middleware]
type: stack
status: reference
updated: 2026-07-30
related: [fleet-api-specification, problem-details, http-status-codes]
---

# Content Negotiation — JSON-Only, Forced, and Vary-Correct

Fleet norms → [[fleet-api-specification]] §7. Primary source: RFC 9110 §12.

## The policy

One representation: `application/json` (UTF-8, the JSON default — no charset parameter
games). Errors: `application/problem+json` ([[problem-details]]). RFC 9110 §12.4.1 permits a
server to either honor an unsatisfiable `Accept` with **406** or ignore the header — both
conform; the fleet **picks 406** and documents it, because silently ignoring Accept is the
kind of small surprise this standard exists to eliminate. (`Accept: application/json`,
`*/*`, and `application/*` are all satisfiable and get JSON; RFC 9457 explicitly blesses
problem+json even when Accept didn't list it.)

XML is considered-and-rejected: a second representation doubles the contract surface and the
test matrix for consumers who, in 2026, universally speak JSON.

## What Laravel doesn't ship — and the fleet does

Laravel decides HTML-vs-JSON per request via `expectsJson()`; there is **no framework
middleware forcing JSON on an API group**, and the only official override is at the exception
layer. The fleet closes it with a pair (canonical artifacts in `standards/laravel/`):

1. **`ForceJsonResponse` middleware** on the api group — sets the request's `Accept` to
   `application/json` (after the 406 check), so every downstream `expectsJson()` branch,
   including validation redirects-vs-JSON, resolves the same way for every client.
2. **`shouldRenderJsonWhen(fn ($req) => $req->is('api/*'))`** in `withExceptions()` — the
   backstop guaranteeing no exception ever renders an HTML error page on the API plane.

Request bodies: `Content-Type: application/json` or **415** (API-303). No form-encoded
bodies, no `_method` spoofing — API clients send real verbs.

## Vary — the caching correctness obligation

Any response whose content depends on a request header beyond method+URI **sends `Vary`**
naming it (RFC 9110 §12.5.5) — it expands the cache key. Three refinements the RFC states:
`Authorization` need never be listed (its reuse is already prohibited per-user);
`Vary: *` is effectively "uncacheable, done wrong" — never generate it; and with path-based
versioning ([[api-versioning]]) there is no version header to vary on — one of the quiet
payoffs of that ruling.

## Language

`Accept-Language` is not negotiated: API payloads are en-only, and problem `title`/`detail`
are developer-facing strings, not UI copy. If per-tenant localization ever reaches the API
plane, it arrives as an explicit, documented parameter — never as silent header-driven
variance that intermediaries must Vary on.
