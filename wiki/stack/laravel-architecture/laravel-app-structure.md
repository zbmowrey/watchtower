---
title: Structuring the Application
description: The two dominant, legitimate ways to organize a Laravel codebase — layered (type-based) and domain-oriented (DDD) — how to choose, and how to enforce the choice with arch tests.
tags: [laravel, architecture, structure]
type: stack
updated: 2026-06-17
related: [laravel-architecture-manual, layered-structure, domain-oriented-structure, transport-layer-boundary, dependency-rules]
---

# Structuring the Application

There are **two dominant, legitimate ways** to organize a Laravel codebase. Choose
deliberately based on size, and **enforce the choice** with
[[pest-architecture-testing|arch tests]].

- **[[layered-structure|Approach A — Layered (type-based)]]** — group files by
  technical role (`Actions/`, `Http/`, `Models/`, `Services/`…). The right default
  for small-to-medium apps and teams new to the framework.
- **[[domain-oriented-structure|Approach B — Domain-oriented (DDD)]]** — group code
  by business domain (`Domains/Ordering/`, `Domains/Billing/`…) so the code mirrors
  the business. Pays off once the app is genuinely large.

> **Rule of thumb.** Start layered. Migrate to domains when a feature consistently
> spans many directories and teams start stepping on each other. Don't pay the
> ceremony cost of DDD on a CRUD app.

Whichever you pick, one rule is non-negotiable: the
**[[transport-layer-boundary|transport layer must stay transport-only]]** — the
`App\Http` namespace depends on the domain, never the reverse. The full set of
"may depend on" rules is in [[dependency-rules]].
