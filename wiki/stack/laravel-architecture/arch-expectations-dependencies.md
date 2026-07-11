---
title: Arch Expectations — Dependencies (the core of layering)
description: The dependency expectations — toOnlyBeUsedIn, toBeUsedIn, toOnlyUse, toUse, toUseNothing, toBeUsed — that express where code may appear and what it may import. This family implements the dependency-rules table row-for-row.
tags: [pest, arch-testing, expectations, dependencies, layering]
type: stack
updated: 2026-06-17
related: [pest-arch-expectations, dependency-rules, transport-layer-boundary, models, data-transfer-objects, observability]
---

# Arch Expectations — Dependencies

This is **the core of layering** — the expectations that implement the
[[dependency-rules]] table row-for-row. They come in two shapes: *where code may
appear* and *what code may import*.

| Expectation                        | Asserts…                                                                               |
|------------------------------------|----------------------------------------------------------------------------------------|
| `toOnlyBeUsedIn('App\X')`          | this code is used **ONLY** within namespace X (e.g. models only used by repositories). |
| `toBeUsedIn('App\X')`              | this code is used in X; with `not->` restricts where it may appear.                    |
| `toOnlyUse('Illuminate\Database')` | this code may import **ONLY** the given dependencies (great for slim [[models]]).      |
| `toUse('request')`                 | this code uses the target; with `not->` **forbids** the dependency.                    |
| `toUseNothing()`                   | this code has **no dependencies at all** ([[data-transfer-objects                      |DTOs]], value objects). |
| `toBeUsed()`                       | with `not->`, asserts the target is **never used anywhere** (e.g. facades, `dd`).      |

## Canonical applications

```php
// Controllers must not touch the database directly. (fat-models-skinny-controllers)
expect('App\Models')->not->toBeUsedIn('App\Http\Controllers');

// The HTTP layer is self-contained. (transport-layer-boundary)
expect('App\Http')->toOnlyBeUsedIn('App\Http');

// Domain is transport-agnostic — no request()/Illuminate\Http.
expect('App\Domains')->not->toUse(['request', 'Illuminate\Http']);

// Slim models import only the database layer. (god-object guard for services too)
expect('App\Models')->toOnlyUse('Illuminate\Database');

// DTOs depend on nothing.
expect('App\DataTransferObjects')->toUseNothing();

// No debug output ever reaches the repo. (observability hygiene)
expect(['dd', 'dump', 'var_dump', 'ray', 'die'])->not->toBeUsed();
```

These are the rules most worth introducing **one at a time** with `ignoring()` to
grandfather legitimate exceptions — see [[pest-arch-modifiers]] and
[[pest-arch-rollout]]. The full worked set is in [[pest-arch-example-suite]].
