---
title: cquality — Laravel code-quality audit framework
description: The fleet's canonical code-quality auditor. Public OSS at github.com/your-org/cquality — LLM-run, tools-first, 15 dimensions, evidence-tiered, read-only. This repo runs it via the /audit skill; it defines & measures the standard that this repo enforces.
tags: [cquality, quality, audit, standard, laravel, tooling]
type: standard
updated: 2026-07-10
related: [laravel-engineering-standard, pest-testing]
---

# cquality

A **markdown-based, LLM-run code-quality audit framework for Laravel**. You point an
agent at a Laravel codebase; it follows the framework to produce an evidence-backed
audit. The repo is the machine; a run produces the report.

- **Location:** `~/code/cquality` · **Public OSS:** <https://github.com/your-org/cquality> (MIT).
- **Roster entry:** code **`cq`** (`kind: tool`, `managed: true`, `run: null`,
  `enabled: false`, `deploy: none` — invoked on-demand against a sibling, not a
  running service). This page is the roster's `wikiPage` target for `cquality` —
  deliberately *not* duplicated under `wiki/projects/` (one fact, one owner; a second
  `cquality.md` there would collide with this page's slug in the wiki link index).
- It is the **"define + measure"** half of the [[laravel-engineering-standard]]; this repo
  is the **"enforce + operate"** half. Invoked via this repo's **`audit` skill**
  (`.claude/skills/audit/SKILL.md`), which shells into `~/code/cquality`.

## What it produces

A run grades the app across **15 dimensions / 4 pillars** (Code Health · Design & Data ·
Runtime · Engineering Process), at **1–5 maturity each — no single health score**, and emits
four layered artifacts: **scorecard · findings register · remediation backlog · evidence
appendix**. Maintainability is *derived* from Pillar I, not graded directly.

## The three non-negotiable guardrails

1. **The LLM computes nothing** — every metric comes from a real tool (PHPStan, PHPMD, Pest,
   jscpd, ESLint…); raw output goes in the evidence appendix. No hand-counted numbers.
2. **Never launder a Tier-3 opinion into a Tier-1 fact** — every finding carries its evidence
   tier (1 deterministic / 2 heuristic / 3 judgment).
3. **The target is read-only** — clone, analyze, report. Never edit, format, or PR the target.

## How to run it (against a managed sibling)

Use the **`/audit <app>`** skill, or by hand:

```
python3 ~/code/cquality/tools/recon.py ~/code/<app> --human   # stack + tools + inventory → confirm profile
python3 ~/code/cquality/tools/new-run.py <app>                # scaffold .results/<app>/<run-id>/
# then follow ~/code/cquality/framework/06-orchestration-runbook.md against the read-only target
python3 ~/code/cquality/tools/trend.py <app>                  # cross-run maturity delta (re-runs)
```

The fleet's profile is **`reference-laravel13-inertia-react`** (inherits `reference-laravel13-php84`)
— exactly the Laravel 13 + Inertia/React stack. Tools are stdlib-only Python; no installs.

## Notes

- **`.results/` is gitignored and local** — it holds full audits of *private* apps (god-class
  names, security findings, file paths). Never commit or publish it. (Confirmed safe before the
  repo went public: only the 47 framework files are tracked.)
- **One app has already been audited** (an example run): the model for what a per-app convergence
  backlog looks like (② Complexity 2/5, ③ Duplication 3/5, 49 findings). Other apps are not yet
  audited.
- cquality lives on **GitHub** (public OSS), unlike the deployed siblings which moved to
  Forgejo; a framework repo with no deploy needs no `.forgejo` pipeline, and
  public repos get free GitHub Actions.
