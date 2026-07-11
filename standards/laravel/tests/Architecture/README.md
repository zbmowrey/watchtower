# standards/laravel — the shared architecture-test suite

The **architectural** half of the [engineering standard](../../README.md): a set
of Pest `arch()` laws that fail the build when an app drifts from the intended
structure. This is what makes this repo govern **design**, not just style — the
controls in [cquality](../../../../wiki/standards/cquality.md) dims ⑥ (Architecture)
and ⑦ (Design Patterns), enforced in CI instead of in review.

It is the **union of every reusable rule** already proven across the fleet,
deduplicated and generalized. App-specific layering tests (an app's own
`FeatureLayeringTest`, etc.) stay in their app — they encode that app's
own domains, not the standard.

This suite is the **operationalized form of the
[Laravel architecture manual](../../../../wiki/stack/laravel-architecture/laravel-architecture-manual.md)** —
the manual is the *why* (principles, the may-depend-on table, the full
expectation vocabulary); this is the *what runs in CI*. Before extending it, read
[`pest-architecture-testing`](../../../../wiki/stack/laravel-architecture/pest-architecture-testing.md),
the annotated [`pest-arch-example-suite`](../../../../wiki/stack/laravel-architecture/pest-arch-example-suite.md),
and the [`pest-arch-pitfalls`](../../../../wiki/stack/laravel-architecture/pest-arch-pitfalls.md).

Two operational notes from the manual:

- **`ext-intl` is required** — Pest's `php()` preset (and a few expectations) need
  it. The `ci-php` image ships `intl`, so CI is fine; a host without it will error.
- **`->preset()->laravel()` is the documented next tightening.** This suite runs
  `php()` + `security()` (proven green fleet-wide); add `laravel()` as a ratchet
  once an app is clean, not as part of the universal floor.
- **`ignoring()` takes `::class`, not strings.** `HttpLayerTest` excepts the base
  `Controller` and auth `User` via `->ignoring(Controller::class)` /
  `->ignoring(User::class)` (with `use` imports), **not** string class-names — a
  string FQCN trips rector's `StringClassNameToClassConstantRector` on any
  rector-gated app. (An app that drops rector is exempt; most apps keep it.)
- **Request-rule mixin traits live under `App\Http\Requests\Concerns`.** The
  form-request suffix/extend rule is scoped with `->classes()` (split into two
  rules — a *chained* `->classes()` only binds the first expectation) so those
  traits aren't checked. Note `->ignoring(namespace)` does **not** filter the
  filename-based `toHaveSuffix` — use `->classes()`.
- **Form requests may import domain enums + `Data` DTOs.** The DomainLayer
  form-request rule forbids only Eloquent, **not** all of `App\Domain` — requests
  assemble domain DTOs (`toData()`) and validate against domain enums, an inward
  HTTP→domain dependency the layering allows. A blanket `App\Domain` ban would
  outlaw the manual's prescribed pattern (surfaced by apps with dozens of such requests).
- **The security preset bans `assert()`.** Type-narrowing via
  `assert($x instanceof User)` trips it — use an `if (! $x instanceof User) { throw … }`
  guard instead (also narrows for Larastan). Surfaced in practice.
- **Security-preset carve-outs for non-security RNG/hash.** `mt_rand`/`mt_srand`
  (deterministic seeded fixtures — `random_int` can't be seeded) and `sha1`/`md5`
  (content fingerprints / dedup keys) are legitimate non-security uses. Carve them
  out **by class** (`->ignoring(['Db\\…\\FixtureSeeder', …])`), not by function
  name, so the ban stays active for genuinely new code. Surfaced in practice.
- **Larastan + `arch()`:** PHPStan infers `$this` in `arch()` chains as
  `Pest\PendingCalls\TestCall`, so it flags `TestCall::expect()` etc. Ignore with
  the path-scoped pattern `#^Call to an undefined method Pest\\PendingCalls\\TestCall::.*\(\)\.$#`
  (`path: tests/*`) — **not** a union-type or per-file-count pattern (those miss
  `arch()` calls / go stale when rules change). Match the reference `phpstan.neon`.
- **Abstract domain bases need a final carve-out.** DomainLayer's
  *every concrete domain class is final* fails on an abstract base like
  `App\Domain\Shared\Exceptions\DomainException` — carve it out by name
  (`->ignoring(...)`); the rule comment shows the pattern.

### Promoted ratchets

- **Strict "controllers never import concrete models" — PROMOTED to the universal
  `HttpLayer` floor (2026-06-17).** Was in the DomainLayer tier; now every app
  enforces `->not->toUse('App\Models')` (removed from DomainLayer to avoid
  duplication). Most apps passed it as-is; an app with no domain layer adopts it
  app-specifically; **some apps needed a controller refactor** (extract model
  access to services). Next opt-in tightening on deck: `->preset()->laravel()`.

## Why it's tiered (read this first)

Pest's arch plugin **errors** — it does not pass — when a rule's *subject*
namespace contains no classes. So `expect('App\Domain')->...` is a hard failure on
an app with no domain layer, not a silent skip. Apps don't all share one
namespace shape:

| Namespace (subject)                                         | App A | App B | App C | App D |
|-------------------------------------------------------------|:-----:|:-----:|:-----:|:-----:|
| `App\Http\{Controllers,Requests,Middleware}` · `App\Models` |   ✓   |   ✓   |   ✓   |   ✓   |
| `App\Domain`                                                |   ✓   |   —   |   ✓   |   ✓   |
| `App\Infrastructure`                                        |   ✓   |   —   |   —   |   ✓   |
| `App\Enums` / `App\*\*\Data`                                |   ✓   | enums |   —   | data  |

So the suite splits into **universal** files (drop in everywhere, verbatim) and
**opt-in** files (copy only where the namespace exists):

| File                   | Tier                                 | Copy into                                      |
|------------------------|--------------------------------------|------------------------------------------------|
| `HygieneTest.php`      | **Universal**                        | **every app**, verbatim                        |
| `HttpLayerTest.php`    | **Universal**                        | **every app**, verbatim                        |
| `DomainLayerTest.php`  | Opt-in · needs `App\Domain`          | apps with `App\Domain`                         |
| `PersistenceTest.php`  | Opt-in · needs `App\Infrastructure`  | apps with `App\Infrastructure`                 |
| `ValueObjectsTest.php` | Opt-in · per-rule (`Data` / `Enums`) | apps with `Data` (DTO) · apps with `Enums`     |
| `TestsLayerTest.php`   | Opt-in · target universal            | all — after per-app verification (see below)   |

> **Filenames must end in `Test.php`.** PHPUnit's `<directory>` testsuite collects
> only files matching the default `suffix="Test.php"`. A tier file named
> `Hygiene.php` is silently **not collected** (`pest --testsuite=Architecture` →
> "No tests found"). Keep the `…Test.php` names when you copy them in.

As an app grows a domain/infra/DTO layer, it **adopts the matching tier** — the
target is for every app to eventually run all of them.

**`TestsLayerTest.php` (added 2026-07-10)** polices the tests themselves: it
mechanically enforces the [testing doctrine's](../../../../wiki/standards/fleet-testing-doctrine.md)
law 1 — `Tests\Unit` stays bootless (no facades, no `Tests\TestCase`, no
`RefreshDatabase`, no container/config helpers). It targets `Tests\Unit` only
(Feature/Integration suites are conditional per spec §3, and an empty arch()
subject errors). It ships **opt-in until verified per app** — Pest test files are
often namespace-less closures, so confirm the `Tests\Unit` subject actually
collects them (probe: a deliberate `Http::fake()` in a Unit test must go red)
before counting the tier adopted; promote it to UNIVERSAL in `bin/arch-drift`
once every app verifies.

## Apply to an app

Work in an **isolated clone**, never `~/code/<app>` (see the
isolate-git rule).
Then, on a branch:

1. **Copy the files this app qualifies for** (per the matrix) into
   `tests/Architecture/`. Replace the app's ad-hoc generic arch tests
   (a `HygieneTest`/`ArchTest`/`LayeringTest` that just re-states these rules);
   **keep** its domain-specific layering tests.
2. **Name the suite `Architecture`.** Ensure `phpunit.xml` has
   `<testsuite name="Architecture"><directory>tests/Architecture</directory></testsuite>`
   and that the CI `pest --testsuite=…` list includes `Architecture`. Rename a
   legacy `tests/Arch` → `tests/Architecture` if the app uses that name.
3. **Run it:** `sail pest --testsuite=Architecture`. New laws *will* surface drift
   — that's the point. Resolve each finding one of two ways:
    - **Fix the code** (the default — that's convergence), or
    - **Carve out a documented exception** with `->ignoring('App\…')` **and a
      one-line comment saying why**. Never delete a rule to make it pass, and never
      loosen a universal rule.
4. Get the suite green, fold it into the convergence PR, let the `ci / tests` gate
   run it on every PR thereafter.

## Carve-out policy (same ethos as the phpstan/phpmd baselines)

A rule + an explicit, commented `->ignoring()` is a tracked exception. A deleted
rule is invisible debt. Always prefer the former. Legitimate, expected carve-outs:

- **Abstract base classes** under a `final-by-default` rule (e.g. a
  `DomainException` base) — abstract can't be final.
- **The auth `User` model** under model-finality (already carved out in
  `HttpLayer.php`).
- **Thin read-model query classes** under "controllers don't import models", if
  the app uses that pattern.

If a whole *file's* worth of rules doesn't fit an app yet, that app simply doesn't
have that tier's namespace — don't force it; adopt the tier when the layer exists.

## Keeping the fleet in sync (tooling)

Consistency is now *checked*, not just trusted:

- **`bin/arch-drift`** — diffs every managed app's merged `origin/main` tiers
  against canonical. Universal tiers (Hygiene, HttpLayer) must be byte-identical;
  any divergence is either a documented exception in
  [`arch-drift.allow`](../../arch-drift.allow) or **drift** (non-zero exit). Run
  it ad-hoc or wire it into this repo's own checks. `--app <slug>`, `--json`,
  `--no-fetch`.
- **`scaffold/apply.sh <app-root> [slug]`** — brings a new (or existing) app to
  parity: drops the universal tiers + reference configs + CI workflow, then prints
  a checklist for the deliberate steps (fragment merges, opt-in tiers, carve-outs).

**Adding a new Laravel+Inertia+React app:** run the scaffold, work the checklist,
then add it to `MANAGED_APPS` in `bin/arch-drift` so it's covered by the drift
check. Forced exceptions go in `arch-drift.allow` *and* as a comment in the app's
tier file.
