---
title: A/B Testing Statistics
description: "Direct execution checklist for A/B Testing Statistics — what to do, when to use it, how to execute, what to watch, and what to avoid."
tags: [growth, conversion, experimentation, statistics]
type: growth
status: reference
updated: 2026-07-04
related: [cro-process, funnel-metrics, analytics-stack, dashboards-alerting]
---

# A/B Testing Statistics

Use this to decide whether a test can produce a reliable readout.

## Do

- Define primary metric before launch.
- Calculate sample size and minimum detectable effect.
- Run long enough to cover normal business cycles.
- Check sample-ratio mismatch.
- Avoid peeking.
- Separate exploratory segment reads from primary decisions.
- Document result and decision.

## When

- Use A/B tests for high-traffic pages or flows.
- Use just-ship measurement for low-traffic, high-confidence fixes.
- Use qualitative research when the problem is not known.

## How

1. Record baseline conversion.
2. Choose MDE.
3. Set power and confidence.
4. Calculate required sample per variant.
5. Predefine duration.
6. Launch with stable assignment.
7. Monitor health only.
8. Check SRM.
9. Read primary metric.
10. Decide ship, rollback, iterate, or inconclusive.

## Watch

- Unequal variant allocation.
- Tracking differences between variants.
- Mid-test traffic source shifts.
- Multiple primary metrics.
- Segment fishing.
- Novelty or primacy windows.
- Tests that run so long the context changes.

## Avoid

- Testing without enough conversions.
- Stopping when the dashboard first turns green.
- Changing variants mid-test.
- Declaring wins on secondary metrics.
- Running tests to justify obvious fixes.
