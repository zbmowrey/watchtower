---
title: Repositories
description: The Repository pattern abstracts data access behind an interface. In vanilla Laravel it is optional; the fleet convention is that the moment an action or service queries the database, that query logic lives in a repository, and a repeated base query drops to a custom query builder.
tags: [laravel, architecture, building-blocks, repository, data]
type: stack
updated: 2026-07-04
related: [laravel-building-blocks, models, data-transfer-objects, services, actions, query-builders, dependency-rules]
---

# Repositories

The Repository pattern abstracts data access behind an **interface**. In vanilla
Laravel it earns its keep when:

- you may **swap the data source**, or
- you want to **mock the data layer cleanly** in tests.

On a bare Eloquent app it can otherwise be **unnecessary ceremony** — the community
default is to adopt it intentionally, not reflexively.

## The fleet convention

> The moment an [[actions|action]] or [[services|service]] **queries the database**,
> that query logic lives in a **repository**, not inline in the action. And when a
> repository **repeatedly initiates the same base query**, that base query drops one
> layer further, into a [[query-builders|custom query builder]].

The chain, top to bottom: [[controllers|controller]] (transport) →
[[actions|action]] (orchestrate one operation) → **repository** (own the queries,
return DTOs/collections) → [[query-builders|query builder]] (the shared, scoped base
query). Each layer knows only the one below it. An action reads as business steps; a
reviewer never has to read a `whereIn` to understand what it does, and the query is
testable and reusable on its own.

This is a **go-forward convention** (guidance for new and changed code), not a
retroactive mandate: existing apps still query inline in places and are not
non-conformant for it. It is not (yet) an enforced arch floor — see
[[laravel-engineering-standard]] for the enforcement status.

```php
interface PostRepository
{
    public function findByUuid(string $uuid): ?PostData;
    public function create(CreatePostData $data): PostData;
}
```

Note the return types: a repository should **return [[data-transfer-objects|DTOs]]
or collections, not raw query builders or Eloquent models**, so the layers above
([[services]], [[actions]]) never depend on the ORM. That constraint is one row of
the [[dependency-rules]].

**Enforcement.** Contracts live as interfaces
(`expect('App\Contracts')->toBeInterfaces()`), and the "repositories return DTOs,
not query builders" rule is a dependency expectation
([[arch-expectations-dependencies]]). A repository may use [[models]], its
[[query-builders|custom query builder]], and nothing further up — it never returns
that builder across its own boundary.
