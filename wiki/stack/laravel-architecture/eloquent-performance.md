---
title: Database & Eloquent Performance
description: The highest-impact performance area — eliminate N+1 with eager loading, index deliberately, select only what you need, chunk heavy datasets, prefer Eloquent but drop to the query builder for hot paths, and use read replicas to scale reads.
tags: [laravel, performance, eloquent, database, n+1]
type: stack
updated: 2026-06-17
related: [laravel-performance, observability, models, repositories]
---

# Database & Eloquent Performance

- **Eliminate N+1 queries with eager loading (`with()`).** This is the single
  highest-impact fix; profile with Telescope or Debugbar to find them (see
  [[observability]]). Consider `Model::preventLazyLoading()` in non-production to
  **fail loudly** on N+1.
- **Index deliberately** — add indexes to columns used in `WHERE`, `ORDER BY`, and
  `JOIN` clauses; use **composite indexes** for multi-column conditions. Watch the
  slow-query log.
- **Select only what you need** — avoid `SELECT *`; project the columns you use.
- **Chunk heavy datasets** with `chunk()` / `lazy()` instead of loading everything
  into memory.
- **Prefer Eloquent and collections** over raw SQL and arrays for readability, but
  **drop to the query builder for genuinely hot paths.** This is where
  [[repositories]] / [[models]] scopes keep the fast path in one place.
- **Use read replicas** to scale reads on high-traffic systems.

A clear data layer is what makes all of this easy — the architecture and the
performance work reinforce each other ([[laravel-performance]]).
