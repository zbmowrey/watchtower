---
title: Repositories
description: The Repository pattern abstracts data access behind an interface. In vanilla Laravel it is optional; the fleet convention is that the moment an action or service queries the database, that query logic lives in a repository, and a repeated base query drops to a custom query builder.
tags: [laravel, architecture, building-blocks, repository, data]
type: stack
updated: 2026-08-08
related: [laravel-building-blocks, models, data-transfer-objects, services, actions, query-builders, dependency-rules]
---

# Repositories

The Repository pattern abstracts data access behind an **interface**. Naming the
distinction precisely (sharpened 2026-08-08, because "repositories are an anti-pattern"
discourse keeps re-litigating this page): **what the community condemns is the passthrough
wrapper** — a repository that re-exposes Eloquent method-for-method (`find`, `where`, `all`)
and returns models or builders, duplicating the ORM while abstracting nothing. That critique
is correct, and **ours is not that pattern.** A fleet repository exists for three specific
payoffs:

- it **returns DTOs, never models or builders** — higher layers can't re-open the query;
- it is the **enforcement point for scope walls** (tenant isolation, entitlement filtering)
  via the [[query-builders|custom query builder]] it composes — a wall you can't forget at a
  call site;
- it is the **seam** [[fleet-testing-doctrine]] needs — a contract-faked port, so the logic
  above it unit-tests bootlessly.

A simple read with no wall and no reuse **may stay on the query-builder path without a
repository** — the pattern is adopted for those payoffs, not reflexively.

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
