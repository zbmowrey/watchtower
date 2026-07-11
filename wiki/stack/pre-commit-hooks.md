---
title: Husky guardrail hooks (standard)
description: A local guardrail-hook standard — husky + lint-staged + commitlint, three hooks (fast pre-commit / heavy pre-push / commit-msg), all run INSIDE the dedicated vite container. Local-only DX — CI is the authoritative gate.
tags: [stack, dx, husky, lint-staged, commitlint, pre-commit, commit-msg, guardrails, standard]
type: stack
updated: 2026-07-09
related: [fleet-app-specification, laravel-engineering-standard]
---

# Pre-commit hooks (husky standard)

Pre-commit hooks are **local-only developer experience** — CI is the authoritative
gate that actually blocks merges. The hooks just catch issues a beat earlier. They
are easy to leave un-standardized: apps drift onto git-native `.githooks` vs
husky + lint-staged, and a scaffold that ships no `hooks` script or template stays
silent about them. So this is an undefined standard worth defining deliberately.

## The decision

Standardize on **husky + lint-staged**, scope **pre-commit + pre-push + commit-msg +
commitlint**. Encoded as the source of truth in **`standards/laravel`**:
`configs/package.fragment.json` (husky + lint-staged + commitlint devDeps +
`prepare: husky` + the lint-staged config), `commitlint.config.js`
(`extends: ['@commitlint/config-conventional']`), and `.husky/pre-commit` +
`.husky/pre-push` + `.husky/commit-msg` templates.

- **pre-commit (FAST):** `lint-staged` → `wayfinder:generate --with-form` →
  `npm run types:check` → `pest --testsuite=Unit`.
- **pre-push (HEAVY):** `composer stan` (L8 + strict-rules) → full `pest`.
- **commit-msg:** `commitlint` validates the message against Conventional Commits.
- **lint-staged:** `vendor/bin/pint` **then** `bin/phpmd-staged.sh` (scoped phpmd — see
  *Scoped phpmd* below) on `*.php`; `prettier --write` + `eslint --fix` on
  `resources/**/*.{ts,tsx,js,jsx}`; `prettier --write` on `**/*.{css,json,md,yml,yaml}`.

## Execution model — the whole toolchain runs in the dedicated `vite` container

**Every app runs the entire local toolchain (JS *and* PHP) INSIDE its dedicated `vite`
compose service** — nothing runs on the host. The `vite` service uses the app image
(`sail-8.x/app` = PHP + node), it already installs and maintains the **shared Linux
`node_modules`** on every `up`, and it sits on the compose network so it reaches
Postgres. Running the toolchain there ends the long-standing **host↔container
`node_modules` thrash** (a `sail up` re-Linux-ifying a host darwin install, or
vice-versa) — there is now exactly one `node_modules`, owned by the container, and the
host never touches it.

**Invocation (the load-bearing detail):**

```
VITE="./vendor/bin/sail exec -T -u sail vite"
$VITE npx lint-staged          # prettier/eslint + vendor/bin/pint, on staged files
$VITE php artisan wayfinder:generate --with-form
$VITE npm run --silent types:check
$VITE ./vendor/bin/pest --testsuite=Unit     # pre-commit; full pest on pre-push
$VITE composer stan                          # pre-push
$VITE npx --no -- commitlint < "$1"          # commit-msg; the message file piped to stdin
```

- **`-T`** — no TTY. Git hooks are non-interactive; without `-T`, `docker compose exec`
  errors with "the input device is not a TTY".
- **`-u sail`** — run as the `sail` user (host-uid-mapped) so `prettier --write` / `pint`
  produce **host-owned** files. Bare `sail exec vite …` runs as **root** → root-owned
  files; raw `docker compose exec` also drops Sail's env (WWWUSER warnings).
- **`vite`** — the designated container (service name `vite` in every compose.yaml).
- **pest** is run as the raw binary IN the container (`$VITE ./vendor/bin/pest`), which
  sidesteps the old `sail pest`-vs-`sail ./vendor/bin/pest` gotcha entirely (that only
  applied to Sail's own `pest` command).
- **Hooks fail fast** (with a "start the stack" hint) when the `vite` container isn't
  running — there's no host fallback in the container model; that's the point. Guard:
  `[ -z "$(./vendor/bin/sail ps --status running -q vite)" ] && exit 1`.

### commit-msg runs in the container too

commit-msg follows the **same container-run rule** as every other hook, but it takes an
extra step to get there, and the gap is instructive:

- **The canonical form** pipes the message file to commitlint's **stdin** rather than passing
  the path: `$VITE npx --no -- commitlint < "$1"`. commitlint's `--edit "$1"` takes a *host*
  path, which the container can't resolve; stdin sidesteps host↔container path translation
  entirely. (`--no` = error if commitlint isn't already installed, never auto-fetch.)
- **Why the host form is a trap.** Some apps first shipped commit-msg with the host form
  `npx --no -- commitlint --edit "$1"` — the only hooks still running on the **host**. They
  appeared to work, but only by **accident**: a stray host `node_modules` happened to resolve
  `commitlint`. That directly contradicts the container model (node_modules is container-owned;
  the apps' own pre-commit comments say *"nothing runs on the host"*), and it would fail on a
  clean checkout. Apps that keep **no** host `node_modules` could never have used the host form
  — so the container form is the only one that works everywhere. After convergence, every app's
  hook is byte-identical bar the `# APPNAME` header line.
- **CI never runs commit-msg** — it's local-only DX, like the other hooks. Existing history is
  untouched; it only validates *new* messages.

**Pest nuance** (the shape is otherwise identical across apps):

- Apps with a browser/Playwright suite exclude it from pre-push (no Chromium in the image,
  same as CI): `pest --testsuite=Unit,Feature,Architecture`. Pest reaches Postgres on the
  compose net; the container's memory limit avoids the 128M-php.ini OOM that host-run pest hit.
- Apps on Postgres run full `pest` against the DB on the compose net.
- Apps whose tests use in-memory sqlite need no DB service.
- **`.prettierignore` must exclude root `composer.json`/`package.json`/`*.lock`/`knip.json`**
  — lint-staged's broad `**/*.json` glob otherwise reindents them and fights
  composer-normalize's 4-space `composer.json`.

**Contributor prereq (all apps):** the Sail stack must be **up** (`just start <app>` /
`./vendor/bin/sail up -d`) to commit or push. No host node/PHP is needed.

## Scoped phpmd — the one whole-app static check that is sound to run per staged file

**Why phpmd, and not the others.** The pre-commit gate is cheap because it only judges what
changed — but that is only *sound* for a check whose verdict on a file doesn't depend on
other files. phpmd qualifies: every rule in the `phpmd.xml` (CyclomaticComplexity,
NPathComplexity, the code-size ceilings, `unusedcode`, the design/naming rules) is
**intra-class**. Running phpmd against just the staged `*.php` therefore gives the
*identical* verdict a full `composer md` would give for those files, for a fraction of the
cost:

| app size | `composer md` (whole `app/`) | scoped to a few staged files |
|-----|------------------------------|------------------------------|
| ~170 app files | ~0.6s | ~0.1s |
| ~930 app files | ~6.4s **and growing** | ~0.1s |

The full run scales with the app; the scoped run doesn't — that's the whole reason it can
live in pre-commit without bloating the commit.

**Why the other CI static checks stay OUT of pre-commit.** Larastan/PHPStan, Psalm-taint,
knip and jscpd are all **whole-program**: a change to one file can create — or fix — a
finding in an *unchanged* file, so scoping them to staged files both **misses** real
breakage and **invents** false positives. Larastan's correct incremental mechanism is its
**result cache** (cold ~32s, warm ~1.2s), which is exactly why it sits on **pre-push**,
not here. jscpd (duplication) and knip (unused exports) are cross-file by definition. Do
not move any of these to a per-staged-file run.

**The helper.** `configs/bin/phpmd-staged.sh` (copied to `<app>/bin/`, `chmod +x`) is what
lint-staged calls after pint. lint-staged hands it the staged paths as separate args, but
phpmd wants **one comma-separated** argument (space-separated makes it read the 2nd path as
the report format and error out), so the helper joins them. It also drops the same paths
CI's `composer md` excludes — `*/Filament/*` and `*/Domain/*/Data/*` — so a staged file
there can't fail a commit CI would wave through; if every staged file is carved out it
exits 0 without invoking phpmd. It's a plain POSIX `.sh`, not an npm binary, so — unlike
`lint-staged` / `@commitlint/cli` — it needs **no** knip `ignoreDependencies` entry.

## Rollout state

All apps are on husky, run the whole toolchain in the dedicated `vite` container, and
enforce Conventional Commits via a container-run `commit-msg` — one uniform model, no host
execution, no `node_modules` thrash.

Notes: commitlint is part of the standard — a fleet guardrail on the canonical container-run
form (see the commit-msg subsection above). Deps: `@commitlint/cli` +
`@commitlint/config-conventional` (pin a single `^` major across apps; normalize any drift on
the next touch). Converge the composer script names across apps (`composer stan`/`md`,
`npm run dup:check`) so the husky pre-push can call `composer stan`. husky's `prepare: husky`
auto-installs the hooks on `npm install` (no manual `composer hooks` step), and no-ops safely
during the CI/Docker `npm ci` (no `.git` yet).

**knip carve-out (required — the vite-exec wrapping makes it mandatory for every
container-wrapped binary).** knip's plugins detect a devDependency as "used" by reading the
husky hook scripts and seeing the binary invoked directly (`npx lint-staged`,
`npx commitlint`). **Wrapping the call as `sail exec … vite npx <binary>` defeats that
detection** — knip sees only `./vendor/bin/sail` and flags the real package as an unused
devDependency, reddening the `static`/`knip` job. So **every tool invoked only through a
container-wrapped husky hook must be listed in `ignoreDependencies`:**

- **`lint-staged`** — required since the container cutover. A missing carve-out reddens the
  `static`/`knip` job on the first run. An app that had passed with a *direct* `npx lint-staged`
  hook (detected) never carried the ignore; the `sail exec` wrap made it required.
- **`@commitlint/cli`** — required for the same reason, once commit-msg runs in the
  container. knip flags `@commitlint/cli` as an unused devDependency the moment the hook moves
  behind `sail exec`; the fix is `@commitlint/cli` in `ignoreDependencies` (note:
  `@commitlint/config-conventional` does **not** need ignoring — knip's commitlint plugin
  resolves it from `commitlint.config.js`'s `extends`).
- The standard `configs/knip.json` also sets `unlisted`/`binaries` rules `off` where
  `vendor/bin/pint` is flagged.

**The inverse — dead ignores (knip config hints).** A dependency that knip *can* resolve
should **not** be in `ignoreDependencies`, or knip emits a `Remove from ignoreDependencies`
config hint. The common case: `@testing-library/dom` / `@testing-library/react` are reached
through `tests/js/` (vitest `setupFiles`/`include`, which knip's vitest plugin discovers as
entries), so an explicit ignore is dead. Config hints **do not fail CI by themselves** (the
exit code is driven by real findings like the unused dep), but they signal stale config —
clean them up. An app with no `tests/js` importing testing-library keeps them (there the
ignore is still load-bearing) — let knip's actual output decide per app.
