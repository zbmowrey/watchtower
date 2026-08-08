---
title: Domain-Oriented (Domain-Driven) Structure
description: Group code by business domain rather than technical layer, so the code mirrors the business. Pays off once the application is genuinely large; codify the inward-dependency rule as a custom arch preset.
tags: [laravel, architecture, structure, ddd]
type: stack
updated: 2026-06-17
related: [laravel-app-structure, layered-structure, transport-layer-boundary, dependency-rules, pest-arch-presets]
---

# Domain-Oriented (Domain-Driven) Structure

**Approach B.** As the application grows, grouping by technical layer scatters a
single feature across a dozen directories. **Domain-Driven** organization groups
code by **business domain** instead, so the code mirrors the business. Onboarding
is faster because the structure tells the story.

```
app/
├── Domains/
│   ├── Ordering/
│   │   ├── Actions/
│   │   ├── Models/
│   │   ├── DataTransferObjects/
│   │   ├── Events/
│   │   ├── Listeners/
│   │   └── Policies/
│   ├── Billing/
│   │   ├── Actions/
│   │   ├── Services/
│   │   └── DataTransferObjects/
│   └── Catalog/
│       ├── Models/
│       └── Queries/
├── Http/                 Thin transport layer stays central
│   ├── Controllers/
│   └── Requests/
└── Support/              Truly cross-cutting helpers
```

> **Rule of thumb.** Start [[layered-structure|layered]]. Migrate to domains when a
> feature consistently spans many directories and teams start stepping on each
> other. Don't pay the ceremony cost of DDD on a CRUD app — several practitioners
> note DDD feels like overkill until the app is genuinely large, at which point it
> pays off in debuggability.

Even here, the [[transport-layer-boundary|transport layer stays central and
transport-only]]: `Http/` depends on the domains, never the reverse.

**Enforcement.** Codify the inward-dependency rule **once** as a reusable
[[pest-arch-presets|custom preset]] and apply it across the domains:

```php
// tests/Pest.php
pest()->presets()->custom('ddd', function () {
    return [
        expect('App\Domains')->not->toUse(['Illuminate\Http', 'App\Http']),
        expect('App\Support')->not->toUse('App\Http'),
    ];
});

// any arch test file
arch()->preset()->ddd();
```

*(Fixed 2026-08-08: the preset previously asserted on `App\Infrastructure`/`App\Application` —
namespaces this page's own tree doesn't define. It now guards the documented shape:
`App\Domains` + `App\Support`, with `Http/` central. An app running the hexagonal
`Domain`/`Infrastructure` split uses the bundle's tiered suite instead — see the
`standards/laravel/tests/Architecture/` README. **This page owns the `ddd` preset definition**;
[[pest-arch-presets]] and [[pest-arch-example-suite]] point here rather than restating it.)*

The wildcard syntax (`App\*\Traits`) is especially useful for cross-cutting
subdirectory conventions in this layout — see [[pest-arch-wildcards]].
