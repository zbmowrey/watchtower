---
title: Fleet App Specification (v1 — mandated operational config)
description: The normative Specification that mandates how every fleet Laravel app is configured and run — runtime/framework versions, static & lint guardrails, testing, CI/hooks/deploy, runtime guardrails, and how architecture is tested. Locks the operational "how" to a single standard while leaving business logic and domain depth free per app. Derived from a ground-truth audit + maintainer decisions. cquality measures it; this repo enforces it; this page is the requirement of record.
tags: [ spec, standard, parity, guardrails, versions, mandate, laravel ]
type: standard
updated: 2026-07-10
related: [ laravel-engineering-standard, fleet-frontend-specification, laravel-runtime-guardrails, cquality, pest-testing, repositories, query-builders, controllers ]
---

# Fleet App Specification — v1

The **requirement of record** for how every fleet Laravel app is set up and run. Where the
[[laravel-engineering-standard]] narrates the philosophy and a convergence backlog
tracks live convergence, **this page is normative**: it states the single mandated value for
each operational concern. Derived from a ground-truth config audit of
every app's `origin/main` plus maintainer decisions.

## Scope, intent, and conformance

- **Governs (the locked "how"):** runtime & framework versions, static-analysis & lint
  guardrails, the test strategy & gates, CI / git-hooks / deploy mechanics, framework runtime
  guardrails, and **how architecture is tested**.
- **Does NOT govern (deliberately free):** each app's **business logic**, feature set, UI, and
  **domain/layering depth** (DDD vs flat+Filament). The spec mandates the *controls*, not the
  *shape* of the domain.
- **Front-end architecture is a sister spec.** This page owns the front-end *versions* (§1),
  *lint/tsconfig/prettier* (§2), *Vitest's existence & CI wiring* (§3), and *Vite runtime
  guardrails* (§5). How components are *shaped* (no god components), how React 19 / Inertia v3 are
  *used*, client state & data patterns, the FE *test strategy*, and which files converge vs flex —
  are owned by **[[fleet-frontend-specification]]**. The two do not restate each other.
- **Applies to:** every Laravel app in your fleet.
- **Normative language:** **MUST / MUST NOT** = required, CI- or arch-test-enforced where
  possible. **SHOULD** = required absent a documented reason. **MAY** = allowed app-need.
  **ACCEPTED-DEVIATION** = a known, justified departure recorded in §7 — never silent.
- **Deviation policy:** if a control breaks an app, that is signal — **refactor the app so the
  control holds; never weaken the control.** A genuine dead-end is documented in §7 and, if
  security-relevant, risk-registered — never `--no-verify`'d away.
- **Enforcement:** this repo's `standards/laravel/` bundle (configs, CI template, arch
  suite, hooks, scaffold) is the reference that apps copy from; `bin/arch-drift` checks arch
  parity; [[cquality]] measures maturity. The bundle MUST be kept at the values below.

---

## §1 Runtime & framework versions

**Pinning principle (governs this whole section).** A manifest constraint
(`composer.json` / `package.json`) states **compatibility intent**, not a snapshot: pin
the **major** that bounds breaking changes, plus a **minimum minor only when a named
feature requires it** (e.g. Wayfinder `^0.1.14` for `--with-form`). The **committed
lockfile is the exact, reproducible pin** (supply chain security), so the caret range
never needs to chase "latest." **Never version-pin a transitive dependency** — if it is
not in the app's manifest, its parent governs it (this is why `nesbot/carbon` is
config-referenced in §2 and §5, never version-pinned). Every package below **is a direct,
top-level dependency** in every app: a dependency the starter kit scaffolded into
`require`/`require-dev` (Fortify, Pest, Pint, Inertia, Wayfinder) is **direct and owned**,
so pinning its major boundary is correct — but a precise *minor* floor that only records
"what was latest on adoption day" is noise. State the boundary, not the snapshot.

| Concern                 | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
|-------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| PHP                     | composer floor **MUST be `^8.3`**; runtime image **MUST be PHP 8.4** (FrankenPHP alpine); CI **MUST run PHP 8.4** (the `ci-php` image).                                                                                                                                                                                                                                                                                                                                                                                                             |
| Laravel                 | **MUST be `^13`** (major boundary).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Inertia                 | **MUST** be `inertiajs/inertia-laravel ^3` + `@inertiajs/react ^3` (Inertia v3 major boundary).                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| React / Vite / Tailwind | **MUST** be React 19 · Vite 8 · Tailwind 4 (major boundaries).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Wayfinder               | **MUST be `^0.1.14`** — a *feature-justified minimum* (`--with-form` landed here) — generated with **`--with-form`**.                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Pest                    | **MUST be `^4`** (major boundary).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| larastan                | **MUST be `^3`** (major boundary).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| TypeScript              | **MUST be `^6`** (major boundary). `baseUrl` **MUST NOT** be set (deprecated in TS6).                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `@types/node`           | **MUST be `^24`** — a *runtime-justified floor* (tracks the Node 24 runtime, below).                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Node**                | **MUST be pinned to the `ci-php` Node (currently 24)** via **both `.nvmrc` and `package.json` `engines.node`**, with **`.npmrc engine-strict=true`** so off-version installs fail. The app pin and the `ci-php` Node version **MUST move in lockstep** — bumping one without the other is a spec violation. Node 24 is the fleet's *de-facto* runtime: the dev Sail containers (Sail 8.5, `NODE_VERSION=24`) and the prod image build (FrankenPHP `php8.4-alpine`, `nodejs` 24.x) already run 24; `ci-php` moved 22→24 to match (the lone laggard). |
| Fortify                 | **MUST be present** (it is direct in every app and §5's rate-limiters depend on it); **`^1`** (major boundary).                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Infra add-ons           | Reverb, Sanctum, Valkey/Redis, MinIO are **MAY (app-need)** — when present, each follows the major-boundary rule above. They change runtime config, deploy workloads, and *maybe* an integration-test service — but **MUST NOT** change the lint/test toolchain below.                                                                                                                                                                                                                                                                              |

> *Open follow-up (not yet decided): pinning the Dockerfile build-stage Alpine Node. Today it
> takes the Alpine package default — currently `nodejs` 24.x on FrankenPHP `php8.4-alpine` 3.24,
> so it lands on 24 in lockstep by happenstance, but is not explicitly pinned. Tracked as a
> hardening item, not v1-blocking.*

---

## §2 Static analysis & lint

**Baseline & ratchet policy (applies to every static tool below).** Each tool's debt
mechanism — a **baseline file** (phpstan, phpmd, psalm) or a **threshold/ratchet number**
(jscpd, coverage, type-coverage, knip rule toggles) — is a **one-way ratchet** with two
compliant states: **(a)** no baseline / at the target value, or **(b)** a baseline /
off-target value that may only move **toward** the target. The hard rules, identical for
every tool: a finding **outside** the baseline (or a regression **past** the threshold)
**MUST** break CI; the baseline **MUST NOT** grow and **MUST NOT** be regenerated or
reset; a threshold **MUST NOT** be loosened. The baseline/threshold is debt to burn down,
never a place to park a new finding — re-running `--generate-baseline` after initial
adoption, or relaxing a number to make CI pass, is a **spec violation**.

**Enforced — MUST:** the `static` job **MUST** run **`bin/baseline-guard.sh`** (from the
`standards/laravel/` bundle), which counts the suppressed findings in each baseline file
(phpstan/phpmd/psalm) on HEAD versus the PR's **merge-base** and **fails CI if any grew**.
Comparing at the merge-base (not the base tip) isolates the PR's own effect, so a teammate
shrinking a baseline on `main` can't false-positive an untouched PR; the guard exits
non-zero (never silently green) if `main` isn't reachable. Threshold loosening (jscpd /
coverage / type-coverage / knip) is not yet auto-gated — it is forbidden by this policy and
caught as a visible config diff at review (a future `baseline-guard` extension may add it).

**PHPStan / Larastan — MUST:** level **8** + `phpstan-strict-rules` (with
`dynamicCallOnStaticMethod: false`) + `checkModelProperties: true`; the `nesbot/carbon`
extension included; `parallel: 4`; `reportUnmatchedIgnoredErrors: true`. Per the baseline
policy: **prefer zero baseline** (the bar is L8-clean); a **frozen** `phpstan-baseline.neon`
is permitted where an app needs one, but it may only shrink — a violation outside it fails
CI, and it is never regenerated. The `TestCall`
ignore **MUST be scoped to `tests/Architecture/*`** *(ACCEPTED-DEVIATION: an app that also
analyses `tests/Feature`+`tests/Unit` MAY scope it to `tests/*` — narrowing yields 1000+ false
positives; §7 D-01)*.

**PHPMD — MUST:** run via **bamarni `vendor-bin/phpmd`** isolation; a **single "LaravelFleet"
ruleset** with: CyclomaticComplexity reportLevel **10**, TooManyMethods **20**,
TooManyPublicMethods **15**, **NumberOfChildren 30**, CouplingBetweenObjects PHPMD default (13),
LongVariable 35, ShortMethodName 2, plus
the codesize/unusedcode/design/naming presets. **Carve-outs (in the bundle ruleset):**
`*/Filament/*` excluded; framework-friction exceptions for `*/Domain/*/Data/*` DTOs and the
domain-wiring provider's container coupling (the dedicated bindings provider — e.g.
`RepositoryServiceProvider`/`DomainServiceProvider` — since `AppServiceProvider` is now the
byte-identical fleet-standard file and wires nothing). Residual marginal findings **MUST** be
resolved by small refactors or per-finding suppressions — the inline form is
`@SuppressWarnings("PHPMD.CouplingBetweenObjects")`, **quoted** so PHPStan's PHPDoc parser
accepts it — not by loosening thresholds. Per
the baseline policy: **zero baseline preferred**; a **frozen** `phpmd.baseline.xml` is
permitted (an app MAY carry burn-down debt in it — it may only shrink, never grow or
regenerate). A **dead / un-applied** baseline file **MUST** be removed.

**Pint — MUST:** `laravel` preset + **`declare_strict_types: true`**. Both local and CI
MAY run pint with `--parallel` enabled for faster operations (this is preferred but any
unwanted side effect or bug in this mode may justify single-threaded operation). Pre-commit
should run `--dirty` while CI runs the full set of files.

**jscpd — MUST:** jscpd **@5**, threshold target **10**, `minTokens: 50`, `absolute: true`,
`gitignore: true`, ignore the Filament + generated `actions`/`routes`/`wayfinder` paths, scan
`app`. Per the ratchet policy, an app MAY sit above target and tighten toward it (e.g. a large
app at **17** now — 17→10, blocks new duplication now, may only tighten).

**knip — MUST:** unused-**`exports` detection ON** (knip's core value); ratchet each app to
clean. `types`/`unlisted`/`binaries` rules MAY be tuned per app. *(ACCEPTED-DEVIATION: an app
MAY run `exports` off — a documented >10 GB OOM on a large component graph; a burn-down
item to re-enable once `project`/`entry`-scoped or heap-bounded, not a free waiver — §7
D-02.)*

**ESLint — MUST:** flat config; **jsx-a11y** recommended; **type-aware** rules (`projectService`)
with **`no-floating-promises: error`**; **`no-explicit-any: error`** (first-party scope);
**`ban-ts-comment: error`**; `consistent-type-imports`; `import/order`. Pre-existing a11y debt
MAY be parked in scoped `TODO(a11y)` override blocks (tracked debt, not a waiver).

**tsconfig — MUST:** `strict: true` **plus the full strict-flag set**:
`noUncheckedIndexedAccess`, `noImplicitReturns`, `noFallthroughCasesInSwitch`,
`noImplicitOverride`, **`noUnusedLocals`, `noUnusedParameters`**. `paths` = `@/* →
resources/js/*`; `include` covers `resources/js/**` + `tests/js/**`.

**Prettier — MUST:** `prettier-plugin-tailwindcss`.

**SAST — MUST:** **psalm taint analysis** (`vimeo/psalm ^6` + `psalm/plugin-laravel`,
`errorLevel: 8`, `findUnusedCode: false`, run as `--taint-analysis`, gated in CI).

**Supply chain — MUST:** `ergebnis/composer-normalize` (checked in CI) +
`roave/security-advisories` (`dev-latest`).

**Composer dependency hygiene — MUST (added 2026-07-10):** the composer-side twins of knip —
`maglnet/composer-require-checker` (`^4`, symbols used but not required; config
`composer-require-checker.json`) and `composer-unused/composer-unused` (`^0.9`, packages
required but not used; config `composer-unused.php`, every `NamedFilter` carries a one-line
reason). Both run as `composer require-check` / `composer unused`, **CI-gated** (own steps in
`static`). First run per app is measure-and-tune: a finding is either a `composer remove`/
`composer require` or a commented filter — never a silenced tool.

**Rector — MUST-carry, local-only (maintainer ruling):** `rector/rector` (`^2`) with the
bundle's `rector.php` (withPhpSets + deadCode/codeQuality/typeDeclarations prepared sets) and the
`composer rector` (dry-run) / `composer rector:fix` scripts on **every** app — resolving prior
per-app keeps/drops drift. It is a **modernization tool, deliberately NOT a CI gate**: run
before PHP/framework bumps and during refactor campaigns; correctness is already CI-gated by
larastan/psalm/pest.

---

## §3 Testing

> This section owns the *operational* testing config. The **judgment layer** — which tests to
> write, where each belongs, what they may assert, the "don't test the framework" boundary, and
> the feature-test escalation path — is the normative [[fleet-testing-doctrine]] (smell list:
> [[testing-antipattern-catalog]]).

- **Suites — MUST:** Pest 4. **`Unit` and `Architecture` are mandatory on every app** (and stay
  **bootless** — no framework boot, no DB, no boundary crossing). **`Feature` and `Integration`
  are conditional — required only when a qualifying test case exists:**
    - **`Feature`** — required **iff** a test case exists that **crosses a unit-testing boundary**
      (boots the framework: hits the DB, exercises an HTTP route / Inertia page, resolves the
      container, fakes a facade). The moment such a behaviour is worth testing, it goes in a
      `Feature` suite.
    - **`Integration`** — required **iff** a test case exists that **relies on an external
      service** (a real queue/cache/object-store/third-party boundary, not a fake).
    - Don't register an **empty** suite — it trips `failOnEmptyTestSuite`. Add the suite when its
      first qualifying test is written; an app with no boundary-crossing or external-service test
      legitimately ships **no** `Feature`/`Integration` suite. (+ Browser where it exists.) React
      via **Vitest 4**.
- **Database — MUST:** all PHP suites run against **Postgres** (`DB_CONNECTION=pgsql` pinned in
  `phpunit.xml`). `phpunit.xml` **MUST NOT** cap `memory_limit` (omit, or set `-1` — defer to
  the image).
- **Parallel-safe suites — MUST:** the suite passes under **`php artisan test --parallel`** —
  CI runs it that way (§4). Two structural rules make that true: **shared test helpers live in
  `tests/Pest.php`** (a paratest worker only loads its own file slice — a helper defined in a
  sibling test file resolves only by single-process luck), and **every `env()`-driven feature
  gate is pinned in `phpunit.xml`** (tests must never inherit a developer's `.env` flags — the
  hermetic-env rule that already covers CACHE/MAIL/SESSION extends to app gates the day they're
  born). Local prerequisite: Sail's `compose.yaml` pgsql service carries
  `command: ['postgres', '-c', 'max_locks_per_transaction=512']` (parallel `migrate:fresh`
  exhausts the 64-slot default → `SQLSTATE[53200]`).
- **KDF cost under test — MUST:** `phpunit.xml` pins `BCRYPT_ROUNDS=4`, `ARGON_MEMORY=8192`,
  `ARGON_TIME=1` (whichever driver the app uses, both are covered). Production hash cost defends
  against offline cracking — no test threat-models that; the driver itself stays production-true.
- **Coverage gates — MUST:** `pest --coverage --min=80` and `type-coverage --min=95`, both
  CI-gated. Coverage `<source>` = the whole `app/`, **no excludes**.
- **Strict PHPUnit flags — MUST (every app):** `failOnRisky`, `failOnWarning`,
  `failOnEmptyTestSuite`, `beStrictAboutOutputDuringTests`,
  `beStrictAboutTestsThatDoNotTestAnything`.
- **RefreshDatabase — MUST:** bound **globally in `Pest.php` to `Feature` + `Integration`** *(where
  those suites exist)* (+ Browser where it exists). `Unit` + `Architecture` stay **bootless /
  DB-free** — never bind `TestCase`/`RefreshDatabase` to them.
- **Mutation testing — MUST (policy):** a **local-only `composer mutation` script** (NOT the PR
  gate — it runs minutes). Scope to the **business-logic layer** (`App\Domain` where it exists,
  else `App\Support`+`App\Actions`); `--covered-only`; **`XDEBUG_MODE=off`**;
  **measure-and-ratchet** toward the fleet aspiration **MSI 70**. (An app gains a script once it
  has a logic layer.)
- **Browser/E2E — ACCEPTED-DEVIATION:** Playwright on the app(s) that need it (§7 A-05);
  **excluded from the PR gate** (no Chromium in `ci-php`).
- **Vitest shape — ACCEPTED-DEVIATION:** an app's bespoke 2-project (`node`+`jsdom`) config
  for a dual game core (§7 A-vitest).
- **Architecture suite — MUST:** the **universal floor** (`HygieneTest`, `HttpLayerTest` — strict
  types, no debug/`env()`, thin final controllers, FormRequests, **controllers MUST NOT import
  `App\Models`**) on **every app**; opt-in tiers (`DomainLayer`, `Persistence`, `ValueObjects`)
  adopted **where the layer exists**. Parity is gated by **`bin/arch-drift`** (universal tiers
  byte-identical; divergences recorded in `arch-drift.allow`).

---

## §4 CI / git-hooks / deploy

**CI gate — MUST:** Forgejo Actions, **two jobs named exactly `static` and `tests`** (the
branch-protection contexts), each tool its **own step** guarded by `if: ${{ !cancelled() }}`,
in the `ci-php` container, with: hand-rolled token `git clone` checkout, **Wayfinder generation
(`--with-form`)**, a Vite build before Feature tests, **parallel pest via `php -d
memory_limit=-1 artisan test --parallel`** (Illuminate's ParallelRunner provisions per-worker
`testing_test_<n>` databases and merges pcov coverage — bare `pest --parallel` races every
worker onto one database; the forked workers inherit the image's 2G ini), a **tmpfs Postgres
service** (data root on `--tmpfs /var/lib/postgresql`, `POSTGRES_INITDB_ARGS` sets
`fsync/synchronous_commit/full_page_writes=off` + `max_locks_per_transaction=512` — a throwaway
CI database needs no crash durability), a **pest retry-once** flake guard, and **larastan on the
persistent result cache** (`composer stan -- -c phpstan.ci.neon`, `tmpDir:
/phpstan-cache/<app>/<target-branch>` on the runner volume — never the volume root; the step
`mkdir -p`s the path so a missing volume degrades to a cold run, never a red step). Audit step
**MUST** be `npm audit --omit=dev --audit-level=high` + `composer audit --abandoned=report`
(**not** `audit-ci`). Measured basis (a large app): pest 12m28s → ~4m45s, larastan 8m58s →
3s warm.

**Branch protection — MUST:** `main` requires the contexts **`ci / static`**, **`ci / tests`**,
and **`build-check / build`**.

**build-check — MUST:** `build-check.yml` builds **both** the `runtime` and `console` image
targets on every PR (no push) — catches Dockerfile breakage before merge.

**Deploy — MUST:** `deploy.yml` (push to `main`, `docker-build` runner) builds + pushes **both**
images to the Forgejo registry (`git.example.com:3000/your-org/<app>:<sha>` + `:<sha>-console`),
**Trivy-scans the console image** (`CRITICAL,HIGH`, `--ignore-unfixed`, `--exit-code 1`,
`--add-host git.example.com`) **before** the k8s `values.yaml` tag bump → ArgoCD sync. This is
**fleet-wide**. See deploy image, argocd deploy flow.

**Git hooks — MUST:** husky **pre-commit + pre-push + commit-msg all run inside the `vite`
compose container** (no host execution — `node_modules` is container-owned). pre-commit =
lint-staged → `wayfinder:generate --with-form` → `types:check` → `pest --testsuite=Unit`;
pre-push = `composer stan` → the pest pyramid (Browser excluded where present).
**lint-staged MUST run scoped phpmd** — `bin/phpmd-staged.sh` (from `configs/bin/`) after
pint on staged `*.php`, running phpmd against only the staged files (all `phpmd.xml` rules
are intra-file, so the verdict equals a full `composer md` for those files) at ~0.1s vs a
whole-`app/` run that scales with the app; it mirrors CI's `*/Filament/*,*/Domain/*/Data/*`
carve-outs. Whole-program checks
(larastan, psalm-taint, knip, jscpd) are **NOT** scopable to staged files (scoping is
unsound) and stay on pre-push / CI — larastan's warm result cache keeps its pre-push run
~1s. See [[pre-commit-hooks]].
**commitlint — MUST (fleet-wide):** `@commitlint/cli` + `@commitlint/config-conventional`
(`^21`, per the §1 pinning principle — major boundary; the bundle's `package.fragment.json`
carries `*` and lets the lockfile pin) + a `commitlint.config.js` extending `config-conventional`

+ a `commit-msg` hook.
  The hook **MUST** run commitlint **in the container** and pipe the message to its **stdin**
  (`$VITE npx --no -- commitlint < "$1"`) — **never** the host-`npx … --edit "$1"` form (that only
  worked by accident where a stray host `node_modules` existed, and breaks on a clean checkout;
  it was the fleet's last host-run hook). Because the container wrapping hides the binary from
  knip's husky plugin, **`@commitlint/cli` MUST be in `knip.json` `ignoreDependencies`** (the same
  companion rule as `lint-staged`); `@commitlint/config-conventional` is resolved by knip's
  commitlint plugin and needs no ignore. Converged fleet-wide. See [[pre-commit-hooks]].

**Dockerfile — MUST:**

- **Two images from one file:** a **shell-less hardened `runtime`** (busybox/`/bin/sh`/apk
  stripped, FrankenPHP file-caps removed) for the internet-facing pods (web, reverb), and a
  **shell-bearing `console`** for worker/scheduler/migrator. Both **non-root**, FrankenPHP on
  `dunglas/frankenphp:1-php8.4-alpine`.
- **`apk upgrade --no-cache`** (+ explicit `libxml2`) in the runtime base.
- **Extensions via the official `docker-php-ext-install`** (+ `pecl install redis`) — **not**
  `install-php-extensions`.
- **php.ini via `mv php.ini-production php.ini`** + a small `conf.d` for deltas (opcache,
  `expose_php = Off`, **explicit `variables_order = "EGPCS"`**). Inherit PHP's hardened upstream
  base; maintain only the overrides.
- **Vendor web fonts** into the image (hermetic build — no build-time fetch to fonts.bunny.net).

---

## §5 Framework runtime guardrails

Set once at boot in `AppServiceProvider::configureDefaults()` (or the test bootstrap).
**`AppServiceProvider` is byte-identical fleet-wide** — locked by `bin/arch-drift` against
[`standards/laravel/app/Providers/AppServiceProvider.php`](../../standards/laravel/app/Providers/AppServiceProvider.php)
— and does nothing but install these guardrails. App-specific container bindings, model
observers, and rate limiting live in a separate **per-domain provider** (registered in
`bootstrap/providers.php`), never in `AppServiceProvider`. **MUST be present on every app:**

| Guardrail                                               | Required form                                                                                                                                                                         |
|---------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| APP_DEBUG-in-prod guard                                 | `throw RuntimeException` if `isProduction() && config('app.debug') === true` (fail-closed).                                                                                           |
| `Model::shouldBeStrict`                                 | `shouldBeStrict()` in the non-prod branch ≡ `shouldBeStrict(! app()->isProduction())` (strict in dev/CI, lenient in prod).                                                            |
| `Model::automaticallyEagerLoadRelationships`            | on, every env.                                                                                                                                                                        |
| `DB::prohibitDestructiveCommands`                       | `(app()->isProduction())`.                                                                                                                                                            |
| `Password::defaults`                                    | prod: `min(12)->mixedCase()->letters()->numbers()->symbols()->uncompromised()`; non-prod lenient.                                                                                     |
| `Date::use(CarbonImmutable)`                            | on.                                                                                                                                                                                   |
| `URL::forceScheme('https')` + `URL::useOrigin(app.url)` | keyed on **`str_starts_with((string) config('app.url'), 'https://')`** (covers staging, env-controllable; `useOrigin` replaces the deprecated `forceRootUrl`).                        |
| `Vite::useCspNonce`                                     | on (drives the CSP nonce).                                                                                                                                                            |
| `Vite::prefetch(concurrency: 3)`                        | on — **waterfall** asset prefetch (3 at a time). NOT `useAggressivePrefetching()`: aggressive fans out a page's whole lazy-chunk graph at once, wasteful on chunk-heavy public pages. |
| `Http::preventStrayRequests()`                          | in `TestCase::setUp` (test bootstrap), hermetic suite.                                                                                                                                |
| RateLimiter                                             | Fortify limiters (login/two-factor[/passkeys]) as the floor; an `api` limiter where the app exposes an API.                                                                           |

**HTTP security — MUST:** a final **`SecurityHeaders` middleware** appended to the web group:
strips `X-Powered-By`; sets `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, a locked `Permissions-Policy`, and **HSTS in
prod**. **CSP MUST be nonce-based** — `script-src 'self' 'nonce-{…}'` with **no `unsafe-inline`
/ `unsafe-eval` on `script-src`**. *(ACCEPTED-DEVIATIONS: `style-src 'unsafe-inline'` for
Radix/@dnd-kit — a documented tradeoff, §7 A-csp; per-app CSP **font-host allowlist** — §7 A-06.)*

**Production logging — MUST:** application logs go to **stderr as structured JSON**, never a
file driver, in every non-local env. Set `LOG_CHANNEL=stack` + `LOG_STACK=stderr` (or
`LOG_CHANNEL=stderr`) **and** `LOG_STDERR_FORMATTER=Monolog\Formatter\JsonFormatter`. **File
channels (`single`, `daily`) are FORBIDDEN in prod:** the hardened pods run
`readOnlyRootFilesystem`, so `storage/logs` is not writable and file logs are **silently
dropped** (the risk register); stderr is captured by the container runtime → Alloy
→ Loki, where JSON parses into queryable fields. **Local dev MAY keep file logs**
(`LOG_STACK=single`). Golden config:
[`standards/laravel/configs/logging.php`](../../standards/laravel/configs/logging.php) (+ its
`.env` fragment); the *why* + rollout state → logging monitoring ir.

**Error tracking — MUST:** every app integrates **`sentry/sentry-laravel`** (runtime `require`) and
**reports** unhandled exceptions, wired in the existing `bootstrap/app.php` `->withExceptions(...)`
closure via **`\Sentry\Laravel\Integration::handles($exceptions)`** — the *report* seam, the same
closure where apps today only `->map()` / `->shouldRenderJsonWhen()` (render but never report). The
DSN comes from env (**`SENTRY_LARAVEL_DSN`**) and is **never committed**; an empty DSN makes the SDK
inert, so **local dev defaults OFF** (no DSN). Sampling is **conservative** (SaaS billing):
`SENTRY_TRACES_SAMPLE_RATE` low (≤ `0.1`) and `SENTRY_PROFILES_SAMPLE_RATE=0.0` (off) unless an app
has a measured need. The Sentry **environment** tag MUST match the deploy env (Sentry's default is
`APP_ENV`; override with `SENTRY_ENVIRONMENT`). Closes the error-tracking half of
the risk register. Bundle: the `sentry/sentry-laravel` require in
[`composer.fragment.json`](../../standards/laravel/configs/composer.fragment.json) + the
`SENTRY_*` `.env` fragment. **SHOULD (not yet mandated):** Sentry's **browser SDK** on the
React/Inertia front end — a follow-up, not required tonight.

**Error notification (Discord) — MUST (added 2026-07-10):** every deployed app's prod log stack
carries a **`discord` channel** — the fleet's **`App\Logging\DiscordLogHandler`** (a `monolog`
driver channel) posting a slack-simple `{username, text}` payload, truncated to 1900 chars, to
the app's private **alerts channel** webhook via Discord's Slack-compat endpoint (env
**`LOG_DISCORD_WEBHOOK_URL`** = the webhook URL **with `/slack` suffix**, injected by the k8s
chart from a Secret; unset locally = inert). **Monolog's stock `SlackWebhookHandler` is
FORBIDDEN here** — Discord's compat endpoint 400s its attachment payload (`footer_icon`) and
hard-rejects >2000-char text instead of truncating, silently dropping every record (verified
live 2026-07-10). Prod values set `LOG_STACK=stderr,discord`; level floor **`error`**
(`LOG_DISCORD_LEVEL`). The `stack` channel sets **`ignore_exceptions: true`** so a webhook
outage can never break a request. Division of labor: this is the *human notification* leg;
Sentry (above) owns aggregation/context; the Grafana `app-error-spike` rule owns storm
detection (Discord webhooks rate-limit ~30/min). Golden artifacts:
[`standards/laravel/app/Logging/DiscordLogHandler.php`](../../standards/laravel/app/Logging/DiscordLogHandler.php)
+ the `discord` channel in
[`standards/laravel/configs/logging.php`](../../standards/laravel/configs/logging.php)
+ `logging.env.fragment`. Channel/webhook topology: fleet alerting.

**Scheduler heartbeat (dead-man switch) — MUST (added 2026-07-10):** every app's scheduler runs
the fleet heartbeat task — a named `fleet-heartbeat` schedule entry, every five minutes, that
`thenPingIf()`s the app's healthchecks.io check when `services.heartbeat.url` is set (env
`SCHEDULE_HEARTBEAT_URL`, injected by the k8s chart; unset locally = inert). A missing ping
alerts your alerts channel (Discord) + email after the 15-minute grace — the only signal that a
crashed/wedged scheduler or dead cron produces, since probes only prove the pod runs. Golden
fragment:
[`standards/laravel/configs/heartbeat.console.fragment.php`](../../standards/laravel/configs/heartbeat.console.fragment.php)
(the `routes/console.php` block + the `config/services.php` entry — env is read only through
config). Ops topology (checks, channel, webhook): fleet alerting.

---

## §6 Architecture (the flexible axis)

Domain/layering **depth** is **per-app and free** — some apps run deep hexagonal DDD, some a
partial domain, some are flat (flat + Filament). The spec governs **how architecture is
tested**, not how deep it goes: the tiered Pest arch suite (§3), the promoted **controllers
MUST NOT import `App\Models`** floor rule, and **`bin/arch-drift`** parity. Layering shapes are
**ACCEPTED-DEVIATION A-04**; arch-tier adoption scales with each app's namespace shape.

**Migrations — MUST follow expand/contract (added 2026-07-10).** Migrations run in the ArgoCD
**PreSync** hook, before new code serves — and a GitOps tag revert rolls back code but **cannot
un-migrate**. So destructive DDL (`dropColumn`/`dropTable`/`renameColumn`/`renameTable`/
`->change()`/`dropForeign`) never ships in the same PR that stops using the old shape: the
**expand** PR adds the new shape (nullable/defaulted column, dual-write, backfill); the
**contract** PR drops the old shape later, once no deployable revision reads it, and carries the
marker `// expand-contract: <what stopped reading this, and when>` in the migration. Enforced by
the bundle's `bin/migration-safety.sh` as a `static`-job CI step (§4) — an added migration with
unmarked destructive DDL fails the gate; the marker is an acknowledgement with a reason, not a
bypass.

**Data-access convention (guidance, not yet an enforced floor).** Regardless of layering depth,
new and changed code follows one data-access chain: an Inertia page with constant props stays a
`Route::inertia` one-liner; the moment it needs per-request data it gets a transport-only
controller → [[actions|action]] → [[repositories|repository]] (query logic, returns DTOs) →
[[query-builders|query builder]] (the shared, scoped base query, enforced the way Eloquent scopes
are). Never a closure route, never inline queries in a controller. This is **go-forward
guidance**, not a retroactive mandate: existing inline queries are not flagged, and no arch test
enforces the chain yet. Promoting any link to an enforced floor (e.g. "actions MUST NOT build
queries inline") is a future ratchet, decided per the [[laravel-engineering-standard]] loop when
the fleet has converged on it. The *why* and the code shapes live in the architecture manual
([[repositories]], [[query-builders]], [[controllers]]).

---

## §7 Accepted-deviations register

These rows are illustrative of the *kinds* of deviation this register records and their format;
record your own apps' deviations the same way.

| ID       | App(s)  | Deviation                                                             | Why                                                                                       |
|----------|---------|----------------------------------------------------------------------|-------------------------------------------------------------------------------------------|
| A-01     | acme    | drops `AddLinkHeadersForPreloadedAssets`                             | root-caused a 502 on a specific route                                                      |
| A-02     | acme    | omits `channels:` routing                                            | custom channel-auth controller                                                            |
| A-03     | acme    | `useStoragePath` + no `HandleAppearance`                            | FrankenPHP writable volume; no theme feature                                              |
| A-04     | all     | layering depth varies (DDD / partial / flat+Filament)               | tracks business-logic complexity; arch is *tested* uniformly                              |
| A-05     | acme    | Playwright browser suite + app-specific eslint guards               | the only browser-tested app; excluded from PR gate                                        |
| A-06     | per-app | CSP **font-host** allowlist                                          | none is looser; justified font delivery                                                   |
| A-csp    | all     | `style-src 'unsafe-inline'`                                          | Radix/@dnd-kit inline styles                                                               |
| A-vitest | acme    | bespoke 2-project (`node`+`jsdom`) Vitest                           | dual PHP/TS game core with golden vectors                                                  |
| D-01     | acme    | phpstan `TestCall` ignore at `tests/*`                              | analyses Feature/Unit; narrowing → 1000+ false positives                                  |
| D-02     | acme    | knip unused-`exports` detection **off**                             | >10 GB OOM on a large component graph; burn-down — re-enable when scoped/heap-bounded      |

> Frozen, non-growing baselines and off-target-but-tightening thresholds are **not**
> deviations — they are the §2 baseline/ratchet policy's compliant state (b), so they are
> not listed here.

Any new deviation **MUST** be added here with a justification before it ships.

---

Convergence is tracked in a convergence backlog (the burndown; this spec is the
target). The spec's dated change history and the applied doc-corrections live in
a convergence log — deliberately kept off this page.
