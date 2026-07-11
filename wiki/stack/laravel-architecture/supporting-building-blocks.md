---
title: Enums, Value Objects, Events, Jobs & Resources
description: The supporting cast — backed enums for fixed sets, small readonly value objects, events/listeners to decouple side effects, queued jobs for slow work, and API resources to shape JSON. Each maps to a distinct arch rule.
tags: [laravel, architecture, building-blocks, enums, value-objects, events, jobs, resources]
type: stack
updated: 2026-06-17
related: [laravel-building-blocks, data-transfer-objects, actions, queues-async, type-safety-and-strictness, arch-expectations-file-type, arch-expectations-inheritance]
---

# Enums, Value Objects, Events, Jobs & Resources

The supporting cast of [[laravel-building-blocks|building blocks]]. Each is small,
has a single job, and maps to a distinct [[pest-architecture-testing|arch rule]].

## Enums

Model fixed sets (statuses, types) as **backed enums**. Prefer them over magic
strings/numbers; use class constants for any remaining magic numbers to give them
context.
*Enforcement:* `expect('App\Enums')->toBeEnums()` (or
`toBeStringBackedEnums()` / `toBeIntBackedEnums()` — see
[[arch-expectations-file-type]]).

## Value Objects

Small, **`final`, `readonly`, dependency-free** types that wrap a concept (`Money`,
`EmailAddress`) with validation in the constructor. Cousins of
[[data-transfer-objects|DTOs]]; both lean on
[[type-safety-and-strictness|PHP 8+ readonly]].
*Enforcement:* `expect('App\ValueObjects')->classes()->toBeFinal()->toBeReadonly()`.

## Events & Listeners

**Decouple side effects.** The [[actions|Action]] raises `PostPublished`; listeners
send notifications, update read models, etc. This keeps the action focused on its
one operation.

## Jobs

Anything **slow** (email, uploads, exports, notifications, external API calls)
should be asynchronous. Jobs implement `ShouldQueue`. See [[queues-async]].
*Enforcement:* `expect('App\Jobs')->toImplement('Illuminate\Contracts\Queue\ShouldQueue')`
— see [[arch-expectations-inheritance]].

## API Resources

Transform models into JSON responses in **one standard place**, so controllers
don't hand-format arrays and you never leak model internals.
*Enforcement:* API response classes restricted to implementing only `Responsable`:
`expect('App\Http\Responses')->toOnlyImplement('Illuminate\Contracts\Support\Responsable')`.
