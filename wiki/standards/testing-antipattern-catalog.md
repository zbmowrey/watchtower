---
title: Testing Anti-Pattern Catalog (smells, harms, fixes, detection)
description: The exhaustive catalog behind [[fleet-testing-doctrine]] — every test smell the fleet bans or watches, in six families (framework-testing, weak assertions, fixtures, test doubles, fragility/flakes, suite structure). Each entry gives the definition, the harm, the positive counterpart, and — where possible — a mechanical detection heuristic the audit procedure greps for. Sources: Meszaros' xUnit Test Patterns smell catalog, Khorikov, GOOS, Feathers, Metz, Fowler, Google Testing Blog, and Laravel-community lore, verified 2026-07-09.
tags: [ standard, testing, anti-patterns, smells, pest, phpunit, audit ]
type: standard
status: normative
updated: 2026-08-08
related: [fleet-testing-doctrine, pest-testing, fleet-app-specification, pest-architecture-testing, fleet-frontend-specification]
---

# Testing Anti-Pattern Catalog

The enforcement vocabulary for [[fleet-testing-doctrine]]. Six families; each entry is
**definition → harm → instead**, plus a **detect:** heuristic where one exists (the
`pest-testing` skill's audit mode runs these greps). Entries marked ⛔ are banned outright;
entries marked ⚠ are judged in context.

## A. Testing the framework ⛔

The named enemy (doctrine §4). Common shapes in a Laravel codebase:

1. **Validation-enforcement test** — a test proving `required`/`email`/`unique` fires.
   *Harm:* re-tests the Validator; a booted app per rule; breaks on message/rule refactors that
   change no behavior. *Instead:* unit-test custom Rule objects; one transport-contract test may
   cover the canonical failure envelope (doctrine §3.4).
   **Detect:** `assertInvalid|assertSessionHasErrors|assertJsonValidationErrors` where the test
   varies only which field is omitted/malformed, and no custom Rule object is involved.
2. **Event-wiring test** — `Event::fake()` + `assertDispatched(X::class)` as the whole test
   (likewise `Queue/Bus/Mail/Notification::fake` + `assertPushed/assertSent`).
   *Harm:* asserts you called `event()` — communication-based, tautological, pins wiring not
   behavior. *Instead:* unit-test the decision that triggers it + the listener's logic on a
   plain event object; keep a fake-assertion only as an outgoing-command check inside a
   legitimate §3 test. **Detect:** `::fake()` where the *only* assertions are
   `assertDispatched|assertNotDispatched|assertPushed|assertSent|assertNothingSent`.
3. **Feature-flag branch test** — asserting a flag turns a code path on/off.
   *Harm:* tests config plumbing. *Instead:* unit-test both branches with the flag value passed
   in. **Detect:** tests toggling `config([...])`/`Config::set`/Pennant `Feature::` then
   asserting reachability rather than branch logic.
4. **Model-metadata tautology** — asserting `$fillable`/`$casts`/`$hidden` contents, a
   relationship's existence/type, or `assertIsInt($m->qty)` on a cast.
   *Harm:* restates the model to itself; tests Eloquent's cast engine; pure change-detector.
   *Instead:* nothing — or extract real cast logic (money, encryption) and unit-test it.
   **Detect:** `getFillable\(|getCasts\(|assertInstanceOf\((HasMany|BelongsTo|MorphMany)`.
5. **Route-200 smoke** — `get('/x')->assertOk()` (or `assertStatus(200)`) as the sole
   assertion. *Harm:* near-assertion-free; catches only crashes; inflates coverage.
   *Instead:* one §3.1 wiring smoke asserting an observable outcome — or delete.
   **Detect:** test bodies whose only assertion matches `assertOk\(\)|assertStatus\(200\)`.
6. **Insert-echo** — `Model::factory()->create([...])` (or a POST) followed by
   `assertDatabaseHas` restating the same attributes. *Harm:* tests `save()`; tautological;
   breaks on renames with no behavior change. *Instead:* assert the behavioral consequence
   (what the next read/user observes); persistence-as-risk gets one §3.2 test.
   **Detect:** `assertDatabaseHas` whose array literal ⊆ the attributes just written.
7. **Container/middleware/config mechanics** — asserting a binding resolves, middleware order,
   `config('x')` returns the file's value. *Harm:* framework mechanism.
   *Instead:* nothing, or one security canary (§3.3) where misconfig = incident.
8. **Rendering-internals test** — asserting compiled Blade HTML or Inertia component internals
   from PHP. *Harm:* structure-sensitive; duplicates the FE suite. *Instead:* assert props/data
   handed to the view; rendering belongs to Vitest/browser tests
   ([[fleet-frontend-specification]] §6). **Detect:** `assertSee(<` / HTML-fragment literals in
   PHP tests.
9. **Framework-auth mechanics** — testing that `auth` middleware redirects guests to login on
   every protected route. *Harm:* re-tests the middleware per route. *Instead:* one canary per
   guard/plane (the fleet's 404-cloak tests are canaries — one per plane, not per route).
10. ⚠ **Vendor starter-kit tests kept as app tests** — the shipped `Auth/*`, `Settings/*`, and
    `ExampleTest` scaffolds retained (or extended) as if they were ours.
    *Harm:* they exercise Fortify/framework flows; dead `ExampleTest` scaffolds inflate suites
    (2026-07 survey: present in 4/5 apps). *Instead:* delete both `ExampleTest`s; keep a
    starter-kit auth test only where it asserts an **app-specific** side-effect (account
    minting on registration, a domain event on lead capture); never extend them with new
    framework-flow cases. **Detect:** `tests/*/ExampleTest.php`; `Auth/`+`Settings/` files
    byte-similar to the starter kit.

## B. Weak / dishonest assertions

1. ⛔ **Tautological test / testing the mock** — the assertion is fully determined by the
   test's own stub setup (`$stub->willReturn(5); expect(f($stub))->toBe(5)` where `f` passes
   through). *Harm:* can never fail; permanent false confidence. *Instead:* assert the SUT's own
   computation. **Detect:** expected value textually equal to a stubbed return; mutation testing
   kills these wholesale.
2. ⛔ **Delegation/forwarder test** — mocks a collaborator, calls a one-line pass-through, and
   asserts the forwarding happened ("delegates X to the repository"), often closing with
   `expect(true)->toBeTrue()` to satisfy the useless-test guard while the real check is the
   mock's implicit verify. *Harm:* re-states the method signature; pins the collaborator's
   method name (pure interface sensitivity); a forwarder is trivial code (doctrine §2 step 1)
   — zero behavior verified. This was the fleet's single largest smell in the 2026-07 survey
   (~60 instances in one app). *Instead:* don't test forwarders at all; test the call site
   where something is decided, once. **Detect:** test names matching
   `delegates|forwards|proxies`; `expect\(true\)->toBeTrue\(\)`.
3. ⛔ **Assertion-free test** — no assertion, or only "didn't throw".
   *Harm:* coverage without verification. *Instead:* assert an outcome; if there's no outcome
   worth asserting, the test shouldn't exist. **Detect:** PHPUnit's
   `beStrictAboutTestsThatDoNotTestAnything` (spec-mandated) flags most; also
   `->throws()`-only tests where a state change should be checked, and
   `expectNotToPerformAssertions`.
4. ⚠ **Assertion roulette** — a long unstructured assertion block over *different* behaviors.
   *Harm:* a failure doesn't say which behavior broke (fails "Specific"). *Instead:* one
   behavior per test; multiple assertions on the *same* behavior are fine.
5. ⛔ **Change-detector test** — mirrors implementation structure (asserts internal call
   sequences, private state via reflection, exact SQL strings) so *any* change fails it.
   *Harm:* pure refactoring tax; no independent notion of correctness (Google's "considered
   harmful"). *Instead:* assert externally-meaningful behavior.
   **Detect:** `ReflectionClass|setAccessible\(true\)|Mockery.*ordered\(|shouldReceive.*once.*once.*once` chains.
6. ⚠ **Snapshot overuse** — `toMatchSnapshot()` on large/whole-page output.
   *Harm:* nobody reads the diff; updates get rubber-stamped; structure-sensitive.
   *Instead:* assert the specific properties that carry meaning; snapshots only for small,
   human-reviewable structures.
7. ⛔ **Coverage-gaming** — tests written to execute lines, not to be able to fail (Goodhart).
   *Harm:* the gate passes while adequacy falls. *Instead:* doctrine law 6 — mutation score is
   adequacy; delete tests that no mutant can fail.
8. ⚠ **Eager test** — one test verifying many unrelated behaviors end-to-end.
   *Harm:* many reasons to fail; slow to diagnose. *Instead:* split per behavior.
9. ⚠ **Excessive parameterization** — datasets with branchy/conditional expectations or dozens
   of near-identical rows. *Harm:* obscures which equivalence class each row represents;
   conditional logic in tests. *Instead:* one named row per equivalence class + boundary values.

## C. Fixture & arrange smells

1. ⚠ **General fixture** — shared setup building more world than any one test needs
   (`beforeEach` creating users+orders+subscriptions for tests that touch one field).
   *Harm:* obscure, slow, fragile-to-data-changes. *Instead:* minimal fresh fixture per test.
2. ⛔ **Mystery guest** — the test depends on data/state not visible in the test (global
   seeders, fixture files, previous tests). *Harm:* cause→effect unreadable; data-sensitive.
   *Instead:* build exactly what the test needs, in the test (or a named builder that shows it).
   **Detect:** `$this->seed\(|DatabaseSeeder` inside tests; assertions on values never arranged.
3. ⚠ **Factory graph overbuild** — `User::factory()->has(Order::factory()->count(5))` to test
   one field; `->create()` where `->make()` (or `new`) suffices.
   *Harm:* slow, general-fixture by stealth. *Instead:* `make()`/`new` for logic; persist only
   in §3.2 tests. **Detect:** `->create(` in `tests/Unit`; `has\(.*count\(` where relations go
   unasserted.
4. ⚠ **Hard-coded magic data** — unexplained literals whose significance is invisible
   (`calculate(7200)`). *Harm:* obscure; edits break tests mysteriously. *Instead:* named
   constants/variables that say *why* (`$twoHours = 2 * 60 * 60`).
5. ⚠ **Over-DRY arrange** — helper/builder layers so aggressive the salient input is invisible
   (mystery guest reborn). *Harm:* unreadable failures. *Instead:* DAMP — the driving input and
   asserted outcome stay in the test body; helpers absorb only irrelevant noise.
6. ⛔ **Interacting tests / shared mutable state** — tests passing only in order, or mutating
   statics/globals that leak. *Harm:* erratic suite; parallel-unsafe. *Instead:* isolated fresh
   state; reset statics in teardown. **Detect:** run `--order-by=random` (or shuffle) — failures
   = this smell; grep `static \$` in tests and leaked `Carbon::setTestNow` without reset.

## D. Test-double misuse

Vocabulary first — **dummy** (fills a param), **stub** (canned answers = indirect inputs),
**spy** (stub recording calls), **mock** (pre-set expectations = indirect outputs), **fake**
(real lightweight implementation, e.g. in-memory repo). Doctrine §5 allows mocking *only*
outgoing commands to unmanaged out-of-process dependencies.

1. ⛔ **Mocking Eloquent models** — `Mockery::mock(User::class)` / partial model mocks.
   *Harm:* mocks a type we don't own; couples to Eloquent internals; tautology-prone.
   *Instead:* construct real models in memory (`new`/`make()`), or extract the logic off the
   model. **Detect:** `mock\((App\\Models|.*::class)` where the class extends Model.
2. ⛔ **Mocking types you don't own** — stubbing a third-party SDK class directly.
   *Harm:* encodes your possibly-wrong belief; silently diverges from the real library.
   *Instead:* thin adapter behind an owned interface; mock the interface; one Integration test
   for the adapter if warranted.
3. ⛔ **Mocking value objects / cheap collaborators** — `createMock(Money::class)`.
   *Harm:* pure ceremony; hides real invariants. *Instead:* construct them — that's what VOs
   are for.
4. ⚠ **Over-mocking / London-everywhere** — every collaborator mocked; more double setup than
   assertions. *Harm:* communication-coupled tests that freeze the design and fail on honest
   refactors. *Instead:* real in-process collaborators (classical school); doubles only at the
   §5 boundary. **Detect:** ratio of `mock|shouldReceive|createMock` lines to `expect|assert`
   lines > 1 in a file.
5. ⛔ **Asserting on stubs / call-order verification** — `shouldHaveReceived` on a query,
   `->ordered()` where order isn't the contract. *Harm:* Metz matrix violations — outgoing
   queries are neither asserted nor mocked; order is implementation. *Instead:* assert outputs
   and state; verify only outgoing *commands*.
6. ⚠ **Facade-fake as behavior test** — see A.2. Fakes are boundary-contract tools inside
   legitimate Feature tests, not behavior tests in themselves.

## E. Fragility & flakes

**Meszaros' four fragility sensitivities** — the diagnostic grid for "this test keeps breaking":
**interface** (breaks on signature changes → funnel construction through builders),
**behavior** (breaks on unrelated behavior → test one behavior),
**data** (breaks on shared/seeded data changes → fresh minimal fixture),
**context** (breaks on time/locale/environment → control the context).

**Flake root causes → fixes** (all ⛔ once identified):

| Cause                                             | Fix                                                                                  |
|----------------------------------------------------|---------------------------------------------------------------------------------------|
| Real clock (`now()` in logic or assertions)        | `Carbon::setTestNow()` (+ teardown reset) in units; better — inject a clock (§6 flaw 4) |
| Timezone/DST/locale assumptions                    | Pin tz/locale in the test; store/compare UTC                                           |
| Unseeded randomness                                | Inject RNG / pass values; seeded `mt_srand` only in fixtures (see arch carve-out)      |
| Test-order / shared-state coupling                 | C.6 — isolate; random order in CI                                                      |
| Sleep-based async waits                            | Poll/await conditions; `Sleep::fake()` in Feature tests                                |
| Float equality                                     | Tolerance compare (`toEqualWithDelta`); money as integer cents (VO)                    |
| Auto-increment/ID assumptions                      | Assert by attributes/relations, not literal IDs (Postgres sequences survive resets)    |
| Concurrency/resource contention (ports, files, DB) | Unique-per-test resources; serial group for the contended few                          |

⛔ **Retry-as-policy:** a retry gate (the CI pest-retry-once flake guard) is a *containment*
for known-flaky infrastructure, never an alternative to fixing a flaky test. A test that needs
the retry is a defect — root-cause it against the table above.

## F. Suite-structure smells

1. ⛔ **Booted "Unit" suite** — binding `TestCase`/`RefreshDatabase` into `tests/Unit` so
   framework-touching tests pass there. *Harm:* dilutes the whole suite; the speed and purity
   guarantees silently die. *Instead:* spec §3 bindings; move boundary-crossers to Feature or
   refactor them pure. **Detect:** `Pest.php` binding analysis + arch rule (doctrine §7); grep
   `tests/Unit` for `::fake\(|config\(|app\(|resolve\(|actingAs|RefreshDatabase|artisan\(`.
2. ⛔ **Ice-cream cone** — Feature/E2E tests outnumbering unit tests over logic-heavy code.
   *Harm:* slow feedback; wiring-shaped tests carrying logic risk. *Instead:* doctrine §2/§6 —
   extract until the pyramid re-inverts. **Detect:** count tests per suite vs. logic mass in
   `Domain/Actions/Support`.
3. ⚠ **Slow-test creep** — Feature suite growing with logic instead of seams (doctrine §8).
   **Detect:** suite wall-time trend; Feature-test count vs seam count.
4. ⛔ **Conditional test logic** — `if`/loops/try-catch steering assertions inside a test.
   *Harm:* the assertion may silently not run; nondeterministic coverage. *Instead:*
   straight-line tests; **named `->with()` dataset rows** for variation (an in-test `foreach`
   is this smell in mild form — the 2026-07 survey found datasets badly under-used fleet-wide).
   **Detect:** `foreach|if \(|while \(` inside test closures.
5. ⛔ **Test logic in production** — `if (app()->environment('testing'))` branches, test-only
   public methods. *Harm:* prod runs untested paths. *Instead:* seams via DI (§6).
   **Detect:** `environment\(.testing|runningUnitTests\(` in `app/`.
6. ⛔ **Testing private methods via reflection** — *Harm:* couples to structure; muffles the
   design signal (a complex private wants to be a public method on an extracted class).
   *Instead:* test through the public API, or extract (§6 flaw 10).
7. ⚠ **Commented-out / skipped test rot** — `->skip()`/`->todo()` accumulating.
   *Harm:* silent coverage loss (spec's `failOnEmptyTestSuite`/strict flags catch some).
   *Instead:* fix or delete; a skip carries a reason and an owner.
8. ⚠ **Duplicate-coverage tests** — the same behavior pinned at multiple levels (unit + feature
   + browser). *Harm:* triple maintenance per change; slower suites. *Instead:* the placement
   algorithm gives each behavior exactly one home; higher levels assert only their own
   integration truth.

## Using this catalog

- **Writing tests:** the doctrine's placement algorithm (§2) plus family A is 90% of the value —
  most bad tests are framework tests or tautologies that should never be born.
- **Auditing suites:** the `pest-testing` skill's audit mode sweeps the **detect:** heuristics
  family by family, then judges ⚠ entries in context. Verdicts: *delete* (A, B.1–B.3),
  *relocate* (F.1), *refactor-then-unit-test* (doctrine §6), *keep* (legitimate §3 tests).
- **Adequacy:** after a cleanup, run the spec's mutation script — the surviving-mutant list is
  the remaining-work list.
