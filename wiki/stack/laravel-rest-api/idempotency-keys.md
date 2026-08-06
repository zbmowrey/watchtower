---
title: Idempotency-Key — Safe Retries for Unsafe Writes
description: The IETF draft semantics the fleet adopts for retry-safe POSTs — replay returns the stored result, same-key/different-payload → 422, in-flight → 409 — where Stripe diverges, and the Laravel implementation sketch (cache lock + stored response, documented retention).
tags: [stack, api, rest, http, idempotency, reliability]
type: stack
status: reference
updated: 2026-07-31
related: [fleet-api-specification, http-method-semantics, problem-details]
---

# Idempotency-Key — Safe Retries for Unsafe Writes

Fleet norm (API-307, SHOULD-tier): endpoints where a duplicate write is costly — payments,
sends, one-shot creates — accept `Idempotency-Key`. Source:
draft-ietf-httpapi-idempotency-key-header (-07; not yet an RFC — the fleet adopts its
semantics because they're the standards-track direction and Struct-Field-clean), with Stripe
as the de-facto production reference.

## The contract

- Header value: a Structured-Field **String**, UUIDv4 recommended, ≤255 chars, no sensitive
  data: `Idempotency-Key: "8e03978e-40d5-43e8-bc93-6894a57f9324"`. Client-generated; unique
  per *operation*, reused only for *retries of the identical request*.
- **First sight** → process normally; store the outcome keyed by (token owner, key, payload
  fingerprint).
- **Retry after completion** → return the stored original response (status + body — success
  *or* error; Stripe replays even 500s and the fleet follows: the point is "what happened",
  not "try again differently").
- **Same key, different payload** → **422** (the draft's ruling; Stripe uses 400 — the fleet
  takes the draft's 422, which matches RFC 9110 §15.5.21 semantics: syntactically fine,
  semantically unprocessable). Problem type `idempotency-key-payload-mismatch`.
- **Retry while the original is still in flight** → **409** (draft and Stripe agree).
  Problem type `idempotency-key-in-flight`.
- **Retention MUST be documented** (draft §2.5.2): fleet default **24h** (Stripe's floor);
  after pruning, a reused key is a new request.
- GET/DELETE: the header is meaningless (already idempotent) — ignore it, don't error.

## Laravel implementation

A route middleware — golden reference at
`standards/laravel/app/Http/Middleware/IdempotencyKey.php` (wire it on the costly
POSTs first: document sends, payment capture; one per-app tune point, the
acting-principal resolution). The reference stores **2xx outcomes only** — an exception unwinds to the handler uncached, so a failed
attempt re-executes; full Stripe-style error replay needs capture at the
exception-renderer seam and is deferred to the contract-chain step. The flow:

1. Key absent on an endpoint that declares it required → **400** problem
   (`idempotency-key-required`; draft §2.7).
2. `Cache::lock("idem:{$owner}:{$key}")` — lock held ⇒ 409.
3. Hit on the stored record: fingerprint (SHA-256 of the raw body) matches ⇒ replay stored
   status+body with an `Idempotency-Replayed: true` marker header; mismatch ⇒ 422.
4. Miss: run the request, persist `{status, body, fingerprint}` with the 24h TTL, release.

Store in the shared cache (Valkey), keyed by token owner so keys can't collide across
accounts. The response replay must bypass the controller entirely — replays cost one cache
read, no domain work.

Why this exists at all: proxies MAY auto-retry idempotent methods but a client timeout on a
POST leaves "did it commit?" unknowable — the key converts that ambiguity into a safe replay
([[http-method-semantics]]).
