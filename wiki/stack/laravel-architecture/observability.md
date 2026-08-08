---
title: Observability
description: The fleet's observability stack is what the spec mandates — Sentry for errors, structured JSON to stderr → Loki → Grafana for logs/alerts, the scheduler heartbeat, the queue age exporter — plus Context-carried correlation IDs and slow-query/lifecycle hooks. Telescope/Debugbar are local-dev microscopes, not the production story. Pulse and Nightwatch: considered, not adopted.
tags: [laravel, performance, observability, logging, sentry, grafana]
type: stack
updated: 2026-08-08
related: [laravel-performance, eloquent-performance, fleet-queue-doctrine, laravel-runtime-guardrails, services, supporting-building-blocks]
---

# Observability

The production observability stack is **mandated by [[fleet-app-specification]] §5**, not
chosen per app: **Sentry** owns error aggregation and release attribution; application logs go
to **stderr as structured JSON** → Alloy → **Loki**, queried and alerted in **Grafana**; the
**Discord error leg** is the human-notification channel; the **scheduler heartbeat** is the
dead-man switch; the **queue age exporter** is [[fleet-queue-doctrine]] §5. This page is the
manual-side judgment layer on top of that stack.

## Correlation — make one request traceable end to end

**Use Laravel's `Context`.** A middleware sets `Context::add('request_id', …)` (plus tenant and
authenticated-principal identifiers where they exist) at the HTTP edge; Context automatically
rides into every log line **and dehydrates into queued jobs**, so "which request queued this
job?" is a single Loki query. This is the piece that turns structured logs from *searchable*
into *followable*. Sentry carries its own trace IDs; put the request-id in Sentry tags so the
two systems join.

## Latency tripwires — cheap, first-party, underused

Boot-time hooks that convert "it feels slow" into a reported event, all candidates for the
per-domain provider (not the byte-identical `AppServiceProvider`):

- `DB::whenQueryingForLongerThan(500, fn (...) => report(...))` — sustained slow queries.
- `whenRequestLifecycleIsLongerThan(...)` / `whenCommandLifecycleIsLongerThan(...)` — whole
  request/command budgets.

Route them through `report()` so they land in Sentry + the Discord leg with Context attached —
never a bare `Log::warning` that nobody alerts on.

## Local-dev microscopes

**Telescope and Debugbar are development tools** — excellent for hunting the N+1s called out in
[[eloquent-performance]] locally, never deployed to production pods (the hardened image has no
place for their routes, storage, or overhead). Profilers (SPX, Blackfire) are reached for on
evidence, not installed by default.

## Considered, not adopted

- **Pulse** — self-hosted and fine, but its dashboards duplicate what Grafana already renders
  from Loki + the exporters, and it adds a storage/auth surface per app. Revisit if a per-app
  in-product ops view becomes a requirement.
- **Nightwatch** — Laravel-native SaaS monitoring; overlaps Sentry (errors) + Grafana
  (metrics). Adopting it would replace two working legs to gain one vendor. Revisit only on a
  consolidation push.
- **OpenTelemetry** — the eventual lingua franca; not adopted until a consumer exists (a
  tracing backend we actually run). When it comes, it layers behind `Context`, not instead of it.

> **Architecture-test angle.** The hygiene side of observability is statically
> enforceable: **ban `dd()`/`dump()`/`var_dump()`/`ray()` in committed code** so
> debugging output never reaches the repo:
>
> ```php
> arch('no debug output')
>     ->expect(['dd', 'dump', 'var_dump', 'ray', 'die'])
>     ->not->toBeUsed();
> ```
>
> See [[arch-expectations-dependencies]] (`not->toBeUsed`) and the
> [[pest-arch-presets|`php()` preset]], which bans `die`/`var_dump` and similar.
