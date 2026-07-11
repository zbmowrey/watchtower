---
title: Models
description: Models represent entities and own entity-local behavior — relationships, scopes, accessors/mutators, casts, and small domain methods. Push reusable query logic into scopes; keep models slim; follow Laravel's naming conventions.
tags: [laravel, architecture, building-blocks, models, eloquent]
type: stack
updated: 2026-06-17
related: [laravel-building-blocks, fat-models-skinny-controllers, repositories, framework-conventions-first, dependency-rules, arch-expectations-dependencies]
---

# Models

Models represent entities and own **entity-local behavior**: relationships,
scopes, accessors/mutators, casts, and small domain methods like `markAsPaid()`.
This is the "fat" in [[fat-models-skinny-controllers]] — but bounded: a model owns
*its own* rules, while cross-entity orchestration belongs in [[services]] /
[[actions]].

Push reusable query logic into **query scopes** rather than repeating
`where`-clauses in controllers (this is [[dry-principle|DRY]]).

```php
class Post extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = ['title', 'body', 'published_at'];
    protected $casts = ['published_at' => 'immutable_datetime'];

    public function scopePublished(Builder $q): Builder
    {
        return $q->whereNotNull('published_at');
    }
}
```

**Naming conventions matter** (see [[framework-conventions-first]]): singular model
names map to plural snake_case tables; relationship method names follow Laravel's
pluralization rules; foreign keys are `model_id`. These conventions are what let
the framework — and your teammates — predict your code.

**Keep models slim.** A model should depend only on the database layer; **no
dispatching jobs/events from inside the model** (that belongs in an
[[actions|Action]]).

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
```

See [[arch-expectations-inheritance]] (`toExtend`) and
[[arch-expectations-dependencies]] (`toOnlyUse`).
