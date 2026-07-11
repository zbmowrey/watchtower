---
title: The Pest Arch Expectation Vocabulary
description: Granular arch rules are built from expectations chained off expect(). The full vocabulary, organized into five families — file-type, naming/casing, dependency, inheritance/contract, and structure/hygiene.
tags: [pest, arch-testing, expectations, laravel]
type: stack
updated: 2026-06-17
related: [pest-architecture-testing, arch-expectations-file-type, arch-expectations-naming, arch-expectations-dependencies, arch-expectations-inheritance, arch-expectations-structure-hygiene, pest-arch-modifiers]
---

# The Pest Arch Expectation Vocabulary

Granular rules are built from expectations chained off `expect()`. The full
vocabulary divides into **five families**, each on its own page:

1. **[[arch-expectations-file-type|File-type]]** — what *kind* of thing a file is:
   `toBeClasses()`, `toBeInterfaces()`, `toBeEnums()`, `toBeInvokable()`,
   `toBeFinal()`, `toBeReadonly()`, …
2. **[[arch-expectations-naming|Naming & casing]]** — `toHaveSuffix()`,
   `toHavePrefix()`, `toBeCasedCorrectly()`, `toHaveSuspiciousCharacters()`.
3. **[[arch-expectations-dependencies|Dependency]]** — *the core of layering*:
   `toOnlyBeUsedIn()`, `toBeUsedIn()`, `toOnlyUse()`, `toUse()`, `toUseNothing()`,
   `toBeUsed()`.
4. **[[arch-expectations-inheritance|Inheritance & contract]]** — `toExtend()`,
   `toImplement()`, `toOnlyImplement()`, `toUseTrait()`, and their `*Nothing()`
   forms.
5. **[[arch-expectations-structure-hygiene|Method, structure & hygiene]]** —
   method surface, constructors, attributes, docblocks, line-count budgets,
   `toUseStrictTypes()`, `toUseStrictEquality()`.

Every expectation can be narrowed or excepted with a
**[[pest-arch-modifiers|modifier]]** (`ignoring()`, `classes()`, `extending()`, …),
and matched across namespaces with a **[[pest-arch-wildcards|wildcard]]** (`*`).

Which expectation enforces which principle is mapped throughout the
[[laravel-architecture-manual|manual]] and assembled in the
[[pest-arch-example-suite|annotated suite]]. The dependency family in particular
implements the [[dependency-rules]] table row-for-row.
