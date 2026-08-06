---
title: Laravel runtime traps
description: Framework behaviours that pass every gate and fail in production or in a specific tenancy context — Eloquent hooks that skip inserts, middleware params that never reach terminate(), permission caches that lie per-tenant, session managers that hold stale singletons, and dev-only dependencies that kill runtime factories. Each one cost a real debugging session on the fleet.
tags: [stack, laravel, eloquent, middleware, tenancy, gotcha]
type: stack
status: reference
updated: 2026-08-03
related: [laravel-architecture, laravel-runtime-guardrails, pest-testing]
---

# Laravel runtime traps

Each of these is a framework behaviour that is correct, documented, and completely
counter-intuitive at the call site. They share a signature: **static analysis and the
test suite both pass**, and the failure appears only in production, only under
tenancy, or only on an insert.

## `wasChanged()` is empty on INSERT

A `saved` model hook guarded by `wasChanged('col')` **skips every insert**.
`wasChanged()` compares against the state at the last sync; on a fresh insert there
is nothing to compare, so it returns empty and the guard falls through to "nothing
changed".

Fix: `if ($model->wasRecentlyCreated || $model->wasChanged('col'))`.

Why it bites harder than it looks: rows created lazily on first edit make INSERT the
*common* path, not the edge case, so the hook can appear to work in manual testing
(where you edit an existing row) and silently never fire in production.

## Middleware parameters never reach `terminate()`

`terminate($request, $response)` receives no route parameters. A middleware written as
`handle($request, Closure $next, string $mode = 'default')` and then reading `$mode`
in `terminate()` gets the **default on every request**, including the routes that
passed something else. The parameterised behaviour silently applies everywhere.

Fix: capture what you need in `handle()` (on the instance, or on the request), and
read that in `terminate()`.

## Spatie permission cache lies per-tenant

Re-seeding permissions inside a tenant keeps the **old permission ids** alive in the
tenant-prefixed cache, so `can()` returns answers based on ids that no longer mean
what they did. The symptom is an authorization check that is confidently wrong for
one tenant while every other tenant is fine.

Fix: `forgetCachedPermissions()` **inside `$tenant->run()`**, so the flush lands on
the tenant's own cache prefix rather than the central one.

## Swapping the session cookie per request needs three `forgetInstance` calls

`StartSession` is a **singleton that holds its own session manager**, so rebinding
config alone does not change the cookie actually used. Swapping the session
per-request requires forgetting all three bound instances (`session`,
`session.store`, and the `StartSession` middleware itself) or the previous manager
keeps serving the old cookie.

This is the class of bug where the first request after a swap behaves correctly and
every subsequent one does not, because the singleton survives.

## Faker must be a production require for runtime factories

`fakerphp/faker` in `require-dev` plus a `--no-dev` production image means **any code
path that touches a factory at runtime dies in prod only**. Seeders that run on
deploy are the usual victim.

If the app instantiates factories outside tests (demo tenants, deploy seeding, sample
data), Faker is a production dependency. This is not a lint preference; the image
simply will not contain it otherwise.

## Filament `simple()` repeaters change shape between live and dehydrated state

A `simple()` repeater is **keyed while live** and **dehydrates flat**. Store flat, and
fill test state keyed, or the two disagree and the mismatch surfaces as a validation
error that makes no sense against the visible form.

## A queue worker keeps running the old code

After changing a job's class, the running worker still holds the previous definition,
so a deserialized job hits **methods that no longer exist or behaves as the old
version**. Nothing in the app reports this; the job just misbehaves.

Restart the worker container (`<app>-queue-1`) after any change to a queued class.
The tell is a job failing on a method the current source clearly defines.
