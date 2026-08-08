---
title: Runtime & Server
description: The fleet runtime is FrankenPHP (classic mode) on the hardened two-image build — a deliberate ruling, with Octane worker mode as a measured-need ratchet gated on the singleton-contamination rules. Keep PHP current per the spec, OPcache on, assets CDN'd via Vite, dependencies lean.
tags: [laravel, performance, runtime, opcache, octane, frankenphp, server]
type: stack
updated: 2026-08-08
related: [laravel-performance, caching, fleet-queue-doctrine, php-language-doctrine]
---

# Runtime & Server

- **The fleet runtime is FrankenPHP, classic mode** (per-request lifecycle), on the spec's
  hardened two-image build — now also the ecosystem's default direction (Octane documents
  FrankenPHP first). PHP version and image tags are owned by [[fleet-app-specification]] §1;
  keep OPcache on (always loaded as of PHP 8.5) and consider **JIT** only for measured
  CPU-bound work.
- **Octane / worker mode is a named ratchet, not the default** (ruled 2026-08-08). Worker mode
  keeps the framework booted between requests for real throughput gains, at the price of a new
  bug class: **singleton contamination** — never inject the container, request, or config
  repository into singleton constructors; no static accumulation; `register`/`boot` run once
  per worker. An app adopts worker mode only on a measured throughput need, and adopting it
  brings those rules plus their arch-test guards in the same PR. Until then, classic mode's
  per-request isolation is a feature, not a limitation.
- **`opcache.preload`** — evaluated with worker mode, not before: classic-mode gains are
  modest on an alpine image with warm OPcache, and a bad preload script is a fleet-wide
  boot failure mode.
- **CDN + asset bundling** — serve static assets via a CDN; bundle with **Vite**;
  compress images.
- **Lean dependencies** — remove unused packages and reduce autoloaded service providers to
  cut boot overhead (the spec's composer-unused/require-checker gates keep this honest).

These pair with the deploy-time [[caching|framework caches]] (`config:cache`,
`route:cache`, …) to minimize per-request and boot cost ([[laravel-performance]]).
