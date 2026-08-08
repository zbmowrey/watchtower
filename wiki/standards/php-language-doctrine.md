---
title: PHP Language Doctrine (8.3–8.5 rulings, 8.6 forward guard)
description: The normative ruling set for modern PHP language features in fleet code — which 8.3/8.4/8.5 idioms are mandated, preferred, deferred, or banned, and why; the typed-boundary idioms that make PHPStan levels 9/10 tractable; the PDO pre-flight for the 8.5 runtime move; and the PHP 8.6 forward guard. One fact, one owner — [[type-safety-and-strictness]] keeps strict-types/strict-equality and points here for everything version-shaped.
tags: [ spec, standard, php, language, idioms, mandate ]
type: standard
status: normative
updated: 2026-08-08
related: [ fleet-app-specification, type-safety-and-strictness, data-transfer-objects, framework-bump-playbook, laravel-runtime-guardrails ]
---

# PHP Language Doctrine

The **requirement of record for language-feature usage** in fleet PHP code. The stance: **we use
advanced functionality where it is reasonable and performant** — a feature is adopted when it
deletes boilerplate, closes a correctness hole, or makes an invariant machine-checkable, and
deferred when it is a style bet the toolchain or ecosystem hasn't settled. Adoption reality is
part of the evidence: as of mid-2026, 8.5 syntax features have near-zero uptake in norm-setting
packages (no `|>` in laravel/framework, symfony, or spatie source), so "the community does it"
is never the argument here — the mechanical payoff is.

Version floors are owned by [[fleet-app-specification]] §1 (composer floor `^8.4`, runtime/CI
8.5). Everything below assumes that floor. Note one supply-chain fact that shapes several
rulings: Laravel 13 depends on `symfony/polyfill-php85`, so selected 8.5 *functions* (not syntax)
exist on every fleet runtime regardless of PHP version.

## §1 Rulings

Normative language per the spec: **MUST / SHOULD / MAY / NOT YET / MUST NOT.** A NOT YET is a
considered-and-deferred ruling with a revisit trigger — not silence.

### PHP 8.3

| Feature | Ruling |
|---|---|
| `#[\Override]` | **MUST** on every method that overrides a parent — machine-enforced via PHPStan's `checkMissingOverrideMethodAttribute: true` (spec §2), so a renamed parent method breaks the build instead of silently orphaning the child. The bundle's `AppServiceProvider` already models it. |
| Typed class constants | **MUST** for new constants (`private const int TTL_SECONDS = 86_400` — the bundle's `IdempotencyKey` models it). |
| `json_validate()` | **SHOULD** where the question is only "is this valid JSON?" — it avoids materializing the decoded tree. Decode-then-check remains correct when you need the value anyway. |
| Readonly-class refinements | Already doctrine: DTOs/VOs are `final readonly` ([[data-transfer-objects]], arch-enforced `toBeReadonly()`). |

### PHP 8.4

| Feature | Ruling |
|---|---|
| Property hooks | **MAY** in plain domain classes and value objects where a hook deletes a getter/setter pair or concentrates a validation invariant. **MUST NOT** on Eloquent models — this is not caution, it's settled: Laravel rejected hooks-as-accessors twice upstream (framework PRs #55412, #55822); `Attribute::make()`/`casts()` remain the model-side idioms. Caveat at serialization boundaries: hooks still trip reflection/serialization bugs in laravel-data and Doctrine — in `*\Data` carrier classes, restrict hooks to **get-only virtual properties** (which laravel-data v4 supports). |
| Asymmetric visibility (`private(set)`/`protected(set)`) | **SHOULD** where a class needs a readonly public face over internal mutation (aggregates, builders, state machines) — the middle ground `readonly` can't express. Not a replacement for `final readonly` DTOs. |
| `array_find` / `array_any` / `array_all` | **SHOULD** over hand-rolled foreach-and-flag loops in plain-PHP code; `Collection` chains keep their own idiom — don't mix the two styles in one expression. |
| `new X()->method()` (no parens) | **MAY** — the bundle's Pint config already sets `new_with_parentheses: false`; follow Pint, don't relitigate per file. |
| `#[\Deprecated]` | **SHOULD** on internal APIs being retired — static analysis then flags the call sites the deprecation comment alone never finds. |
| Lazy objects | **MUST NOT** hand-roll — deferred initialization is the container's job. If you're reaching for `newLazyGhost()`, the design wants a provider binding or a `#[BindWhen]` conditional instead. |

### PHP 8.5

| Feature | Ruling |
|---|---|
| `clone with` | **SHOULD — inside `withX()` implementations.** Readonly reassignment during clone respects visibility, so external callers generally cannot `clone with` a readonly DTO; the wither method remains the public API and `clone with` deletes its property-copy boilerplate. Applies fleet-wide once an app's runtime is 8.5 (syntax, so floor-gated — the floor moves to `^8.5` per the [[framework-bump-playbook]] Q4 pass). |
| Pipe operator `\|>` | **NOT YET.** Three blockers, each sufficient: Psalm — the fleet SAST gate — cannot parse it; Rector deprecated its own pipe-migration rules (2026-08-04, "cannot be decided mechanically"); zero usage in norm-setting packages. Revisit trigger: Psalm support lands **and** 8.6 partial function application makes pipelines materially better than nested calls. Collections stay on `Collection` chains regardless. |
| `#[\NoDiscard]` | **SHOULD** on must-use returns: immutable transforms, wither results, result/outcome objects, anything where discarding the return value is a bug. The upstream BC objection applies to published libraries, not app code — fleet apps are the ideal adopter. Suppress intentionally with the `(void)` cast, never by ignoring the warning. |
| `array_first()` / `array_last()` | **MAY now** (the symfony polyfill guarantees availability on 8.4 runtimes); they return `null` on empty and don't move the array pointer — prefer them over `reset()`/`end()`. **MUST NOT** define userland `array_first`/`array_last` helpers or require `laravel/helpers` — the historical userland signature took a callback, and the polyfill's global wins/loses unpredictably against redefinitions. Adoption step: grep the app for pre-existing collisions first. |
| URI extension (`Uri\Rfc3986\Uri`, `Uri\WhatWg\Url`) | **SHOULD** for URL parsing/validation over `parse_url()` string-poking — strict RFC 3986 class throws on garbage; WHATWG class normalizes browser-style. Apps already on league/uri get the native classes transparently (league/uri ≥7.6 wraps them). |
| `FILTER_THROW_ON_FAILURE` | **SHOULD** over `=== false` checks when using the filter API — fail loudly, in keeping with the fleet's fail-closed posture. |
| Closures / first-class callables / casts in constant expressions | **MAY** — this is what powers `#[BindWhen]` (Laravel 13.22+). Use where a literal-only attribute argument was previously the blocker. |
| `#[\DelayedTargetValidation]`, attributes on constants, `final` + promoted ctor | **MAY**, unremarkable — no ruling needed beyond "they exist". |
| Fatal-error backtraces (`fatal_error_backtraces`, default on) | Keep **on** (the default) in the image; it feeds the stderr JSON logs. Not an app-code concern. |

## §2 Mixed at the boundary — the levels-9/10 companion

Spec §2 ratchets PHPStan from level 8 toward **10**. What 9/10 add is strictness about `mixed` —
and `mixed` enters a Laravel app at exactly four gates. The idioms that keep those gates typed
are the difference between "level 10 is a war with the framework" and "level 10 is a formality":

1. **Config:** `config()->string('services.x.key')` / `->integer()` / `->boolean()` / `->array()`
   — the typed accessors (Laravel 11+) replace `(string) config(...)` casts. Env is already
   config-only (arch rule); this types the second hop.
2. **Request input:** `$request->string()`, `->integer()`, `->boolean()`, `->date()`,
   `->enum(X::class)` inside FormRequests, feeding `toData()` DTOs ([[form-requests]]). Raw
   `->input()` returns `mixed` and should not escape the FormRequest.
3. **JSON:** `json_decode` returns `mixed`; narrow immediately behind the adapter that owns the
   payload (assert shape, construct the DTO) — never pass decoded trees upward.
4. **Eloquent attributes:** `checkModelProperties` + `casts()` already type this gate.

The domain layer never sees `mixed` — that is [[validate-at-the-boundary]] restated as a type
rule, and at level 10 it stops being an honor system.

**On `declare(strict_types=1)`:** still **MUST**, everywhere, Pint-enforced — and it is a
**deliberate divergence**: `laravel/framework` itself does not use strict types. We hold app code
to a stricter bar than the framework holds itself; that is a choice we own, not "the standard."

## §3 Enforcement and the bump interplay

- **Rector is the adoption engine.** `rector.php` uses `withPhpSets()`, which keys off the
  composer floor — so the floor bump *is* the modernization trigger: raise the floor, run
  `composer rector:fix`, review, done. This is also what retires the 8.5-deprecated non-canonical
  casts (`(integer)`/`(boolean)`/`(double)`) mechanically. One asymmetry to know: `settype($x,
  'integer')` was *not* deprecated — only the cast spellings were; don't hand-write a broader rule.
- **Pint** owns spelling-level rulings (`declare_strict_types`, `new_with_parentheses`).
- **PHPStan** owns the `#[\Override]` mandate (`checkMissingOverrideMethodAttribute`) and the
  §2 mixed discipline (levels 9/10).
- **Arch suite** owns the structural rulings (readonly DTOs, final-by-default, strict types).

## §4 The 8.5 runtime pre-flight — PDO first

Before an app's image moves to PHP 8.5, run this checklist. The loud migration surface is not
syntax — it's PDO:

- **Driver-specific constants/methods are deprecated** (~45 constants, 12 methods, relocated to
  `Pdo\Pgsql` / `Pdo\Mysql` / `Pdo\Sqlite` subclasses). Postgres-relevant: `PDO::pgsqlCopyFromArray()`
  → `Pdo\Pgsql::copyFromArray()`, the five `PDO::PGSQL_TRANSACTION_*` constants. Laravel's stock
  `config/database.php` still carries `PDO::MYSQL_ATTR_SSL_CA` (framework#57141) — harmless on
  pgsql apps but grep anyway. `symfony/polyfill` ≥1.34 backports the `Pdo\*` subclasses if a
  package lags.
- **Hard BC, not deprecation:** the integer values of `PDO::FETCH_GROUP`, `FETCH_UNIQUE`,
  `FETCH_CLASSTYPE`, `FETCH_PROPS_LATE`, `FETCH_SERIALIZE` **changed**. Hard-coded fetch-mode
  ints break silently. Grep for numeric fetch modes.
- Smaller: `Directory` is now `final` (use `dir()`); the `disable_classes` INI was removed
  outright; `(integer)`-family casts warn (Rector closes).
- Grep set:
  `grep -rEn 'PDO::(PGSQL_|MYSQL_|SQLITE_|pgsql|mysql|sqlite)' app/ config/ database/` and
  `grep -rEn 'fetchAll?\([0-9]' app/`.
- Track patch releases on the new image: 8.5.9 (2026-07-30) was a security fix for a pgsql
  `E'...'` quoting SQLi — the runtime image inherits patches via the FrankenPHP tag, but the
  Renovate image-pin ratchet is what actually delivers them.

## §5 PHP 8.6 forward guard

8.6 lands **2026-11-19** (feature freeze 2026-08-13). Pre-empt now, at leisure, instead of under
a deadline later:

- **Deprecation grep (run during the Q4 bump):** `spl_object_hash(` (→ `spl_object_id()`),
  `is_integer|is_long|is_double|doubleval` (→ `is_int`/`is_float`/`floatval`), `return` inside
  `finally`, `SplFileObject` CSV methods, objects passed to array-expecting functions
  (`array_walk`, `http_build_query`).
- **Secure session defaults** flip in 8.6 (`use_strict_mode=1`, `cookie_httponly=1`,
  `cookie_samesite=Lax`). Laravel's `config/session.php` already pins the cookie pair; pin
  `session.use_strict_mode = 1` in the image's `conf.d` now so the flip is a no-op.
- `trim()` adds `\f` to its default mask — a declared BC break; audit anything relying on
  form-feed preservation (realistically: nothing, but the grep is one line).
- **Policy shift to internalize:** input type/value validation is now exempt from PHP's BC
  policy — future releases may tighten `TypeError`/`ValueError` without it counting as a break.
  **Never depend on lax input coercion**; the §2 boundary idioms already are the compliance.
- Adoptables to watch, not pre-adopt: partial function application (the real pipe-operator
  unlock), `clamp()`, the `SortDirection` enum (designed for framework adoption — expect
  Laravel to take it).
- **Planning assumption: there is no PHP 9.0 roadmap.** Both the 8.5 and 8.6 deprecation RFCs
  target "PHP 9", but no plan, generics, or async work exists upstream. Plan for 8.7 in Nov
  2027, and treat the accumulated deprecation lists as the eventual 9.0 removal set.
