---
title: Pest Arch Wildcards
description: Since Pest 3.8 you can match multiple namespaces with *, ideal for cross-cutting subdirectory conventions like App\*\Traits across a domain-oriented structure.
tags: [pest, arch-testing, wildcards, namespaces]
type: stack
updated: 2026-06-17
related: [pest-architecture-testing, pest-arch-modifiers, domain-oriented-structure, laravel-architecture-references]
---

# Pest Arch Wildcards

Since **Pest 3.8** you can match multiple namespaces with `*`, which is ideal for
cross-cutting subdirectory conventions — especially in a
[[domain-oriented-structure|domain-oriented layout]] where the same subdirectory
shape repeats across many domains.

```php
arch()
    ->expect('App\*\Traits')      // App\Models\Traits, App\Billing\Traits, ...
    ->toBeTraits();

arch()
    ->expect('App\*\*\Traits')    // two levels deep
    ->toBeTraits();
```

This complements [[pest-arch-modifiers|modifiers]]: wildcards **broaden** which
namespaces a rule matches, while `ignoring()` **excepts** specific ones.

> **Version caveat.** Wildcards require Pest **3.8+**. Verify against the docs for
> your installed version ([[laravel-architecture-references]]).
