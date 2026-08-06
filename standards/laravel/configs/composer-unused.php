<?php

declare(strict_types=1);

use ComposerUnused\ComposerUnused\Configuration\Configuration;
use ComposerUnused\ComposerUnused\Configuration\NamedFilter;

/*
 * Fleet composer dependency hygiene (fleet-app-specification §2):
 * composer-unused finds PACKAGES REQUIRED BUT NOT USED (the composer-side
 * twin of knip's unused-dependency check). Run via `composer unused`.
 *
 * NamedFilter = a package whose "usage" is invisible to static analysis
 * (side-effect packages, service-provider auto-discovery, runtime-resolved
 * drivers). Every filter carries a reason; adding one without a reason is
 * the same smell as an unexplained baseline entry. First run per app is
 * measure-and-tune — findings are either a `composer remove` or a filter.
 *
 * DO NOT COPY THIS FILE VERBATIM. A filter naming a package this app does not
 * have in `require` registers as a ZOMBIE exclusion, and composer-unused exits
 * NON-ZERO on zombies exactly as it does on unused packages — so an over-broad
 * filter list ships a permanently-red CI gate. Note that `require-dev` packages
 * are not in the analysed set either, so filtering one is always a zombie.
 * Carry only the filters the app actually needs, each with its reason.
 *
 * The two filters below are safe defaults: both packages are mandated for every
 * fleet app by the spec, so neither can be a zombie. The commented block after
 * them is the fleet's observed catalogue of OPTIONAL filters — uncomment only
 * the ones that apply to the app you are converging.
 */
return static function (Configuration $config): Configuration {
    return $config
        // Build-time typed-route generator (php artisan wayfinder:generate); emits TS, never imported by PHP.
        ->addNamedFilter(NamedFilter::fromString('laravel/wayfinder'))
        // Error tracking mandated by spec §5, so EVERY fleet app requires it and this can
        // never be a zombie here. Wired in bootstrap/app.php via
        // Sentry\Laravel\Integration::handles() plus an auto-discovered provider and config —
        // all outside the scanned autoload roots, so no app class ever imports it.
        ->addNamedFilter(NamedFilter::fromString('sentry/sentry-laravel'));

    // Catalogue — add back only what this app requires (see the zombie warning above):
    //   laravel/reverb               WebSocket server: auto-discovered provider + reverb:start command
    //   dedoc/scramble               auto-discovered provider; generates OpenAPI docs at request/CLI time
    //   laravel/chisel               scaffold-pruning toolkit driven entirely by its artisan command
    //   league/flysystem-aws-s3-v3   Flysystem driver resolved at runtime via FILESYSTEM_DISK=s3
    //   laravel/tinker               artisan-only REPL (only if it is in `require`, not `require-dev`)
};
