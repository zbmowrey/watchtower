---
title: Custom Query Builders (Query Objects)
description: When a repository keeps re-initiating the same base query, that base query moves into a custom Eloquent Builder so the scope is defined once and enforced on every call — the way Eloquent's own scopes are. The data-access floor beneath repositories.
tags: [laravel, architecture, building-blocks, query-builder, data, scopes]
type: stack
updated: 2026-07-04
related: [repositories, models, actions, services, dependency-rules, eloquent-performance, laravel-building-blocks]
---

# Custom Query Builders (Query Objects)

A custom query builder is the home for a **reusable base query**. When two or more
[[repositories|repository]] methods start from the same starting point — the same
`where`, the same membership `whereIn`, the same soft-delete or tenant filter — that
starting point is a fact about the model, not about any one method. It belongs in one
place that every caller composes from, so the scope can never be forgotten or written
two subtly-different ways.

This is the **data-access floor** beneath repositories, and the last link in the
fleet chain: [[controllers|controller]] → [[actions|action]] → [[repositories|repository]]
→ **query builder**.

## The rule (fleet convention)

> When a repository **repeatedly initiates the same base query**, extract that base
> query into a custom query builder. The repository then composes from the builder
> instead of re-writing the base filter in every method.

The point is the one the owner named: **rely on the query builder to enforce scopes
the way Eloquent does.** A membership wall (`Subscription` is only ever visible
through the caller's accounts) written inline is a wall you can forget on the next
method. Written as a builder method it is applied by *calling it*, and the type
system reminds you it exists.

## Primary form — a custom Eloquent Builder

Prefer extending `Illuminate\Database\Eloquent\Builder` and returning it from the
model's `newEloquentBuilder()`. This keeps `Model::query()` fluent and typed, and the
scope methods chain exactly like first-party Eloquent scopes.

```php
// app/Models/Builders/SubscriptionBuilder.php
namespace App\Models\Builders;

use App\Enums\SubscriptionStatus;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/** @extends Builder<\App\Models\Subscription> */
final class SubscriptionBuilder extends Builder
{
    /** The row-level-security wall: a subscription is only ever visible
        through one of the caller's accounts. Defined once, here. */
    public function ownedBy(User $user): self
    {
        return $this->whereIn('account_id', $user->accounts()->select('accounts.id'));
    }

    public function active(): self
    {
        return $this->where('status', SubscriptionStatus::Active);
    }
}
```

```php
// app/Models/Subscription.php
/** @return SubscriptionBuilder<static> */
public function newEloquentBuilder($query): SubscriptionBuilder
{
    return new SubscriptionBuilder($query);
}
```

Now every caller starts from the guarded base query and reads as intent:

```php
Subscription::query()->ownedBy($user)->active()->get();
```

The repository composes the same way, and no method can query subscriptions without
passing through `ownedBy()`.

## Alternative form — a standalone query object

When the query does not belong to one model (a report joining several tables, a
read-model), a plain invokable class that takes a base builder and returns a narrowed
one is the lighter option. Same idea, no `newEloquentBuilder()` wiring:

```php
final class ActiveSubscriptionsForUser
{
    public function __invoke(User $user): Builder
    {
        return Subscription::query()
            ->whereIn('account_id', $user->accounts()->select('accounts.id'))
            ->where('status', SubscriptionStatus::Active);
    }
}
```

## Don't over-reach

A base query used in **one** place is not yet a builder — it lives in the repository
method that needs it. The builder earns its existence on the **second** caller (the
DRY trigger, see [[dry-principle]]). Reflexively wrapping every model in a builder is
the same ceremony trap that [[repositories]] warns about.

## Enforcement

Custom builders live under `App\Models\Builders` (or `App\*\Queries` in a domain
layout) and may use the model and `Illuminate\Database` only — never a
[[repositories|repository]], service, or anything higher up. That is one row of the
[[dependency-rules]], expressible as
`expect('App\Models\Builders')->toOnlyUse([...])` (see
[[arch-expectations-dependencies]]).
