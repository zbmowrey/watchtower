---
title: Single Responsibility Principle (SRP)
description: A class and a method should have one, and only one, reason to change — the most-cited rule in the Laravel best-practices canon and the root of most others.
tags: [laravel, architecture, principles, srp]
type: stack
updated: 2026-06-17
related: [laravel-first-principles, fat-models-skinny-controllers, controllers, actions, services]
---

# Single Responsibility Principle (SRP)

A class and a method should have **one, and only one, reason to change.** This is
the most-cited rule in the community best-practices canon and the root of nearly
every other guideline in [[laravel-first-principles|first principles]].

When a controller validates input, talks to the database, formats a response,
sends an email, and writes a log line, it has at least five reasons to change.
That is the smell SRP exists to catch.

> **The "and" test.** Methods should do just one thing. If you find yourself
> describing a method with "and," it is doing too much. **Extract.**

SRP is *why* the rest of the manual splits work across narrow building blocks:
thin [[controllers]] (HTTP only), [[actions]] (one business operation each),
[[services]] (cohesive orchestration), and rich-but-bounded [[models]]. It pairs
with [[fat-models-skinny-controllers]] as the practical application of "one reason
to change" to the request lifecycle.

**Enforcement.** SRP itself is a design judgement, but its consequences are
statically checkable: single-action invokable controllers and one-entry-point
actions ([[arch-expectations-file-type|`toBeInvokable()`]]), slim models
([[arch-expectations-dependencies|`toOnlyUse()`]]), and even a per-file size budget
([[arch-expectations-structure-hygiene|`toHaveLineCountLessThan()`]]).
