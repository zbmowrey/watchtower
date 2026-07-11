<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Tier 2 — Domain layer  (OPT-IN: copy ONLY if the app has App\Domain)
|--------------------------------------------------------------------------
| Qualifies: any app that has an App\Domain namespace. An app with no domain
| layer yet skips this file until it grows one. (An arch() whose *subject*
| namespace is empty ERRORS, it does not pass — so this can't be a no-op on an
| app without App\Domain; it must simply be absent there.)
|
| Encodes cquality dims ⑥/⑦: an HTTP-unaware domain, dependency direction
| pointing inward (domain depends on nothing framework-y), final-by-default.
*/

// ── The domain is a pure, framework-agnostic core ────────────────────────
arch('domain code is framework-agnostic (no HTTP, Eloquent, or facades)')
    ->expect('App\Domain')
    ->not->toUse([
        'Illuminate\Http\Request',
        'Illuminate\Support\Facades',
        'Illuminate\Database\Eloquent\Model',
        'Illuminate\Database\Eloquent\Builder',
        'Illuminate\Database\Query\Builder',
    ]);

arch('the domain does not depend on infrastructure (contracts point inward)')
    ->expect('App\Domain')
    ->not->toUse('App\Infrastructure');

arch('the domain does not depend on the HTTP layer')
    ->expect('App\Domain')
    ->not->toUse('App\Http');

// final-by-default. ->classes() excludes interfaces/enums/traits. Abstract
// base classes CAN'T be final — carve each out explicitly, e.g.:
//   ->ignoring('App\Domain\Shared\Exceptions\DomainException')
arch('every concrete domain class is final (final-by-default)')
    ->expect('App\Domain')
    ->classes()
    ->toBeFinal();

// NOTE: "controllers never import concrete models" was promoted to the
// universal HttpLayer tier (2026-06-17), so it no longer lives here.

// ── The HTTP layer delegates INTO the domain, never around it ────────────
// Form requests legitimately import domain *value types* — enums (for
// Rule::enum validation) and Data DTOs (the manual's toData() assembly
// pattern). That is an inward HTTP→domain dependency the layering allows, so
// the rule only forbids reaching Eloquent directly — NOT a blanket App\Domain
// ban, which would outlaw toData(). (Banning domain *services/repositories* in
// requests is a separate, app-specific concern if an app wants it.)
arch('form requests never touch Eloquent directly')
    ->expect('App\Http\Requests')
    ->not->toUse('Illuminate\Database\Eloquent\Model');
