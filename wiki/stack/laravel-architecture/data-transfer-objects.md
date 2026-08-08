---
title: Data Transfer Objects (DTOs)
description: Don't pass raw arrays between layers. A DTO is a typed, immutable structure that carries data across boundaries — typically final, readonly, and dependency-free. Mature architectures return DTOs from the data layer instead of Eloquent models.
tags: [laravel, architecture, building-blocks, dto, data]
type: stack
updated: 2026-08-08
related: [laravel-building-blocks, form-requests, repositories, supporting-building-blocks, type-safety-and-strictness, arch-expectations-file-type]
---

# Data Transfer Objects (DTOs)

Don't pass raw arrays between layers. A DTO is a **typed, immutable structure** that
carries data across boundaries, giving you autocompletion, type safety, and a
single source of truth for the shape of the data. DTOs are typically **`final` and
`readonly`, and depend on nothing** — see [[type-safety-and-strictness]].

```php
final readonly class CreatePostData
{
    public function __construct(
        public string $title,
        public string $body,
        public ?CarbonImmutable $publishAt = null,
    ) {}
}
```

A DTO is usually assembled at the boundary by a [[form-requests|Form Request]]
(`toData()`) and consumed by an [[actions|Action]] or [[services|Service]].

**Two DTO species, one rule each** (clarified 2026-08-08 — this page previously recommended
`spatie/laravel-data` in prose while its example rule banned extending anything; the split
below is the actual fleet position):

- **Domain DTOs/VOs** — native `final readonly` classes, framework-free, living in the
  `*\Data`/`ValueObjects` namespaces. The default everywhere.
- **Transport carriers** — `spatie/laravel-data` classes at the HTTP boundary only, as typed
  carriers + the TypeScript source ([[spatie-laravel-data]]): they extend `Data`, stay
  `final readonly`, and **never validate** (validation is the FormRequest's —
  [[fleet-api-specification]] API-302).

A deliberate design choice in mature architectures is to **return DTOs from the data layer**
([[repositories]]) **rather than Eloquent models**, so higher layers never depend on the ORM.

Modern-PHP notes ([[php-language-doctrine]]): `clone with` implements withers without
property-copy boilerplate (8.5); property hooks are fine as **get-only virtual properties** but
stay off carriers' backed properties (serialization bugs); `#[\NoDiscard]` belongs on wither
returns.

**Enforcement.** The bundle's `ValueObjectsTest` states the invariant that holds for **both**
species:

```php
arch('DTOs in Data namespaces are readonly')
    ->expect('App\*\*\Data')
    ->classes()
    ->toBeReadonly();
```

Domain DTOs additionally satisfy `toUseNothing()` in spirit — but that spelling is **not** in
the shared suite, precisely because carriers extend `Data` and domain DTOs legitimately import
`CarbonImmutable`/VOs. An app MAY add a scoped `toExtendNothing()` rule on a
domain-only `Data` namespace where the split is directory-clean. See
[[arch-expectations-file-type]] (`toBeFinal` / `toBeReadonly`) and
[[arch-expectations-dependencies]].
