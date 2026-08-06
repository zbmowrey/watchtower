---
title: Analytics Stack & Event Taxonomy
description: "Direct execution checklist for Analytics Stack & Event Taxonomy — what to do, when to use it, how to execute, what to watch, and what to avoid."
tags: [growth, measurement, analytics, instrumentation]
type: growth
status: reference
updated: 2026-07-04
related: [dashboards-alerting, funnel-metrics, seo-monitoring, paid-acquisition, forms-signup-flow]
---

# Analytics Stack & Event Taxonomy

Use this to make behavior data trustworthy before growth decisions depend on it.

## Do

- Use one product analytics source and one revenue source.
- Define events in `object_action` form.
- Track pageview, signup/lead, activation, trial, checkout, subscription, churn, expansion, referral, and key feature events.
- Define required properties for each event.
- Register UTM vocabulary.
- Preserve consent and privacy requirements.
- Reconcile analytics events against database records.
- Maintain a tracking plan.

## When

- Before acquisition.
- Before CRO tests.
- Before paid spend.
- Before reading funnel metrics.
- After release changes to forms, checkout, onboarding, billing, routing, domains, or consent flows.

## How

1. Pick tools.
2. Create the tracking plan.
3. Add canonical events.
4. Add required properties.
5. Mark conversion/key events.
6. Configure UTMs.
7. Define identity stitching rules.
8. QA with test users and database queries.
9. Add dashboards in [[dashboards-alerting]].

## Watch

- Duplicate events.
- Missing user or account IDs.
- UTM values outside vocabulary.
- Client-side blockers.
- Consent-mode loss.
- Cross-domain session breaks.
- Bot or spam traffic.
- Analytics totals that disagree with backend records.

## Avoid

- Inventing new event names inside feature work.
- Reading attribution as truth.
- Optimizing on last click alone.
- Mixing revenue truth into analytics without reconciliation.
- Acting on anomalies before data-quality triage.
