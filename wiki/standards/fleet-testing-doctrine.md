---
title: Fleet Testing Doctrine (v1 — what to test, what not to test)
description: The normative judgment layer for testing every fleet Laravel app — the unit-first law (bootless units over an extracted pure core), the placement algorithm for every prospective test, the precise "don't test the framework" boundary, the assertion and test-double rules, the design-flaw escalation path that turns feature-test pressure into refactors, and the architecture-suite mandate. Peer to [[fleet-app-specification]] §3, which owns the operational config (suites, gates, flags); this page owns WHICH tests to write, WHERE they live, and WHAT they may assert. The exhaustive smell list is [[testing-antipattern-catalog]].
tags: [ spec, standard, testing, pest, phpunit, unit-tests, architecture-tests, mandate ]
type: standard
status: normative
updated: 2026-07-10
related: [ fleet-app-specification, testing-antipattern-catalog, laravel-engineering-standard, pest-testing, pest-architecture-testing, dependency-rules, laravel-architecture-manual, controllers, actions, repositories, query-builders, fleet-frontend-specification ]
---

# Fleet Testing Doctrine — v1

The **requirement of record for testing judgment** on every fleet Laravel app.
[[fleet-app-specification]] §3 owns the *operational* testing config — which suites exist, the
bootless binding, coverage/type-coverage gates, strict PHPUnit flags, the mutation script — and
this page does not restate it. What §3 leaves unsaid, and this page now mandates, is the
**judgment layer: which tests get written, where each one lives, what it may assert, and what it
must never do.** Front-end testing is governed by [[fleet-frontend-specification]] §5, not here.

Derived from the 2026-07-09 research pass: a capability map of Pest 4 / PHPUnit 12 / Laravel
testing facilities, a distillation of the testing-quality literature (Khorikov, Meszaros, GOOS,
Feathers, Beck, Metz, Bernhardt, Fowler), and a file-level survey of the fleet's real suites.
The full smell catalog with detection heuristics is [[testing-antipattern-catalog]]; the
procedure that applies this page is the `pest-testing` skill.

## §1 The six laws

1. **Unit-first, bootless.** The default home of every new test is `tests/Unit` on plain
   `PHPUnit\Framework\TestCase`: no container, no DB, no filesystem, no network, no facades, no
   ambient clock. A unit test exercises **your logic** — a pure function, value object, enum,
   DTO, domain service, Action with constructor-injected collaborators — through inputs and
   observable outputs. If most of an app's tests need the framework, that is a verdict on the
   app's design, not a reason to bind `TestCase` into the Unit suite.
2. **A Feature test is an escalation, not a habit.** Before writing one, name the *integration
   truth* it buys (§3 lists the only legitimate ones). If the honest reason is "the logic can't
   be reached without booting," that is a **design flaw** — take the §6 escalation path
   (extract, unit-test the extraction, downgrade the feature test to at most one wiring smoke).
3. **Integration tests are for unmanaged external services only** — a real queue / cache /
   object store / third-party boundary, not a fake (spec §3's definition). The managed Postgres
   is *not* an external service; DB-truth tests are Feature tests.
4. **Architecture tests are mandatory and only ever tighten.** They are executable layering —
   the [[dependency-rules]] table enforced in CI — and they protect the framework-free core
   that makes law 1 possible. Every new structural convention lands with its arch rule **in the
   same PR** (§7).
5. **Never test the framework.** Don't test framework *mechanism* (the Validator enforcing
   rules, the bus delivering events, a flag toggling a branch, casts casting, the router
   routing). Test **your configuration** only where misconfiguration is a **business/security
   incident**, at the thinnest seam, **once** (§4).
6. **Adequacy is mutation score on the logic core, not line coverage.** Coverage is a floor and
   a gap-finder (the spec gates it); a suite is *proven* by killed mutants. A test that raises
   coverage without being able to fail on a behavior change is noise (see
   [[testing-antipattern-catalog]] — coverage-gaming, change-detectors).

## §2 The placement algorithm

Run every prospective test through this, in order. It is the doctrine as a flowchart.

1. **Is there logic?** (branching, computation, an invariant, a decision) — No → **don't test
   it.** Trivial code — getters, pass-through delegation, `$fillable` arrays — earns no test.
2. **Is the thing at risk framework mechanism?** — Yes → **don't test it** (§4). Reframe: what
   is *my* code here? Often the answer is a custom Rule object, a policy method, a listener's
   decision — test *that*, per the rows in §4.
3. **Is the logic pure — or extractable?** — Yes → **Unit test**, bootless. If it's currently
   tangled with I/O, extraction comes *first* (§6); the unit test targets the extraction.
   This is the expected destination for the overwhelming majority of tests.
4. **Is the risk a managed-DB truth?** — the SQL semantics of a security- or money-critical
   scope/query (tenant isolation, entitlement filtering, billing selection), or persistence
   itself being the risk — Yes → **Feature test**, minimal fixture, asserting semantics (who
   is included/excluded), not row-echoes.
5. **Does it cross to an unmanaged external service?** — Yes → **Integration test** (rare;
   most apps legitimately have none — spec §3).
6. **Otherwise it's wiring.** One **Feature smoke per seam** at the thinnest point — not one
   per route, not one per variation. Variations belong to the unit tests of the extracted core.

The same algorithm as a map of code types (Khorikov's quadrants, in fleet vocabulary):

| Code                                                                        | Testing posture                                                                                             |
|-----------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------|
| `App\Domain`, `App\Actions`, `App\Support` — algorithms, invariants, money | **Unit-test exhaustively.** Branch-complete, boundary values, error paths. This is where the suite's mass is. |
| Value objects, DTOs, enums, custom casts' logic, custom Rule objects        | **Unit-test** — output-based, the cheapest and most refactor-proof tests you can own.                          |
| Controllers, middleware, listeners-as-glue — the humble shell               | **A few Feature smokes** (one per seam). If a controller needs more, it isn't humble — escalate (§6).          |
| Eloquent models (anemic per [[dependency-rules]])                           | **Nothing.** Their config is framework mechanism; logic found on a model wants extracting.                     |
| Trivial code                                                                | **Nothing.**                                                                                                   |
| Logic tangled with I/O ("overcomplicated")                                  | **Refactor out of existence** (§6), then unit-test the core. Never pin it permanently with feature tests.      |

## §3 The only legitimate Feature tests

A Feature test must be able to answer *"which of these am I?"* — in a comment or its name:

1. **Wiring smoke** — proves the humble shell connects request → extracted core → response.
   **One per seam.** Asserts an observable outcome (redirect target, Inertia prop presence,
   created aggregate's visible effect), never "200 only". The fleet template is the
   **dual-suite pattern** (e.g. a saved-picks matching service): exhaust the logic in Unit
   with hand-written contract fakes; prove the seam **once** in Feature against real Eloquent —
   and never re-assert the unit-covered math in the Feature test.
2. **Managed-DB semantics** — the scope/query truth of §2 step 4, where being wrong is an
   incident (cross-tenant leak, wrong billing set). Assert *semantics*: build rows on both
   sides of the boundary, assert inclusion **and** exclusion.
3. **Security canary** — one test per critical wiring: *this* admin surface actually sits
   behind *this* guard; *this* cloak returns 404 to outsiders. One canary ≠ re-testing the
   middleware pipeline across every route.
4. **Transport contract** — where response shape *is* the product (a public/client API):
   status + envelope shape for the canonical success and the canonical failure. Not a re-run
   of validation, not one test per field.

Everything else that looks like it wants a Feature test is either framework-testing (§4) or a
design flaw (§6). **Litmus:** if a Feature test's failure would be diagnosed by reading *your*
domain code, the logic belongs in a unit test; if diagnosed by reading wiring/config, it's a
legitimate (single) smoke.

## §4 Don't test the framework — the boundary

The framework's authors test its mechanisms; a fleet test re-proving them buys zero information
and costs a booted app per run. But *your intent expressed through framework config* can carry
business risk. The line, made precise:

**Never test (framework mechanism)** — each row with its positive counterpart:

| ✗ Never                                                                                       | ✓ Instead                                                                                                                                              |
|------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------|
| That a validation rule is *enforced* (`assertInvalid` proving `required` works)                 | Unit-test **custom Rule objects'** logic (input → verdict, bootless). The `rules()` array is config; a transport-contract test (§3.4) may cover the canonical failure envelope once. |
| That an event *reaches* its listener (`Event::fake` + `assertDispatched` as the whole test)     | Unit-test the **decision that triggers** the event and the **listener's logic** on a plain event object. `assertDispatched` is legitimate only as an outgoing-command assertion at a real boundary (§5). |
| That a feature flag toggles a branch                                                            | Unit-test **both branches** of the logic directly (pass the flag value in). The flag plumbing is config.                                                  |
| That `$casts` / `$fillable` / a relationship *exists* (asserting model metadata back at itself) | Nothing — tautology. If a cast hides real logic (money rounding, encryption envelope), extract and unit-test **that**.                                    |
| That a route resolves / returns 200 (as the sole assertion)                                     | A §3.1 wiring smoke asserting an actual outcome — or nothing.                                                                                             |
| That the container resolves a binding, middleware runs in order, config returns its value       | Nothing — unless misconfig = incident, then **one** §3.3 canary at the thinnest seam.                                                                     |
| That Eloquent saves/loads/soft-deletes; `assertDatabaseHas` echoing the row you just wrote      | Assert the **behavioral consequence** (what the next read / the user observes). Persistence-as-risk → one §3.2 test.                                      |
| Blade/Inertia rendering internals (compiled HTML structure)                                     | Assert the **data handed to the view** (Inertia props); rendering belongs to the FE suite ([[fleet-frontend-specification]] §5).                          |

**Do test (your logic the framework calls):** custom `ValidationRule` classes · policy methods
as plain functions over (user, resource) — plus at most one §3.3 canary that the gate is
actually consulted · listener/job **logic** (extracted, on plain objects) · custom cast
transformations · complex scope semantics (§3.2) · console command logic (extracted; the
command class stays humble).

**The dividing question** for any config-shaped test: *"If this configuration were wrong, would
it be a business incident — and is this the cheapest place to catch it?"* No → don't write it.
Yes → one test, thinnest seam.

## §5 Assertions and test doubles

**What to assert** — observable behavior only: return values, visible state changes, and
messages to *unmanaged out-of-process* dependencies. Sandi Metz's matrix is the rule of thumb:

| Message to the SUT                | Assert?                                             |
|-----------------------------------|------------------------------------------------------|
| Incoming query                    | **Yes** — assert the returned value                  |
| Incoming command                  | **Yes** — assert the resulting public state          |
| Internal/private (sent-to-self)   | **No** — never (no reflection on privates)           |
| Outgoing query                    | **No** — neither asserted **nor mocked**             |
| Outgoing command to a boundary    | **Yes** — assert it was *sent* (the only mock use)   |

- **One behavior per test** (several physical assertions on the *same* behavior are fine).
  Error paths are first-class behaviors. Business rules are tested **branch-complete** with
  boundary values (at/around each edge), via datasets with named rows.
- Style ranking: **output-based > state-based > communication-based.** Every extraction (§6)
  moves tests up this ranking.
- **DAMP over DRY in tests:** the salient arrange and the asserted outcome stay visible in the
  test body. Helpers/builders may hide *irrelevant* setup, never the input that drives the
  outcome. (Test files are exempt from production DRY pressure — see
  [[testing-antipattern-catalog]] § over-DRY.)

**Doubles policy** (definitions in the catalog):

- **Mock only outgoing commands to unmanaged out-of-process dependencies** (payment gateway,
  mail provider, third-party API). Never mock the managed DB, never mock in-process
  collaborators, **never mock Eloquent models**, never mock value objects — construct them.
- **Don't mock what you don't own.** Third-party SDKs get a thin adapter behind an interface
  *we* own ([[repositories]] / gateway seams); mock the interface; the adapter itself gets one
  Integration test if its risk warrants.
- **Stubs answer, mocks verify** — never assert on a stub (that's testing the mock; PHPUnit 12
  enforces the split: `createStub()` for inputs, `createMock()`+`expects()` for interaction).
- **Prefer hand-written contract fakes over mocking frameworks for in-process ports** — an
  in-memory `implements` of the interface with public inspection arrays reads as a real
  collaborator and doesn't pin method names. Mockery `expects()` is reserved for outgoing
  commands at unmanaged boundaries. (Mock-every-repository London style is what breeds the
  delegation-test smell — [[testing-antipattern-catalog]] B.2. And never unit-test a one-line
  forwarder at all: trivial code, §2 step 1.)
- **Facade fakes (`Event/Queue/Mail/Bus/Http/Storage::fake`) are Feature-suite tools** — they
  require the booted app, so they cannot appear in Unit; and they are communication-based, so
  they carry the §4 event-wiring trap. Legitimate use: asserting an outgoing command at a real
  boundary inside a §3 test.

## §6 The escalation path — feature-test pressure is a design signal

*Test pain is a design smell* (GOOS). When a test wants the framework, the code is telling you
one of these is present. **Fix the flaw; don't buy the boot.**

| # | Design flaw forcing a boot                                        | Refactor                                                                       |
|---|--------------------------------------------------------------------|---------------------------------------------------------------------------------|
| 1 | I/O woven through logic                                            | Functional core / imperative shell — decisions pure, I/O at the edge             |
| 2 | Framework calls inside domain code (`request()`, `auth()`, `config()`, `Model::query()` mid-logic) | Pass values in; keep the core framework-free ([[dependency-rules]])              |
| 3 | Facade or `app()`/`resolve()` service-location inside logic        | Constructor injection of an interface                                            |
| 4 | Time/randomness/IDs read ambiently (`now()`, `random_int`, `Str::uuid()` mid-logic) | Parameterize from above — inject a clock/RNG/id-generator, or pass the value      |
| 5 | Static/global mutable state                                        | Instance state, injected                                                          |
| 6 | Logic living on a controller                                       | Extract to Action/Service ([[controllers]] — validate → delegate → respond)       |
| 7 | Logic living on an Eloquent model                                  | Extract to domain service/VO; the model stays anemic                              |
| 8 | Query logic inline where business logic lives                      | Repository + custom query builder ([[repositories]], [[query-builders]])          |
| 9 | Constructor doing work                                             | Constructors only assign                                                          |
| 10 | God class / many unrelated collaborators                          | Split by responsibility (SRP); each piece becomes unit-testable                   |
| 11 | Hidden/temporal dependencies (call order matters invisibly)       | Make ordering explicit in types; dependencies in signatures                       |
| 12 | Primitive obsession (invariants re-checked everywhere)            | Value objects — self-validating constructors concentrate the invariant **once**   |

**Procedure when caught mid-test:** stop → name the flaw (table above) → extract the decision
into `Domain`/`Actions`/`Support` per the [[laravel-architecture-manual]] → unit-test the
extraction branch-complete → keep **at most one** §3.1 wiring smoke for the shell → if the
extraction changed layering, add/tighten the arch rule (§7) in the same PR.

**The honest exceptions** (not design flaws — the literature's refinement, adopted): the small
deliberate §3.2 managed-DB layer, §3.3 canaries, and §3.4 transport contracts. These are
integration truths that cannot be bought more cheaply. What stays banned is a Feature test
**load-bearing for logic that could be pure**.

## §7 The architecture suite — mandatory, tightening, test-aware

The enforcement layer is the tiered shared suite (`standards/laravel/tests/Architecture/` —
its README owns the tier→namespace matrix, carve-out policy, and `bin/arch-drift` parity;
the vocabulary and rollout technique live in [[pest-architecture-testing]] and its shards).
Doctrine on top of it:

- **Encode dependency direction and layer purity, not naming trivia.** Every
  [[dependency-rules]] row is a rule; suffix/finality rules ride along. A rule that would break
  on a harmless rename with no layering meaning is a change-detector — don't add it.
- **New convention ⇒ new rule, same PR.** Adopting repositories? The `toOnlyUse` rules for
  [[repositories]]/[[query-builders]] land with the first repository. A convention without an
  arch rule doesn't exist.
- **Carve-outs are documented exceptions** (`->ignoring()` + one-line reason), never deleted or
  loosened universal rules. A rule that is mostly ignores is a wrong convention — change the
  convention deliberately instead.
- **The suite polices the tests too.** The Unit suite's bootlessness is itself arch-enforced —
  `Tests\Unit` must not use facades, `Tests\TestCase`, `RefreshDatabase`, or HTTP test
  machinery; Feature tests must not reach into `App\Domain` internals to assert privates. The
  canonical rules are the bundle's `TestsLayerTest.php` (verify the `Tests\*` subject scans
  correctly on first adoption per app — tests autoload via `autoload-dev`).
- **Presets:** `php()` + `security()` are the proven fleet floor; `laravel()` and `strict()`
  are named ratchets — adopt per app when clean, never silently.

## §8 Suite health

- **Speed is a feature of the doctrine, not a nicety.** The Unit suite must stay fast enough to
  run on every save (hundreds of tests in ~a second — bootless makes this free). Feature-suite
  growth is the metric to watch: it should grow with *seams*, not with *logic*.
- **Determinism:** no real clock (`Carbon::setTestNow()` in units — reset in teardown; the
  framework's `freezeTime()` sugar is Feature-only), no unseeded randomness, no order coupling,
  no shared mutable fixtures. Flake root-causes and fixes: [[testing-antipattern-catalog]].
  The shared `tests/TestCase.php` stays **hermetic and byte-identical** fleet-wide
  (`Http::preventStrayRequests()`, SSR disabled) — no test may reach the network.
- **Parallel-safe by construction** (CI runs `artisan test --parallel` — spec §3/§4): a test
  file must be loadable in a worker that loaded *no other test file*. Two rules fall out:
  **shared helpers live in `tests/Pest.php`**, never in a sibling test file (a helper defined
  in one file and called from another resolves only by single-process luck — a real CI failure
  has been traced to exactly this); and **hermetic env extends to app feature gates** — any
  `env()`-driven gate the app grows is pinned in `phpunit.xml` the day it's born, or a
  developer's `.env` flag silently flips test outcomes (e.g. an open-registration flag). Order
  coupling (already banned above) is also what parallel distribution punishes first.
- **Mutation** (law 6): the spec's `composer mutation` script is the adequacy check for
  `Domain`/`Support`/`Actions`; run it when logic-heavy code lands. If MSI drops, the new code
  lacks behavior-pinning assertions — add assertions, never game the metric. Operational
  gotchas (timeouts, zombies, xdebug): [[pest-testing]].
- **Audit:** judging an existing suite against this doctrine is the `pest-testing` skill's
  audit procedure, using the detection heuristics in [[testing-antipattern-catalog]].
