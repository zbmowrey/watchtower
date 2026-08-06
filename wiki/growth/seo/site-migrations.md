---
title: Site Migrations, Redesigns & URL Changes Without Losing Traffic
description: "Direct execution checklist for Site Migrations, Redesigns & URL Changes Without Losing Traffic — what to do, when to use it, how to execute, what to watch, and what to avoid."
tags: [growth, seo, migrations, redirects]
type: growth
status: reference
updated: 2026-07-04
related: [technical-seo, seo-monitoring, site-architecture, core-web-vitals, analytics-stack]
---

# Site Migrations, Redesigns & URL Changes Without Losing Traffic

Use this for any URL, domain, IA, CMS, framework, rendering, or template change that can affect search.

## Do

- Classify migration risk.
- Isolate changes where possible.
- Snapshot baseline.
- Map old URLs to new URLs 1:1.
- Crawl staging.
- Validate redirects, canonicals, robots, sitemaps, rendering, analytics, and schema.
- Monitor day 0, 1, 7, and 28.

## When

- Before redesigns.
- Before domain/subdomain moves.
- Before URL restructuring.
- Before CMS/framework moves.
- Before template rewrites on ranking pages.

## How

1. Freeze baseline: traffic, rankings, GSC, backlinks, top pages, conversions.
2. Inventory URLs.
3. Create redirect map.
4. Crawl staging.
5. Fix crawl-diff issues.
6. Prepare launch checklist.
7. Launch with redirect and analytics checks.
8. Monitor and triage losses by pattern.

## Watch

- Homepage redirects for unmatched URLs.
- Missing high-value URLs.
- Canonicals pointing to old/staging URLs.
- Robots/noindex left from staging.
- JS rendering regressions.
- Analytics breakage.
- Internal links still pointing to old URLs.

## Avoid

- Combining rebrand, IA, content rewrite, CMS move, and design refresh without isolation.
- Launching without redirect map.
- Changing URLs for aesthetics.
- Waiting weeks to inspect GSC after launch.
