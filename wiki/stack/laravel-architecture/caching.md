---
title: Caching
description: Cache expensive query results and computed data in Redis/Memcached, run the framework caches (config/route/view/event) on every production deploy, and move sessions and cache off files once you have meaningful traffic.
tags: [laravel, performance, caching, redis]
type: stack
updated: 2026-08-08
related: [laravel-performance, eloquent-performance, runtime-and-server]
---

# Caching

- **Application cache** — cache expensive query results and computed data in
  **Valkey/Redis**; cache user permissions or product listings for minutes to
  shave load off the database. Hardening: `cache.serializable_classes = false` is a
  [[fleet-app-specification]] §5 mandate — prefer array payloads over cached PHP objects.
- **Stampede control** — for hot keys that are expensive to rebuild, use
  **`Cache::flexible($key, [$fresh, $stale], $cb)`** (stale-while-revalidate: serve stale,
  rebuild in the background) instead of a bare `remember()` that lets every request rebuild
  at expiry; for genuinely single-flight rebuilds, an atomic **`Cache::lock()`** — refreshed
  per unit of work (`$lock->refresh()`), never a long pessimistic TTL.
- **Framework caches** — run `php artisan optimize` (config + events + routes + views in one
  step) as part of **every production deploy**; `optimize:clear` is its inverse.
- **Redis-backed sessions & cache** — store sessions and cache in Valkey/Redis, not files,
  once you have meaningful traffic (the hardened pods' read-only filesystem forces this
  anyway).

Caching complements [[eloquent-performance|query optimization]]: first make the
query cheap, then cache the result. The framework caches pair with the deploy-time
work in [[runtime-and-server]].
