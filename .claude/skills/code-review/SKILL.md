---
name: code-review
description: Perform a multi-perspective adversarial code review of a diff/branch/PR across application and dev-ops dimensions. Use when the user asks to review code, review a PR, critique changes, or find problems before merge. Produces severity-ranked findings with file:line references and concrete fixes.
---

# code-review (perform)

Adversarial, multi-lens review. The goal is to **find what's wrong or risky**,
not to rubber-stamp. Be specific, cite `file:line`, and propose the fix.

## 0. Establish scope & intent

- Get the diff: `git -C ~/code/<repo> diff <base>...HEAD` (or `gh pr diff <n> -R <owner>/<repo>`).
- Read enough surrounding code to understand intent — review against what the
  change is *trying* to do, not just the lines shown.
- Load standards: project facts via `bin/wiki inject --page <repo> --depth 1`;
  deep PHP/Laravel/security technique via the `php-tomes:*` skills.

## 1. Review through every relevant lens

**Application:**

- **Correctness** — logic errors, edge cases, off-by-one, null/empty, error paths,
  race conditions, incorrect assumptions about data.
- **Security** — authz/authn (policies/gates), input validation & Form Requests,
  mass-assignment (`$fillable`/`$guarded`), SQL injection, XSS in Blade/React,
  secrets in code, SSRF, IDOR, CSRF, tenancy isolation.
- **Data & queries** — N+1 (eager loading), missing indexes, migrations
  (reversible? safe on large tables? zero-downtime?), transaction boundaries.
- **Tests** — do new code paths have meaningful tests? Are tests asserting
  behavior, not implementation? Coverage gate respected (e.g. 80%)? Arch tests?
- **Types** — TS types honest (no stray `any`), PHPStan/Larastan clean.
- **Framework idioms** — Eloquent vs query builder, service/action structure,
  events/jobs/queues used correctly, config not hardcoded.
- **Frontend (Inertia/React)** — props contract typed, no leaking Eloquent models,
  state correctness, accessibility, Wayfinder routes regenerated not hand-edited.

**Dev-ops:**

- **CI** — workflow changes correct; checks not weakened/skipped silently.
- **Containers** — Dockerfile/FrankenPHP correctness, image size, non-root, caching.
- **k8s / GitOps** — `values.yaml`/chart changes sane; resource limits/probes;
  secrets handled out-of-repo; deploy safe (see [argocd-deploy-flow] in wiki).
- **Observability & ops** — logging, metrics, error handling, rollback story.

## 2. Adversarial pass

For each non-trivial claim of correctness, actively try to break it: construct the
input/sequence that fails, or note the missing test that would catch it. Prefer a
concrete failing scenario over a vague concern.

## 3. Report

Group findings by severity, most important first:

- **🔴 Blocker** — must fix before merge (bug, security, data loss, broken deploy).
- **🟠 Major** — should fix (correctness risk, missing tests, perf).
- **🟡 Minor** — worth fixing (idioms, clarity, small risks).
- **⚪ Nit** — optional/style.

Each finding: `path:line` · what's wrong · why it matters · suggested fix. End with
a short overall assessment and an explicit merge recommendation. If `--fix` work is
wanted, offer to apply the blocker/major fixes.
