---
title: The Dependency Rules (the heart of architecture testing)
description: Architecture is mostly about which layer may know about which other layer. Dependencies point inward/downward and nothing depends back up. The canonical may-depend-on table — and every row maps to a Pest arch rule.
tags: [laravel, architecture, dependencies, layering, arch-testing]
type: stack
updated: 2026-07-04
related: [laravel-architecture-manual, transport-layer-boundary, fat-models-skinny-controllers, arch-expectations-dependencies, pest-arch-example-suite, controllers, services, repositories, query-builders, models, data-transfer-objects]
---

# The Dependency Rules

Architecture is mostly about **which layer is allowed to know about which other
layer.** Dependencies should point **inward/downward**: transport depends on
business, business depends on data, and **nothing depends back up**. This is the
core of [[fat-models-skinny-controllers|the layered view]] and the single most
important thing the [[pest-architecture-testing|arch suite]] enforces.

## The canonical "may depend on" rules

Every row maps to a Pest rule (see [[arch-expectations-dependencies]] and the
[[pest-arch-example-suite|annotated suite]]).

| Layer                                              | May depend on / Constraint                                                                                                                |
|----------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------|
| **Http\Controllers**              | Actions, Services, Form Requests, Resources, DTOs. **Never** query the DB directly; **never** contain business rules.                     |
| **Http\Requests**               | Validation rules + DTO assembly only.                                                                                                     |
| **Actions**                           | Services, repositories, models, DTOs, events. **One public entry point.** Query logic is **delegated to a repository**, not built inline. |
| **Services**                         | Repositories, models, DTOs, events. **Stateless.** Transport-agnostic (no Http).                                                          |
| **Repositories**                 | Models, custom query builders. **Return DTOs or collections, not raw query builders.** A repeated base query drops to a query builder.    |
| **Query Builders**             | The model + `Illuminate\Database` only. Own the **reusable base/scoped query**; never reach up to a repository or service.                |
| **Models**                             | `Illuminate\Database` only (ideally). **No dispatching jobs/events from inside the model.**                                               |
| **DTOs / ValueObjects** | **Nothing.** Pure data. `final` + `readonly`.                                                                                             |
| **Domain / business layer**                        | Must **NOT** use `request()`, `Illuminate\Http`, or other transport globals. (See [[transport-layer-boundary]].)                          |

## Why this is the payoff

These rules are **exactly** what Pest's `arch` API expresses natively:

- `toOnlyBeUsedIn()`, `toBeUsedIn()` — where code may appear.
- `toOnlyUse()`, `not->toUse()`, `toUseNothing()` — what code may import.
- `toBeFinal()`, `toBeReadonly()`, `toBeInvokable()` — the shape of each block.

The architectural diagram and the test file become the **same artifact** — the
direction of dependency you draw on a whiteboard is the direction Pest verifies on
every commit. Read [[arch-expectations-dependencies]] for the full dependency
vocabulary, then [[pest-arch-example-suite]] for these rules written out.
