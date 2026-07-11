<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Tier 3 — Value objects  (OPT-IN: copy the RULES your app qualifies for)
|--------------------------------------------------------------------------
| DTOs live in *\Data namespaces and are immutable; backed enums are typed.
| These two rules are INDEPENDENTLY opt-in — keep only the ones whose
| namespaces your app actually has, because an arch() with an empty subject
| ERRORS rather than passing:
|
|   - DTO rule  → apps with any App\...\Data namespace
|   - enum rule → apps with App\Enums (or domain enums)
|
| Delete the rule you don't qualify for, or rescope its namespace.
*/

// DTOs — any App\…\Data namespace holds readonly value objects.
// The App\*\*\Data wildcard matches App\<X>\<Y>\Data (e.g.
// App\Domain\Lottery\Data, App\Infrastructure\Markdown\Data).
arch('DTOs in Data namespaces are readonly')
    ->expect('App\*\*\Data')
    ->classes()
    ->toBeReadonly();

// Enums — string-backed, never bare. (Pest arch has no generic "backed"
// matcher; it's toBeStringBackedEnums() / toBeIntBackedEnums(). The fleet
// convention is string-backed; swap the matcher for an int-backed set.)
// Rescope to App\Domain with ->enums() if the app keeps enums under the
// domain instead of App\Enums.
arch('enums are string-backed')
    ->expect('App\Enums')
    ->toBeStringBackedEnums();
