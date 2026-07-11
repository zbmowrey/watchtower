---
title: Fat Models, Skinny Controllers — and Beyond
description: Keep controllers thin (HTTP only); push entity-local behavior into models; move cross-entity orchestration into a service/action layer — without falling into the anemic-domain trap.
tags: [laravel, architecture, principles, models, controllers]
type: stack
updated: 2026-06-17
related: [laravel-first-principles, single-responsibility-principle, controllers, models, actions, services, dependency-rules]
---

# Fat Models, Skinny Controllers — and Beyond

The traditional Laravel guidance, traced back to Taylor Otwell, is to keep
[[controllers]] **thin** and push database/query logic into **fat** [[models]].
Controllers should concern themselves with HTTP — receiving a request and
returning a response — not orchestrating business rules.

As applications grow, the community refines this further: **business logic that
orchestrates across entities moves out of both controllers and models into a
dedicated layer** ([[services]] or [[actions]]), while models retain rich,
entity-local behavior. The hexagonal/layered view treats services as the business
layer and models/repositories as the data layer — the dependency direction this
implies is formalized in [[dependency-rules]].

> **Avoid the anemic domain trap.** Keep meaningful methods on models where they
> belong (e.g. `Order::markAsPaid()`). Don't strip models down to bare property
> bags and push everything into services — that is the *anemic domain model*
> anti-pattern. **Services orchestrate; models still own entity-local rules.**

This principle is the request-lifecycle application of
[[single-responsibility-principle|SRP]]: each layer changes for one kind of
reason.

**Enforcement.** "Controllers don't touch the database" is the canonical arch
rule — `expect('App\Models')->not->toBeUsedIn('App\Http\Controllers')` (see
[[arch-expectations-dependencies]] and the [[pest-arch-example-suite|annotated
suite]]). Slim models are guarded with `toOnlyUse('Illuminate\Database')`.
