---
title: "Technical SEO: Crawling & Indexing"
description: "Direct execution checklist for Technical SEO: Crawling & Indexing — what to do, when to use it, how to execute, what to watch, and what to avoid."
tags: [growth, seo, crawling, indexing]
type: growth
status: reference
updated: 2026-07-04
related: [site-architecture, core-web-vitals, structured-data, seo-monitoring, programmatic-seo]
---

# Technical SEO: Crawling & Indexing

Use this to make valuable URLs discoverable, renderable, indexable, and correctly canonicalized.

## Do

- Control crawl, render, index, canonical, redirect, sitemap, status-code, and internal-link signals.
- Keep primary content in rendered HTML.
- Use sitemaps for canonical URLs.
- Keep redirects direct.
- Analyze logs when crawl behavior matters.
- Clean index bloat.

## When

- Before launch.
- Before migrations.
- When pages fail indexing.
- When crawl budget or duplicate pages become visible.
- After template, routing, JavaScript, sitemap, or robots changes.

## How

1. Crawl the site.
2. Check robots.txt.
3. Check status codes.
4. Check noindex and canonical tags.
5. Check rendered HTML.
6. Check sitemap inclusion and lastmod.
7. Check redirect chains.
8. Check internal links and orphan pages.
9. Inspect GSC indexing states.
10. Fix by URL pattern.

## Watch

- Robots blocking resources or URLs needed for rendering.
- Canonicals pointing to wrong URLs.
- Redirect chains and loops.
- JS-only links/content.
- Soft 404s.
- Parameter and facet index bloat.
- Sitemap URLs that are not canonical.

## Avoid

- Using robots.txt to remove indexed pages.
- Letting staging URLs index.
- Shipping templates without crawl tests.
- Fixing one URL when the issue is pattern-level.
