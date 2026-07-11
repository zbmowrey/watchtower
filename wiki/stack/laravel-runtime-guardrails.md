---
title: Laravel Runtime Guardrails (AppServiceProvider + test bootstrap)
description: The framework-level runtime guardrails — the strict/safety toggles set once in AppServiceProvider::configureDefaults() (and the test bootstrap), what each one does, why some are prod-lenient, the factory/$attributes gotcha shouldBeStrict surfaces, and the shortlist of further Laravel guardrails to evaluate. Companion to the engineering standard.
tags: [standard, parity, guardrails, laravel, runtime, eloquent, hardening]
type: stack
updated: 2026-06-23
related: [laravel-engineering-standard, pest-testing]
---

# Laravel Runtime Guardrails

Framework-level **strict/safety toggles** set once at boot — distinct from
the static/lint/test *tool set* ([[laravel-engineering-standard]]) because they change
**runtime behaviour**, not CI. They live in `AppServiceProvider::configureDefaults()`
(app boot) or the **test bootstrap** (`tests/Pest.php` / `TestCase`). These are
**first-class requirements**, on the same footing as Larastan L8 or the Pest arch
suite — see the standard's "Runtime hardening" bullet.

## The adopted set — uniform in `configureDefaults()`

Required identical on **all** the Laravel apps:

| Guardrail                                                | What it does                                                                                       | Prod?               |
|----------------------------------------------------------|----------------------------------------------------------------------------------------------------|---------------------|
| `Date::use(CarbonImmutable::class)`                      | All `now()`/date casts return immutable Carbon — no spooky-action-at-a-distance mutation.          | on everywhere       |
| **`Model::shouldBeStrict(! app()->isProduction())`**     | See below. Lazy-loads / silent attribute discards / missing-attribute reads **throw in dev & CI**. | **off in prod**     |
| `DB::prohibitDestructiveCommands(app()->isProduction())` | Blocks `migrate:fresh`/`db:wipe`/`migrate:rollback` etc. against the prod connection.              | **on in prod only** |
| `Password::defaults(…)`                                  | 12-char min, mixed/letters/numbers/symbols, `uncompromised()` (HIBP) — in prod; lenient locally.   | hardened in prod    |

**App-specific, deliberately NOT uniform** (present only where the front-end needs them):
`URL::forceScheme('https')` + `URL::forceRootUrl()` behind the TLS-terminating proxy
(key it on `isProduction()`, or on an `https://` `APP_URL`), and
`Vite::useCspNonce()` (the per-request CSP nonce — a documented security tradeoff).

## `Model::shouldBeStrict()` — the headline guardrail

One call flips three Eloquent strictness flags:

- **`preventLazyLoading`** — accessing an unloaded relation throws `LazyLoadingViolationException` (surfaces N+1).
- **`preventSilentlyDiscardingAttributes`** — `fill()`/`update()` with a non-fillable key throws instead of silently
  dropping it.
- **`preventAccessingMissingAttributes`** — reading an attribute the row never loaded throws
  `MissingAttributeException`.

**Why `! isProduction()` and not always-on:** strict mode is a *development microscope*,
not a prod seatbelt. In prod a single drifted row mustn't 500 the cluster — CI/dev catches
the violation first, prod degrades gracefully (returns null / no exception). This is
uniform across the apps.

### The gotcha it surfaces: DB-default columns aren't hydrated on factory instances

A column with a DB `default(...)` that the factory never sets is **absent from the
in-memory model** a factory returns (the insert didn't include it and the model isn't
reloaded). Under `preventAccessingMissingAttributes`, the first read **throws**. Two fixes,
both used across the apps:

- **Model `$attributes` default** (e.g. `User.is_admin`): `protected $attributes = ['is_admin' => false];`
  mirrors the DB default so every instance is hydrated. Preferred for **real columns**.
- **Appended accessor** (e.g. a computed `User.is_admin`): the value is computed, declared in
  `$appends`, so it's never a "missing" column. Use when the value **isn't a stored column**.

## Test-bootstrap guardrails

Set in `tests/Pest.php` / `TestCase`, not the app provider:

- **`Http::preventStrayRequests()`** — any un-faked outbound HTTP call throws. Keeps the
  test suite **hermetic** and reinforces the SSRF-clean posture. It was originally used
  per-test (in the `beforeEach` of HTTP tests) then **globalized** — lifted into
  `TestCase::setUp()` on all apps — see the adopted rollout below.

## Adopted — converging (rollout order)

These are now **requirements**, not options. **Enforcement policy:** enforce the
control; **if an app breaks, that is signal — refactor the app so the constraint holds, never
weaken the control.** A *genuine* dead-end (the control is truly incompatible with a
legitimate need) is documented and risk-registered with
justification + compensating controls — never silently skipped or `--no-verify`'d away.

1. **`Http::preventStrayRequests()` — global** — lifted from a per-test `beforeEach` into the
   shared **`TestCase::setUp()`** on all apps, so **every** test throws on an un-faked outbound
   request. **What it surfaced & the refactor:** Inertia SSR — a page render POSTs to the SSR
   daemon (`/__inertia_ssr`), which the guard blocks (dozens of tests where SSR is enabled; apps
   whose SSR is already off were clean). Under test that call only ever **fell back to client
   render**, so tests now disable SSR in the same `setUp`
   (`config(['inertia.ssr.enabled' => false])`) — behaviour-preserving, **prod SSR untouched**.
   **Browser E2E opts out:** `BrowserTestCase` calls `Http::preventStrayRequests(false)` — it
   drives a real browser + server and isn't hermetic.
2. **`Model::automaticallyEagerLoadRelationships()`** (Laravel 12.8+; the fleet is `^13`) — in
   `configureDefaults()`, on in every environment, **bundled with the `shouldBeStrict` enforcement
   test**. Auto-batches relationship access on a collection to kill N+1 at the source — the *fix*
   side of what `preventLazyLoading` only *detects*. **Zero blast radius**: the suites already
   eager-load with discipline (`preventLazyLoading` has been on), so the safety net changed nothing
   observable. Interacts cleanly with `preventLazyLoading` (collection access auto-loads; a lone
   model still needs explicit eager-loading).
3. **`Mail::alwaysTo(<sink>)` in non-production** — redirects all dev/staging mail to a sink so
   a real address can't receive a test send. Lands where an app dispatches mail outside prod;
   needs a per-app sink address (config).

Already covered elsewhere, no action: mass-assignment firewall (FormRequest→DTO column-map),
rate limiting, `declare(strict_types=1)` (arch-test enforced).

## Enforcement status

The tool set (Larastan/Pint/Pest arch) is **CI-gated**; the runtime guardrails are being
brought to the same bar:

- **`shouldBeStrict`** — ✅ **shipped** as `tests/Feature/RuntimeGuardrailsTest.php` on all apps:
  asserts `Model::preventsLazyLoading()` + the discard/missing checkers are true in `testing`, so
  dropping the guardrail fails CI.
- **`Http::preventStrayRequests()`** — **self-enforcing**: a stray request throws, so the suite
  itself is the gate.
- **`automaticallyEagerLoadRelationships`** — covered indirectly (turning it off changes query
  behaviour, which feature tests catch).

Shared home for the reusable assertions: `standards/laravel/tests/` (so greenfield apps built
off the bundle inherit them).
