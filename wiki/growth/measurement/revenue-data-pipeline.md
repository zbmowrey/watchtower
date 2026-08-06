---
title: "Revenue Data Pipeline: Billing Truth from Stripe to Dashboards"
description: "Direct execution checklist for Revenue Data Pipeline: Billing Truth from Stripe to Dashboards — what to do, when to use it, how to execute, what to watch, and what to avoid."
tags: [growth, measurement, billing, stripe]
type: growth
status: reference
updated: 2026-07-04
related: [funnel-metrics, analytics-stack, dashboards-alerting, retention-churn, offer-pricing]
---

# Revenue Data Pipeline: Billing Truth from Stripe to Dashboards

Use this as the count-of-record for subscription revenue.

## Do

- Ingest billing webhooks.
- Normalize billing events into MRR movements.
- Store an immutable movement ledger.
- Roll movements into daily metrics.
- Reconcile month close against Stripe/Cashier.
- Feed dashboards and alerts from the ledger, not ad hoc analytics events.

## When

- Before reading MRR, churn, LTV, CAC payback, NRR, or GRR.
- Before paid acquisition.
- Before pricing tests.
- After billing, plan, coupon, trial, or subscription-state changes.

## How

1. Map billing events to movement types.
2. Persist raw webhook payload references.
3. Deduplicate webhook delivery.
4. Convert all amounts to normalized MRR.
5. Write movement rows for new, expansion, contraction, churn, reactivation, refund, and correction.
6. Roll up daily account and business metrics.
7. Reconcile Stripe totals, app subscriptions, and ledger totals.
8. Alert on failed webhooks and impossible movement states.

## Watch

- Duplicate webhook processing.
- Out-of-order events.
- Coupons represented as permanent MRR changes.
- Trial state counted as paid revenue.
- Refunds missing from movement history.
- Plan changes recorded as churn plus new instead of expansion/contraction.
- Currency and tax handling.

## Avoid

- Using GA/product analytics as revenue truth.
- Overwriting history instead of appending corrections.
- Ignoring failed webhook retries.
- Calculating NRR/GRR from current subscription state only.
- Mixing cash collected and MRR without labeling them.
