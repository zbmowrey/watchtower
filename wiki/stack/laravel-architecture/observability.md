---
title: Observability
description: Performance tuning is continuous — use Telescope, Debugbar, Blackfire, or an APM to find bottlenecks before users do; log meaningful events; add metrics for duration, failures, and retries on services and jobs.
tags: [laravel, performance, observability, profiling, apm]
type: stack
updated: 2026-06-17
related: [laravel-performance, eloquent-performance, services, supporting-building-blocks]
---

# Observability

Performance tuning is **continuous**. Use **Telescope, Debugbar, Blackfire, or an
APM** (New Relic, etc.) to find bottlenecks **before users do** — these are also
how you hunt the N+1 queries called out in [[eloquent-performance]].

- **Log meaningful events.**
- **Add metrics** for duration, failures, and retries on your [[services]] and
  [[supporting-building-blocks|jobs]].

> **Architecture-test angle.** The hygiene side of observability is statically
> enforceable: **ban `dd()`/`dump()`/`var_dump()`/`ray()` in committed code** so
> debugging output never reaches the repo:
>
> ```php
> arch('no debug output')
>     ->expect(['dd', 'dump', 'var_dump', 'ray', 'die'])
>     ->not->toBeUsed();
> ```
>
> See [[arch-expectations-dependencies]] (`not->toBeUsed`) and the
> [[pest-arch-presets|`php()` preset]], which bans `die`/`var_dump` and similar.
