---
title: Runtime & Server
description: Keep PHP current with OPcache (and JIT for CPU-bound work), consider Octane for high-concurrency APIs, serve assets via CDN with Vite bundling, and trim dependencies and service providers to cut boot overhead.
tags: [laravel, performance, runtime, opcache, octane, server]
type: stack
updated: 2026-06-17
related: [laravel-performance, caching, queues-async]
---

# Runtime & Server

- **Latest PHP + OPcache** — keep PHP current, enable OPcache, and consider **JIT**
  for CPU-bound work.
- **Laravel Octane** — for high-concurrency APIs, Octane (Swoole / RoadRunner /
  FrankenPHP) keeps the framework **booted between requests** for large throughput
  gains.
- **CDN + asset bundling** — serve static assets via a CDN; bundle with **Vite**;
  compress images.
- **Lean dependencies** — remove unused packages and reduce autoloaded service
  providers to cut boot overhead.

These pair with the deploy-time [[caching|framework caches]] (`config:cache`,
`route:cache`, …) to minimize per-request and boot cost ([[laravel-performance]]).
