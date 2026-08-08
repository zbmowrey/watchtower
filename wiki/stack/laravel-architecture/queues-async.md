---
title: Queues & Asynchronous Work
description: Pointer shard — the normative rule set for background work (partitioning, job coding rules, worker operations, observability, troubleshooting) is fleet-queue-doctrine. This page keeps only the architecture-manual framing — why queues exist in the performance plan and the arch rule that enforces queueability.
tags: [laravel, performance, queues, jobs, async]
type: stack
updated: 2026-08-08
related: [fleet-queue-doctrine, laravel-performance, supporting-building-blocks, runtime-and-server]
---

# Queues & Asynchronous Work

A performance plan without queues is **incomplete**. Push email, uploads, exports,
notifications, and third-party API calls onto queues so requests **return immediately**.

**Everything normative about queues lives in [[fleet-queue-doctrine]]** — how queues are
partitioned (latency class + blast radius, never by model), how job code is written (thin
envelopes over [[actions]], idempotent handlers, attribute-declared retry policy,
`after_commit` dispatch), how workers run and recycle in production, how queues are observed
(oldest-job **age** is the alert, depth is context), and the symptom→cause troubleshooting
table. This shard deliberately holds no copy of those rules.

The manual-side framing that remains here: queued work is the operational face of the
[[supporting-building-blocks|Jobs building block]] — anything slow becomes a `ShouldQueue` job
whose `handle()` delegates to an [[actions|Action]], keeping the logic bootlessly unit-testable
per [[fleet-testing-doctrine]].

**Enforcement.** Jobs are required to be queueable —
`expect('App\Jobs')->toImplement('Illuminate\Contracts\Queue\ShouldQueue')` (see
[[supporting-building-blocks]] and [[arch-expectations-inheritance]]).
