---
title: Mago — Rust PHP toolchain (fleet evaluation)
description: Evaluation of Mago 1.42.0 (carthage-software) as a replacement/pre-filter for the fleet's PHP CI tools. Benchmarked head-to-head on acme against Pint (format), PHPStan/Larastan (analyze), PHPMD (lint), and Pest arch (guard). Verdict — DO NOT ADOPT on the fleet now (net gain ≈ nil): no tool is a subset so none can pre-filter; analyze is framework-blind (Laramago helps but is v0.2.x); lint is a lateral PHPMD swap; guard perimeter is net-new but solves layering these flat apps lack. Worth it only on greenfield / framework-free PHP. Revisit if Mago ships native Eloquent (#885) or Laramago hits 1.0.
tags: [mago, tooling, formatter, static-analysis, linter, arch-testing, ci, laravel, evaluation]
type: reference
updated: 2026-06-27
related: [laravel-engineering-standard, pest-testing, cquality]
---

# Mago — Rust PHP toolchain (fleet evaluation)

[Mago](https://mago.carthage.software) (carthage-software) is a single ~22 MB static
Rust binary (`mago 1.42.0`, no PHP runtime / no Composer deps) bundling four tools:
`format`, `lint`, `analyze`, and `guard`. Evaluated 2026-06-27 head-to-head on
**acme** (285 tracked PHP files, 155 in `app/`) against the fleet's incumbents.

Install (standalone, version-pinned, no sudo):
`curl --proto '=https' --tlsv1.2 -sSf https://carthage.software/mago.sh | bash -s -- --version=1.42.0 --install-dir="$HOME/.local/bin"`
(also `composer require --dev carthage-software/mago`, `brew install mago`). Global
flags (`--workspace`, `--config`, `--php-version`) go **before** the subcommand.
Config is `mago.toml`; `mago config` dumps the full effective schema; `mago init`
needs a TTY. Each tool has its own **baseline** (`--generate-baseline` / loose variant
matches by file+code+message+count, resilient to line shifts).

## Bottom line — DO NOT ADOPT on the fleet right now (net gain ≈ nil)

For a mature, already-green, Laravel-native stack (Pint + PHPStan/Larastan + Pest +
PHPMD), Mago has nothing to do that is **both non-redundant and trustworthy**. Verdict
per tool:

| Mago tool                | Incumbent             | Speed (acme)               | Relationship                                                       | Adopt?                                                                                                         |
|--------------------------|-----------------------|------------------------------|--------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------|
| `format`                 | Pint (laravel preset) | ~0.01s vs ~0.6–0.8s          | **Peer**, different style                                          | **No** — dropped: no single-pass convergence guarantee (`format` can't pass its own `--check`); fights Pint    |
| `analyze` (raw)          | PHPStan L8 + Larastan | 0.9s vs 5.7s, **1.4 GB RSS** | **Peer engine, framework-blind** (256 FPs on clean code)           | **No** — unusable raw on Laravel                                                                               |
| `analyze` + **Laramago** | PHPStan L8 + Larastan | 3.2s vs 5.7s                 | **Viable peer** — overlays cut 256→4 — but v0.2.6, emits artifacts | **No (not yet)** — too immature for the trust gate; revisit post-1.0                                           |
| `lint`                   | PHPMD                 | ~0.01s vs 1.0s               | **Superset** (mess-detection + modernization)                      | **No** — lateral: PHPMD already green; saves ~1s; extra rules are opt-in/redundant with pint+phpstan-strict    |
| `guard`                  | Pest arch             | 0.5s vs 2.7s                 | **Peer + net-new** (deptrac perimeter)                             | **No** — perimeter is real but enforces layering these flat apps don't have; structural is redundant with Pest |

**Why nothing lands:**

1. **No subset = no pre-filter.** The original goal (fast pre-commit early-exit fronting
   a slow gate) is structurally impossible: a pre-filter must be a *subset* of its gate,
   but every Mago tool is a *peer with its own opinions* — proven (guard's direct-vs-
   transitive `must-extend` fails code Pest passes; raw analyze floods FPs Larastan
   doesn't; format and Pint fight). Peers can only be *additive gates* or *replacements*,
   never pre-filters.
2. **The trust-critical slot (analyze) is Mago's weakest** — framework-blind; only fixed
   by immature Laramago.
3. **Where Mago is strong, the fleet is already covered** — lint duplicates a green
   PHPMD + phpstan-strict; guard's only non-redundant piece (perimeter) solves a layered-
   architecture problem these controller→action→model apps don't have.

**When Mago WOULD be worth it (none describe this fleet):** a **greenfield PHP project
with no existing toolchain** (one fast PHP-runtime-free binary = format+lint+analyze+
guard out of the box), or a **framework-free PHP package** (analyzer is a true PHPStan
peer, no Laravel blindness). **Re-evaluate** only if Mago ships native Eloquent support
([#885](https://github.com/carthage-software/mago/issues/885)) or Laramago reaches 1.0 —
that reopens the analyzer question, the only one worth reopening.

## Formatter — `mago format` vs Pint

Set `[formatter] preset = "laravel"` (mirrors Pint's `laravel` preset; resolves e.g.
no-space concat). It is NOT a drop-in for Pint:

- **40% of files differ** (115/285) on already-Pint-clean code, ~3.7k changed lines.
  Cause: Mago is a **Prettier-style pretty-printer** (hard 120-col `print-width`,
  reflows everything); Pint is a **rule-based fixer** that preserves your line breaks.
- Divergence signatures: Laravel config doc-comment block re-indent (+1 space, PSR
  asterisk align), first method-chain call forced onto its own line, one-call-per-line
  when a chain breaks, >120-col arrays exploded, blank-line policy.
- **Mutually incompatible as gates:** `pint --test` fails on Mago's output and vice
  versa → you cannot run both; pick one.
- **Formatter gaps vs Pint:** does NOT insert `declare(strict_types=1)` and does NOT
  convert `array()`→`[]` (those are Pint *rules* → map to Mago **lint**, not format).
- **⚠️ Single-pass non-convergence (1.42.0):** one `mago format` (exit 0) can leave
  files that `mago format --check` then flags — observed on 6 files, all the
  `$this->method()` chain-break; a 2nd pass converges. Naive CI (`format` then
  `--check`) would fail right after formatting. The fixer is otherwise idempotent
  (format-twice = zero diff).
- **Determinism is ~a tie, not a Mago win:** both tools are deterministic (same input →
  same output). Under the `laravel` preset Mago *preserves* existing multiline arrays
  (Prettier "magic trailing comma" model — author keeps a layout lever), exactly like
  Pint; its real divergence is more aggressive **method-chain** canonicalization
  (`$this` forced to its own line, one call per line) + comment/blank-line handling.
  Mago's pretty-printer *lineage* (gofmt/Prettier) is the more modern category and could
  be pushed toward fully-canonical output Pint can't do — but its laravel preset
  deliberately dials that back to mimic Pint, so in practice the output-quality gap is
  lateral, not a clear objective win.

## Analyzer — `mago analyze` vs PHPStan/Larastan (the trust question)

Ground truth: acme PHPStan **L8, no baseline = 0 errors** (cold 5.7s/319 MB).
On the *same clean code*, `mago analyze` reports **256 issues (191 error / 59 warn /
6 help)**, cold 0.9s but **1.41 GB RSS** (loads `vendor` for symbol resolution via
`source.includes = ["vendor"]`).

- **Engine recall is peer-grade:** on 10 planted framework-free type bugs (wrong
  return, bad arg, undefined method/property/var, null deref, always-false compare,
  unreachable, too-few-args, array-access-on-int) **Mago caught 10/10, same as
  PHPStan-max.** It is a real analyzer, not a toy.
- **The entire 256-issue delta is Laravel framework-blindness** — Mago ships **no
  Larastan equivalent** (`plugins: []`). Dominant families: `mixed-*` (~125; can't
  narrow `$request->user()`, Eloquent attributes), `invalid-template-parameter` (14;
  `HasFactory` generics), facade `non-documented-method/property` (20; `__callStatic`),
  Eloquent builder proxying (`->where()` typed as `Query\Builder` not
  `Eloquent\Builder`), and **`abort_unless($x instanceof Y)` not narrowing** (Larastan
  has a type-specifying extension; Mago doesn't know it throws). Spot-checks of the
  residual after suppressing magic families: **all framework FPs, zero genuine bugs
  PHPStan missed.**
- **Baseline:** Mago can `--generate-baseline` its 256 findings → re-run clean (exit 0).
  So it can grandfather *its own* deltas (green-then-ratchet), but it **cannot import
  PHPStan's baseline** — different finding sets/format. A baseline here masks ~real
  signal under framework noise.

**Verdict (raw Mago):** unusable on a Laravel app; only viable on framework-free
pure-PHP packages where it's a genuine peer.

### Laramago — the Laravel-aware bridge (tested)

[`laramago/laramago`](https://packagist.org/packages/laramago/laramago) (MIT, v0.2.6
2026-06-04, PHP 8.3+, Mago ^1.30, Laravel ^13) is a community Composer package that
makes Mago's analyzer Laravel-aware **without modifying source**: it generates Eloquent
model PHPDoc overlays + Laravel framework/auth overlays into `.laramago/cache/`, ships a
Laravel runtime preset, maps `--phpstan-level=0..10|max` to keep your strictness gate,
and has a baseline + `compare` (vs PHPStan) workflow. `composer require --dev
laramago/laramago && vendor/bin/laramago init|analyze|baseline|compare`.

**Tested on acme (2026-06-27):** `laramago analyze --phpstan-level=8` cut the raw
Mago noise from **256 → 4 issues** (its own `compare`: plain Mago 215 → Laramago 4) —
a ~98% reduction; the framework-blindness is essentially solved. Cost: **3.2s / 1.4 GB**
(overlay generation + Laravel boot each run; ~2× faster than PHPStan cold but loses raw
Mago's sub-second speed and uses 4.5× the RAM).

**But it is a v0.2.x bridge, not a gate-of-record replacement:** of the 4 residuals,
one (`SiteSetting::selectraw()` "line 170") is a provable **overlay artifact** — the
real file is 59 lines and has no `selectRaw`; the finding points into a generated
overlay with broken source-mapping. Plus Laramago isn't a strict subset of Larastan
(it surfaced a `GetClientDetail` return-precision nit Larastan tolerates), so it's still
a peer, not a pre-filter. Native Mago Eloquent support is tracked upstream
([issue #885](https://github.com/carthage-software/mago/issues/885)); Laramago's author
plans to move logic into first-class analyzer plugins once Mago exposes extension points
(it does not as of 1.42.0 — `plugins: []` is not a public API).

## Linter — `mago lint` vs PHPMD

PHPMD: 0 findings (acme is clean). Mago lint (defaults): **~94 issues, only 6
error-level** (2 cyclomatic-complexity, 2 excessive-parameter-list, 1 kan-defect,
1 no-literal-password), rest warning/help/note; 38 auto-fixable; ~0.01s.

- **Superset of PHPMD:** overlaps the mess-detection dimension (cyclomatic-complexity,
  excessive-parameter-list, kan-defect, halstead) **and** adds Rector/Pint-style
  modernization (`prefer-static-closure`, `prefer-first-class-callable`,
  `literal-named-argument`, `no-isset`) + a `disallowed-functions` rule that can cover
  Pest arch's "no dd/dump/var_dump".
- **Laravel FPs by default:** `no-literal-password` fires on `'password' => 'hashed'`
  (a cast directive); `excessive-parameter-list` fires on `App\Data` DTO constructors.
- **Fully tunable** (the 94 is *breadth*, not strict thresholds): every rule has
  `[linter.rules.<name>] { enabled, level }` + configurable thresholds
  (`cyclomatic-complexity.threshold` 15, `excessive-parameter-list` 5, `excessive-nesting`
  7, `halstead`, `kan-defect` 1.6). Disabling the 7 opinionated modernization rules +
  relaxing thresholds dropped acme **94 → 3**. Own baseline. `integrations =
  ["laravel","php-unit"]` *adds* framework rules, doesn't quiet.

## Guard — `mago guard` vs Pest arch tests (the best fit)

Two halves, both deny-by-default, each with a baseline, ships empty (you author rules):

- **`--structural`** (naming/modifiers/inheritance): replicated acme's controllers
  final+`*Controller`, requests final+`*Request`+extend FormRequest, DTOs final+readonly
  cleanly. **Caveat:** `must-extend` is **direct-parent only**, while Pest `toExtend`
  is **transitive** — it flagged `App\Models\User` (extends `Authenticatable`→…→`Model`).
- **`--perimeter`** (Deptrac-style layer deps): **net-new capability Pest arch lacks
  natively.** Verified the thin-controller boundary (controllers must not depend on
  `App\Models`) = **0 violations, matches the passing Pest rule.** Allowlist semantics:
  `permit = [...]`, anything unlisted is forbidden; aliases `@native`/`@self`/
  `@layer:`; only checks symbols it can resolve.
- **Gaps & quirks:** hygiene/preset rules (`toUseStrictTypes`, `preset()->php()`/
  `->security()`, no-eval/weak-compare) are NOT guard — they spread across Mago
  **lint** (`disallowed-functions`) + **analyze**. API inconsistency: `guard.
  structural.rules` accepts a `reason` key but `guard.perimeter.rules` rejects it
  (parse error, exit 2) — a silent foot-gun (looks like "0 violations").

## How the fleet should use Mago (recommendation)

**Decision (2026-06-27): do not adopt Mago anywhere on the fleet right now.** Keep the
existing gates of record — Pint + PHPStan/Larastan + Pest (incl. arch) + PHPMD — exactly
as they are. The full reasoning is in **Bottom line** above; in short, every Mago tool is
a peer (not a subset, so no pre-filter), the trust-critical analyzer is framework-blind,
and where Mago is strong the fleet is already covered. The deep-dive that produced this
(formatter convergence proof, 256→4 Laramago test, lint 94→3 tunability, guard structural

+ perimeter, the Pest-arch coverage map) is preserved in the sections above so a future
  session need not re-run it.

**The only trigger to revisit:** Mago ships native Eloquent/Laravel analyzer support
([#885](https://github.com/carthage-software/mago/issues/885)) **or** Laramago reaches a
stable 1.0. Either reopens the **analyzer** question (the one slot with real potential
value) — re-benchmark `analyze`+Laramago against PHPStan/Larastan at that point. Until
then, nothing here is worth the adoption + dual-maintenance cost.

**If a brand-new context arises** (a greenfield PHP service with no toolchain, or a
framework-free extracted package), Mago becomes attractive on its own merits — single
fast PHP-runtime-free binary, and the analyzer is a true PHPStan peer with no Laravel
blindness. That is a different decision from retrofitting it onto these mature apps.
