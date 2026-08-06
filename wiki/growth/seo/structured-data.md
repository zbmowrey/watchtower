---
title: Structured Data & Rich Results
description: "Direct execution checklist for Structured Data & Rich Results — what to do, when to use it, how to execute, what to watch, and what to avoid."
tags: [growth, seo, schema, rich-results]
type: growth
status: reference
updated: 2026-07-04
related: [serp-features-ctr, ai-search-geo, local-seo, technical-seo, seo-monitoring]
---

# Structured Data & Rich Results

Use this to describe page entities and qualify for eligible search features.

## Do

- Use JSON-LD.
- Use stable `@id` values.
- Match structured data to visible content.
- Pick schema types by page kind.
- Validate in CI or release checks.
- Monitor GSC enhancement reports.

## When

- On SaaS product, organization, article, breadcrumb, FAQ, review, and local business pages where visible content supports it.
- Before local SEO launch.
- Before rich-result or AI-search optimization.
- After template changes.

## How

1. Identify page type.
2. Select schema type.
3. Add required and recommended properties.
4. Connect entities with `@id`.
5. Confirm visible-content parity.
6. Validate output.
7. Monitor warnings/errors.

## Watch

- Schema claims not visible on the page.
- Deprecated or ineligible rich-result types.
- Duplicate or unstable entity IDs.
- Review/rating markup abuse.
- LocalBusiness type mismatch.
- Broken JSON after template changes.

## Avoid

- Adding schema for content that is not on the page.
- Expecting schema to compensate for weak content.
- Marking fake reviews or aggregate ratings.
- Treating warnings as always urgent; fix errors first.
