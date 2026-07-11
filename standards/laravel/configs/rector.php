<?php

declare(strict_types=1);

use Rector\Config\RectorConfig;

/*
 * Fleet rector config — fleet-app-specification §2 (LOCAL TOOL, never a CI
 * gate; the 2026-07-10 owner ruling). Rector is the modernization engine:
 * run `composer rector` (dry-run preview) / `composer rector:fix` (apply)
 * before PHP or framework major/minor bumps and during refactor campaigns.
 * It is deliberately NOT wired into ci.yml — rule churn must never break a
 * build; correctness is already gated by larastan/psalm/pest.
 *
 * withPhpSets() reads the composer.json PHP floor, so this file needs no
 * edit on a PHP bump. Next ratchet when wanted: driftingly/rector-laravel.
 */
return RectorConfig::configure()
    ->withPaths([
        __DIR__.'/app',
        __DIR__.'/config',
        __DIR__.'/database',
        __DIR__.'/routes',
        __DIR__.'/tests',
    ])
    ->withPhpSets()
    ->withPreparedSets(deadCode: true, codeQuality: true, typeDeclarations: true)
    ->withImportNames(removeUnusedImports: true);
