---
title: Queues & Asynchronous Work
description: A performance plan without queues is incomplete. Push email, uploads, exports, notifications, and third-party API calls onto queues so requests return immediately; use Redis or a dedicated backend and run workers under a supervisor.
tags: [laravel, performance, queues, jobs, async]
type: stack
updated: 2026-06-17
related: [laravel-performance, supporting-building-blocks, runtime-and-server]
---

# Queues & Asynchronous Work

A performance plan without queues is **incomplete**. Push email, uploads, exports,
notifications, and third-party API calls onto queues so requests **return
immediately**. Use Redis or a dedicated queue backend and run workers under a
**supervisor**.

This is the operational side of the [[supporting-building-blocks|Jobs building
block]]: anything slow becomes a `ShouldQueue` job, dispatched (typically) from an
[[actions|Action]] and processed off the request cycle.

**Enforcement.** Jobs are required to be queueable —
`expect('App\Jobs')->toImplement('Illuminate\Contracts\Queue\ShouldQueue')` (see
[[supporting-building-blocks]] and [[arch-expectations-inheritance]]).
