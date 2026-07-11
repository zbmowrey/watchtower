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
 */
return static function (Configuration $config): Configuration {
    return $config
        // Meta-package: constrains known-vulnerable versions, exports no code.
        ->addNamedFilter(NamedFilter::fromString('roave/security-advisories'))
        // Auto-discovered service provider wired in bootstrap/app.php, not imported.
        ->addNamedFilter(NamedFilter::fromString('sentry/sentry-laravel'))
        // Artisan-only REPL; never imported by app code.
        ->addNamedFilter(NamedFilter::fromString('laravel/tinker'))
        // Flysystem driver resolved at runtime via FILESYSTEM_DISK=s3.
        ->addNamedFilter(NamedFilter::fromString('league/flysystem-aws-s3-v3'));
};
