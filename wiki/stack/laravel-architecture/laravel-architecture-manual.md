---
title: The Well-Architected Laravel Application (Manual Hub)
description: Top entry point for the Laravel architecture + Pest arch-testing manual — the two-pass structure (architect the app, then enforce the shape), and the full map of sharded pages.
tags: [laravel, architecture, arch-testing, pest, hub]
type: stack
updated: 2026-06-17
related: [laravel-first-principles, laravel-app-structure, laravel-building-blocks, dependency-rules, laravel-performance, pest-architecture-testing, pest-arch-example-suite, laravel-engineering-standard]
---

# The Well-Architected Laravel Application

An encyclopedic manual of patterns, practices, and **Pest architecture
enforcement** — how a Laravel app *should* be structured for clarity,
maintainability, and performance, and how to lock that shape in with automated
arch tests so the rules defend themselves on every commit.

This is the hub for a sharded manual. Search it with `bin/wiki`, or
`inject --page laravel-architecture-manual --depth 1` to pull the section hubs.

## Read it in two passes

The manual is built to be read in two passes, and the wiki mirrors that split:

1. **The architectural manual** (Parts I–V) — how a Laravel application should be
   structured. Start at [[laravel-first-principles]].
2. **The enforcement layer** (Parts VI–VIII) — how to translate every principle
   above into an automated **Pest architecture test**, so the rules are
   self-defending. Start at [[pest-architecture-testing]].

Each enforcement rule is cross-referenced to the principle it protects — and each
principle page links forward to the rule that guards it. That bidirectional link
*is* the point: the architectural diagram and the test file become the same
artifact.

## The guiding philosophy

Everything below is downstream of two ideas the Laravel community converges on:
**convention over configuration** paired with the **single responsibility
principle**. See [[single-responsibility-principle]].

> **Core idea — testing shape, not logic.** Architecture testing lets you specify
> expectations that verify your app adheres to a set of architectural rules. The
> rules are expressed against **namespaces, fully-qualified class names, or
> function names** — *not* behavior. An arch test is only worth writing once
> you've decided what the convention is. Decide the shape, encode the shape, let
> the tests defend the shape.

## Map of the manual

**Part I — [[laravel-first-principles|First Principles: the "Laravel Way"]]**
[[single-responsibility-principle|SRP]] ·
[[fat-models-skinny-controllers]] ·
[[dry-principle|DRY]] ·
[[framework-conventions-first|prefer framework conventions]] ·
[[validate-at-the-boundary]] ·
[[type-safety-and-strictness]]

**Part II — [[laravel-app-structure|Structuring the Application]]**
[[layered-structure|layered (type-based)]] ·
[[domain-oriented-structure|domain-oriented (DDD)]] ·
[[transport-layer-boundary|the transport boundary]]

**Part III — [[laravel-building-blocks|The Building Blocks]]**
[[controllers]] · [[form-requests]] · [[actions]] · [[services]] ·
[[data-transfer-objects|DTOs]] · [[repositories]] · [[query-builders]] · [[models]] ·
[[supporting-building-blocks|enums / value objects / events / jobs / resources]]

**Part IV — [[dependency-rules|The Dependency Rules]]** — the heart of arch testing.

**Part V — [[laravel-performance|Performance & Operational Excellence]]**
[[eloquent-performance]] · [[caching]] · [[queues-async]] ·
[[runtime-and-server]] · [[observability]]

**Part VI — [[pest-architecture-testing|Enforcing It All with Pest]]**
[[pest-arch-presets|presets]] · [[pest-arch-expectations|the expectation vocabulary]] ·
[[pest-arch-modifiers|modifiers]] · [[pest-arch-wildcards|wildcards]]

**Part VII — [[pest-arch-example-suite|A Complete, Annotated Arch Suite]]**

**Part VIII — Rollout & living with the rules**
[[pest-arch-rollout|adopt incrementally + CI]] · [[pest-arch-pitfalls|common pitfalls]]

**Appendix — [[laravel-architecture-references|Key references]]**

## Where this connects

This manual is the *conceptual reference* behind the
[[laravel-engineering-standard]] — the standard's "architectural controls" and the
shared `tests/Architecture/` suite are this manual, applied. For the
project-specific Pest facts (versions, coverage gates per repo), see
[[pest-testing]].
