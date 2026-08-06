---
title: Pest Testing
description: How testing is set up — Pest suites, coverage gates, mutation testing, and the right commands.
tags: [stack, pest, testing, phpunit, infection, coverage, laravel]
type: stack
updated: 2026-07-10
related: [fleet-testing-doctrine, testing-antipattern-catalog]
---

# Pest Testing

Test the PHP side with **Pest**. (For deep Pest/PHPUnit technique, the
`php-tomes:php-testing` skill is the reference; this page captures the operational
facts.)

## What to test, where — the doctrine

The judgment layer (unit-first bootless law, the placement algorithm, the
"don't test the framework" boundary, the feature-test escalation path, assertion
and test-double rules) is the normative [[fleet-testing-doctrine]]; the exhaustive
smell list is [[testing-antipattern-catalog]]. This page carries only the
operational facts below.

Architecture tests are mandatory and only ever tighten ([[fleet-testing-doctrine]]
§7). For the full Pest arch-testing reference — presets, the expectation
vocabulary, modifiers, and a ready-to-adapt suite — see
[[pest-architecture-testing]] and the [[laravel-architecture-manual]].

## Suite shape

Every app runs three Pest suites — **Unit, Feature, Architecture** — and adds
extras as it needs them. Pin the same Pest major across every app so you never
have to remember which API a given repo speaks. Common extras:

- **Coverage gate** — enforce a minimum in CI (a good default is **80%**), or gate
  via a `COVERAGE_MIN` repo variable. Run locally with `sail pest --coverage --min=<n>`.
- **Browser/E2E** — `pest-plugin-browser` drives Playwright for true end-to-end
  tests; it needs browsers installed in the container.
- **Mutation testing** — Infection or Pest's built-in `--mutate` scores test
  quality; run it explicitly (see below), never in the PR gate.
- **Drift** — `pest-plugin-drift` helps migrate a PHPUnit suite to Pest syntax.
- **Frontend** — Vitest covers React component/unit tests (see [[inertia-react]]).

## Conventions

- **Suites:** Unit, Feature, Architecture. Arch tests (`arch()`) enforce
  structure — keep them green; they catch layering violations cheaply.
- **Coverage:** enforce a minimum in CI, or gate via a `COVERAGE_MIN` repo
  variable. Run locally with `sail pest --coverage --min=<n>`.
- **Mutation:** Infection runs in a `mutation.yml` CI workflow, covered classes
  only, MSI threshold ~70%. Run locally via `sail composer infection` (verify the
  script name in `composer.json`).
- **Browser: local-only, and it fails silent.** `pest-plugin-browser` drives
  Playwright and needs the browser **binary** installed in the container
  (`npm run test:browser:setup` inside the vite container). If CI ships no Chromium
  it must run `--testsuite=Unit,Feature,Architecture` instead — which means a
  missing binary turns the whole browser tier off with **nothing red anywhere**.
  Assume that will happen to you: a suite that is skipped locally *and* excluded in
  CI is a suite nobody is running. The plugin's own error points at the wrong fix
  ("Playwright is outdated" — the npm package is current, only the binary is gone)
  and surfaces as one error plus a wall of bare "Assertion error" lines. Make
  `BrowserTestCase` fail fast with the real command, and run the tier by hand before
  shipping anything that touches a page it covers.

## Writing tests well

Governed by [[fleet-testing-doctrine]] — unit-first and bootless; a needed feature
test is an escalation (name which of the doctrine-§3 kinds it is); never test the
framework. Factories + `RefreshDatabase` and facade fakes are Feature/Integration
tools only, per the doctrine's doubles policy (§5).

## Mutation testing (Pest `--mutate`) — policy & gotchas

Shape: scope to the **business-logic layer** (DDD apps → `App\Domain`; flat apps
→ `--class="App\Support,App\Actions"`), `--covered-only`, an **MSI floor 70
aspiration** set **measure-and-ratchet** (floor at the measured baseline rounded
down, climb to 70), run **explicitly/local** — *not* in the PR CI gate (a full run
is ~14 min). The `composer mutation` script is the gate; keep its shape identical
across apps.

Hard-won gotchas:

- **Composer caps scripts at 300 s.** A full mutation run is ~14 min, so a bare
  `composer mutation` dies mid-run with a process-timeout. The script **must** begin
  with `"Composer\\Config::disableProcessTimeout"`. A bare `vendor/bin/pest --mutate …`
  has no such cap.
- **A killed composer wrapper orphans its `pest --mutate` child.** When the 300 s
  timeout (or a Ctrl-C) kills `composer mutation`, the underlying `pest --mutate`
  process keeps running detached. It then **silently hammers the shared `testing`
  Postgres DB**, deadlocking `RefreshDatabase`'s `migrate:fresh` ("Dropping all
  tables … FAIL — deadlock detected") and leaving the DB half-migrated → cascading,
  misleading `SQLSTATE… relation "x" does not exist` failures in *every* later test
  run. **Recovery:** `docker exec <app>-laravel.test-1 pkill -9 -f 'pest --mutate'`,
  then terminate stuck backends — `docker exec <app>-pgsql-1 psql -U sail -d postgres
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='testing'
  AND pid <> pg_backend_pid();"` — then `migrate:fresh`. If you see spurious test-DB
  errors after a mutation run, suspect a zombie first; it is rarely a code regression.
- **`--parallel` is broken for mutation here** — pest's parallel mode has no
  per-process mutation test DBs, so it reports a wall of false failures. Run mutation
  **serially**; re-enabling parallel needs paratest DBs wired up (follow-up).
- **xdebug makes mutation runs take *hours*.** The dev containers load xdebug
  *alongside* pcov; with xdebug active, each per-mutant test run carries its full
  overhead. A 92-file `App\Domain` run tracked ~2.5 h with xdebug on, vs
  **~68 min with it off** (one sampled class: ~minutes → **7.3 s**). pcov alone
  collects the coverage `--covered-only` needs. So the `composer mutation` script
  should set **`@putenv XDEBUG_MODE=off`** before the pest call. Symptom of forgetting
  it: `etime` climbs into the hours while CPU-time barely moves (work is in slow child
  processes).
