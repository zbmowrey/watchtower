---
title: Models
description: Models own persistence configuration — relationships, casts, scopes-as-query-vocabulary — declared in the Laravel 13 idiom (metadata attributes, the casts() method, #[Scope]). They may answer questions about themselves; they do not make decisions or cause effects. Mass assignment rides validated() + explicit fillable.
tags: [laravel, architecture, building-blocks, models, eloquent]
type: stack
updated: 2026-08-08
related: [laravel-building-blocks, fat-models-skinny-controllers, repositories, query-builders, framework-conventions-first, dependency-rules, arch-expectations-dependencies]
---

# Models

Models own **persistence configuration**: relationships, casts, query scopes, and small
self-referential conveniences. The boundary rule (from [[dependency-rules]] and the testing
doctrine's bootless-core law): a model may **answer questions about itself**
(`$order->isPaid()`), but it does not **make decisions or cause effects** — a `markAsPaid()`
that flips state and dispatches events belongs in an [[actions|Action]] or domain service,
where it is unit-testable without booting Eloquent. See [[fat-models-skinny-controllers]] for
how this squares with the classic "fat models" advice.

Push reusable query logic into **query scopes** rather than repeating `where`-clauses at call
sites ([[dry-principle|DRY]]); a scope that grows into a shared *base query* graduates into a
[[query-builders|custom query builder]].

**The declaration style is the Laravel 13 idiom** (ruled 2026-08-08, matching what
`laravel new` now scaffolds): metadata as **attributes** (`#[Fillable]`, `#[Hidden]`), casts as
the **`casts()` method**, scopes as **`#[Scope]` methods** (not the `scopeX()` prefix).
Existing property-style models are modernized opportunistically — when a PR touches the model —
not in a big-bang sweep.

```php
declare(strict_types=1);

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;

#[Fillable(['title', 'body', 'published_at'])]
final class Post extends Model
{
    /** @use HasFactory<PostFactory> */
    use HasFactory, SoftDeletes;

    protected function casts(): array
    {
        return ['published_at' => 'immutable_datetime'];
    }

    #[Scope]
    protected function published(Builder $query): Builder
    {
        return $query->whereNotNull('published_at');
    }
}
```

**Mass assignment:** the safety boundary is the FormRequest — controllers and actions consume
`validated()`/`safe()`/`toData()` output only ([[form-requests]]), which allow-lists input by
construction. `$fillable`/`#[Fillable]` stays **explicit** as the second wall; `$guarded = []`
(and `#[Unguarded]`) is forbidden. `preventSilentlyDiscardingAttributes` (runtime guardrails)
is the tripwire that catches the mismatch between the two lists.

**Naming conventions matter** (see [[framework-conventions-first]]): singular model names map
to plural snake_case tables; relationship method names follow Laravel's pluralization rules;
foreign keys are `model_id`. These conventions are what let the framework — and your teammates
— predict your code.

**Keep models slim.** A model should depend only on the database layer; **no dispatching
jobs/events from inside the model** (that belongs in an [[actions|Action]]).

**Enforcement.**

```php
arch('models extend the base model')
    ->expect('App\Models')
    ->toExtend('Illuminate\Database\Eloquent\Model')
    ->ignoring('App\Models\Concerns');

arch('models are slim')
    ->expect('App\Models')
    ->toOnlyUse('Illuminate\Database')
    ->ignoring('App\Models\User');

arch('models are final (auth User excepted)')
    ->expect('App\Models')
    ->classes()
    ->toBeFinal()
    ->ignoring('App\Models\User');
```

See [[arch-expectations-inheritance]] (`toExtend`) and
[[arch-expectations-dependencies]] (`toOnlyUse`).
