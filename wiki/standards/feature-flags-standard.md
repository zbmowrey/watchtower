---
title: Feature Flags Standard (v1 — Pennant classes, scope, exposure, retirement)
description: The normative rule set for feature flags on every fleet Laravel app — Laravel Pennant with one class-based Feature per capability so the class list *is* the register, the per-template default scope (tenant in multi-tenant, user in single-tenant) and its nullable-scope law, the database store as a resolution *cache* whose values are sticky plus the purge/activate tooling that moves them, the explicit Inertia shared-props allow-list that keeps flags display-state while authorization stays server-side, and the retirement discipline that stops flags becoming dead-branch debt. A/B experimentation and the metrics that decide a rollout belong to the growth corpus, not here.
tags: [ spec, standard, feature-flags, pennant, release-engineering, laravel, mandate ]
type: standard
status: normative
updated: 2026-08-08
related: [ fleet-app-specification, fleet-frontend-specification, fleet-testing-doctrine, testing-antipattern-catalog, fleet-queue-doctrine, pest-architecture-testing, laravel-runtime-guardrails ]
---

# Feature Flags Standard — v1

The **requirement of record for shipping code that is not yet on for everyone**. Written against
Laravel 13 + **Pennant** on PHP 8.5 / Postgres, exposed through Inertia + React 19, across both app
templates (multi-tenant with a database per tenant, and single-tenant). Normative language per
[[fleet-app-specification]]: **MUST / SHOULD / MAY / ACCEPTED-DEVIATION**, deviations recorded
there, never silent.

**Governs:** definition (§2), scope (§3), stored-value behavior and the tooling that moves it (§4),
checking and exposure (§5), retirement (§6), testing (§7).

**Does NOT govern — pointers, not restatements:** Inertia shared-prop architecture and page-prop
typing ([[fleet-frontend-specification]]); test placement ([[fleet-testing-doctrine]], smells in
[[testing-antipattern-catalog]]); authorization ([[fleet-app-specification]]); and **A/B
experimentation** — variant assignment, exposure logging, and the metrics that decide a rollout live
in [the growth corpus](../growth/_index.md). A flag answers *"is this capability on for this
scope?"*, never *"which variant won?"*.

## §1 The four laws

1. **Every flag is born temporary.** A flag is a branch in *time*, not in architecture. A permanent
   conditional is configuration, an entitlement, or a policy — three things this page is not. If you
   cannot name the condition under which the flag is deleted, you are not building a flag.
2. **A flag is not a permission.** A flag decides whether a capability *exists yet*; authorization
   decides *who may use it*. Both checks run, independently, and the flag never widens access.
3. **The class list is the register.** One class per capability under `App\Features`, discovered by
   Pennant — "what flags does this app have?" is answered by `ls`, a grep, and an arch rule, never
   by a spreadsheet that drifts.
4. **Resolution is sticky.** The store holds *already-resolved* values per scope; the class holds the
   *default* for scopes not yet seen. Changing the default does not retroactively change anyone —
   most of §8's table is this law surprising someone.

## §2 Defining a flag — one class per capability

- **Class-based, one per capability — MUST:** `php artisan pennant:feature <Name>` →
  `app/Features/<Name>.php` (`App\Features`), registered by `Feature::discover()` in a service
  provider. **Inline closure definitions (`Feature::define('some-flag', fn () => …)`) are
  forbidden** — invisible to discovery, ungreppable at retirement, and they make the register
  "whatever a provider happened to run".
- **`resolve()` is the definition — MUST** return the flag's **default value for a scope**, and
  nothing else: pure, cheap, no HTTP, no dispatch, no writes. A read of the scope's own row is the
  ceiling; anything heavier belongs *behind* the flag, not inside it. It **MUST be deterministic** —
  the same scope resolves the same value (randomized assignment is an experiment, §9).
- **Named for the capability, never the change — MUST:** `InvoicePdfExport`,
  `SelfServeSeatManagement`. Rejected: ticket ids (`Feat1234Export`), dates, people, and the aging
  vocabulary `New*` / `*V2` / `Legacy*` — the second one of those turns the first into a lie. The
  **stored name MUST NOT drift from the class**: it defaults to the class name, and a `$name`
  override is legitimate only to *pin* it across a class rename (renaming a live flag otherwise
  orphans every stored value; the alternative is a deliberate §4 purge).
- **Boolean by default; rich values MAY** where a capability genuinely has modes — but the value set
  **MUST** be a backed enum (or class constants) and every consumer **MUST** handle the whole set:
  an exhaustive `match`, not string comparison soup.
- **Arch — MUST:** `App\Features` is a leaf, referenced from the shell (HTTP, console, actions) and
  **MUST NOT** be referenced from `App\Domain` — §7's testing law is what that buys. **A flag MUST
  NOT read another flag**: nested resolution is a dependency graph with undefined order and no
  retirement path. Compose at the call site.

## §3 Scope — the resolution axis

- **Default scope — MUST, per template:** multi-tenant apps resolve to the **tenant model**;
  single-tenant apps resolve to the **authenticated user**. Set once, centrally, with
  `Feature::resolveScopeUsing(…)` in a service provider — one line answers "what is a flag *about*
  in this app?". Per-call `Feature::for(…)` is for off-request contexts, §4's tooling, and recorded
  deviations — not the daily path.
- **Nullable scope — MUST:** `resolve()`'s scope parameter **MUST be nullable** and **MUST return the
  flag's default when the scope is null** — unauthenticated pages, artisan commands and unscoped jobs
  resolve the *default*, by rule, not by accident. Pennant short-circuits a *non-nullable* signature
  to `false`, which presents as "the rollout didn't take" rather than as a bug.
- **Off-request contexts — MUST pass scope explicitly:** `Feature::for($tenant)->active(Flag::class)`
  in jobs, commands, and listeners. The ambient resolver reads request auth state, which a worker
  does not have — the assumption [[fleet-queue-doctrine]] §3 bans about dispatch-time state.
- **One flag, one scope axis — MUST.** A flag checked against a user in one call site and a tenant in
  another yields values that flip between requests and leaves nothing coherent to purge.
- **A different axis — MAY, as ACCEPTED-DEVIATION:** a genuinely per-user beta inside a multi-tenant
  app, or a flag keyed to something that is neither (an integration, a workspace). The class **MUST**
  state its axis in the docblock and the divergence **MUST** be recorded in the
  [[fleet-app-specification]] §7 register — an unannounced axis breaks the rule above by accident.
- **MUST NOT scope on request shape** — IP, geo, header, percentage bucket. That is traffic
  splitting, not capability state (§9).

## §4 The store is a resolution cache

- **Store — MUST:** `PENNANT_STORE=database` on the app's Postgres. In multi-tenant apps the
  `features` table lives in the **tenant database** (tenant migration path), so a tenant's flag
  state travels with the tenant. `array` is test-only (§7); a cache-backed store is rejected (§9).
- **First resolution writes; every later check reads.** Pennant calls `resolve()` once per scope and
  persists the answer. **Operational consequence: changing a default changes nothing for scopes that
  already resolved** — a default edit is a change to *future* resolution, never a rollout.
- **Moving already-resolved scopes — the sanctioned trio, used deliberately:**
  `Feature::activateForEveryone(Flag::class)` / `deactivateForEveryone(…)` rewrite stored values
  fleet-wide; `Feature::purge(Flag::class)` (`php artisan pennant:purge <name>`) deletes them so every
  scope re-resolves from `resolve()`; `Feature::for($scope)->forget(…)` does one scope. **A change to
  a default MUST ship with one of these, or an explicit "new scopes only" note.** Nothing else writes
  that table — never hand-UPDATE it. **In multi-tenant apps these commands run per tenant database**
  through the tenancy runner; a central-only run touches no tenant's table and exits 0 — the most
  expensive false success on this page.
- **Resolve once per request — SHOULD:** a page checking several flags loads them together
  (`Feature::for($scope)->load([...])`) rather than lazily at each call site. Every first-time
  resolution is an INSERT, so an N+1 of flag checks is an N+1 of *writes*.

## §5 Exposure — server gate first, then the client allow-list

- **Check at the highest point that removes the branch — SHOULD:** route middleware
  (`EnsureFeaturesAreActive`, configured to the app's 404/403 shape rather than its bare default)
  for a whole capability; `Feature::when()` / `active()` at the controller or action edge otherwise.
  One decision, one check site — a flag re-checked at five depths has five retirement sites.
- **A flag is not a permission — MUST (law 2).** The policy/gate check is separate and always runs.
  A flagged-off route **MUST fail closed on the server** even when a stale client still renders the
  control, and a flag **MUST NOT** be used to grant access to anything a policy would otherwise deny.
- **Client exposure — MUST be an explicit allow-list.** Flags the UI needs ride the existing Inertia
  shared-props mechanism ([[fleet-frontend-specification]] owns that architecture and the page-prop
  typing): a small named set per page or layout, resolved server-side. **Publishing the whole
  register (`Feature::all()`) into shared props is forbidden** — it ships the unreleased roadmap to
  every browser, bloats every response, and couples the client to every flag's existence.
- **The client treats flags as display state only — MUST.** Show/hide, enable/disable, nothing else.
  There is no client-side source of truth: no localStorage override, no query-string toggle, no
  cookie. **MUST NOT** vary a shared cache entry on a flag without the flag *and* scope in the key —
  a per-scope value inside a shared entry is a cross-tenant leak, not a display bug.
- **Blade `@feature` — MAY** in the root/shell view; the Inertia page is the normal surface.

## §6 Lifecycle — every flag is born temporary

- **Birth record — MUST:** each Feature class carries a docblock with one line of purpose and its
  **retirement trigger** ("remove once the export is on for all tenants"). A flag with no trigger is
  a defect at review: it has no way to die.
- **The retirement rule — MUST:** once a flag resolves the same way for every scope and that is the
  intended end state, **the flag and the losing branch are deleted in one change**. Deleting the
  check while leaving the dead branch is not retirement — **the dead branch is the debt this entire
  discipline exists to kill.**
- **Safe removal order — MUST:** (1) make the winning branch unconditional; delete the loser and its
  tests. (2) Delete the check sites. (3) Delete the Feature class. (4) `pennant:purge <name>` **last**
  (per tenant in MT). Purging first re-resolves every scope from a default that is about to vanish.
- **Audit — SHOULD, on a standing cadence:** a scheduled or manual pass over stored values per flag;
  any flag whose values are unanimous — and whose `resolve()` default agrees — is nominated for
  removal that cycle. Its output goes where the ops alerts already go.
- **Enforcement — MUST (arch):** an architecture test asserts every class in `App\Features` is
  referenced from outside `App\Features`; an unreferenced Feature class is a flag whose class
  outlived its usage. It is only total because of its companion rule — **check sites MUST name the
  class (`Flag::class`), never a string literal** — which is what makes the grep exhaustive. New
  convention, new rule, same PR ([[fleet-testing-doctrine]] §7).
- **Kill switches — legitimate, still temporary.** A flag deployed as an incident-mitigation lever
  (disable the expensive report, stop an outbound sync) is sanctioned and **MUST** say so in its
  docblock. It dies when the incident pattern stabilizes into a real control — a rate limit, a
  circuit breaker ([[fleet-queue-doctrine]] §3), a config knob, or the actual fix. A switch nobody
  has flipped in a long while is a control that should be code.

## §7 Testing

- **Store — MUST:** `PENNANT_STORE=array` pinned in `phpunit.xml`, never left to a developer's
  `.env` — the hermetic feature-gate rule of [[fleet-testing-doctrine]] §8. Tests neither read nor
  write the `features` table.
- **State is set explicitly — MUST:** the test that depends on a flag sets it
  (`Feature::define(Flag::class, true)`, or `Feature::for($scope)->activate/deactivate`). **No test
  may rely on the ambient default** — a default change would silently re-point unrelated suites.
- **MUST NOT test that a flag toggles a branch** — that is flag plumbing, catalogued as a smell in
  [[testing-antipattern-catalog]]. Test **both branches bootless with the value passed in**, and
  **while a flag lives, both branches carry tests**; the retirement change deletes the loser's, so a
  suite that *shrinks* on retirement is the proof the dead branch actually left.
- **Which forces the design law — MUST:** `Feature::active()` is called in the humble shell and the
  resolved value is **passed into** domain code as an argument; domain classes never call Pennant
  (§2's arch rule). Both branches then unit-test for free, and retirement becomes "delete a parameter
  and a test file".
- **One Feature-suite smoke MAY** prove the exposure seam (an allow-listed flag reaching page props)
  where that seam warrants it, asserted with `AssertableInertia` per doctrine §3 — never as a second
  way to re-assert the toggle.

## §8 Troubleshooting — symptom → cause → fix

| Symptom | Likely causes, in order | Fix |
|---|---|---|
| Changed the default, nothing changed for existing users/tenants | Stored values are sticky (§1 law 4) — the default only serves unseen scopes | `activateForEveryone`/`deactivateForEveryone`, or `pennant:purge` to force re-resolution |
| `pennant:purge` reported success, production unchanged (MT) | Ran against the central database; tenant tables never touched | Re-run per tenant through the tenancy runner |
| Flag reads `false` for guests, console, or jobs | Non-nullable scope parameter → Pennant short-circuits to `false` (§3) | Make the scope nullable and return the default for `null` |
| Flag value differs between two requests for the same user | Mixed scope axes on one flag (user here, tenant there) | One flag, one axis; purge and re-resolve after the fix |
| Job sees the opposite value from the request that queued it | Ambient scope resolver has no auth context in a worker | `Feature::for($scope)->active(…)` explicitly in the job |
| Client renders the control, server returns 403/404 | Flag treated as a permission, or the allow-list drifted from the server gate | Keep both checks; the server gate is authoritative and fails closed |
| Hot page writes rows to `features` on every load | First-time resolution per new scope + lazy per-call-site resolution | `load()` the page's flags once per request (§4) |
| Tests pass locally, flip in CI or under `--parallel` | Test relied on the ambient default, or the DB store leaked in | `PENNANT_STORE=array` in `phpunit.xml`; set the flag explicitly per test |
| A flag has no retirement trigger and nobody knows what it does | Missing birth record (§6) | Reconstruct purpose + trigger, or retire it now — an unexplained flag is dead-branch debt |

## §9 Considered and rejected

- **Third-party flag platforms** (SaaS flag/experiment services) — a network dependency in the
  request path, a second auth surface to harden, and per-seat cost, in exchange for targeting a fleet
  of this flag volume does not need; Pennant is first-party over the app's own Postgres. **Revisit
  trigger:** real experimentation — percentage ramps with metric-driven promotion across properties —
  at which point the growth corpus owns the requirement anyway.
- **`config()` / env booleans as flags** — no scope axis, no per-tenant state, and flipping one is a
  deploy; they also collide with the hermetic-env rule (every gate becomes a `phpunit.xml` pin).
  Config describes *deployment shape*, a flag describes *capability state for a scope* — keep genuine
  config in config.
- **Inline closure features** — the register stops being enumerable the moment a flag exists only
  inside a provider; discovery, `all()`, purge-by-name and §6's arch rule degrade together.
- **A cache-backed Pennant store** (Redis/Valkey) — resolved values become evictable, so a scope can
  silently re-resolve mid-rollout and "sticky" stops being true. Postgres is durable and already
  there; per-request caching plus §4's `load()` covers the read cost.
- **Percentage rollouts and bucketed variants** — hash assignment, ramp schedules, exposure events,
  significance. That is an experiment ([the growth corpus](../growth/_index.md)), not a switch.
- **Flags as plan entitlements** — "which features does this tier include" is billed domain state
  living permanently in the subscription model; as flags it puts revenue logic on a retirement queue
  and makes §6's audit permanently noisy. **Flags as permissions** — law 2: an authorization decision
  hiding in the release-engineering layer never gets a policy test.
