---
title: The local gate (run this before you push)
description: The one owner of what "gated" means locally on a fleet Laravel app — the full static set, the two things composer ci:check does NOT run, the per-app suite differences, and the husky pre-push timing that looks like a network failure. Assembled 2026-08-03 from five scattered notes after running the gate piecemeal cost real CI round trips.
tags: [standard, ci, testing, gate, husky, pest, phpmd, bundle]
type: standard
status: normative
updated: 2026-08-03
related: [fleet-app-specification, fleet-testing-doctrine, pest-testing, pre-commit-hooks, forgejo-ci]
---

# The local gate

**The rule: green locally must mean green in CI.** Everything below exists because
some part of the gate was skipped and CI caught it instead, which costs a red build
and a round trip.

The failure mode is never "I didn't know there was a gate." It is running *part* of
it, calling that gated, and pushing.

## The short answer

For any change that can move JS weight (dependency refreshes above all):

```
sail exec -T -u sail vite sh -c 'composer ci:check && npm run build && npm run bundle:check'
```

For a PHP-only change, `composer ci:check` plus the app's own test suites (see
*Per-app differences*) is enough.

## What `composer ci:check` covers, and the two gaps

It runs pint, phpstan/larastan, phpmd, psalm-taint, composer-normalize, eslint,
prettier, tsc, knip, and the PHP test suite.

**Gap 1 — it does NOT run `npm run bundle:check`.** CI runs the bundle-size budget as
its own step in the `tests` job, right after "build frontend". A fully green local
`ci:check` can still fail CI on bundle size. The budget needs a real
`public/build/manifest.json`, which is why it was never folded into the composer
script, so it has to be a separate `npm run build && npm run bundle:check`.

Before rebaselining a breached budget, measure `origin/main` against the branch and
confirm it is not a lazy-to-eager regression: a chunker or plugin bump can breach a
budget with zero code growth, and rebaselining that hides the real change.

**"Can move JS weight" includes adding pages, not just dependency work.** Kataroom
One PR breached `totalJs` by 1.8 kB from seven code-split console pages accumulated
over seven slices — no new dependency, no chunker change, and each individual slice
looked far too small to matter. The breach lands on whichever PR crosses the line,
which is rarely the one that caused most of the growth. **If a branch adds or deletes
any `resources/js/pages/**` file, run the build and `bundle:check`.**

The diagnostic that separates real growth from a regression is **first-load versus
total**. Genuine new lazy pages move `total` and leave `first-load` flat (#192:
total +3.7 kB, first-load +0.1 kB) — rebaseline. A jump in `first-load` with little
total change means something that was lazy became eager; find that instead.

**Gap 2 — the front-end test suite is separate.** `ci:check` does not run vitest on
every app. See below.

**Gap 3 — some apps' `static` CI job runs JS gates that `ci:check` never touches.**
On **acme** the static job also runs `npm run knip` (dead-code / unused-file
detection) and `npm run dup:check` (jscpd). Neither is reachable from
`composer ci:check`, so a locally-green branch can still turn the static job red.

*The trigger to remember:* **deleting a component or page is exactly what knip
catches** — the types file or helper that existed only for it is now an unused
file, and knip exits 1 on one. It fires after
`TelemetryTile.tsx` was removed and `types/telemetry.ts` lost its only consumer.

**`knip` OOMs in the local container** (node heap; same failure as the acme
convergence work). So it cannot simply be added to the local gate — instead,
after deleting any front-end file, grep for imports of everything it referenced
and either re-home them or delete them too. `npm run dup:check` DOES run locally
and is cheap; run it when a slice adds a new action alongside a similar one.

## The static set, in CI's order

composer install → composer-normalize → pint → phpmd → composer-audit → larastan
(phpstan) → psalm (taint) → require-checker/unused → baseline-ratchet guard.

**Running only pint + larastan locally is not enough.** That is the single most
common way to push a red build.

**The one that bites: phpmd caps cyclomatic complexity at 10.** A non-trivial action
`__invoke` with a couple of loops plus nested `if`/`||`/`&&`/`?:` reaches 11 or 12
easily. The fix is to extract a private helper, not to inline all the branching.
phpmd also flags unused params, boolean flag arguments, short variable names, and
`else` after `return`.

Note there is no `composer phpmd` script on every app; the direct invocation is

```
sail php vendor-bin/phpmd/vendor/bin/phpmd app text phpmd.xml \
  --exclude '*/Filament/*,*/Domain/*/Data/*'
```

**Run the static scripts serially.** Running phpmd and psalm-taint in parallel
produces phantom violations.

### phpstan's result cache will lie to you after a config change

phpstan caches per-file results. Change something that alters **inferred types in
files you did not touch** — above all `config/auth.php` — and it serves those files'
stale clean results and prints `[OK] No errors`, while CI starts cold and finds
them all.

```
sail php vendor/bin/phpstan clear-result-cache
```

Adding a second guard/provider is the classic trigger: Larastan resolves
`$request->user()` from the configured providers, so every **unguarded** call site
becomes a union (e.g. `Administrator|User`) and breaks `->is_admin`, `->isPro()`,
and any `int $userId` parameter. Costs a red `static` with
eleven errors after a local run said clean.

**Fix by naming the guard — `$request->user('web')` — but only in the files the
analyser named.** A blanket find-and-replace across `app/` broke every API test on
that same PR: `routes/api.php` authenticates with **Sanctum tokens**, so
`user('web')` is null there. Code reachable from both planes must stay unguarded
and narrow by type instead:

```php
$user = $request->user();
if (! $user instanceof User) { $user = null; }
```

## Per-app differences that have actually caused red builds

- **Two test runners, not one.** Some apps carry an independent vitest suite beside
  the PHP one. Running vitest, then making one more front-end edit, then re-running
  only the PHP suite and the static gates is the trap: tsc and eslint pass happily
  while a vitest assertion is broken, because they check types and style, not
  behaviour. **Re-run BOTH suites after the LAST edit**, not after the last edit you
  happened to think of as front-end.
- **A parallel Integration tier.** Where an app splits Integration out, the local
  gate is the parallel pest run plus `bundle:check`; and static must be re-run after
  any post-gate edit, because the edit you make while waiting is the one nothing
  checked.
- **Bare `pest --parallel` collides.** It shares one testing database and produces a
  42P01 storm. Use `artisan test --parallel`, which provisions per-worker databases.

## The husky hooks, and the timeout that looks like a network failure

`.husky/pre-push` runs `composer stan` plus the full Unit/Feature/Architecture suite
inside the repo's `vite` compose service before every push.

Two consequences worth internalising:

- **A `git push` that "times out" after two minutes is usually the gate still
  running**, not a git.example.com network problem. Check `.husky/pre-push` before you go
  hunting for a LAN block. The real network-failure signature is an immediate "no
  route to host", not a hang.
- **The stack must be UP for a push to work at all** — the hook exits early if the
  vite container is not running.

Push with a 600s timeout, or in the background. `git push --no-verify` is the
emergency bypass and wants the maintainer's blessing. The pre-commit hook is heavy too
(around 90s: pint, phpmd, prettier, eslint, unit tests), so give commits a long
timeout as well.

**The hooks only fire if the local checkout has `core.hooksPath` set to `.husky/_`,**
which `npm ci` / `npm run prepare` does. A checkout where npm never ran has it unset:
commits and pushes succeed with no pint auto-fix, no phpmd, and no pre-push suite,
and everything looks normal until CI fails. Verify per checkout, not per repo:

```
git -C ~/code/<app> config core.hooksPath      # expect .husky/_
```

## Why this page exists

These five facts lived as five separate notes, so the gate had to be reassembled from
memory every time and was reliably run in pieces. One page, one owner. If you learn a
new way the gate can be partially run, add it here rather than starting a sixth note.
