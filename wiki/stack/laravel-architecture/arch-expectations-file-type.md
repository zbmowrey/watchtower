---
title: Arch Expectations — File Type
description: Expectations that assert what kind of thing files in a namespace are — classes, interfaces, traits, enums (string/int-backed), invokable, abstract, final, readonly.
tags: [pest, arch-testing, expectations, file-type]
type: stack
updated: 2026-06-17
related: [pest-arch-expectations, arch-expectations-inheritance, data-transfer-objects, supporting-building-blocks, actions, services]
---

# Arch Expectations — File Type

Assert what *kind* of thing the files in a namespace are.

| Expectation               | Asserts that files in the namespace…                                     |
|---------------------------|--------------------------------------------------------------------------|
| `toBeClasses()`           | are PHP classes.                                                         |
| `toBeInterfaces()`        | are interfaces.                                                          |
| `toBeTraits()`            | are traits.                                                              |
| `toBeEnums()`             | are enums.                                                               |
| `toBeStringBackedEnums()` | are string-backed enums.                                                 |
| `toBeIntBackedEnums()`    | are int-backed enums.                                                    |
| `toBeInvokable()`         | are invokable (have an `__invoke` method).                               |
| `toBeAbstract()`          | are abstract.                                                            |
| `toBeFinal()`             | are final (pair with the `classes()` modifier). |
| `toBeReadonly()`          | are readonly (pair with the `classes()` modifier).                       |

## Where these land in the manual

- `toBeInvokable()` → [[actions|Actions]] have one public entry point.
- `toBeEnums()` / `toBeStringBackedEnums()` → [[supporting-building-blocks|Enums]].
- `toBeFinal()` + `toBeReadonly()` → [[data-transfer-objects|DTOs]] and value
  objects; also bundled in the [[pest-arch-presets|`strict()` preset]].
- `toBeClasses()` → [[services|Services]] are real classes (then `->toBeFinal()`).

`toBeFinal()` and `toBeReadonly()` typically need the `classes()` modifier so they
don't trip over enums/interfaces in the same namespace — see
[[pest-arch-modifiers]]. For "extends/implements" assertions, see
[[arch-expectations-inheritance]].
