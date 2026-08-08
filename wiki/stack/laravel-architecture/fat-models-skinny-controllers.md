---
title: Fat Models, Skinny Controllers — and What Replaced It
description: The historical guidance and the fleet's refinement — thin controllers, slim models, rich domain. Eloquent models stay persistence-configuration; business behavior lives in actions/services/domain where it is bootlessly testable. The anemic-domain warning applies to the domain layer, not to Eloquent models.
tags: [laravel, architecture, principles, models, controllers]
type: stack
updated: 2026-08-08
related: [laravel-first-principles, single-responsibility-principle, controllers, models, actions, services, dependency-rules, fleet-testing-doctrine]
---

# Fat Models, Skinny Controllers — and What Replaced It

The traditional guidance — keep [[controllers]] **thin**, push logic into **fat**
[[models]] — solved the right problem (business rules leaking into HTTP handlers) with the
tool 2010s-era Laravel had. The fleet keeps its first half verbatim: controllers concern
themselves with HTTP only. The second half is superseded here.

**The fleet position: thin controllers, slim models, rich domain.** A fat Eloquent model
concentrates business rules onto a class that cannot exist without the framework — which
makes the suite boot-bound, exactly what [[fleet-testing-doctrine]] law 1 forbids. So
behavior lives one layer up: [[actions]] for operations, [[services]] for reusable stateless
logic, domain objects/VOs for invariants. The model keeps persistence configuration and may
*answer questions about itself* (`isPaid()`); it does not *decide or cause effects*
(`markAsPaid()` that mutates and dispatches is an Action). The dependency direction is
formalized in [[dependency-rules]]; the escalation path off a fat model is
[[fleet-testing-doctrine]] §6 flaw 7.

> **The anemic-domain warning, aimed correctly.** "Anemic domain model" is a real
> anti-pattern — but it describes a *domain layer* reduced to property bags shuffled by
> procedural services. It is not an argument for fat Eloquent models. A rich domain object
> (a `Money` VO enforcing its invariants, an `Order` aggregate in `App\Domain` with real
> behavior) satisfies the objection *and* stays framework-free. Slim Eloquent models and a
> rich domain are the same decision, not a contradiction.

This principle is the request-lifecycle application of
[[single-responsibility-principle|SRP]]: each layer changes for one kind of reason.

**Enforcement.** "Controllers don't touch the database" is the canonical arch rule —
`expect('App\Models')->not->toBeUsedIn('App\Http\Controllers')` (see
[[arch-expectations-dependencies]] and the [[pest-arch-example-suite|annotated suite]]).
Slim models are guarded with `toOnlyUse('Illuminate\Database')`; the domain's framework-freedom
is the DomainLayer tier's `not->toUse` set.
