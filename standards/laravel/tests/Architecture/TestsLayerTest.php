<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Tier 4 — Tests layer  (OPT-IN, target: universal once fleet-verified)
|--------------------------------------------------------------------------
| The suite that polices the tests: mechanically enforces the testing
| doctrine's law 1 — the Unit suite stays BOOTLESS (wiki:
| fleet-testing-doctrine §7). Without this, one convenient facade call in
| tests/Unit silently dilutes the whole suite's purity guarantee.
|
| Scoped to Tests\Unit only: every app has a Unit suite (spec §3 mandates
| it), while Feature/Integration are conditional — and an arch() whose
| subject namespace is empty ERRORS rather than passing, so no rule here
| may target a conditional suite.
|
| VERIFY ON FIRST ADOPTION (per app): Pest test files are commonly
| namespace-less closures; confirm the Tests\Unit subject (autoload-dev
| psr-4 → tests/) actually collects them before trusting green. A quick
| probe: drop a deliberate Http::fake() into a tests/Unit file and confirm
| the first rule goes red. Record the result in the convergence log.
*/

// ── No facades: a facade resolves through the container → requires boot ──
arch('unit tests never boot the app — no facades')
    ->expect('Tests\Unit')
    ->not->toUse('Illuminate\Support\Facades');

// ── No app TestCase / DB machinery: those belong to Feature/Integration ──
arch('unit tests stay bootless — no TestCase, RefreshDatabase, or DB traits')
    ->expect('Tests\Unit')
    ->not->toUse([
        'Tests\TestCase',
        'Illuminate\Foundation\Testing\RefreshDatabase',
        'Illuminate\Foundation\Testing\LazilyRefreshDatabase',
        'Illuminate\Foundation\Testing\DatabaseTransactions',
        'Illuminate\Foundation\Testing\DatabaseMigrations',
    ]);

// ── No container/config helpers: app(), resolve(), config(), event() all
//    require a booted application ─────────────────────────────────────────
arch('unit tests do not reach for the container or ambient config')
    ->expect('Tests\Unit')
    ->not->toUse(['app', 'resolve', 'config', 'event', 'dispatch']);
