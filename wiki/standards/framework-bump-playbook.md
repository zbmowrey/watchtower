---
title: Framework Bump Playbook (annual PHP/Laravel rituals + feature-rulings register)
description: The standing procedure that keeps the standards current instead of re-auditing them by hand — the Q4 PHP bump ritual, the Q1 Laravel bump ritual, the verify-by convention for version-scoped reference claims, and the per-major feature-rulings register (Laravel 13's table lives here). Written 2026-08-08 after a full corpus review found the gaps this page exists to prevent.
tags: [ standard, process, upgrades, php, laravel, playbook, ratchet ]
type: standard
status: normative
updated: 2026-08-08
related: [ fleet-app-specification, php-language-doctrine, fleet-api-specification, laravel-engineering-standard, security-governance ]
---

# Framework Bump Playbook

Versions are pinned in [[fleet-app-specification]] §1; this page owns the **ritual that moves
them**. The 2026-08 corpus review found the failure mode this page prevents: values stay
current while the *doctrine around them* silently ages (a REST corpus verified against the
previous major, a manual teaching two-generations-old model idioms, zero rulings on two years
of language features). A bump is not a version edit — it is a version edit **plus** the
re-verification and rulings passes below, in one PR series.

## §1 The Q4 PHP bump (each new PHP lands in November)

1. **Floor + images move together:** composer floor, `ci-php` image, FrankenPHP runtime tag,
   Sail — per the spec §1 rule *floor = lowest CI-tested version*. Run the outgoing version's
   pre-flight first (for 8.5: the PDO checklist in [[php-language-doctrine]] §4).
2. **Rector pass:** `composer rector:fix` per app (`withPhpSets()` keys off the new floor),
   review, land. This is the mechanical modernization; it is why rector is MUST-carry.
3. **Deprecation grep** for the *next* version ([[php-language-doctrine]] §5's list) — fix at
   leisure now, not under next year's deadline.
4. **Doctrine pass:** extend [[php-language-doctrine]] §1 with rulings for the new version's
   features — every feature gets MUST/SHOULD/MAY/NOT-YET/MUST-NOT with a reason; NOT-YET
   carries a revisit trigger. Silence is not a ruling.
5. **Close the loop:** update spec §1, the cquality profile name, and this page's §4 log row.

## §2 The Q1 Laravel bump (each new major lands ~Q1)

1. **Upgrade mechanics:** Boost's `/upgrade-laravel-vN` or Shift per app; the upgrade-guide
   diff review happens once, fleet-level, and lands as a spec PR — not N private readings.
2. **Skeleton diff:** `laravel new` a scratch app; diff against the previous skeleton. Every
   changed default is either adopted into the standard, rejected into §4's register, or made
   an ACCEPTED-DEVIATION. (This is how `casts()`-method → metadata-attributes drift gets
   caught the year it happens instead of two majors later.)
3. **Feature-rulings pass:** every headline feature and every 1x.x-minor feature that touches
   a fleet concern gets a §4 register row. "We haven't decided" is a legal row; an absent row
   is not.
4. **Reference-corpus re-verification:** every claim tagged with a `verify-by:` (§3) that
   names the old major gets re-checked against the new one — *negative capability claims
   first* ("Laravel doesn't ship X" is exactly what a new major silently invalidates).
5. **Close the loop:** spec §1 versions, arch-suite/preset verification against the new Pest
   major if one shipped, §4 log row.

## §3 The `verify-by:` convention

Any **reference** page (status: reference) making a **version-scoped claim** — "verified
against 12.x", "no framework support for X", a pinned third-party compatibility floor —
carries the claim inline with a date or major it was checked against, and the page's owner
re-checks it during the §1/§2 pass that crosses it. Dated "as of" phrasing ("one month
post-publication") is forbidden in reference pages per CLAUDE.md's law-vs-news rule — write
"as of the last check (YYYY-MM-DD)" so staleness is visible instead of implied.

## §4 Feature-rulings register

One row per feature per major. Rulings for sub-features already owned by another page point
there (one fact, one owner).

### Laravel 13 (ruled 2026-08-08)

| Feature | Ruling |
|---|---|
| Eloquent metadata **attributes** (`#[Fillable]`, `#[Hidden]`, …) + `casts()` method + `#[Scope]` | **Adopted** as the fleet declaration style — the [[models]] page owns the idiom; migration is opportunistic (touch-the-file), never big-bang. `#[Guarded]`/`#[Unguarded]` stay out ([[models]] mass-assignment stance). |
| Controller/route attributes (`#[Middleware]`, `#[WithoutMiddleware]`, `#[Authorize]`) | **Not adopted** for middleware — route files stay the single greppable authority (the transport-only-controller doctrine leans on route-file legibility, and `route:cache` reviewability). `#[Authorize]` **MAY** replace a one-line FormRequest `authorize()` where the policy call is the whole body. |
| Queue attributes, `Queue::route()`, `#[DebounceFor]`, refreshable locks | **Adopted** — owned by [[fleet-queue-doctrine]]. |
| First-party **JSON:API resources** (`--json-api`) | **Rejected** — [[fleet-api-specification]] considered-and-rejected owns the reasoning + revisit triggers. |
| `cache.serializable_classes => false` | **Mandated** — spec §5 row. |
| CSRF rename (`PreventRequestForgery`, `Sec-Fetch-Site` two-layer) | **Adopt on upgrade** (deprecated aliases cover the transition); check `bootstrap/app.php` references. The origin-only layer is HTTPS-only — no prod behavior change under forced HTTPS. |
| Passkeys via Fortify (`Features::passkeys()`) | **MAY** for the user plane (spec §5 already carries the passkeys rate-limiter row); **watch** for the privileged planes — a passkey on `/control` is attractive but waits for a real operator ask. |
| First-party `Image` facade, pgvector search, AI SDK (`laravel/ai`, `laravel/mcp`) | **MAY (app-need)** — infra add-on rows. pgvector is notable: the fleet already runs Postgres, so embeddings cost zero new infra. |
| Dev tooling: Boost 2, `laravel/pao`, `artisan doctor`, `artisan dev`, `laravel/lsp` | **Evaluate as a set** (dev-only, never in the runtime image). `pao` is the natural first adopt (agent-optimized output, inert for humans, `require-dev`); `doctor` belongs in the scaffold checklist; Boost's guidelines overlap this repo's own standards bundle — trial before double-maintaining. |
| `Cache::touch()`, rate-limiter `after()`, `Str`/`Collection` additions | **Free use** — no ruling needed; `after()` is the first-party form of API-1003's enumeration guidance. |
| Hyphenated cache/Redis/session prefixes | **Upgrade note:** pin `CACHE_PREFIX`/`REDIS_PREFIX`/`SESSION_COOKIE` before the bump or accept the one-time cache flush + session invalidation deliberately — never discover it in prod. |

### Bump log

| Date | Move | Notes |
|---|---|---|
| 2026-08-08 | Spec: PHP floor `^8.3`→`^8.4`, runtime/CI 8.4→8.5, Pest `^4`→`^5`, PHPStan L8→L10 ratchet declared | Out-of-cycle — corpus review; the 8.5 image move lands before 2026-12-31 (8.4 goes security-only) |
