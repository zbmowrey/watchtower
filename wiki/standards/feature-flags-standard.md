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
there, never silent. Governs definition (§2), scope (§3), stored-value behavior and the tooling that
moves it (§4), exposure (§5), retirement (§6), testing (§7).

**Does NOT govern — pointers, not restatements:** Inertia shared-prop architecture and prop typing
([[fleet-frontend-specification]]); test placement ([[fleet-testing-doctrine]], smells in
[[testing-antipattern-catalog]]); authorization ([[fleet-app-specification]]); and **A/B
experimentation** — variant assignment, exposure logging, and the metrics that decide a rollout live
in [the growth corpus](../growth/_index.md). A flag answers *"is this capability on for this
scope?"*, never *"which variant won?"*.

## §1 The four laws

1. **Every flag is born temporary.** A flag is a branch in *time*, not in architecture; a permanent
   conditional is configuration, an entitlement, or a policy. If you cannot name the condition under
   which it is deleted, you are not building a flag.
2. **A flag is not a permission.** A flag decides whether a capability *exists yet*; authorization
   decides *who may use it*. Both checks run, independently, and the flag never widens access.
3. **The class list is the register.** One class per capability under `App\Features`, discovered by
   Pennant — "what flags does this app have?" is answered by `ls`, a grep, and an arch rule.
4. **Resolution is sticky.** The store holds *already-resolved* values per scope, the class the
   *default* for scopes not yet seen; changing a default changes nobody retroactively.

## §2 Defining a flag — one class per capability

- **Class-based, one per capability — MUST:** `php artisan pennant:feature <Name>` →
  `app/Features/<Name>.php` (`App\Features`), registered by `Feature::discover()`. **Inline closure
  definitions (`Feature::define('some-flag', fn () => …)`) are forbidden** — invisible to discovery,
  ungreppable at retirement, and they reduce the register to "whatever a provider happened to run".
- **`resolve()` is the definition — MUST** return the flag's **default value for a scope** and nothing
  else: pure, cheap, no HTTP, no dispatch, no writes; a read of the scope's own row is the ceiling.
  It **MUST be deterministic** — same scope, same value (randomized assignment is an experiment, §9).
- **Named for the capability, never the change — MUST:** `InvoicePdfExport`, `SelfServeSeatManagement`;
  never ticket ids (`Feat1234Export`), dates, people, or the aging `New*` / `*V2` / `Legacy*` — the
  second one turns the first into a lie. The **stored name MUST NOT drift from the class**: a `$name`
  override only ever *pins* it across a rename (renaming a live flag orphans every stored value).
- **Boolean by default; rich values MAY** where a capability has modes — but the set **MUST** be a
  backed enum (or constants) and consumers **MUST** cover it exhaustively (`match`, not string soup).
- **Arch — MUST:** `App\Features` is a leaf — referenced from the shell (HTTP, console, actions),
  **MUST NOT** be referenced from `App\Domain` (§7's testing law is what that buys). **A flag MUST NOT
  read another flag**: nested resolution has undefined order and no retirement path.

## §3 Scope — the resolution axis

- **Default scope — MUST, per template:** multi-tenant apps resolve to the **tenant model**,
  single-tenant apps to the **authenticated user**, set once centrally with
  `Feature::resolveScopeUsing(…)` in a service provider — one line answers "what is a flag *about*
  here?". Per-call `Feature::for(…)` is for off-request contexts, §4's tooling and deviations.
- **Nullable scope — MUST:** `resolve()`'s scope parameter **MUST be nullable** and **MUST return the
  flag's default when the scope is null** — guests, commands and unscoped jobs get the *default*, by
  rule. Pennant short-circuits a *non-nullable* signature to `false`: "the rollout didn't take".
- **Off-request contexts — MUST pass scope explicitly:** `Feature::for($tenant)->active(Flag::class)`
  in jobs, commands, listeners. The ambient resolver reads request auth state, which a worker does
  not have — the assumption [[fleet-queue-doctrine]] §3 bans about dispatch-time state.
- **One flag, one scope axis — MUST.** A flag checked against a user in one call site and a tenant in
  another yields values that flip between requests and leaves nothing coherent to purge.
- **A different axis — MAY, as ACCEPTED-DEVIATION:** a per-user beta inside a multi-tenant app, a
  flag keyed to an integration or workspace. The class **MUST** state its axis and the divergence
  **MUST** be recorded in the [[fleet-app-specification]] §7 register. **Never scope on request
  shape** — IP, geo, header, percentage bucket is traffic splitting, not capability state (§9).

## §4 The store is a resolution cache

- **Store — MUST:** `PENNANT_STORE=database` on the app's Postgres. In multi-tenant apps the
  `features` table lives in the **tenant database** (tenant migration path), so a tenant's flag state
  travels with the tenant. `array` is test-only (§7); a cache-backed store is rejected (§9).
- **First resolution writes; every later check reads.** Pennant calls `resolve()` once per scope and
  persists the answer. **Operational consequence: changing a default changes nothing for scopes that
  already resolved** — a default edit changes *future* resolution, it is not a rollout.
- **Moving already-resolved scopes — the sanctioned trio, used deliberately:**
  `activateForEveryone(Flag::class)` / `deactivateForEveryone(…)` rewrite stored values;
  `purge(Flag::class)` (`pennant:purge <name>`) deletes them so every scope re-resolves; `forget(…)`
  does one scope. **A default change MUST ship with one of these or an explicit "new scopes only"
  note.** **In MT they run per tenant database** — a central-only run exits 0 having touched nothing.
- **Resolve once per request — SHOULD:** a page checking several flags loads them together
  (`Feature::for($scope)->load([...])`) rather than lazily at each call site. Every first-time
  resolution is an INSERT, so an N+1 of flag checks is an N+1 of *writes*.

## §5 Exposure — server gate first, then the client allow-list

- **Check at the highest point that removes the branch — SHOULD:** route middleware
  (`EnsureFeaturesAreActive`, on the app's 404/403 shape), else `Feature::when()` / `active()` at the
  controller or action edge, `@feature` in the root/shell view. One decision, one check site — five
  depths means five retirement sites.
- **A flag is not a permission — MUST (law 2).** The policy check is separate and always runs; a
  flagged-off route **MUST fail closed on the server** even when a stale client renders the control,
  and a flag **MUST NOT** grant access a policy would deny.
- **Client exposure — MUST be an explicit allow-list**: a small named set per page or layout, riding
  the existing Inertia shared-props mechanism ([[fleet-frontend-specification]] owns that
  architecture). **`Feature::all()` into shared props is forbidden** — it publishes the unreleased
  roadmap to every browser and couples the client to the whole register.
- **The client treats flags as display state only — MUST**: show/hide, nothing else; no localStorage
  override, no query-string toggle, no cookie. **MUST NOT** vary a shared cache entry on a flag
  without flag *and* scope in the key — a per-scope value in a shared entry is a cross-tenant leak.

## §6 Lifecycle — every flag is born temporary

- **Birth record — MUST:** each Feature class carries a docblock with one line of purpose and its
  **retirement trigger** ("remove once the export is on for all tenants"). A flag with no trigger is
  a defect at review: it has no way to die.
- **The retirement rule — MUST:** once a flag resolves the same way for every scope and that is the
  intended end state, **the flag and the losing branch are deleted in one change**. Deleting the
  check and leaving the dead branch is not retirement — that branch is the debt this kills.
- **Safe removal order — MUST:** (1) make the winning branch unconditional, deleting the loser and
  its tests; (2) delete the check sites; (3) delete the Feature class; (4) `pennant:purge <name>`
  **last** (per tenant in MT) — purging first re-resolves every scope from a vanishing default.
- **Audit — SHOULD, on a standing cadence:** a scheduled or manual pass over stored values; a flag
  whose values are unanimous — and whose `resolve()` default agrees — is nominated for removal.
- **Enforcement — MUST (arch):** an architecture test asserts every class in `App\Features` is
  referenced from outside it — an unreferenced Feature class outlived its usage. Total only because
  **check sites MUST name the class (`Flag::class`), never a literal** ([[fleet-testing-doctrine]] §7).
- **Kill switches — legitimate, still temporary.** An incident-mitigation lever (disable the costly
  report, stop an outbound sync) is sanctioned and **MUST** say so in its docblock; it dies when the
  pattern stabilizes into a real control — rate limit, circuit breaker ([[fleet-queue-doctrine]] §3),
  config knob, or the fix.

## §7 Testing

- **Store — MUST:** `PENNANT_STORE=array` pinned in `phpunit.xml`, never left to a developer's `.env`
  — the hermetic feature-gate rule of [[fleet-testing-doctrine]] §8. Tests neither read nor write the
  `features` table.
- **State is set explicitly — MUST:** the test that depends on a flag sets it
  (`Feature::define(Flag::class, true)`, or `Feature::for($scope)->activate/deactivate`). **No test
  may rely on the ambient default** — a default change would silently re-point unrelated suites.
- **MUST NOT test that a flag toggles a branch** — flag plumbing, catalogued in
  [[testing-antipattern-catalog]]. Test **both branches bootless with the value passed in**, and
  **while a flag lives both branches carry tests**; retirement deletes the loser's, so a suite that
  *shrinks* on retirement is proof the dead branch left.
- **Which forces the design law — MUST:** `Feature::active()` is called in the humble shell and the
  value **passed into** domain code as an argument; domain classes never call Pennant (§2). Both
  branches then unit-test for free; one Feature smoke **MAY** prove the exposure seam with
  `AssertableInertia`, never the toggle.

## §8 Troubleshooting — symptom → cause → fix

| Symptom | Likely causes, in order | Fix |
|---|---|---|
| Changed the default, nothing changed for existing scopes | Stored values are sticky (§1 law 4) — the default only serves unseen scopes | `activateForEveryone`/`deactivateForEveryone`, or `pennant:purge` to force re-resolution |
| `pennant:purge` reported success, production unchanged (MT) | Ran against the central database; tenant tables never touched | Re-run per tenant through the tenancy runner |
| Flag reads `false` for guests, console, or jobs | Non-nullable scope parameter → Pennant short-circuits to `false` (§3) | Make the scope nullable and return the default for `null` |
| Flag value differs between two requests for the same person | Mixed scope axes on one flag (user here, tenant there) | One flag, one axis; purge and re-resolve after the fix |
| Job sees the opposite value from the request that queued it | Ambient resolver has no auth context in a worker | `Feature::for($scope)->active(…)` explicitly in the job |
| Client renders the control, server returns 403/404 | Flag treated as a permission, or the allow-list drifted from the server gate | Keep both checks; the server gate is authoritative and fails closed |
| Hot page writes rows to `features` on every load | First-time resolution per new scope + lazy per-call-site resolution | `load()` the page's flags once per request (§4) |
| Tests pass locally, flip in CI or under `--parallel` | Test relied on the ambient default, or the DB store leaked in | `PENNANT_STORE=array` in `phpunit.xml`; set the flag explicitly per test |

## §9 Considered and rejected

- **Third-party flag platforms** (SaaS flag/experiment services) — a network dependency in the
  request path, a second auth surface to harden, and per-seat cost, for targeting a fleet of this
  flag volume does not need. **Revisit trigger:** real experimentation (percentage ramps with
  metric-driven promotion), which the growth corpus owns anyway.
- **`config()` / env booleans as flags** — no scope axis, no per-tenant state, flipping one is a
  deploy, and each collides with the hermetic-env rule (a `phpunit.xml` pin per gate). Config
  describes *deployment shape*; a flag describes *capability state for a scope*. **Inline closure
  features** likewise (§2): discovery, `all()`, purge-by-name and §6's arch rule degrade together.
- **A cache-backed Pennant store** (Redis/Valkey) — resolved values become evictable, so a scope can
  silently re-resolve mid-rollout and "sticky" stops being true; Postgres is durable and already
  there, and §4's `load()` covers the read cost.
- **Percentage rollouts and bucketed variants** — hash assignment, ramp schedules, exposure events,
  significance: an experiment ([the growth corpus](../growth/_index.md)), not a switch.
- **Flags as plan entitlements** — "which features does this tier include" is billed domain state
  living permanently in the subscription model; as flags it puts revenue logic on a retirement queue
  and makes §6's audit noisy. **Flags as permissions** — law 2: an authorization decision hiding in
  the release-engineering layer never gets a policy test.
