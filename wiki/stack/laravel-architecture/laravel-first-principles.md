---
title: First Principles — the "Laravel Way"
description: The small set of principles the Laravel community converges on; nearly every architectural decision is downstream of these six.
tags: [laravel, architecture, principles]
type: stack
updated: 2026-06-17
related: [laravel-architecture-manual, single-responsibility-principle, fat-models-skinny-controllers, dry-principle, framework-conventions-first, validate-at-the-boundary, type-safety-and-strictness]
---

# First Principles: the "Laravel Way"

Before any folder structure or pattern, the community converges on a small set of
principles. Nearly every architectural decision elsewhere in this
[[laravel-architecture-manual|manual]] is downstream of these.

1. **[[single-responsibility-principle|Single Responsibility Principle (SRP)]]** —
   one reason to change; the root of nearly every other guideline.
2. **[[fat-models-skinny-controllers|Fat Models, Skinny Controllers — and beyond]]** —
   thin HTTP, rich entity behavior, orchestration in a service/action layer; avoid
   the anemic-domain trap.
3. **[[dry-principle|Don't Repeat Yourself (DRY)]]** — one well-named home per piece
   of logic.
4. **[[framework-conventions-first|Prefer framework conventions and standard tools]]** —
   lean into Laravel; use the container, not `new`.
5. **[[validate-at-the-boundary]]** — all user input validated at the edge, in Form
   Requests.
6. **[[type-safety-and-strictness]]** — `strict_types`, `===`, and PHP 8+ features.

These are the principles the [[pest-architecture-testing|Pest arch suite]] turns
into executable guardrails — see especially [[dependency-rules]] and the
[[pest-arch-example-suite|annotated suite]].
