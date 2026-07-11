---
title: Pest Arch Modifiers
description: Modifiers narrow a rule to a precise subset or carve out legitimate exceptions — ignoring, classes, enums/interfaces/traits, abstracts, extending, implementing, using — plus the global ignore for treating the framework as native.
tags: [pest, arch-testing, modifiers, ignoring]
type: stack
updated: 2026-06-17
related: [pest-architecture-testing, pest-arch-expectations, pest-arch-wildcards, pest-arch-pitfalls, pest-arch-presets]
---

# Pest Arch Modifiers

Modifiers let **one rule apply to a precise subset**, or **carve out legitimate
exceptions** so the rule stays green without being weakened elsewhere.

| Modifier                                | Effect                                                    |
|-----------------------------------------|-----------------------------------------------------------|
| `ignoring('App\Models\User')`           | exclude a namespace/class/function from the rule.         |
| `classes()`                             | restrict the expectation to classes only.                 |
| `enums()` / `interfaces()` / `traits()` | restrict to that file type only.                          |
| `abstracts()`                           | restrict to abstract classes only.                        |
| `extending(Model::class)`               | restrict to classes/interfaces extending the given class. |
| `implementing(ShouldQueue::class)`      | restrict to classes implementing the given interface.     |
| `using(HasFactory::class)`              | restrict to classes that use the given trait.             |

Modifiers also work on [[pest-arch-presets|presets]] — e.g.
`arch()->preset()->security()->ignoring('md5')` softens a preset without abandoning
it.

## Global ignores

To treat the framework as "native" and focus only on **your own** dependencies, add
a global ignore in `tests/Pest.php`:

```php
pest()->beforeEach(fn () => $this->arch()->ignore(['Illuminate'])->ignoreGlobalFunctions());
```

> **`ignoring()` is a documented exception, not a hiding place.** Every ignore is a
> recorded decision; review them periodically. A rule that's mostly ignores is
> telling you the convention is wrong. See [[pest-arch-pitfalls]].

For matching many namespaces at once (rather than excepting), see
[[pest-arch-wildcards]].
