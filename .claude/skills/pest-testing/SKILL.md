---
name: pest-testing
description: Write, place, and audit PHP tests for your Laravel apps under the testing doctrine — unit-first and bootless, feature tests as rare escalations, never test the framework. Use when adding or fixing tests, deciding where a test belongs or whether it should exist, raising coverage or mutation score, reviewing/auditing test quality ("do our tests need work?"), fixing flaky tests, or setting up a test suite in a Laravel app.
---

# pest-testing

**Load the law before writing or judging a single test:**

```
bin/wiki inject --page fleet-testing-doctrine --depth 0     # the judgment layer (mandatory)
bin/wiki inject --page testing-antipattern-catalog --depth 0 # when auditing, or in doubt
bin/wiki inject --page pest-testing --depth 0                # per-repo matrix + run commands
```

The doctrine is the rule of record; this skill is the procedure. Operational config
(suites, gates, strict flags, mutation script) is [[fleet-app-specification]] §3. Deep
Pest/PHPUnit technique: the `php-tomes:php-testing` skill. Frontend tests:
[[fleet-frontend-specification]] §6.

## Writing tests — the placement algorithm (doctrine §2)

Run EVERY prospective test through this, in order:

1. **No logic** (no branch/computation/invariant)? → don't test it.
2. **Framework mechanism** at risk (validation enforcement, event delivery, flag
   plumbing, casts, routing, container)? → don't test it; find *your* code in the
   story (rule object, policy, listener logic) and test that instead (doctrine §4).
3. **Pure or extractable logic?** → **Unit** — the default destination. Bootless:
   plain `PHPUnit\Framework\TestCase`, no facades/container/DB;
   `Carbon::setTestNow()` (+ teardown reset) for time; construct real value
   objects/models with `new`/`make()`, never `create()`.
4. **Managed-DB semantics** (security/money-critical scope truth)? → **Feature**,
   minimal fixture, assert inclusion AND exclusion.
5. **Unmanaged external service?** → **Integration** (rare; most apps have none).
6. **Wiring?** → at most **one Feature smoke per seam**, asserting a real outcome —
   never `assertOk()` alone.

Quality bar for what you write: one behavior per test; error paths are first-class;
business rules branch-complete with boundary values via named dataset rows; assert
observable outcomes (returns, state, outgoing *commands* at real boundaries — never
outgoing queries, privates, or call order); DAMP — the driving input and asserted
outcome stay visible in the test body. Doubles: mock only outgoing commands to
unmanaged out-of-process dependencies behind interfaces we own; never mock Eloquent
models, value objects, or third-party types.

## The escalation reflex (doctrine §6)

The moment a test you're writing wants the framework booted, STOP — that is a design
signal, not a test problem:

1. Name the flaw (doctrine §6 table: I/O in logic, facade/service-location, ambient
   time/randomness, logic on controller/model, inline queries, god class…).
2. Extract the decision into `Domain`/`Actions`/`Support` per the layering.
3. Unit-test the extraction branch-complete.
4. Keep at most one wiring smoke for the humble shell.
5. If layering changed, add/tighten the arch rule **in the same PR** (doctrine §7).

Never "fix" a boundary-crossing Unit test by binding `TestCase`/`RefreshDatabase`
into the Unit suite — relocate the test to Feature or refactor it pure.

## Auditing a suite ("do our tests need work?")

1. **Bindings:** read `tests/Pest.php` + `phpunit.xml` against spec §3 — Unit/Arch
   bootless, `RefreshDatabase` only on Feature/Integration, strict flags, no empty
   suites. Check whether the app has adopted `TestsLayerTest.php`.
2. **Sweep the catalog:** run each family's **detect:** greps from
   [[testing-antipattern-catalog]] (framework-testing family A first — it's most of
   the harvest), then judge ⚠ entries in context. Before sweeping, check the app's
   row in the latest fleet test-suite survey baseline
   (`bin/wiki search "test-suite survey"` → the newest `wiki/logs/` page) — the
   usual quick wins are vendor starter-kit scaffolds (A.10), delegation/forwarder
   tests (B.2), and in-test `foreach` loops that should be named dataset rows.
3. **Verdict per finding:** *delete* (framework tests, tautologies, assertion-free) ·
   *relocate* (boundary-crossers sitting in Unit) · *refactor-then-unit-test*
   (feature tests load-bearing for extractable logic — name the §6 flaw) · *keep*
   (legitimate doctrine-§3 tests; label which of the four kinds each one is).
4. **Adequacy:** run the repo's `composer mutation` (local-only; gotchas in the
   [[pest-testing]] wiki page — zombie processes, XDEBUG_MODE=off, serial only).
   Surviving mutants on `Domain`/`Support`/`Actions` = the remaining-work list.
5. **Report:** per-suite counts, findings by family with file:line, verdicts, and
   the top extraction opportunities — most-valuable first, not exhaustive-first.

## Running

```
sail pest                              # all suites, as CI runs them
sail pest --testsuite=Unit             # the fast loop (should stay ~instant)
sail pest --filter=SomeTest
sail pest --coverage --min=<gate>      # gate per the matrix
sail composer mutation                 # adequacy — local only, minutes
npm run test                           # FE runner per the matrix (in the vite container)
```

Per-repo versions, gates, and container gotchas live in the injected [[pest-testing]]
matrix — never assume one app's Pest major or gate carries to another.

## Before declaring done

Run the suite + coverage exactly as CI would and report real output. A skipped,
retried-into-green, or failing test is not done. If you relocated or deleted tests,
state what coverage moved where and why the doctrine says so.
