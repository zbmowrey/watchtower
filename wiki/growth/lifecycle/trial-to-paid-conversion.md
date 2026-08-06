---
title: Trial & Free-to-Paid Conversion
description: "Direct execution checklist for Trial & Free-to-Paid Conversion — what to do, when to use it, how to execute, what to watch, and what to avoid."
tags: [growth, lifecycle, trial-conversion, checkout]
type: growth
status: reference
updated: 2026-07-04
related: [funnel-metrics, activation-onboarding, retention-churn, offer-pricing, email-capture-nurture]
---

# Trial & Free-to-Paid Conversion

Use this to convert activated unpaid users into paying customers.

## Do

- Define account states.
- Trigger upgrade prompts at value moments.
- Send trial-end emails based on usage state.
- Keep checkout short and trustworthy.
- Handle payment failure as a product state.
- Define PQL criteria and owner action.

## When

- After activation is instrumented.
- When users activate but do not pay.
- Before changing trial length, card requirement, or freemium gates.
- Before paid acquisition into a trial flow.

## How

1. Define states: anonymous, free, trialing, active, grace, past_due, canceled, expired.
2. Define upgrade triggers by usage, feature limit, team need, or outcome.
3. Map trial timeline:
   - Start.
   - First value.
   - Mid-trial usage check.
   - Trial-end sequence.
   - Grace/expiry.
4. Add checkout events.
5. Add first-payment-failure flow.
6. Assign sales-assist action for PQLs.
7. Monitor activation -> paid by cohort and channel.

## Watch

- Trial starts without activation.
- Upgrade prompts before value.
- Free tier satisfying the full job.
- Checkout abandonment.
- Declines at first payment.
- Trial extensions used as default retention.

## Avoid

- Optimizing trial conversion before activation.
- Hiding cancellation or billing terms.
- Sending the same trial-end email to active and inactive users.
- Treating all free users as sales leads.
- Moving paywalls without measuring retention impact.
