---
title: Tending the Garden — watchtower self-maintenance charter
description: How Claude keeps watchtower ITSELF healthy as it grows — the repo-wide self-maintenance mandate (standing authority, single-source discipline, law-vs-news, keep-the-core-lean, where-new-things-go, run-the-guards, two-memories). Generalizes the wiki mandate to the whole repo (CLAUDE.md, apps.json, skills, standards, logs).
tags: [meta, maintenance, garden, governance, conventions]
type: meta
status: normative
updated: 2026-06-27
related: [wiki-conventions, wiki-tool]
---

# Tending the Garden

This repo is the watchtower — and like any garden it overgrows if untended. The
[[wiki-conventions]] cover one bed (the wiki). This page is the **whole-garden
charter**: how Claude keeps the *entire* repo — `CLAUDE.md`, `apps.json`, the skills,
the `standards/` artifacts, the wiki, the logs — authoritative, lean, and
single-sourced as it grows. CLAUDE.md carries the reflex subset; this page
owns the rules.

You have **standing authority to tend the garden without asking.** Improve the repo as
you work: fix stale facts, collapse duplication into pointers, file new knowledge at
its one owner, regenerate hubs. The one guardrail: **structural moves/renames and
deletions of normative content get a heads-up and a git commit first** (so every
change is reversible).

## The mandate

1. **Search before the web.** `bin/wiki search <kw>` → `bin/wiki inject --page <slug>
   --depth 1` first; only go to the internet if the wiki doesn't have it.
2. **Write back what you learn.** After learning something durable — from the web, a
   repo, or debugging — record it as a page or fold it into an existing one. Knowledge
   should compound, not evaporate between sessions.
3. **Correct in place.** When a fact is wrong or stale, fix it at its owner and bump
   `updated:`. Never append "actually it's now X" — make the page true as-of-now.

## The discipline (what keeps it from re-chaosing)

4. **One fact, one owner.** Every fact has exactly one canonical home; everywhere else
   is a pointer (a link), never a second copy. Duplication is a defect — it is the
   proven cause of every drift this repo has had (the roster lived in 3 places and all
   three disagreed). See the source-of-truth map in [[wiki-conventions]].
5. **Restate downward only.** A more-loaded doc (CLAUDE.md, a hub, a README) may carry
   a *pointer* to a fact owned lower down — never a copy of the fact itself.
6. **Law vs news.** Timeless rules ("law") and dated status ("news" — PR numbers,
   rollout dates, per-app convergence, registers) live in physically separate homes.
   News is `status: living` and lives under `wiki/logs/`; it never enters a normative
   page or CLAUDE.md. A normative page links "current status → convergence log".
7. **Keep the always-loaded core lean.** `CLAUDE.md` is loaded every session, so every
   line costs. Before adding one, ask: *must this be true in-context before the first
   tool call?* If not, it's a pointer, not a fact. If CLAUDE.md crosses ~70 lines,
   shard it back down. Never reintroduce a project table, a threshold number, or a
   dated status into it.
8. **Values live in runnable artifacts.** Threshold numbers (Larastan L8, cyclomatic
   ≤10, coverage `--min=80`, type-coverage `--min=95`, jscpd 10) live ONLY in the
   config files CI and `scaffold/apply.sh` consume (`standards/laravel/configs/`).
   Prose links to the file; it never restates the number.
9. **Machine data has one machine source.** The fleet roster lives once, in
   `apps.json` (read via `bin/fleet`). The justfile, the statusline hook, and the
   `/project` arg-hint all derive from it or are linted against it — never hand-copied.

## Where new things go

- **A new project** → one entry in `apps.json` + one `wiki/projects/<slug>.md` leaf.
  The justfile, statusline, arg-hint, and `projects/_index` then derive automatically.
- **A new skill** → one `SKILL.md` whose description the harness discovers. No
  CLAUDE.md edit. Skills are procedure — they inject the relevant wiki page at runtime
  rather than hardcoding the roster, a version, or a date (`skill-lint.sh` enforces).
- **A new standard threshold** → the value in `standards/laravel/configs/` (CI
  consumes it) + one sentence in [[fleet-app-specification]] (the rule).
- **A new concept** → one leaf under exactly one domain directory; the hub regenerates.
- **A new dated status** → a `status: living` page under `wiki/logs/`.

## Run the guards (the mechanical anti-rot)

These defend the invariants so the garden doesn't rely on diligence:

- `bin/wiki lint` — frontmatter contract (the PostToolUse hook runs it on every edit).
- `bin/wiki lint --hubs` — every populated directory has an `_index.md`; `type`
  matches its domain directory.
- `bin/wiki index` — regenerates each hub's navigation from leaf frontmatter (hubs
  hold no hand-maintained fact lists, so they can't rot).
- `bin/fleet check` — `apps.json` is valid and its consumers are in sync.
- `.claude/hooks/skill-lint.sh` — no PR numbers / dates / hardcoded rosters in skills.

Run them all at once with **`just check`** (or `bin/check`) — the hard checks
(frontmatter, hubs, `apps.json`) fail the run; the soft ones (dangling links, skill
rot) only warn. The **`.githooks/pre-commit`** hook runs it on every commit; activate
once per clone with `git config core.hooksPath .githooks`. Run them after edits; don't
leave a guard red. A light periodic sweep only needs to
confirm `type`/`status` are honestly assigned and `status: living` pages that are
actually done get archived — never to hand-curate an index.

## Two memories, one boundary

- **Durable facts → the wiki** (in-repo, permanent, single-sourced). This is the
  garden.
- **Ephemeral work-state → auto-memory / `saves/`** (out-of-repo, gitignored): the
  current PR, where-I-left-off, this session's plan. Never park a durable fact in
  auto-memory — it belongs on a wiki page that everything else can point to.
