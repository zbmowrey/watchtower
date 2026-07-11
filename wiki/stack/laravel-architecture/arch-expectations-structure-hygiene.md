---
title: Arch Expectations — Method, Structure & Hygiene
description: Expectations about the surface and hygiene of a class — methods present, public/protected/private surface limits, constructors, attributes, docblocks, line-count budgets, strict types, strict equality, and filesystem permissions.
tags: [pest, arch-testing, expectations, hygiene, structure, strict-types]
type: stack
updated: 2026-06-17
related: [pest-arch-expectations, type-safety-and-strictness, single-responsibility-principle, controllers, pest-arch-pitfalls]
---

# Arch Expectations — Method, Structure & Hygiene

Constrain the surface and hygiene of classes and files.

| Expectation                                                  | Asserts…                                                 |
|--------------------------------------------------------------|----------------------------------------------------------|
| `toHaveMethod('index')` / `toHaveMethods([...])`             | the class exposes the given method(s).                   |
| `not->toHavePublicMethodsBesides([...])`                     | the class exposes no public methods beyond those listed. |
| `not->toHaveProtectedMethods()` / `Besides([...])`           | constrains protected method surface.                     |
| `not->toHavePrivateMethods()` / `Besides([...])`             | constrains private method surface.                       |
| `toHaveConstructor()` / `toHaveDestructor()`                 | the class defines `__construct` / `__destruct`.          |
| `toHaveAttribute('...AsCommand')`                            | the class carries the given PHP attribute.               |
| `toHaveMethodsDocumented()` / `toHavePropertiesDocumented()` | members carry docblocks.                                 |
| `toHaveLineCountLessThan(100)`                               | files stay under a size budget.                          |
| `toUseStrictTypes()`                                         | every file declares `strict_types`.                      |
| `toUseStrictEquality()`                                      | code uses `===` rather than `==`.                        |
| `not->toHaveFileSystemPermissions('0777')`                   | files don't carry over-permissive permissions.           |

## Where these land in the manual

- `toUseStrictTypes()` + `toUseStrictEquality()` → [[type-safety-and-strictness]]
  (also in the [[pest-arch-presets|`strict()` preset]]).
- `not->toHavePublicMethodsBesides([...])` → keep [[controllers]] to the RESTful
  seven; keep [[actions]] to one entry point.
- `toHaveLineCountLessThan()` → a size budget that pressures
  [[single-responsibility-principle|SRP]].

> **Caveat.** `toUseStrictEquality()` trips if `==` and `===` are mixed across the
> codebase — adopt a formatter/Rector pass alongside it ([[pest-arch-pitfalls]]).
