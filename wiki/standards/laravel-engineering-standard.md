---
title: Laravel Engineering Standard (philosophy + index)
description: The philosophy behind managing every fleet Laravel app the same way — the two halves (cquality defines & measures, this repo enforces & operates), the audit→converge→re-audit loop, and an index into the rule of record, the enforcement artifacts, and the convergence history. The mandated VALUES live in fleet-app-specification; this page is the why and the map.
tags: [standard, parity, guardrails, architecture, quality, laravel, philosophy]
type: standard
updated: 2026-06-27
related: [fleet-app-specification, cquality, laravel-architecture-manual, dependency-rules, pest-architecture-testing, laravel-runtime-guardrails, pre-commit-hooks]
---

# Laravel Engineering Standard

> **This page is the philosophy + the map, not the rule.** The mandated value for every
> operational concern (versions, guardrails, CI/deploy, runtime hardening) is the
> normative **[[fleet-app-specification]]** (v1). The dated rollout history is
> a convergence log; what's left to converge is a convergence backlog. Read this
> page for the *why*; read the spec for the *what*.

## The goal — manage every Laravel app the same way

Same test strategy, same CI/CD pipeline, same automated guardrails (Larastan, tsc,
Pint, Prettier, PHPMD…), same architectural controls (thin controllers, FormRequest
validation, services for business logic, complexity limits). Apps diverge **only** on
genuine needs — Reverb, Valkey, MinIO — and on their own business logic and
domain/layering depth. The "how" of building is at parity, so you are free to
focus on each app's business logic.

## Two halves

|                       | Repo                      | Role                                                                                                                                                                     |
|-----------------------|---------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Define & measure**  | [[cquality]] (public OSS) | The rubric + auditor — 15 dimensions, 1–5 maturity, evidence-tiered findings. **Read-only.**                                                                             |
| **Enforce & operate** | **this repo** (here)      | The reference configs, the shared arch-test suite, the CI templates, the new-app scaffold — and the fleet's deploy/infra. **The half cquality deliberately never does.** |

### The closed loop

```
cquality AUDIT  (measure → maturity + findings)
      │
      ▼
watchtower CONVERGE  (turn findings into config + arch-test + CI-gate PRs, per app)
      │
      ▼
cquality RE-AUDIT  (verify the L-level lift)
```

Most gaps are an **L3 → L4 "enforce it in CI"** move — exactly what the enforcement
layer does. The audit→converge→re-audit loop is driven by the `/audit` skill.

## The enforcement layer — `standards/laravel/`

The reference bundle every app copies from (harvested from a reference app).
Apply procedure, ratchet policy, and divergence rules: `standards/laravel/README.md`.
What it holds (the **values** are owned by [[fleet-app-specification]] §1–§5, not
restated here):

- **`configs/`** — the canonical lint/type/test config files (phpstan, phpmd, pint,
  jscpd, knip, eslint, tsconfig, psalm, prettier, vitest) + the composer/package
  fragments to merge. These files ARE the enforced values.
- **`.forgejo/workflows/ci.yml`** — the canonical 2-job (`static`/`tests`) gate template.
- **`tests/Architecture/`** — the shared, tiered Pest arch suite (universal floor +
  opt-in tiers). The *why* behind each control is the sharded
  [[laravel-architecture-manual]] (see [[dependency-rules]], [[pest-architecture-testing]]);
  the tier→namespace matrix is the suite's own README.
- **`.husky/`** — the container-run pre-commit / pre-push / commit-msg hooks
  ([[pre-commit-hooks]]).
- **`scaffold/apply.sh`** — "new app at parity on commit #1" + the new-repo footgun
  checklist.
- **`bin/arch-drift`** — checks arch-tier parity across the fleet (universal tiers
  byte-identical; documented exceptions in `arch-drift.allow`).

Runtime hardening (boot-time behaviour, not lint) is a first-class peer of the tool set
— full catalogue in [[laravel-runtime-guardrails]], mandated in
[[fleet-app-specification]] §5. The deploy harness (two-image Dockerfile + GitOps) is
per-app — deploy image, argocd deploy flow.

## Where the live state lives

This page is philosophy; it carries no status. The **rule** is [[fleet-app-specification]];
the **dated convergence history** (who adopted what, when) is a convergence log; the
**open burndown** (what's left) is a convergence backlog; the maturity lift is
measured by re-running the [[cquality]] audit.
