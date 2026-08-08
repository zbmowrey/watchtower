---
title: Key References (Laravel Architecture Manual)
description: The load-bearing sources behind the manual — Pest arch docs, Laravel docs, the alexeymezenin community canon, spatie/laravel-data, DDD structuring, and the 2025–2026 performance guides — plus the version caveat.
tags: [laravel, architecture, references, appendix]
type: stack
updated: 2026-08-08
related: [laravel-architecture-manual, pest-architecture-testing, data-transfer-objects, domain-oriented-structure]
---

# Key References

This [[laravel-architecture-manual|manual]] synthesizes the official documentation
with named, current community sources (sourcing refreshed 2026-08-08). The most
load-bearing:

- **Pest — Architecture Testing** (official docs): the complete expectation,
  preset, modifier, and wildcard API. Basis for [[pest-architecture-testing]].
- **Laravel 13.x — official documentation** (docs, release notes, upgrade guide):
  validation, Eloquent, queues, caching, the container, naming conventions — and
  the source of record for what the framework now scaffolds (metadata attributes,
  `casts()`, `#[Scope]`).
- **PlanetScale, "Laravel's safety mechanisms"** (corroborated by Laravel News):
  the per-flag strictness analysis behind the fleet's split
  (`preventLazyLoading` dev-only; the two correctness flags everywhere) —
  [[laravel-runtime-guardrails]].
- **Current Actions-pattern writing** (e.g. d4b.dev's 2026 "The Laravel Action
  pattern deserves to escape Laravel"; nabilhassen.com's service-pattern critique):
  organize by business operation, avoid the sub-controller service — [[actions]],
  [[services]].
- **spatie package documentation** (`laravel-data`, `laravel-query-builder`): the
  carrier-only DTO ruling and the query vocabulary — [[data-transfer-objects]],
  [[spatie-laravel-data]].
- **Domain-Driven structuring guidance** (Spatie's *Laravel Beyond CRUD* lineage)
  for organizing by business domain — see [[domain-oriented-structure]].
- *(Retired as a load-bearing source, 2026-08-08:* `alexeymezenin/laravel-best-practices`
  — Laravel 5/6-era; its fat-models and business-logic-in-services stances aged
  into the positions [[fat-models-skinny-controllers]] now explicitly supersedes.
  Kept here as provenance, no longer cited as authority.)*

> **Version caveat.** Verify version-specific details — preset contents, the
> `intl` requirement, wildcard support — against the current official docs for
> your installed versions ([[fleet-app-specification]] §1 owns the mandated
> versions; the [[framework-bump-playbook]] owns the annual re-verification).
