---
title: Prefer Framework Conventions and Standard Tools
description: Lean into Laravel — Eloquent, Blade/Inertia, the first-party queue/cache/event systems, the IoC container over `new` — and don't fight or patch the framework.
tags: [laravel, architecture, principles, conventions, container]
type: stack
updated: 2026-06-17
related: [laravel-first-principles, models, supporting-building-blocks, queues-async, pest-arch-presets]
---

# Prefer Framework Conventions and Standard Tools

Use the standard Laravel tools the community has accepted:

- **Eloquent** over raw SQL; **Blade/Inertia** over hand-rolled templating; the
  first-party **queue, cache, and event** systems (see [[queues-async]]).
- **Follow Laravel naming conventions** — they're what let the framework *and*
  your teammates predict your code (singular models → plural snake_case tables,
  `model_id` foreign keys, pluralized relationship methods). See [[models]].
- **Use the IoC / service container** (`app()`, constructor injection) instead of
  `new Class()`. This is what makes code testable and swappable.
- **Don't modify the framework's core behavior**, or you'll pay for it at every
  upgrade.

> If you find yourself fighting the framework and yearning for the patterns of
> Symfony or Spring, that is a *signal* — those frameworks may be the better fit
> for that project. Inside Laravel, **lean into Laravel.**

**Enforcement.** Convention adherence is largely what the
[[pest-arch-presets|`laravel()` preset]] checks (controllers suffixed `Controller`
with only RESTful methods, etc.). Naming conventions map to
[[arch-expectations-naming|`toHaveSuffix()` / `toBeCasedCorrectly()`]].
