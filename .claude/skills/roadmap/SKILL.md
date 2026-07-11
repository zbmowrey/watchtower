---
name: roadmap
description: Manage a project's prioritized product roadmap — the features/milestones we intend to build, each a directory of living planning docs (_index + plan + shards) under wiki/roadmaps/<project>/. Use when the user says "add to the roadmap", "what's on the roadmap?", "show the roadmap", "reprioritize", "advance/update a roadmap item", marks one delivered, or asks to "archive old roadmap items". Distinct from the convergence roadmaps (spec-parity backlogs) and from the todo skill (small one-off items).
---

# roadmap

Maintain a project's **product roadmap** — prioritized features/milestones, each item a
directory of living planning docs under `wiki/roadmaps/<project>/`.

The full structure, frontmatter schema, lifecycle, and +30-day archive rule are owned
by **[[planning-conventions]]** §2 — **inject it first** and follow it exactly, don't
restate it: `bin/wiki inject --page planning-conventions --depth 0`.

**Quality vs mechanics.** This skill owns the *mechanics* — create / show / advance /
reprioritize / archive, and the structural side of shaping. Judging whether an item is
*well-shaped* and a roadmap *coherent* (the rubric, coherence rules, readiness gates, and
the evaluation ritual) is the **`roadmap-eval`** skill, against the
[[roadmap-process-spec]]. Reach for `roadmap-eval` when shaping an item to
`ready-for-work`, conforming a pre-spec item, or running a coherence sweep.

## 1. Resolve the project

`<project>` = the active project (latest `⟦project: <name>⟧` marker / work in flight;
any project in your project list plus cross-cutting scopes like `k8s`, `watchtower`, or
`fleet`). Ask if ambiguous. Re-emit the marker. Root: `wiki/roadmaps/<project>/`.

## 2. The actions

**Add an item** ("add to the roadmap …") — create `wiki/roadmaps/<project>/<item-slug>/`
with at minimum `_index.md` (tracking frontmatter per §2b) + `plan.md`. Set
`readiness`/`stage` honestly (a fresh capture is usually `readiness: needs-shaping`,
`stage: backlog`). Add the item to the project `_index.md`'s hand-kept `## Priority
order` list at the rank the user wants (default: bottom). Create the project
`_index.md` (§2a) if this is the first item — never pre-seed empty roadmaps for other
apps.

**Show / list** ("what's on the roadmap?") — read `wiki/roadmaps/<project>/_index.md`
and present the priority order with each item's `stage`. Offer to inject any item's
`_index`/`plan`/shards for depth. No roadmap dir yet → say it's empty and offer to
start one.

**Shape / expand an item** — add or revise shards (`user-stories.md`,
`acceptance-criteria.md`, `tool-selection.md`, `spec.md`, …) and the `plan.md` steps;
bump `readiness` toward `ready-for-work` as it firms up. These are living docs — revise
freely up to completion.

**Advance / update** — move `stage` along the §2c state machine
(`backlog → active → in-review → delivered`), keeping `## Present status` and `plan.md`
checkboxes current. On **delivered**: set `delivered:` (today) and `archive_after:`
(today + 30 days), fill `## Completion notes` (what shipped + PR#/commit), and spin any
loose ends out as todos.

**Reprioritize** — reorder the `## Priority order` list in the project `_index.md` and
mirror each item's `priority:` field.

**Archive pass** ("archive old roadmap items") — per §2d: find items with
`stage: delivered` **and** today ≥ `archive_after`, `git mv` each into
`wiki/roadmaps/<project>/archive/<item>/`, set `stage: archived`. It's a structural
move — if the tree is dirty, follow [[tending-the-garden]] and commit first. Report
which items moved (and which delivered items are not yet 30 days old).

## 3. Finish

Bump `updated:` on every touched page, then run `bin/wiki lint` + `bin/wiki index` so
the roadmaps + logs hubs regenerate. Confirm in a line or two — don't dump whole files
unless asked.
