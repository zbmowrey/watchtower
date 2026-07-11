---
title: Data Transfer Objects (DTOs)
description: Don't pass raw arrays between layers. A DTO is a typed, immutable structure that carries data across boundaries — typically final, readonly, and dependency-free. Mature architectures return DTOs from the data layer instead of Eloquent models.
tags: [laravel, architecture, building-blocks, dto, data]
type: stack
updated: 2026-06-17
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

The community frequently reaches for **`spatie/laravel-data`** to add nested
casting, validation, and serialization to DTOs. A deliberate design choice in
mature architectures is to **return DTOs from the data layer**
([[repositories|repositories]]) **rather than Eloquent models**, so higher layers
never depend on the ORM.

**Enforcement.** DTOs are the purest data type, and the arch suite states that
plainly:

```php
arch('DTOs are final, readonly, dependency-free')
    ->expect('App\DataTransferObjects')
    ->toBeFinal()
    ->toBeReadonly()
    ->toExtendNothing()
    ->toUseNothing();
```

See [[arch-expectations-file-type]] (`toBeFinal` / `toBeReadonly`) and
[[arch-expectations-dependencies]] (`toUseNothing`).
