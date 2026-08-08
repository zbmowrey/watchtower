---
title: API Rate Limiting — the Limiter, the Headers, the 429
description: The mandatory RateLimiter::for('api') definition and throttle:api wiring, Laravel's actual header emissions verified from source, response-based counting against enumeration, and the status of the redesigned IETF RateLimit draft.
tags: [stack, api, laravel, rate-limiting, throttle, security]
type: stack
status: reference
updated: 2026-07-30
related: [fleet-api-specification, sanctum-token-auth, problem-details]
---

# API Rate Limiting

Fleet norms → [[fleet-api-specification]] §10. Laravel 11+ **no longer binds a default
`throttle:api`** (still true through 13.24, re-checked 2026-08-08) — an app that never declares
the limiter ships an unthrottled API while the route group looks protected. Declaring it is on
us, every app, always.

## The fleet default

```php
// AppServiceProvider::boot()
RateLimiter::for('api', function (Request $request): Limit {
    return Limit::perMinute(120)
        ->by('api:'.($request->user()?->getAuthIdentifier() ?? $request->ip()));
});
```

applied as `throttle:api` on the versioned group. Keyed per authenticated user (all their
tokens share one bucket — a per-token key would make minting tokens a limit bypass), per-IP
for the unauthenticated sliver (the public OpenAPI document, if served). Stacked windows use
the unique-`by`-prefix idiom (`'minute:'.$id`, `'day:'.$id`).

## Headers — verified from `ThrottleRequests` source (docs don't cover this)

- Every throttled-route response: `X-RateLimit-Limit`, `X-RateLimit-Remaining`.
- Only once the limit is hit: `Retry-After` (seconds) + `X-RateLimit-Reset` (unix timestamp).
  So clients cannot preemptively back off from headers alone — a known Laravel limitation,
  not a fleet bug; document it.
- The 429 body is the fleet problem+json (`type: rate-limit-exceeded`) with `Retry-After` on
  the response (fleet MUST; the RFC only says MAY) — [[problem-details]]. 429 and 428 MUST
  NOT be cached (RFC 6585).

**The IETF `RateLimit`/`RateLimit-Policy` structured fields are not adopted yet** —
deliberately. The draft was *redesigned* in 2026 (draft-11 dropped the
Limit/Remaining/Reset trio most blog posts still describe, for two structured fields plus
registered problem types) and is still not an RFC. Adopting now means guessing which shape
survives; the X- trio + `Retry-After` is what GitHub ships and what Laravel emits natively.
Revisit on RFC publication — it would be an additive header change.

## Beyond the blanket limiter (API-1003)

- **Named limiters for expensive/abuse-prone surfaces**: exports, `quotes:send`-style money
  paths, token minting — each its own `RateLimiter::for()` with its own budget.
- **Response-based counting against enumeration** (shipped in Laravel 12; promoted to a
  headline rate-limiter API at Laracon US 2026): count only misses toward a
  tight bucket, so ID-guessing burns out fast while legitimate traffic doesn't —
  `Limit::perMinute(10)->by(...)->after(fn ($response) => $response->status() === 404)`.
- Non-HTTP work (jobs sending mail on API's behalf) uses the `RateLimiter` facade directly —
  same limits, enforced where the work happens.
