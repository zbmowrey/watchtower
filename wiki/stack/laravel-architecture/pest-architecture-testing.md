---
title: Enforcing It All with Pest Architecture Tests
description: Pest's architecture testing encodes every Laravel convention as an executable expectation — expressed against namespaces, FQCNs, or function names, not behavior. Setup, the arch()/expect() model, and the map of presets, expectations, modifiers, and wildcards.
tags: [pest, arch-testing, architecture, laravel, enforcement]
type: stack
updated: 2026-06-17
related: [laravel-architecture-manual, dependency-rules, pest-arch-presets, pest-arch-expectations, pest-arch-modifiers, pest-arch-wildcards, pest-arch-example-suite, pest-arch-rollout, pest-testing]
---

# Enforcing It All with Pest Architecture Tests

This is the enforcement layer the [[laravel-architecture-manual|manual]] builds
toward. Pest's architecture testing lets you encode **every convention** in Parts
I–V as an executable expectation. Rules are expressed against **namespaces,
fully-qualified class names, or function names** using the `arch()` function and the
`expect()` API — you are testing **shape, not logic** (see [[dependency-rules]]).

## Setup

Install Pest and the Laravel plugin, then create a dedicated architecture test
file.

```bash
composer require pestphp/pest --dev --with-all-dependencies
composer require pestphp/pest-plugin-laravel --dev
php artisan pest:install

# Conventionally:  tests/Arch/ArchTest.php  (or tests/Feature/ArchTest.php)
```

A common practice is to **group** these tests so they can run alone in CI: tag them
and invoke `./vendor/bin/pest --group=arch`. See [[pest-arch-rollout]] for the CI
workflow.

## The four moving parts

1. **[[pest-arch-presets|Presets]]** — `arch()->preset()->php()` /
   `security()` / `laravel()` / `strict()`. Turn these on **first**; they cover
   broadly-agreed expectations in one line each.
2. **[[pest-arch-expectations|The expectation vocabulary]]** — granular rules
   chained off `expect()`, grouped into file-type, naming, dependency,
   inheritance, and structure/hygiene families.
3. **[[pest-arch-modifiers|Modifiers]]** — `ignoring()`, `classes()`,
   `extending()`, … — narrow a rule to a subset or carve out legitimate
   exceptions.
4. **[[pest-arch-wildcards|Wildcards]]** — `*` namespace matching (Pest 3.8+) for
   cross-cutting subdirectory conventions.

## Then put it together

- [[pest-arch-example-suite]] — a complete, annotated, ready-to-adapt suite.
- [[pest-arch-rollout]] — adopt incrementally, run in CI, and the virtuous loop.
- [[pest-arch-pitfalls]] — what to avoid.

In this repo this is operationalized as the shared `tests/Architecture/` suite in
the [[laravel-engineering-standard]]; for per-repo Pest facts see [[pest-testing]].
