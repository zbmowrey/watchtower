---
title: Pest Arch Presets
description: Predefined arch rule bundles — php(), security(), laravel(), strict(), relaxed(), custom() — that encode broadly-agreed expectations in a single line each. Turn these on before hand-writing granular rules.
tags: [pest, arch-testing, presets, laravel]
type: stack
updated: 2026-06-17
related: [pest-architecture-testing, pest-arch-expectations, pest-arch-modifiers, domain-oriented-structure, pest-arch-rollout]
---

# Pest Arch Presets

Before hand-writing rules, switch on the **predefined presets**. They encode
broadly-agreed expectations and give you coverage in a single line each.

```php
arch()->preset()->php();        // bans die/var_dump, deprecated PHP functions  (needs intl)
arch()->preset()->security();   // bans eval, md5, and similar risky calls
arch()->preset()->laravel();    // enforces Laravel structural conventions
arch()->preset()->strict();     // strict_types everywhere, final classes, and more
```

| Preset       | What it enforces                                                                                                     |
|--------------|----------------------------------------------------------------------------------------------------------------------|
| `php()`      | Avoids `die`, `var_dump` and similar; flags deprecated PHP functions. **Requires the `intl` extension.**             |
| `security()` | Forbids code that invites vulnerabilities — `eval`, `md5`, and similar functions.                                    |
| `laravel()`  | Laravel conventions: [[controllers]] suffixed `Controller` with only the standard RESTful public methods, and so on. |
| `strict()`   | Strict types in every file, all classes `final`, and other strictness rules ([[type-safety-and-strictness]]).        |
| `relaxed()`  | The inverse of `strict()` — non-final, non-strict; for legacy or gradual adoption.                                   |
| `custom()`   | Define and reuse your own named preset across projects or in a plugin.                                               |

> **Tip.** Presets accept the same [[pest-arch-modifiers|modifiers]] as granular
> rules, so you can **soften** a preset without abandoning it, e.g.
> `arch()->preset()->security()->ignoring('md5');`.

## Custom presets

The `custom()` preset is how a [[domain-oriented-structure|domain-structured app]]
codifies its inward-dependency rule once and reuses it:

```php
// tests/Pest.php
pest()->presets()->custom('ddd', function () {
    return [
        expect('App\Infrastructure')->toOnlyBeUsedIn('App\Application'),
        expect('App\Domains')->not->toUse('Illuminate\Http'),
    ];
});

arch()->preset()->ddd();
```

Adopt presets **first** in the [[pest-arch-rollout|rollout]] — they're the
cheapest, highest-value step. Note the `intl` caveat for `php()` in CI
([[pest-arch-pitfalls]]).
