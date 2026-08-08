---
title: Don't Repeat Yourself (DRY)
description: Reuse code wherever possible — Blade components and partials, Eloquent query scopes, and a single well-named home for shared business logic.
tags: [laravel, architecture, principles, dry]
type: stack
updated: 2026-06-17
related: [laravel-first-principles, models, services, controllers]
---

# Don't Repeat Yourself (DRY)

Reuse code wherever possible. In practice this means:

- **View layer** — reuse Blade components and partials instead of pasting markup.
- **Query layer** — reuse Eloquent **query scopes** (`#[Scope]` methods — see the
  [[models]] declaration-style ruling) rather than copying the same `where`-clauses
  across [[controllers]]; a scope shared as a *base query* graduates into a
  [[query-builders|custom query builder]].
- **Business logic** — extract shared logic into a **single well-named home**
  ([[actions]] / [[services]]) rather than duplicating it across controllers.

DRY is the reuse-side complement to [[single-responsibility-principle|SRP]]: SRP
says each home owns one thing; DRY says there's exactly *one* home for it.

**Enforcement.** Duplication is caught at the tooling layer rather than by arch
expectations — jscpd (copy-paste detection) and PHPMD complexity limits in the
[[laravel-engineering-standard|fleet standard]]. Arch tests keep the *homes*
well-defined so there's an obvious place for the shared code to live.
