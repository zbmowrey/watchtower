---
title: The Transport Layer Must Stay Transport-Only
description: App\Http depends on the domain, never the reverse. Domain code must not reach back into HTTP — no request() helper, no Illuminate\Http in the business layer. This is what keeps business logic reusable across controllers, commands, jobs, and tests.
tags: [laravel, architecture, structure, boundary, transport]
type: stack
updated: 2026-06-17
related: [laravel-app-structure, dependency-rules, validate-at-the-boundary, services, actions, arch-expectations-dependencies]
---

# The Transport Layer Must Stay Transport-Only

Whichever structure you pick — [[layered-structure|layered]] or
[[domain-oriented-structure|domain-oriented]] — the **`App\Http` namespace should
depend on the domain, never the other way around.**

Domain code must **not** reach back into HTTP concerns:

- no `request()` helper,
- no `Illuminate\Http` types inside your business layer.

Keeping [[services]] and [[actions]] **transport-agnostic** is what lets the same
logic run from a controller, a console command, a queued [[supporting-building-blocks|job]], or a test —
unchanged. This is the structural payoff of
[[validate-at-the-boundary|validating at the boundary]]: HTTP concerns (parsing,
validation) live at the edge; everything inward receives clean, typed data.

This is one row in the full [[dependency-rules|dependency rules]], and it is
directly enforceable.

**Enforcement.** Two complementary rules (see [[arch-expectations-dependencies]]
and the [[pest-arch-example-suite|annotated suite]]):

```php
// The HTTP layer is self-contained — nothing else may live inside it.
arch('http stays in http')
    ->expect('App\Http')
    ->toOnlyBeUsedIn('App\Http');

// No request() helper or HTTP types leak into the domain.
arch('domain is transport-agnostic')
    ->expect('App\Domains')
    ->not->toUse(['request', 'Illuminate\Http']);
```
