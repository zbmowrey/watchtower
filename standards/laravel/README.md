# standards/laravel — the engineering-standard enforcement artifacts

The **runnable artifacts** every managed Laravel app copies from to be linted, typed,
tested, and gated the same way. Every app in the fleet
is the **same stack — Laravel + Postgres + React/Inertia** — so this guardrail set is
**identical on all of them**. The *only* legitimate divergence is infra add-ons (Reverb
/ Valkey / MinIO), which change runtime config, deploy workloads, and *maybe* an
integration-test service container — **never** the tool set.

> **The rule of record is the spec, not this README.** The single mandated value for
> every concern is [`fleet-app-specification`](../../wiki/standards/fleet-app-specification.md)
> (`bin/wiki inject --page fleet-app-specification`); the *why* is
> [`laravel-engineering-standard`](../../wiki/standards/laravel-engineering-standard.md); the
> dated rollout history is `convergence-log`. These
> files ARE the enforced values — when a number here and the spec disagree, the spec
> wins and these files are brought to it. CI mechanics:
> `forgejo-ci`. Harvested from the reference app.

## What's here

```
configs/
  phpstan.neon          # Larastan L8 + strict-rules + checkModelProperties, NO baseline
  phpmd.xml             # complexity ceilings (cyclomatic <= 10) + dead code/design; NumberOfChildren 30; carve-outs Filament + Domain/*/Data
  psalm.xml             # fleet SAST — taint analysis only (composer psalm-taint), errorLevel 8, Laravel plugin
  pint.json             # Laravel preset + declare_strict_types
  .jscpd.json           # copy-paste, threshold 10 (target), ignores Filament + generated wayfinder
  knip.json             # unused files/exports/deps (entry globs are per-app tunable)
  eslint.config.js      # typescript-eslint + react + hooks + import + stylistic + jsx-a11y + TYPE-AWARE (no-floating-promises, no-explicit-any:error first-party)
  tsconfig.json         # full strict — the 6 flags (noUncheckedIndexedAccess, noImplicitReturns, noFallthroughCasesInSwitch, noImplicitOverride, noUnusedLocals, noUnusedParameters); NO baseUrl (TS6)
  .prettierrc / .prettierignore / .editorconfig / .npmrc (engine-strict) / .nvmrc (Node 22)
  vitest.config.ts      # React unit layer (jsdom + testing-library)
  commitlint.config.js  # Conventional Commits ruleset (extends config-conventional)
  vendor-bin/phpmd/composer.json   # phpmd isolated via bamarni (dep tree can't clash with app)
  bin/check-bundle-size.mjs        # perf gate (ci.yml tests job); MUST calibrate BUDGETS_KB
  bin/baseline-guard.sh           # ratchet gate (ci.yml static job) — fails if a phpstan/phpmd/psalm baseline GREW vs merge-base
  tests/js/vitest.setup.ts         # Vitest setup (referenced by vitest.config.ts)
  composer.fragment.json           # require-dev (+psalm trio) + scripts (psalm-taint, local-only mutation) + extra + allow-plugins to MERGE
  package.fragment.json            # devDependencies (+jsx-a11y, typescript ^6, NO audit-ci) + engines.node 22 + scripts to MERGE
  logging.php                      # config/logging.php golden — stderr channel + LOG_STDERR_FORMATTER hook; prod = stderr JSON, file drivers forbidden (spec §5 / a documented tradeoff)
  logging.env.fragment             # .env.example logging block — local-dev file default + the prod stderr/JSON values (commented)
  sentry.env.fragment              # .env.example SENTRY_* block — error tracking OFF locally (empty DSN), conservative sampling; DSN via env only (spec §5, sentry/sentry-laravel require is in composer.fragment.json)
  renovate.json                    # dependency-update config (composer+npm, weekly digest, majors gated, automerge OFF) — wiki/infra/dependency-updates.md
  composer-require-checker.json    # deps hygiene half 1 (spec §2, 2026-07-10): symbols used but not required — `composer require-check` (CI static step); tune symbol-whitelist per app WITH reasons
  composer-unused.php              # deps hygiene half 2: packages required but not used — `composer unused` (CI static step); every NamedFilter carries a reason
  rector.php                       # modernization engine (spec §2): LOCAL ONLY, never a CI gate — `composer rector` (preview) / `rector:fix`; run before PHP/framework bumps
  heartbeat.console.fragment.php   # spec §5 scheduler dead-man switch — merge into routes/console.php + config/services.php; ping URL from SCHEDULE_HEARTBEAT_URL (k8s values) — wiki/infra/fleet-alerting.md
  bin/migration-safety.sh          # spec §6 expand/contract gate (ci.yml static job) — added migrations with destructive DDL need an `// expand-contract:` marker
.husky/pre-commit / pre-push / commit-msg   # the local gate + Conventional-Commits check (all run inside the vite container)
tests/Architecture/                # the shared arch-test suite (design controls, cquality ⑥/⑦)
  HygieneTest.php / HttpLayerTest.php   # UNIVERSAL tiers — copy verbatim into all four
  DomainLayerTest.php / PersistenceTest.php / ValueObjectsTest.php   # OPT-IN tiers (keyed on namespace)
  README.md                        # tier→namespace matrix + carve-out policy (files MUST end in Test.php)
app/Providers/AppServiceProvider.php  # §5 runtime guardrails — BYTE-IDENTICAL fleet-wide (arch-drift-locked); app bindings live in a separate per-domain provider
app/Http/Middleware/SecurityHeaders.php  # §5 HTTP security MUST — nonce CSP + HSTS/X-Frame-Options/etc; golden reference, NOT byte-identical (2 marked per-app tune points — see file docblock + application-security.md)
.forgejo/workflows/ci.yml          # the canonical 2-job (static/tests) gate template
.forgejo/workflows/renovate.yml    # scheduled dependency-update runner (Forgejo Actions, official renovate/renovate image) — wiki/infra/dependency-updates.md
```

> **This bundle implements [`fleet-app-specification`](../../wiki/standards/fleet-app-specification.md) (v1).**
> The spec is the requirement of record; this is the reference apps copy from. Raised to v1
> on 2026-06-27: psalm-taint + a local-only mutation script, jsx-a11y + type-aware eslint,
> the full tsconfig strict set + dropped `baseUrl`, a Node 22 pin (`.nvmrc` + `engines.node`
> + `engine-strict`), phpmd `NumberOfChildren=30` + Data-DTO carve-out, and `npm audit` in
> place of `audit-ci`. As of 2026-06-28 the bundle also ships the canonical
> **`app/Providers/AppServiceProvider.php`** (the §5 `configureDefaults()` guardrails —
> byte-identical fleet-wide, locked by `bin/arch-drift`). As of 2026-07-09 it also ships
> **`app/Http/Middleware/SecurityHeaders.php`** (the §5 HTTP-security MUST — nonce-based CSP,
> HSTS, X-Frame-Options, etc.; a golden reference with two marked per-app tune points, NOT
> byte-identical — see the file's docblock and `application-security`).
> This closes the gap that let an app reach prod without CSP in the first
> place (hand-fixed after the fact; verified live-conformant since — see
> `convergence-log`) — but until now the *bundle itself*
> still had no artifact to copy for the *next* greenfield app. The one **runtime-security piece
> this bundle still does NOT generate** — and a greenfield app MUST add by hand — is
> **`Http::preventStrayRequests()`** in the test bootstrap; see the `scaffold/apply.sh`
> checklist and spec §5. As of 2026-07-10 the bundle also ships **`renovate.json` +
> `.forgejo/workflows/renovate.yml`** — a self-hosted, per-app Renovate runner (composer +
> npm, weekly digest, majors gated, automerge off) that finally makes real the fleet's
> "Renovate/Dependabot SHOULD watch deps" line (fleet-frontend-specification §6) and any
> until-now-vestigial GitHub-only dependency configs (`.whitesource` /
> `.github/dependabot.yml`) — see `dependency-updates`.

`scaffold/apply.sh` now copies the universal arch tiers, every `configs/` file
**plus** `bin/check-bundle-size.mjs`, `bin/baseline-guard.sh`, `bin/phpmd-staged.sh`
(lint-staged's scoped-phpmd helper — `chmod +x`), `vendor-bin/phpmd/`,
`tests/js/vitest.setup.ts`, and the `.husky/` hooks, and the CI workflow — leaving only the composer/package
fragment **merges** (and the new-repo footguns below) as deliberate hand steps.

## Apply to an app

Work in an **isolated clone**, never a working checkout you edit live —
see `wiki/...` / the isolate-git memory. Then, on a branch:

1. **composer:** merge `composer.fragment.json` into the app's `composer.json`
   (require-dev + scripts + `extra.bamarni-bin` *as real booleans* +
   `config.allow-plugins` incl. `bamarni/composer-bin-plugin` and
   `ergebnis/composer-normalize`); copy `vendor-bin/phpmd/composer.json`. **Add
   `/vendor-bin/*/vendor/` to `.gitignore`** (commit only the bin's composer.json/
   lock, never its installed vendor). Install phpmd: `composer bin phpmd install`.
   On an app with complexity debt, **generate the phpmd baseline** (see ratchet
   below). Then `composer update --lock` (refresh hash) + `composer normalize`.
   Note: don't add `phpmd/phpmd` to the root require-dev — its tree conflicts with
   app deps (that's why it's bamarni-isolated).
2. **npm:** `npm i -D` the `package.fragment.json` devDependencies (incl.
   `eslint-plugin-jsx-a11y`, `typescript ^6`; **no `audit-ci`**); merge its scripts
   and the `engines.node` block. Copy the `configs/` dotfiles + `eslint.config.js` +
   `tsconfig.json` + `vitest.config.ts` + `phpstan.neon` + `phpmd.xml` + `psalm.xml` +
   `.jscpd.json` + `knip.json` + `commitlint.config.js` + `.nvmrc` into the repo root.
   (Or just run `scaffold/apply.sh`, which copies all of these.)
2a. **logging (prod stderr/JSON):** copy `configs/logging.php` → the app's
   **`config/logging.php`** (golden reference for a greenfield app; on an existing app
   **don't clobber app-specific channels** — just verify its `stderr` channel keeps the
   `'formatter' => env('LOG_STDERR_FORMATTER')` hook). Merge `configs/logging.env.fragment`
   into `.env.example` (local dev stays `LOG_STACK=single`). **Prod MUST be stderr JSON:** set
   `LOG_STACK=stderr` + `LOG_STDERR_FORMATTER=Monolog\Formatter\JsonFormatter` in the app's k8s
   `infra/<app>/values.yaml` — file drivers are forbidden under `readOnlyRootFilesystem`
   ([`fleet-app-specification`](../../wiki/standards/fleet-app-specification.md) §5;
   a documented tradeoff). `scaffold/apply.sh` does **not** auto-copy
   `logging.php` (avoids clobbering channels) — it's a printed checklist step.
2b. **error tracking (Sentry):** merge the `sentry/sentry-laravel` **`require`** from
   `configs/composer.fragment.json` (runtime dep — verify the major resolves against the app's
   `laravel/framework ^13`, bump if composer refuses), then `composer update`. **Wire the report
   seam** in `bootstrap/app.php`'s existing `->withExceptions(...)` closure:
   `use Sentry\Laravel\Integration;` then `Integration::handles($exceptions);` (the apps only
   `->map()`/`->shouldRenderJsonWhen()` there today — render, not report). Merge
   `configs/sentry.env.fragment` into `.env.example` (**DSN empty locally = OFF**). Prod: set
   `SENTRY_LARAVEL_DSN` (a Secret, never committed) + the conservative sample rates in the app's
   k8s `infra/<app>/values.yaml`. Closes the error-tracking half of
   a documented tradeoff. *(Front-end browser SDK is a SHOULD, not
   wired here.)*
2c. **runtime security (SecurityHeaders + CSP):** copy `app/Http/Middleware/SecurityHeaders.php`
   → the app's **`app/Http/Middleware/SecurityHeaders.php`** VERBATIM, then customize only the
   two TUNE POINTs marked in its docblock (per-app webfont host in `font-src`/`style-src` if the
   app loads a font CDN — register the deviation as
   [`fleet-app-specification`](../../wiki/standards/fleet-app-specification.md) §7 A-06; the
   Reverb-aware `connect-src` needs no edit, it collapses to `'self'` when the app has no Reverb
   config). **Register it LAST** in `bootstrap/app.php`'s `$middleware->web(append: [...])` list
   (after `HandleAppearance`/`HandleInertiaRequests`/etc.) — see a reference app's `bootstrap/app.php`
   for the exact seam. It reads the CSP nonce from `Vite::useCspNonce()`, which
   `app/Providers/AppServiceProvider.php` (step 1/copy-verbatim above) already wires — no separate
   nonce setup needed. Full doctrine (the a documented tradeoff/a documented tradeoff accepted-deviation rationale, the header-by-header
   ZAP mapping) lives in `application-security` — this
   step doesn't restate it. `scaffold/apply.sh` does **not** auto-copy `SecurityHeaders.php` (same
   reason as `AppServiceProvider.php` — it's boot code that needs registering, not a standalone
   dotfile) — it's a printed checklist step.
3. **test DB → Postgres:** point the app's `phpunit.xml` at pgsql (drop any
   `DB_CONNECTION=sqlite` / `DB_DATABASE=:memory:`); the CI `tests` job provides
   the service. Standardize the arch suite name to **`Architecture`** (rename
   `Arch` if present) and make the `--testsuite=...` list match the app's
   actual suites.
3b. **parallel-safe + hermetic phpunit** (spec §3; CI runs `artisan test
   --parallel`): pin the KDF cost (`BCRYPT_ROUNDS=4`, `ARGON_MEMORY=8192`,
   `ARGON_TIME=1`) and **every `env()`-driven feature gate** the app has grown
   (grep `config/*.php` for `env(` keys that gate behavior; a developer's `.env`
   flag must never flip a test — e.g. an `ACME_OPEN_REGISTRATION` feature flag). Sweep for
   **cross-file test helpers** (`grep -rn "^function " tests/ --include="*Test.php"`,
   then check each for callers in other files) and move shared ones to
   `tests/Pest.php` — a paratest worker only loads its own file slice. Add
   `command: ['postgres', '-c', 'max_locks_per_transaction=512']` to the app's
   `compose.yaml` pgsql service (parallel `migrate:fresh` exhausts the 64-slot
   default → `SQLSTATE[53200]`), then prove it locally:
   `sail exec laravel.test php artisan test --parallel` fully green.
3a. **arch suite:** copy the `tests/Architecture/` tier files this app qualifies
   for (universal `Hygiene.php` + `HttpLayer.php` everywhere; the opt-in tiers per
   the namespace matrix in `tests/Architecture/README.md`). Replace the app's
   ad-hoc *generic* arch tests with these; **keep** its domain-specific layering
   tests. Run `pest --testsuite=Architecture`, then fix violations or add
   documented `->ignoring()` carve-outs (never delete a universal rule).
4. **run the gate locally green** (`composer ci:check` + `npm run test`), then
   **ratchet** anything that fails (see below).
5. **CI:** copy `.forgejo/workflows/ci.yml` **and `configs/phpstan.ci.neon`**
   (→ repo root), replace `__APP__` with the repo slug in BOTH, adjust the
   `--testsuite` list + any integration `services:`. The neon scopes larastan's
   persistent result cache to `/phpstan-cache/<app>/main` — never flatten it to
   the volume root (cache mixing); the workflow's `mkdir -p` makes a missing
   runner volume degrade to a cold run, never a red step.
5a. **dependency updates (Renovate):** copy `configs/renovate.json` → the app's
   **`renovate.json`** (repo root, verbatim — `scaffold/apply.sh` does this) and
   `.forgejo/workflows/renovate.yml`, replacing `__APP__` with the repo slug and
   setting **this app's cron minute** from the stagger table in
   `dependency-updates` (never copy the
   same minute to every app — multiple apps' Renovate PRs landing on the shared runner
   at once is exactly the CI storm this avoids). Needs its own one-time bot setup —
   a dedicated `renovate-bot` Forgejo account (PAT scopes + full doctrine on that
   page) added as a collaborator, with its token stored as **this repo's**
   `RENOVATE_TOKEN` secret (`tea actions secrets create RENOVATE_TOKEN --repo
   your-org/<slug>` — same footgun shape as `CI_TOKEN` below). Runs self-hosted
   against this Forgejo (`platform: forgejo`) — closes
   a documented tradeoff (no continuous CVE
   monitoring) once adopted per app.
6. **enforce:** branch protection on `main` requiring `ci / static (pull_request)`
   + `ci / tests (pull_request)` (`POST /repos/your-org/<app>/branch_protections`,
   `enable_status_check: true`, `enable_push: true`).
7. **new-repo footguns — fix these or CI fails on commit #1** (learned standing up
   a new app):
   - **CI_TOKEN:** a fresh Forgejo repo has no Actions secret, so *every* workflow
     dies at "Set up job" (`failed to interpolate container.credentials.password`).
     `tea actions secrets create CI_TOKEN --repo your-org/<slug>` (it **prompts** —
     do NOT pass `--stdin`, which hangs in a non-interactive shell). Scope:
     read/write **repository** + read/write **package**.
   - **bundle budget:** `bin/check-bundle-size.mjs` ships `BUDGETS_KB={0,0,0}`, so
     the `tests` job's `bundle size budget` step fails on *every* run until set.
     `npm run build` → `node bin/check-bundle-size.mjs`, set the three budgets to
     the measured kB + ~10%. **Not caught by `composer ci:check`** — `bundle:check`
     is ci.yml-only, so the local gate looks green while CI is red.
   - **bunny fonts (newer React starter kit):** if `vite.config.ts` has
     `fonts: [bunny(...)]`, it FETCHES the font from fonts.bunny.net at *build*
     time → the hermetic `build-check` docker build can't reach the CDN and fails
     (`ConnectTimeoutError`). ci/tests passes anyway (its `npm run build` runs in
     the ci-php container on the host network, which *can* reach the CDN) — so it
     shows up as build-check-only. Fix: vendor the woff2 + a `@font-face`
     `resources/css/fonts.css` (mirror a reference app), `@import` from app.css, and DELETE
     the `bunny()` plugin + the `@fonts` blade directive.

## Deploy harness — separate from this guardrail bundle

This bundle is the **lint/test gate only**. A new app ALSO needs its
production-image + GitOps deploy harness, which is **per-app** (harvested from a
reference app) and lives in the app repo + the `your-org/k8s` repo, **not here**:

- App repo: `Dockerfile` (two-image split — hardened zero-shell web[/reverb] +
  shell-bearing console for worker/scheduler/migrator), `docker/Caddyfile`,
  `docker/php.ini`, `.dockerignore`; `.forgejo/workflows/build-check.yml` (builds
  both images per PR) + `deploy.yml` (build/push/Trivy/k8s-tag-bump on `main`).
- k8s repo: `infra/<app>/` Helm chart + `infra/apps/<app>.yaml` ArgoCD Application
  + `infra/cnpg/cluster/init-<app>-database.yaml`.

See `wiki/infra/deploy-image.md`. A lean app
with no reverb/redis/s3 makes the
**simplest reference**. `scaffold/apply.sh` does NOT generate
these — adapt a reference app's.

## Ratchet, don't grandfather

Adding a tool an app lacked **will** surface findings. The rule of record is the spec's
**baseline & ratchet policy** ([`fleet-app-specification`](../../wiki/standards/fleet-app-specification.md)
§2): every tool's debt is a **one-way ratchet** — either no baseline / at-target, or a
baseline / off-target value that may only move **toward** the target. A new finding
outside the baseline (or a regression past the threshold) breaks CI; **a baseline never
grows and is never regenerated, and a threshold is never loosened.** The "never grows" half
is **machine-enforced** by `bin/baseline-guard.sh` in the `static` job (it fails the build
if any phpstan/phpmd/psalm baseline has more suppressed findings than at the PR's
merge-base). Per tool:

- **Larastan:** prefer **zero baseline** (the bar is L8 clean). A *frozen*
  `phpstan-baseline.neon` is permitted where an app needs one, but it may only shrink.
- **phpmd:** zero baseline preferred; on an app with existing complexity debt, generate
  the baseline **once** — `phpmd app text phpmd.xml --exclude '*/Filament/*'
  --generate-baseline` writes `phpmd.baseline.xml` (auto-read next to `phpmd.xml`). Commit
  it; phpmd then gates only NEW violations while the frozen set is burn-down debt. **Never
  re-run `--generate-baseline` to absorb new findings**, and don't blanket-disable
  rulesets. A dead / un-applied baseline file MUST be removed.
- **Thresholds** (`.jscpd.json`, `--coverage --min`, type-coverage `--min`): set the
  per-app value to *pass today*, record it as the ratchet point, then tighten toward the
  bundle target (jscpd **10**, coverage **80**, type-coverage **95**). Never loosen one.
- **knip:** turn off the noisiest rules per app + `ignoreDependencies` for dead deps to
  pass now; the unused files/exports are a burn-down list — re-enable rules as cleaned.
- **rector is NOT in the standard** — it conflicts with the phpstan L8 gate; phpstan L8 +
  strict-rules + Pint cover the ground. No `rector.php`, `rector/rector` dep, or rector CI
  step on any app. (How it was removed: see the wiki's convergence-log.)

## Divergence policy

Allowed to differ **only**: which workloads deploy (reverb/worker/scheduler),
which `services:` an app's *integration* tests need (redis for Valkey, s3/minio
for MinIO), the Browser/E2E job (opt-in, app-specific), and business logic.
Everything in `configs/` is identical fleet-wide.

## Convergence history

The dated per-app rollout — who adopted what, when, the phpmd baselines, the parity
snapshots, the per-tool CI restructure — is `status: living` news. It lives in the
wiki's `convergence-log`, not here. This README
stays a timeless apply-guide; the forward burndown is
`fleet-variance-backlog`.
