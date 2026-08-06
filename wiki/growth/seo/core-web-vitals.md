---
title: Core Web Vitals & Page Experience
description: "Direct execution checklist for Core Web Vitals & Page Experience — what to do, when to use it, how to execute, what to watch, and what to avoid."
tags: [growth, seo, web-performance, technical-seo]
type: growth
status: reference
updated: 2026-07-04
related: [technical-seo, seo-monitoring, analytics-stack, cro-process, dashboards-alerting]
---

# Core Web Vitals & Page Experience

Use this to protect conversion and search eligibility on pages with traffic or business value.

## Do

- Measure field data first.
- Debug with lab tools.
- Track LCP, INP, and CLS.
- Fix the largest user-impact bottleneck.
- Set performance budgets.
- Add regression checks for critical templates.

## When

- Before paid traffic to a page.
- Before launch/relaunch.
- When field data fails thresholds.
- When conversion drops on slow pages.
- After major frontend, image, ad, analytics, or font changes.

## How

1. Check GSC/CrUX field data.
2. Segment by template and device.
3. Run lab diagnostics.
4. Fix LCP first when hero/content loading is weak.
5. Fix INP when interactions lag.
6. Fix CLS when layout shifts.
7. Re-test lab.
8. Wait for field-data window.

## Watch

- Third-party scripts.
- Unoptimized hero images.
- Slow server response.
- Client-heavy rendering.
- Font shifts.
- Late-loading embeds.
- Mobile-specific failures.

## Avoid

- Spending cycles on CWV before there is traffic or conversion risk.
- Optimizing lab scores while field data stays bad.
- Adding heavy analytics/ads without budget.
- Treating CWV as a substitute for content or intent fit.
