---
title: Caching
description: Cache expensive query results and computed data in Redis/Memcached, run the framework caches (config/route/view/event) on every production deploy, and move sessions and cache off files once you have meaningful traffic.
tags: [laravel, performance, caching, redis]
type: stack
updated: 2026-06-17
related: [laravel-performance, eloquent-performance, runtime-and-server]
---

# Caching

- **Application cache** — cache expensive query results and computed data in
  **Redis/Memcached**; cache user permissions or product listings for minutes to
  shave load off the database.
- **Framework caches** — run `config:cache`, `route:cache`, `view:cache`, and
  `event:cache` as part of **every production deploy**.
- **Redis-backed sessions & cache** — store sessions and cache in Redis, not files,
  once you have meaningful traffic.

Caching complements [[eloquent-performance|query optimization]]: first make the
query cheap, then cache the result. The framework caches pair with the deploy-time
work in [[runtime-and-server]].
