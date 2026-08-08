---
title: Rollout, CI & Living With the Rules
description: How to adopt arch tests incrementally — presets first, then cheap global rules, then layering rules one at a time — run them on every push in CI, and the virtuous loop that makes the suite self-documenting.
tags: [pest, arch-testing, rollout, ci, adoption]
type: stack
updated: 2026-06-17
related: [pest-architecture-testing, pest-arch-presets, pest-arch-example-suite, pest-arch-pitfalls, laravel-engineering-standard]
---

# Rollout, CI & Living With the Rules

## Adopt incrementally

- **Turn on the [[pest-arch-presets|presets]] first** (`php`, `security`,
  `laravel`). Fix or ignore what they surface.
- **Add the global no-debug and strict-types rules** — cheap, high-value, rarely
  contentious.
- **Encode your layering rules** ([[dependency-rules]]) **one at a time.** Use
  `ignoring()` to grandfather legitimate existing exceptions rather than disabling a
  rule wholesale ([[pest-arch-modifiers]]).
- **Tighten over time** — introduce `toBeFinal()`, `toUseNothing()`, and line-count
  budgets once the team is comfortable.

## Run them in CI

Architecture tests are **fast and deterministic**, so run them on every push and
pull request. Tag them so they can also run as a quick standalone gate.

```yaml
# .github/workflows/arch-tests.yml
name: Architecture Tests
on: [push, pull_request]
jobs:
  arch-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - name: Install dependencies
        run: composer install --no-interaction --prefer-dist
      - name: Run architecture tests
        run: ./vendor/bin/pest --group=arch
```

In this repo this runs inside your CI gate rather than GitHub Actions, as part of
the shared `tests/Architecture/` suite in the [[laravel-engineering-standard]].

## The virtuous loop

Architectural testing isn't about enforcing rules for their own sake — it's about
building a **sustainable, maintainable codebase that can evolve with the
business.** Each rule you add converts a tribal-knowledge convention into an
executable, self-documenting guardrail. New contributors learn the architecture by
**reading the arch suite**; the suite, in turn, prevents them (and you) from
eroding it.

> **Decide the shape, encode the shape, and let the tests defend the shape on every
> commit.**

Mind the [[pest-arch-pitfalls|common pitfalls]] as you go.
