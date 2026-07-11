<?php

declare(strict_types=1);

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder as EloquentBuilder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Foundation\Http\FormRequest;

/*
|--------------------------------------------------------------------------
| Tier 1 — HTTP layer  (UNIVERSAL)
|--------------------------------------------------------------------------
| Every sibling has App\Http\{Controllers,Requests,Middleware} and
| App\Models. Encodes cquality dim ⑥: thin controllers (validate → delegate
| → respond, never touch Eloquent directly), FormRequest validation, and
| anemic-at-the-edges models.
|
| Applies to ALL FOUR apps. The `use` imports above are only here to give us
| ::class strings — arch() scans App\ code, not this file.
*/

// ── Controllers: final, suffixed, thin ───────────────────────────────────
arch('controllers carry the Controller suffix')
    ->expect('App\Http\Controllers')
    ->toHaveSuffix('Controller')
    ->ignoring(Controller::class);

arch('controllers are final')
    ->expect('App\Http\Controllers')
    ->classes()
    ->toBeFinal()
    ->ignoring(Controller::class);

arch('controllers stay thin — no Eloquent models or query builders')
    ->expect('App\Http\Controllers')
    ->not->toUse([Model::class, EloquentBuilder::class, QueryBuilder::class]);

// Promoted to the universal floor (2026-06-17): a controller must route through
// a service/action/repository and never import a concrete model. The rule above
// bans the base Model/Builder; this bans `App\Models\X` directly. Thin read-model
// query classes are the only exception — carve them out by name if used.
arch('controllers never import concrete models — delegate instead')
    ->expect('App\Http\Controllers')
    ->not->toUse('App\Models');

// ── Form requests: final, suffixed, validation-shaped ────────────────────
// Mixin traits under App\Http\Requests\Concerns hold shared validation rules
// and aren't requests; ->classes() scopes them out of both checks. (Split into
// two rules because a chained ->classes() only binds to the first expectation.)
arch('form requests carry the Request suffix')
    ->expect('App\Http\Requests')
    ->classes()
    ->toHaveSuffix('Request');

arch('form requests extend FormRequest')
    ->expect('App\Http\Requests')
    ->classes()
    ->toExtend(FormRequest::class);

arch('form requests are final')
    ->expect('App\Http\Requests')
    ->classes()
    ->toBeFinal();

// ── Middleware ───────────────────────────────────────────────────────────
arch('middleware exposes a handle() method')
    ->expect('App\Http\Middleware')
    ->toHaveMethod('handle');

// ── Models: extend Eloquent, final, anemic at the layer boundary ─────────
// ->classes() scopes past any model traits/enums (e.g. App\Models\Concerns),
// which can't "extend" — matches the manual's Concerns carve-out.
arch('models extend the Eloquent base model')
    ->expect('App\Models')
    ->classes()
    ->toExtend(Model::class);

// The auth User model is the one common non-final exception (Fortify/Filament
// contracts, test doubles). Carve out others here only with a reason.
arch('models are final (auth User excepted)')
    ->expect('App\Models')
    ->classes()
    ->toBeFinal()
    ->ignoring(User::class);

arch('models are anemic — no domain, infrastructure, or HTTP imports')
    ->expect('App\Models')
    ->not->toUse(['App\Domain', 'App\Infrastructure', 'App\Http']);
