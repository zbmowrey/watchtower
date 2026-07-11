---
title: Arch Expectations — Inheritance & Contract
description: Expectations about what classes extend, implement, and use — toExtend, toExtendNothing, toImplement, toOnlyImplement, toImplementNothing, toUseTrait, toUseTraits.
tags: [pest, arch-testing, expectations, inheritance, contracts]
type: stack
updated: 2026-06-17
related: [pest-arch-expectations, models, supporting-building-blocks, repositories, data-transfer-objects]
---

# Arch Expectations — Inheritance & Contract

Assert what classes extend, implement, and which traits they use.

| Expectation                         | Asserts…                                                                |
|-------------------------------------|-------------------------------------------------------------------------|
| `toExtend('...Model')`              | every class extends the given base class.                               |
| `toExtendNothing()`                 | no class extends anything (pure data types).                            |
| `toImplement('...ShouldQueue')`     | every class implements the given interface.                             |
| `toOnlyImplement('...Responsable')` | classes are restricted to implementing **only** the given interface(s). |
| `toImplementNothing()`              | no class implements any interface.                                      |
| `toUseTrait(SoftDeletes::class)`    | every class uses the given trait.                                       |
| `toUseTraits([...])`                | every class uses **all** of the given traits.                           |

## Where these land in the manual

- `toExtend('Illuminate\Database\Eloquent\Model')` → [[models]] extend the base
  model.
- `toImplement('Illuminate\Contracts\Queue\ShouldQueue')` →
  [[supporting-building-blocks|Jobs]] are queueable (see [[queues-async]]).
- `toOnlyImplement('Illuminate\Contracts\Support\Responsable')` → API response
  classes return standardized [[supporting-building-blocks|Responsable]] responses.
- `toExtendNothing()` → [[data-transfer-objects|DTOs]] / value objects are pure
  data, extending nothing.
- `toUseTrait()` / `toUseTraits()` → require e.g. `HasFactory`, `SoftDeletes` on
  models where that's the convention.

Pair with [[arch-expectations-file-type]] (is it even a class/enum?) and narrow
with the `extending()` / `implementing()` / `using()`
[[pest-arch-modifiers|modifiers]].
