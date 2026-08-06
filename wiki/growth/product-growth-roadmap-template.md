---
title: Product Growth Roadmap Template
description: Copy-ready growth roadmap skeleton for applying the growth corpus to one property with objective inputs, readiness gates, stage selection, lane selection, cadence, and decision records.
tags: [ growth, roadmap, template, planning ]
type: growth
status: reference
updated: 2026-07-04
related: [growth-engine-overview, growth-principles-runbook, funnel-metrics, positioning-icp, analytics-stack, seo-program-roadmap, dashboards-alerting]
---

# Product Growth Roadmap Template

Copy this into the relevant roadmap item or planning page. Delete sections that do
not apply. Keep decisions in tables. Link to owner pages for execution details.

## 1. Property

| Field                    | Value                                                  |
|--------------------------|--------------------------------------------------------|
| Product / property       | `[name]`                                               |
| Type                     | `[new SaaS/app, local business, relaunch]`             |
| Primary ICP              | `[segment]`                                            |
| Main alternative         | `[competitor, spreadsheet, do nothing]`                |
| Primary conversion       | `[signup, lead, trial, payment, booking, call, visit]` |
| Revenue model            | `[subscription, membership, service, one-time]`        |
| Source of revenue truth  | `[Stripe/Cashier, POS, CRM, manual]`                   |
| Source of behavior truth | `[analytics tool / logs]`                              |
| Roadmap owner            | `[person/agent]`                                       |
| Review cadence           | `[weekly day/time]`                                    |

## 2. Current Constraint

Pick one.

| Stage              |     Current value |   Pass / target | Owner page                   | Selected |
|--------------------|------------------:|----------------:|------------------------------|----------|
| Positioning        | `[clear/unclear]` |           clear | [[positioning-icp]]          | `[ ]`    |
| Measurement        |     `[pass/fail]` |            pass | [[analytics-stack]]          | `[ ]`    |
| Conversion         |          `[rate]` |      `[target]` | [[landing-page-anatomy]]     | `[ ]`    |
| Activation         |    `[rate / TTV]` |      `[target]` | [[activation-onboarding]]    | `[ ]`    |
| Trial/lead -> paid |          `[rate]` |      `[target]` | [[trial-to-paid-conversion]] | `[ ]`    |
| Retention/churn    |          `[rate]` |      `[target]` | [[retention-churn]]          | `[ ]`    |
| Acquisition        |   `[lane result]` |        `[gate]` | `[owner]`                    | `[ ]`    |
| Referral           |     `[readiness]` | retention ready | [[referral-word-of-mouth]]   | `[ ]`    |

Rule: work the selected row only until the day-30 decision.

## 3. Do-Not-Start Gates

| Work               | Do not start until                                                       | Owner                      |
|--------------------|--------------------------------------------------------------------------|----------------------------|
| Acquisition        | positioning, page conversion path, analytics, and activation event exist | [[growth-engine-overview]] |
| Paid               | LTV/payback is known or bounded and conversion tracking works            | [[paid-acquisition]]       |
| SEO production     | keyword, intent, and topical map exist                                   | [[keyword-research]]       |
| pSEO               | editorial trust and page-quality gates exist                             | [[programmatic-seo]]       |
| Referral           | retention curve is ready and satisfaction is positive                    | [[referral-word-of-mouth]] |
| Migration/redesign | baseline snapshot and redirect/crawl plan exist                          | [[site-migrations]]        |
| A/B test           | sample size, duration, primary metric, and SRM checks are defined        | [[ab-testing-statistics]]  |

## 4. Baseline Snapshot

Fill before changes.

| Metric                  |       Current | Source              | Date  |
|-------------------------|--------------:|---------------------|-------|
| Visitors / sessions     |         `[ ]` | `[ ]`               | `[ ]` |
| Primary conversion rate |         `[ ]` | `[ ]`               | `[ ]` |
| Activation rate / TTV   |         `[ ]` | `[ ]`               | `[ ]` |
| Trial/lead -> paid      |         `[ ]` | `[ ]`               | `[ ]` |
| MRR / revenue           |         `[ ]` | `[ ]`               | `[ ]` |
| Churn / retention       |         `[ ]` | `[ ]`               | `[ ]` |
| CAC / payback           |         `[ ]` | `[ ]`               | `[ ]` |
| Top traffic source      |         `[ ]` | `[ ]`               | `[ ]` |
| Top money page          |         `[ ]` | `[ ]`               | `[ ]` |
| Data-quality state      | `[pass/fail]` | [[analytics-stack]] | `[ ]` |

## 5. First 7 Days

Complete in order.

1. [ ] Write or update positioning canvas. Owner: [[positioning-icp]].
2. [ ] Verify behavior analytics and billing truth. Owners: [[analytics-stack]], [[revenue-data-pipeline]].
3. [ ] Snapshot baseline table.
4. [ ] Audit or ship one money path.
   Owners: [[landing-page-anatomy]], [[forms-signup-flow]], [[offer-pricing]], [[social-proof-trust]].
5. [ ] Define activation event and TTV. Owner: [[activation-onboarding]].
6. [ ] Select one constraint stage.
7. [ ] Select one acquisition lane only if the constraint is acquisition.
8. [ ] Create weekly review entry.

## 6. First 30 Days

| Week | Focus              | Output                                                          | Owner                         |
|------|--------------------|-----------------------------------------------------------------|-------------------------------|
| 1    | Baseline + gates   | Clean baseline, selected constraint, rejected lanes listed      | [[dashboards-alerting]]       |
| 2    | Constraint fix     | One shippable change against selected stage                     | `[selected owner page]`       |
| 3    | Measurement window | Read metric, triage noise, ship one follow-up only if needed    | [[dashboards-alerting]]       |
| 4    | Decision           | Continue, narrow, pivot, fix product, or repair instrumentation | [[growth-principles-runbook]] |

## 7. Acquisition Lane

Choose one only when acquisition is the selected constraint.

| Lane               | Use when                 | First action                          | Metric                                                        | Stop / continue                                               |
|--------------------|--------------------------|---------------------------------------|---------------------------------------------------------------|---------------------------------------------------------------|
| SEO BOFU           | demand and SEO gate pass | publish 3-5 BOFU assets               | indexed pages, impressions, qualified clicks                  | continue if indexed + impressions; narrow if queries miss ICP |
| Launch/directories | product can be listed    | submit launch kit and directory batch | referral traffic, signups, links, reviews                     | continue if qualified referrals or useful links appear        |
| Founder social     | founder can post weekly  | run 3-pillar cadence                  | DMs, mentions, self-reported attribution, branded/direct lift | continue if conversations or qualified traffic appear         |
| Local SEO          | physical service area    | GBP + service/location pages          | calls, bookings, direction clicks, geo-grid movement          | continue if local actions move                                |
| Paid search        | LTV/payback known        | exact-intent search test              | CAC, activation, paid conversion                              | continue only if CAC trends toward target                     |
| Sponsorship        | niche audience exists    | one verified placement                | clicks, leads, paid conversion, self-report                   | repeat only if cohort quality clears                          |
| Cold outbound      | ACV clears manual motion | 50 verified prospects                 | positive replies, meetings, close rate                        | scale only after reply and meeting gates pass                 |
| Marketplace        | platform audience exists | one useful integration/listing        | installs, activation, retention, support load                 | continue if activation and retention justify support          |

## 8. Work Item Log

| Date           | Stage     | Action shipped | Metric watched | Result    | Decision                             |
|----------------|-----------|----------------|----------------|-----------|--------------------------------------|
| `[YYYY-MM-DD]` | `[stage]` | `[change]`     | `[metric]`     | `[value]` | `[continue/narrow/pivot/fix/repair]` |

## 9. Weekly Review

```markdown
## YYYY-MM-DD — [property]

- Constraint:
- Baseline:
- Current:
- Action shipped:
- What moved:
- Noise / data-quality issues:
- Decision:
- Next action:
```

## 10. Day-30 Decision

Choose one.

| Decision               | Use when                                                      | Next action                                                          |
|------------------------|---------------------------------------------------------------|----------------------------------------------------------------------|
| Continue               | selected metric moved and data is clean                       | run same stage for another 30 days                                   |
| Narrow                 | signal exists but audience, offer, page, or lane is too broad | cut to one segment, one offer, one page, or one channel              |
| Pivot channel          | acquisition lane gate failed after clean execution            | pick next lane from §7                                               |
| Fix product/activation | traffic or signups arrive but activation/pay/retention fails  | stop acquisition; open lifecycle owner page                          |
| Repair instrumentation | sources conflict or data-quality check fails                  | stop decisions; fix [[analytics-stack]] or [[revenue-data-pipeline]] |
| Stop                   | no signal and gate failed                                     | close item; record reason                                            |

## 11. Completion Notes

```markdown
## Completion

- Final decision:
- Metrics before:
- Metrics after:
- Shipped:
- Follow-ups:
- Owner pages used:
```
