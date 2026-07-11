---
title: Layered (Type-Based) Structure
description: The default Laravel layout — group files by technical role. The right default for small-to-medium applications and teams new to the framework.
tags: [laravel, architecture, structure, layered]
type: stack
updated: 2026-06-17
related: [laravel-app-structure, domain-oriented-structure, laravel-building-blocks, dependency-rules]
---

# Layered (Type-Based) Structure

**Approach A.** The default Laravel layout groups files by **technical role**. This
is the right default for small-to-medium applications and for teams new to the
framework.

```
app/
├── Actions/              Single-purpose business operations
├── Console/
├── DataTransferObjects/  (or DTOs/)
├── Enums/
├── Events/
├── Exceptions/
├── Http/
│   ├── Controllers/      Thin: HTTP in, response out
│   ├── Middleware/
│   ├── Requests/         Validation lives here
│   └── Resources/        API response transformers
├── Jobs/                 Queued work
├── Listeners/
├── Models/               Rich, entity-local behavior
├── Policies/             Authorization
├── Providers/
├── Repositories/         (optional) data-access abstraction
├── Services/             Cross-entity orchestration
└── ValueObjects/
```

Each directory maps to a [[laravel-building-blocks|building block]] with a narrow
job. The trade-off this layout makes: a single feature is scattered across a dozen
directories — which is exactly the pain that motivates
[[domain-oriented-structure|Approach B]] as the app grows.

**Enforcement.** This is the structure the [[pest-arch-example-suite|example
suite]] assumes by default — `App\Http`, `App\Actions`, `App\Services`,
`App\Models`, `App\DataTransferObjects`, etc. The [[dependency-rules]] are
expressed directly against these namespaces.
