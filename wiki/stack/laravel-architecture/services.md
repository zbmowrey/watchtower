---
title: Services — Cross-Entity Orchestration
description: A Service is a stateless class, suffixed Service, that coordinates work across multiple entities or external systems. Keep it stateless, read config from config(), document every side effect, and watch for the god-service smell.
tags: [laravel, architecture, building-blocks, services]
type: stack
updated: 2026-06-17
related: [laravel-building-blocks, actions, models, repositories, transport-layer-boundary, dependency-rules, arch-expectations-dependencies]
---

# Services — Cross-Entity Orchestration

A Service is a **stateless** class, suffixed `Service`, that coordinates work
**across multiple entities or external systems**. The rules that keep services
clean:

- **Stateless** — pass everything in as parameters or [[data-transfer-objects|DTOs]];
  never store request-specific state on the service.
- **Config from `config()`** — read configuration and secrets from `config()`,
  never hardcoded.
- **Transport-agnostic** — no `request()`, no `Illuminate\Http`. See
  [[transport-layer-boundary]].
- **Document and test every side effect** (emails, queued jobs, external calls),
  and decouple with [[supporting-building-blocks|events]] where helpful.

> **God-service smell.** If a service coordinates too many unrelated concerns,
> split it into smaller services or use-case classes. A service that imports half
> your namespaces is a refactor waiting to happen — and `toOnlyUse()` will catch
> it.

See [[actions]] for the Action-vs-Service distinction: an Action does one thing; a
Service groups several related operations.

**Enforcement.**

- `expect('App\Services')->classes()->toBeFinal()` — services are real, final
  classes.
- `toOnlyUse(...)` bounds what a service may import (the god-service guard) —
  [[arch-expectations-dependencies]].
- Statelessness and transport-agnosticism follow the [[dependency-rules]].
