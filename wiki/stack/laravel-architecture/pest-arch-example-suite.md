---
title: A Complete, Annotated Arch Suite
description: A ready-to-adapt Pest arch suite that encodes the principles from Parts I–V. Each block is annotated with the principle it protects — drop it in, adjust namespaces to your structure, and tighten over time.
tags: [pest, arch-testing, suite, laravel, reference]
type: stack
updated: 2026-06-17
related: [pest-architecture-testing, dependency-rules, pest-arch-presets, pest-arch-rollout, controllers, models, data-transfer-objects, transport-layer-boundary]
---

# A Complete, Annotated Arch Suite

A ready-to-adapt starting suite that encodes the principles from
[[laravel-architecture-manual|Parts I–V]]. Drop it in, adjust namespaces to your
structure, and tighten over time. Each block links to the principle it protects.

## Global hygiene & strictness

```php
// Presets do the heavy lifting first.  → pest-arch-presets
arch()->preset()->php();
arch()->preset()->security();
arch()->preset()->laravel();

// No debugging statements ever reach the repo.  → observability
arch('no debug output')
    ->expect(['dd', 'dump', 'var_dump', 'ray', 'die'])
    ->not->toBeUsed();

// Strict types everywhere.  → type-safety-and-strictness
arch('strict types')
    ->expect('App')
    ->toUseStrictTypes();
```

## Controllers stay thin and conventional

```php
arch('controllers are suffixed')
    ->expect('App\Http\Controllers')
    ->toHaveSuffix('Controller');

// Controllers must not touch the database directly.  → dependency-rules
arch('controllers do not use Eloquent directly')
    ->expect('App\Models')
    ->not->toBeUsedIn('App\Http\Controllers');

// HTTP layer is self-contained.  → transport-layer-boundary
arch('http stays in http')
    ->expect('App\Http')
    ->toOnlyBeUsedIn('App\Http');
```

See [[controllers]], [[dependency-rules]], [[transport-layer-boundary]].

## The business layer is transport-agnostic

```php
// No request() helper or HTTP types leak into the domain.  → transport-layer-boundary
arch('domain is transport-agnostic')
    ->expect('App\Domains')
    ->not->toUse(['request', 'Illuminate\Http']);

// Actions are single invokable operations.  → actions
arch('actions are invokable')
    ->expect('App\Actions')
    ->toBeInvokable();

// Services are real classes and final.  → services
arch('services are final classes')
    ->expect('App\Services')
    ->classes()
    ->toBeFinal();
```

## Models are lean

```php
arch('models extend the base model')
    ->expect('App\Models')
    ->toExtend('Illuminate\Database\Eloquent\Model')
    ->ignoring('App\Models\Concerns');

// Models depend only on the database layer — no dispatching jobs/events
// from inside a model.  → fat-models-skinny-controllers (anemic-vs-fat balance)
arch('models are slim')
    ->expect('App\Models')
    ->toOnlyUse('Illuminate\Database')
    ->ignoring('App\Models\User');
```

See [[models]].

## Pure data types are pure

```php
arch('DTOs are final, readonly, dependency-free')
    ->expect('App\DataTransferObjects')
    ->toBeFinal()
    ->toBeReadonly()
    ->toExtendNothing()
    ->toUseNothing();

arch('value objects are final and readonly')
    ->expect('App\ValueObjects')
    ->classes()
    ->toBeFinal()
    ->toBeReadonly();
```

See [[data-transfer-objects]], [[supporting-building-blocks]].

## Contracts, enums, jobs, and resources

```php
arch('contracts are interfaces')
    ->expect('App\Contracts')
    ->toBeInterfaces();

arch('enums live in the Enums namespace')
    ->expect('App\Enums')
    ->toBeEnums();

arch('jobs are queueable')
    ->expect('App\Jobs')
    ->toImplement('Illuminate\Contracts\Queue\ShouldQueue');

// API controllers return standardized, Responsable responses.  → supporting-building-blocks
arch('api responses are responsable')
    ->expect('App\Http\Responses')
    ->toOnlyImplement('Illuminate\Contracts\Support\Responsable');
```

## Discourage facades in the domain (optional, opinionated)

```php
arch('avoid facades outside providers')
    ->expect('Illuminate\Support\Facades')
    ->not->toBeUsed()
    ->ignoring('App\Providers');
```

## Custom preset for a domain-structured app

If you run the [[domain-oriented-structure|Domain structure]], codify the
inward-dependency rule once as a reusable [[pest-arch-presets|custom preset]]:

```php
// tests/Pest.php — the definition (and its expectation list) is owned by
// [[domain-oriented-structure]]; register it there, invoke it here:
arch()->preset()->ddd();
```

Now adopt it incrementally and run it in CI — see [[pest-arch-rollout]] — and avoid
the [[pest-arch-pitfalls|common pitfalls]].
