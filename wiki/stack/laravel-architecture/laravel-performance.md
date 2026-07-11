---
title: Performance & Operational Excellence
description: Clean architecture and performance are not in tension — a clear data layer is the easiest place to make queries fast. The community consensus clusters into five areas, several of which are statically enforceable.
tags: [laravel, architecture, performance, operations]
type: stack
updated: 2026-06-17
related: [laravel-architecture-manual, eloquent-performance, caching, queues-async, runtime-and-server, observability]
---

# Performance & Operational Excellence

Clean architecture and performance are **not in tension** — a clear data layer is
the easiest place to make queries fast. The community consensus on Laravel
performance clusters into five areas:

1. **[[eloquent-performance|Database & Eloquent]]** — eager loading (N+1),
   indexing, column projection, chunking, read replicas.
2. **[[caching]]** — application cache, framework caches, Redis sessions.
3. **[[queues-async|Queues & asynchronous work]]** — push slow work off the
   request.
4. **[[runtime-and-server]]** — PHP/OPcache/JIT, Octane, CDN + bundling, lean
   dependencies.
5. **[[observability]]** — profile and measure continuously.

> **Architecture-test angle.** Several operational rules are statically
> enforceable: ban `dd()`/`dump()`/`var_dump()` in committed code, forbid the
> `request()` helper in the domain layer ([[transport-layer-boundary]]), and
> require [[supporting-building-blocks|jobs]] to implement `ShouldQueue`. The
> [[pest-architecture-testing|arch suite]] becomes a lightweight, zero-cost
> guardrail that runs on every push.
