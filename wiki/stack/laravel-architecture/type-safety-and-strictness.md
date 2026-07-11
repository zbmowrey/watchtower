---
title: Type Safety and Strictness
description: Use strict_types across the codebase, prefer type-safe === comparison, and lean on PHP 8+ features — readonly properties, enums, constructor property promotion, typed signatures.
tags: [laravel, architecture, principles, strict-types, php8]
type: stack
updated: 2026-06-17
related: [laravel-first-principles, data-transfer-objects, supporting-building-blocks, pest-arch-presets]
---

# Type Safety and Strictness

- Use **strict types** (`declare(strict_types=1);`) across the entire codebase.
- Prefer the type-safe **`===`** comparison by default. There are very few cases
  where you genuinely don't know the type, so `==` should be the rare exception.
- Lean on **PHP 8+ features**: `readonly` properties, enums, constructor property
  promotion, and first-class typed signatures.

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
