<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Tier 1 — Hygiene  (UNIVERSAL: every sibling runs this file verbatim)
|--------------------------------------------------------------------------
| No structural assumptions beyond a stock Laravel skeleton (App\,
| Database\Seeders\, Database\Factories\ all exist on a fresh install).
| Encodes the cquality dim-⑦ basics: strict types everywhere, no debug or
| dump leftovers, env() read only through config, plus Pest's curated
| php/security presets.
|
| These rules apply to EVERY app. Do not trim them. If a preset flags a
| legitimate construct, scope it with ->ignoring('App\Some\Namespace') and
| leave a one-line comment saying why — never delete the rule.
*/

arch('all application code declares strict types')
    ->expect('App')
    ->toUseStrictTypes();

arch('seeders and factories declare strict types')
    ->expect(['Database\Seeders', 'Database\Factories'])
    ->toUseStrictTypes();

arch('no debugging or dump helpers ship to production')
    ->expect(['dd', 'dump', 'ray', 'var_dump', 'var_export', 'print_r', 'dde', 'vd', 'die', 'exit'])
    ->not->toBeUsed();

arch('env() is read only through the config layer')
    ->expect('env')
    ->not->toBeUsed()
    ->ignoring('config');

// Pest's curated presets — cheap structural guardrails for the common smells.
// https://pestphp.com/docs/arch-testing#presets
// Console commands legitimately echo to stdout, so the php preset's no-output
// rule is scoped away from App\Console (a proven carve-out).
arch('php preset — no debug funcs, weak comparisons, or forbidden constructs')
    ->preset()
    ->php()
    ->ignoring('App\Console');

arch('security preset — no eval, unsafe randomness, or injection sinks')
    ->preset()
    ->security();
