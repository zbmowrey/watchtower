---
title: Sanctum Token Auth — Abilities, the Clamp, and the Traps
description: Personal access tokens as the fleet API's only credential — resource:verb ability naming, one ability per route via the ALL-of middleware (and why the ANY-of twin is banned), the grant-time permission clamp, finite expiry, and the tokenCan-always-true SPA trap.
tags: [stack, api, laravel, sanctum, auth, tokens, security]
type: stack
status: reference
updated: 2026-07-30
related: [fleet-api-specification, api-rate-limiting, problem-details]
---

# Sanctum Token Auth — Abilities, the Clamp, and the Traps

Fleet norms → [[fleet-api-specification]] §9. Package: `laravel/sanctum` v4, personal access
tokens only (`Authorization: Bearer`), stateless (API-104) — Sanctum's SPA cookie mode is a
web-plane affordance and never mounts on `/api/v{n}`. Passport/OAuth2 only if a genuine
third-party consent flow materializes.

## Abilities — the vocabulary

- **Shape: `resource:verb`** (`customers:read`, `quotes:send`, `payments:record`), pinned by
  `^[a-z][a-z-]*:(read|write|send|record)$`. Resource-first groups naturally in pickers,
  docs, and sorted lists; the verb set extends beyond read/write for money paths, which get
  their own abilities so a "write" grant never implicitly moves money.
- The vocabulary is a **single catalog** (config or enum — one owner) feeding the mint UI,
  the route middleware, and the OpenAPI security scheme. An endpoint that can't be named as
  a verb on a resource is a modeling smell, not grounds for an ability exception.
- **Exhaustively pinned by test** (API-1203): `toBe([...])` on the full list + the shape
  regex — vocabulary drift is a failing test.

## Enforcement — one ability per route, ALL-of middleware

```php
Route::middleware('abilities:quotes:send')->post('quotes/{quote}/send', ...);
```

Sanctum ships two near-identical aliases with **opposite semantics**: `abilities:` =
`CheckAbilities` = ALL listed required; `ability:` = `CheckForAnyAbility` = ANY one
suffices. The fleet uses **`abilities:` exclusively and bans the `ability:` alias outright**
(don't even register it in `bootstrap/app.php`) — one ability per route makes the ALL/ANY
distinction moot while keeping the ability→endpoint map trivially auditable (API-903).

**Abilities gate the token; policies gate the user** (API-905). Two reasons this is
non-negotiable: `tokenCan()` returns **`true` unconditionally** for first-party SPA
(cookie) sessions, and an ability says nothing about *which* records the user may touch.
Every write still runs `can()` — in the FormRequest's `authorize()` or the action.

## The grant-time clamp (API-904)

A token is a **delegation** of its minter's authority, never an escalation: each ability maps
to the web-plane permission atom required to grant it (`customers:read` → `customers.view`),
and the clamp is enforced **twice** — the mint picker only offers grantable abilities, and
the store FormRequest re-validates with `Rule::in($grantable)`. Pinned by a test asserting
every ability resolves to a real permission atom. Without the clamp, a low-privilege user
mints an admin-shaped token and the API plane becomes a privilege-escalation path.

## Hygiene

- **Expiry is finite**: `config/sanctum.php` `expiration` set (fleet default 525600 = 365d);
  `sanctum:prune-expired` scheduled daily. Plaintext token shown exactly once at mint.
- **401s carry `WWW-Authenticate: Bearer`** (an RFC MUST the fleet renderer adds —
  [[problem-details]]); Laravel alone does not send it.
- Entitlement/paywall rides the route **group** (`403` + problem type
  `entitlement-required`, not 402) — never re-checked per controller.
- Wildcard (`*`) tokens are for tests only (`Sanctum::actingAs($user, ['*'])`); the mint UI
  never offers one.
- Token management UI (mint with ability picker, list, revoke) ships with the API — an API
  without a mint surface is unreachable by construction.
