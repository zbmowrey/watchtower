---
title: Key References (Laravel Architecture Manual)
description: The load-bearing sources behind the manual — Pest arch docs, Laravel docs, the alexeymezenin community canon, spatie/laravel-data, DDD structuring, and the 2025–2026 performance guides — plus the version caveat.
tags: [laravel, architecture, references, appendix]
type: stack
updated: 2026-06-17
related: [laravel-architecture-manual, pest-architecture-testing, data-transfer-objects, domain-oriented-structure]
---

# Key References

This [[laravel-architecture-manual|manual]] synthesizes the official documentation
with the prevailing community consensus. The most load-bearing sources:

- **Pest — Architecture Testing** (official docs): the complete expectation,
  preset, modifier, and wildcard API. Basis for [[pest-architecture-testing]].
- **Laravel — official documentation**: validation, Eloquent, queues, caching,
  the container, and naming conventions.
- **`alexeymezenin/laravel-best-practices`** (GitHub): the widely-translated
  community canon — SRP, fat models/skinny controllers, validation in requests,
  business logic in services, DRY, Eloquent-over-raw-SQL, eager loading. Basis for
  [[laravel-first-principles]].
- **Community writing on Actions/Services/DTOs** and Clean/Service-Action
  architecture, including the **`spatie/laravel-data`** approach to
  [[data-transfer-objects|DTOs]].
- **Domain-Driven structuring guidance** for organizing by business domain rather
  than technical layer — see [[domain-oriented-structure]].
- **Laravel performance guides (2025–2026)**: N+1/eager loading, indexing, Redis
  caching, framework caches, queues, OPcache/Octane, CDN, and profiling with
  Telescope/Debugbar. Basis for [[laravel-performance]].

> **Version caveat.** Verify version-specific details — Pest **3.8+** for
> [[pest-arch-wildcards|wildcards]], exact preset contents, and the `intl`
> requirement — against the current official docs for your installed versions, as
> the APIs continue to evolve.
