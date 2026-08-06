---
title: Funnel Model & Unit Economics
description: "Direct execution checklist for Funnel Model & Unit Economics — what to do, when to use it, how to execute, what to watch, and what to avoid."
tags: [growth, lifecycle, unit-economics, metrics]
type: growth
status: reference
updated: 2026-07-04
related: [analytics-stack, activation-onboarding, retention-churn, paid-acquisition, dashboards-alerting]
---

# Funnel Model & Unit Economics

Use this to decide which growth stage to work on and whether a channel can scale.

## Do

- Track visitors, leads/signups, activations, paid conversions, retained customers, and referrals.
- Calculate conversion rate at each stage.
- Track MRR movement: new, expansion, contraction, churn, reactivation.
- Calculate CAC, LTV, gross margin, payback, logo churn, revenue churn, GRR, and NRR.
- Segment funnel metrics by channel, cohort, ICP, plan, and activation path.
- Use cohorts to separate acquisition quality from lifecycle quality.

## When

- Before paid acquisition.
- Before choosing a monthly growth constraint.
- After launches, migrations, pricing changes, onboarding changes, or channel tests.
- During weekly growth review and monthly revenue review.

## How

1. Define the funnel stages for the product.
2. Map each stage to a canonical event from [[analytics-stack]].
3. Pull revenue truth from [[revenue-data-pipeline]].
4. Build a funnel table by cohort and channel.
5. Compare each stage against prior baseline and relevant benchmark.
6. Pick the weakest stage.
7. Assign one owner page for the fix.
8. Recalculate after the measurement window.

## Watch

- Blended CAC hiding a bad paid channel.
- Analytics conversions disagreeing with database records.
- Trial conversion measured with the wrong denominator.
- High signup volume with low activation.
- Low logo churn with high contraction.
- NRR below 100% when expansion should exist.

## Avoid

- Using LTV before churn is stable.
- Scaling channels without payback math.
- Comparing cohorts with different acquisition sources.
- Counting account creation as activation.
- Averaging enterprise, SMB, and self-serve motions together.
