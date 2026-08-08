---
title: Type Safety and Strictness
description: Use strict_types across the codebase (a deliberate divergence — the framework itself doesn't) and prefer type-safe === comparison. Version-shaped language-feature rulings live in php-language-doctrine; this page keeps the spelling-level rules and their arch enforcement.
tags: [laravel, architecture, principles, strict-types, php8]
type: stack
updated: 2026-08-08
related: [laravel-first-principles, php-language-doctrine, data-transfer-objects, supporting-building-blocks, pest-arch-presets]
---

# Type Safety and Strictness

- Use **strict types** (`declare(strict_types=1);`) across the entire codebase.
  Own the divergence: `laravel/framework` itself does not use strict types — the fleet
  deliberately holds app code to a stricter bar than the framework holds itself.
- Prefer the type-safe **`===`** comparison by default. There are very few cases
  where you genuinely don't know the type, so `==` should be the rare exception.
- **Which modern language features fleet code uses — and which are deferred or banned — is
  owned by [[php-language-doctrine]]** (the 8.3/8.4/8.5 rulings: `#[\Override]` mandate,
  property hooks, asymmetric visibility, `clone with`, the pipe-operator deferral, and the
  typed-boundary idioms that make PHPStan levels 9/10 tractable). This page keeps only the
  two spelling-level rules above.

These features are what make the pure-data building blocks possible —
[[data-transfer-objects|DTOs]] and value objects are `final readonly`, and fixed
sets are modeled as backed enums (see [[supporting-building-blocks]]).

**Enforcement.** This principle is among the most directly testable:

- `expect('App')->toUseStrictTypes()` — strict types everywhere.
- `toUseStrictEquality()` — `===` over `==`.
- The [[pest-arch-presets|`strict()` preset]] bundles strict types + final classes
  and more.

See [[arch-expectations-structure-hygiene]]. Note the caveat: mixing `==` and
`===` across the codebase trips `toUseStrictEquality()`, so adopt a
formatter/Rector pass alongside the rule ([[pest-arch-pitfalls]]).
