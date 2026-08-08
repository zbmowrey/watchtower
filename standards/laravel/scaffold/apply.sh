#!/usr/bin/env bash
#
# scaffold/apply.sh — bring a Laravel+Inertia+React app to fleet parity.
#
# Drops the canonical architecture tiers, the reference configs, and the CI
# workflow into a target app so a NEW app starts at parity on commit #1 (and an
# existing one can be re-baselined). Universal pieces are copied verbatim;
# namespace-dependent opt-in tiers and the composer/package *fragments* are left
# for you to adopt deliberately (see the printed checklist).
#
# Usage:  standards/laravel/scaffold/apply.sh <target-app-root> [app-slug]
#
set -euo pipefail

STD="$(cd "$(dirname "$0")/.." && pwd)"          # …/standards/laravel
target="${1:?usage: apply.sh <target-app-root> [app-slug]}"
slug="${2:-$(basename "$target")}"
[ -d "$target" ] || { echo "✗ target not found: $target" >&2; exit 1; }

say() { printf '  %s\n' "$1"; }

echo "→ scaffolding fleet parity into $target  (slug: $slug)"

# 1) Universal architecture tiers — verbatim, every app runs these.
mkdir -p "$target/tests/Architecture"
for f in HygieneTest HttpLayerTest; do
  cp "$STD/tests/Architecture/$f.php" "$target/tests/Architecture/$f.php"
  say "tier (universal): tests/Architecture/$f.php"
done

# 2) Reference configs — standalone files copied as-is.
#    psalm.xml = the fleet SAST (taint) config; .nvmrc pins Node to the ci-php
#    image (spec v1 §1, with engines.node in the package fragment + engine-strict
#    in .npmrc).
for f in phpstan.neon phpmd.xml psalm.xml pint.json .jscpd.json knip.json eslint.config.js \
         commitlint.config.js tsconfig.json vitest.config.ts .prettierrc .prettierignore \
         .editorconfig .npmrc .nvmrc renovate.json; do
  [ -f "$STD/configs/$f" ] && { cp "$STD/configs/$f" "$target/$f"; say "config: $f"; }
done

# 2b) Supporting files that live OUTSIDE the repo root — apply.sh used to skip
#     these, leaving a manual-copy gap that broke CI on the first run (the bundle
#     gate + husky hooks especially). Copy them too.
mkdir -p "$target/bin" "$target/vendor-bin/phpmd" "$target/tests/js" "$target/.husky"
[ -f "$STD/configs/bin/check-bundle-size.mjs" ] && {
  cp "$STD/configs/bin/check-bundle-size.mjs" "$target/bin/check-bundle-size.mjs"
  say "perf: bin/check-bundle-size.mjs  (⚠ CALIBRATE BUDGETS_KB — ships as {0,0,0}, fails CI until set)"; }
[ -f "$STD/configs/bin/baseline-guard.sh" ] && {
  cp "$STD/configs/bin/baseline-guard.sh" "$target/bin/baseline-guard.sh"
  say "gate: bin/baseline-guard.sh  (ratchet — ci.yml static step; fails if a phpstan/phpmd/psalm baseline grew)"; }
[ -f "$STD/configs/bin/phpmd-staged.sh" ] && {
  cp "$STD/configs/bin/phpmd-staged.sh" "$target/bin/phpmd-staged.sh"
  chmod +x "$target/bin/phpmd-staged.sh"
  say "hook: bin/phpmd-staged.sh  (lint-staged scoped phpmd on staged *.php — pre-commit)"; }
[ -f "$STD/configs/bin/ci-detect-changes.sh" ] && {
  cp "$STD/configs/bin/ci-detect-changes.sh" "$target/bin/ci-detect-changes.sh"
  chmod +x "$target/bin/ci-detect-changes.sh"
  say "ci: bin/ci-detect-changes.sh  (path-scoped CI — the detect step in ci.yml/build-check.yml; fail-safe flags)"; }
[ -f "$STD/configs/vendor-bin/phpmd/composer.json" ] && {
  cp "$STD/configs/vendor-bin/phpmd/composer.json" "$target/vendor-bin/phpmd/composer.json"
  say "tool: vendor-bin/phpmd/composer.json  (bamarni-isolated phpmd)"; }
[ -f "$STD/configs/tests/js/vitest.setup.ts" ] && {
  cp "$STD/configs/tests/js/vitest.setup.ts" "$target/tests/js/vitest.setup.ts"
  say "test: tests/js/vitest.setup.ts"; }
for h in pre-commit pre-push commit-msg; do
  [ -f "$STD/.husky/$h" ] && {
    cp "$STD/.husky/$h" "$target/.husky/$h" && chmod +x "$target/.husky/$h"
    say "hook: .husky/$h  (whole gate runs in the vite container)"; }
done

# 3) CI workflow — __APP__ placeholder filled with the slug.
if [ -f "$STD/.forgejo/workflows/ci.yml" ]; then
  mkdir -p "$target/.forgejo/workflows"
  sed "s/__APP__/$slug/g" "$STD/.forgejo/workflows/ci.yml" > "$target/.forgejo/workflows/ci.yml"
  say "ci: .forgejo/workflows/ci.yml (slug substituted)"
fi

# 3b) Renovate runner workflow — __APP__ substituted; the cron minute still needs a
#     manual per-app edit (the stagger table). The RENOVATE_TOKEN secret it needs
#     is NOT scaffolded here (one-time bot-account setup outside this script) — see
#     the printed checklist below.
if [ -f "$STD/.forgejo/workflows/renovate.yml" ]; then
  mkdir -p "$target/.forgejo/workflows"
  sed "s/__APP__/$slug/g" "$STD/.forgejo/workflows/renovate.yml" > "$target/.forgejo/workflows/renovate.yml"
  say "renovate: .forgejo/workflows/renovate.yml (slug substituted; ⚠ SET THE CRON MINUTE — stagger it per app)"
fi

cat <<'CHECKLIST'

✓ universal pieces in place. Finish parity by hand (deliberate steps):

  [ ] Merge the deps + scripts from standards/laravel/configs/composer.fragment.json
      and package.fragment.json into the app's composer.json / package.json,
      then `composer update` / `npm install`. This brings in psalm-taint (SAST,
      `composer psalm-taint` + the copied psalm.xml), the local `composer mutation`
      gate (set --class to your logic layer + ratchet --min toward MSI 70), the
      jsx-a11y + type-aware eslint rules, the full-strict tsconfig, and the Node
      pin (engines.node 24.x + .nvmrc + .npmrc engine-strict).

  [ ] ⚠ RUNTIME-SECURITY LAYER — NOT scaffolded by this script (it's app-boot
      code, harvested per-app from a reference app). A greenfield app is NOT
      spec-conformant without it, and skipping it is exactly how an app can ship to
      prod with no CSP. Add, per spec
      v1 §5:
        - app/Http/Middleware/SecurityHeaders.php — copy VERBATIM from
          standards/laravel/app/Http/Middleware/SecurityHeaders.php (X-Frame-Options
          DENY, nosniff, Referrer-Policy, locked Permissions-Policy, HSTS in prod,
          nonce-based CSP `script-src 'self' 'nonce-…'` with NO unsafe-inline/eval
          on script-src). It's a golden REFERENCE, not byte-identical — customize
          only the 2 TUNE POINTs its docblock marks (per-app webfont host in
          font-src/style-src if the app loads a font CDN — register as spec §7
          A-06; the Reverb-aware connect-src needs no edit). Register it LAST in
          bootstrap/app.php's `$middleware->web(append: [...])` list — see a
          reference app's bootstrap/app.php for the exact seam.
          Full doctrine: your own application-security notes (don't restate it
          here).
        - app/Providers/AppServiceProvider.php — copy VERBATIM from
          standards/laravel/app/Providers/AppServiceProvider.php (byte-identical
          fleet-wide, locked by bin/arch-drift). It installs only the §5
          guardrails: APP_DEBUG-in-prod guard, Model::shouldBeStrict (non-prod),
          automaticallyEagerLoadRelationships, Date::use(CarbonImmutable),
          Vite::useCspNonce, Vite::prefetch(concurrency: 3), URL::forceScheme +
          URL::useOrigin keyed on str_starts_with(app.url,'https://'),
          DB::prohibitDestructiveCommands + Password::defaults (prod). Put
          app-specific bindings/observers in a SEPARATE per-domain provider,
          never in AppServiceProvider. (SecurityHeaders reads its CSP nonce from
          this provider's Vite::useCspNonce() call — copy this one first.)
        - tests/TestCase.php setUp: Http::preventStrayRequests() (disable Inertia
          SSR in tests). Add tests/Feature/RuntimeGuardrailsTest.php to CI-gate it.
  [ ] LOGGING (prod stderr/JSON) — NOT auto-copied (would clobber app-specific log
      channels). Copy configs/logging.php → config/logging.php for a GREENFIELD app;
      on an existing app just confirm its `stderr` channel keeps the
      `'formatter' => env('LOG_STDERR_FORMATTER')` hook. Merge
      configs/logging.env.fragment into .env.example (local dev stays LOG_STACK=single).
      Prod MUST log to stderr as JSON — set LOG_STACK=stderr +
      LOG_STDERR_FORMATTER=Monolog\Formatter\JsonFormatter in the app's k8s
      infra/<app>/values.yaml; file drivers are forbidden under readOnlyRootFilesystem
      (spec v1 §5; a documented tradeoff).
  [ ] ERROR TRACKING (Sentry SaaS) — spec v1 §5. Merge the sentry/sentry-laravel
      `require` from configs/composer.fragment.json (RUNTIME dep — verify the major
      resolves against the app's laravel/framework ^13; bump if composer refuses),
      then `composer update`. Wire the REPORT seam in bootstrap/app.php's existing
      ->withExceptions(...) closure: `use Sentry\Laravel\Integration;` +
      `Integration::handles($exceptions);` (apps only ->map()/->shouldRenderJsonWhen()
      there today — render, not report). Merge configs/sentry.env.fragment into
      .env.example (DSN empty locally = OFF). Prod: SENTRY_LARAVEL_DSN (a Secret, never
      committed) + conservative sample rates in k8s infra/<app>/values.yaml. Closes the
      error-tracking half of a documented tradeoff. (FE browser SDK = SHOULD, later.)
  [ ] Register the Architecture testsuite in phpunit.xml:
        <testsuite name="Architecture"><directory>tests/Architecture</directory></testsuite>
  [ ] Adopt OPT-IN tiers as the app grows the namespaces (copy from
      standards/laravel/tests/Architecture/, drop rules whose subject namespace
      is empty — Pest arch ERRORS on an empty subject):
        DomainLayerTest   → needs App\Domain
        PersistenceTest   → needs App\Infrastructure
        ValueObjectsTest  → DTO rule needs App\*\*\Data; enum rule needs App\Enums
  [ ] Run `vendor/bin/pest --testsuite=Architecture`; resolve findings by fixing
      code or a documented ->ignoring() carve-out (never delete a universal rule).
  [ ] Any intentional divergence from a universal tier → record it in
      standards/laravel/arch-drift.allow AND as a comment in the app's file.
  [ ] Verify with `bin/arch-drift --app <slug>` once merged to main.
  [ ] Copy configs/bin/check-bundle-size.mjs → <app>/bin/ AND CALIBRATE its
      BUDGETS_KB: run `npm run build` then `node bin/check-bundle-size.mjs`, set
      the three budgets to the measured kB + ~10% headroom. It ships as {0,0,0},
      which makes ci.yml's `bundle size budget` step FAIL on every run until set.
  [ ] Provision the repo's CI_TOKEN secret (else every workflow dies at "Set up
      job"): `tea actions secrets create CI_TOKEN --repo your-org/<slug>` (it
      prompts; do NOT pass --stdin). Scope: read/write repository + read/write
      package.
  [ ] Renovate: set THIS APP's cron minute in .forgejo/workflows/renovate.yml
      (stagger the minute per app — don't leave every app
      on the same minute). One-time fleet setup (skip if the renovate-bot account
      + token already exist from a prior app): create the renovate-bot Forgejo
      user (full name + email set, or it can't commit), add it as a repo
      Collaborator (write), then `tea actions secrets create RENOVATE_TOKEN --repo
      your-org/<slug>` (prompts; do NOT pass --stdin) with its PAT — same value
      across every app repo, like CI_TOKEN. Full doctrine + PAT scopes:
      your own dependency-update notes.
  [ ] If vite.config.ts has `fonts: [bunny(...)]` (newer React starter kit): it
      FETCHES the font from fonts.bunny.net at BUILD TIME, which fails build-check
      (hermetic docker build can't reach the CDN). Vendor the woff2 + a @font-face
      fonts.css (mirror a reference app's resources/fonts/ + resources/css/fonts.css),
      @import it from app.css, and DELETE the bunny() plugin + the @fonts blade
      directive. See a reference app / k8s docs/known-issues.md #29.

CHECKLIST
echo "done."
