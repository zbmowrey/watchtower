---
title: Growth Principles Runbook
description: "Direct execution checklist for Growth Principles Runbook — what to do, when to use it, how to execute, what to watch, and what to avoid."
tags: [ growth, principles, rules, examples, runbook, execution ]
type: growth
status: reference
updated: 2026-07-04
related: [growth-engine-overview, product-growth-roadmap-template, funnel-metrics, analytics-stack, seo-program-roadmap, dashboards-alerting]
---

# Growth Principles Runbook

Use this as the compressed execution layer for [[growth-engine-overview]]. Open the maintainer page when a checklist needs formulas, implementation detail, or a project-specific adaptation.

## Global Rules

- Pick one constraint stage per cycle.
- Instrument before acquisition.
- Choose one acquisition lane at a time.
- Use first-party data as the decision source.
- Use benchmark tables only to locate abnormal stages.
- Keep channels, pages, and lifecycle work tied to one funnel metric.
- Run anomaly triage before reacting to surprising numbers.
- Log the action, metric, date, and next decision.

## Execution Loop

1. Select the property.
2. Fill [[product-growth-roadmap-template]].
3. Pick the constraint stage.
4. Open the maintainer page.
5. Execute one shippable change.
6. Measure with [[dashboards-alerting]].
7. Keep, narrow, pivot, fix product, or repair instrumentation.

## Stage Rules

| Stage | Do | Avoid |
|---|---|---|
| Positioning | Pick segment, alternative, category, value proof | Writing copy for everyone |
| Measurement | Track events, UTMs, billing truth, dashboards | Reading metrics before QA |
| Conversion | Match source intent, offer, proof, form, CTA | Polishing copy before offer clarity |
| Activation | Shorten path to first value | Counting account creation as value |
| Revenue | Diagnose churn and expansion by segment | Scaling acquisition into retention leak |
| Referral | Ask after proven value | Launching before retention flattens |
| SEO | Build BOFU/topic coverage by intent | Publishing broad content too early |
| Paid | Spend only after CAC/LTV gates | Letting platforms optimize to bad leads |
| Social | Use founder-native posts and DM motion | Treating brand posts as early growth |
| Outbound | Test small with compliance and ACV gates | Scaling domains before replies convert |

## Watch

- Source mix changes.
- Tracking drift.
- Bot traffic.
- Seasonality.
- SERP intent drift.
- Form drop-off.
- Trial activation gap.
- Payment failures.
- Churn concentration.
- Channel saturation.

## Output Format

```markdown
## YYYY-MM-DD — [property]
- Constraint:
- Action shipped:
- Metric watched:
- Result:
- Decision:
- Next action:
```
