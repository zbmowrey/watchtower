---
title: Planning Conventions — Todos & Roadmaps
description: The fleet practice for per-project planning — lightweight one-off todo lists (wiki/todos/<slug>-todos.md) and prioritized, sharded product roadmaps (wiki/roadmaps/<project>/). The single owner of both formats; the todo and roadmap skills are thin procedure that inject this page.
tags: [meta, planning, roadmap, todo, conventions]
type: meta
status: normative
updated: 2026-06-28
related: [wiki-conventions, tending-the-garden, roadmaps, todos]
---

# Planning Conventions — Todos & Roadmaps

Two per-project planning artifacts, both **`status: living`** ("news", per
*Law vs news* in [[wiki-conventions]]). This page is their **single owner** — the
format lives here once; the `todo` and `roadmap` skills (§3) are thin procedure that
inject this page rather than re-stating the format.

| Artifact      | Holds                                              | Lives at                                       | Lifecycle                                       |
|---------------|----------------------------------------------------|------------------------------------------------|-------------------------------------------------|
| **Todo list** | One-off items to tackle eventually                 | `wiki/todos/<slug>-todos.md` (one per project) | add → done **& validated** → **delete the row** |
| **Roadmap**   | Prioritized features / milestones, with deep dives | `wiki/roadmaps/<project>/<item>/`              | shape → active → delivered → archive (+30d)     |

> **Naming — do not confuse two "roadmaps".** A **product roadmap** (this page) lives
> under `wiki/roadmaps/` and tracks *features we want to build*. A
> **convergence roadmap** (`wiki/logs/<slug>-convergence-roadmap.md`) tracks
> *deviations from [[fleet-app-specification]]* and is owned by the
> `convergence-audit` skill. Different domain, different owner.

`<slug>` / `<project>` is the app's `apps.json` slug (read via `bin/fleet`), plus
`k8s`, `watchtower`, or `fleet` for cross-cutting work.

---

## 1. Todo lists — the one-off backlog

A flat, greppable list of *small, one-off* items — the things worth doing "at some
point" that don't warrant a roadmap item. One file per project:
`wiki/todos/<slug>-todos.md`.

**Format** — a single table, newest discipline is the lifecycle, not the order:

```markdown
---
title: <Display> — Todos
description: One-off todo backlog for <display>. Items are deleted on confirmed + validated completion (see [[planning-conventions]]).
tags: [todo, <slug>]
type: todo
status: living
updated: 2026-06-28
related: [<slug>]
---

# <Display> — Todos

One-off backlog. Items are **deleted** once done **and validated** — this list only
ever shows live work. Deeper work belongs on the roadmap page, not here.

| # | Description | Detail | Status | Updated |
|---|-------------|--------|--------|---------|
| 1 | <what to do, imperative> | `<detail-page>` or — | open | 2026-06-28 |
```

- **Description** — one imperative line ("Wire Paddle webhook retries").
- **Detail** — a wiki link to a deeper page (often a roadmap item) or `—` if the
  row is self-contained. If a todo grows real depth, promote it to a roadmap item and
  point the Detail at it.
- **Status** — `open` | `doing` | `blocked` (with a why). There is **no `done`** — a
  done-and-validated item is *removed*, not marked.
- **Updated** — ISO date the row last changed.

**Lifecycle (the whole point):** add a row when asked; when the item is **confirmed
done and its result validated**, **delete the row entirely**. The list is always a
snapshot of live work, never a graveyard. Renumber freely or leave gaps — `#` is just
a handle for "do #2", not a stable id.

Create the file lazily on first `add a todo` for a project; never pre-seed empty
files. Bump frontmatter `updated:` on every change and re-run `bin/wiki index` so the
todos hub stays honest.

---

## 2. Roadmaps — prioritized, sharded, living

> **Format vs quality.** This page owns the roadmap **format** (the structure below —
> the lint-floor). The **quality bar** — how to evaluate whether an item is *well-shaped*
> and a roadmap *coherent* (the item rubric, coherence rules, and evaluation ritual) — is
> the Roadmap Process Spec (`wiki/roadmaps/spec/`). Conform to both.

A project roadmap is a **prioritized list of features/milestones**, each a directory
of living planning docs. Domain layout:

```
wiki/roadmaps/
  _index.md                      domain hub (generated nav; this page is the law)
  <project>/
    _index.md                    the project's PRIORITIZED roadmap (order is hand-kept)
    archive/                     delivered items aged out (+30d) land here
    <item-slug>/
      _index.md                  the item: tracking frontmatter + outcome + status
      plan.md                    the sequenced checklist of steps (mandatory)
      <shard>.md                 deeper dives, added as the item is shaped
```

**Minimum for a new item:** `_index.md` + `plan.md`. **Shards** (`user-stories.md`,
`acceptance-criteria.md`, `tool-selection.md`, `spec.md`, `design.md`, …) are added as
the item is shaped — don't manufacture empty shards.

### 2a. The project roadmap — `wiki/roadmaps/<project>/_index.md`

```markdown
---
title: <Display> — Product Roadmap
description: Prioritized feature/milestone roadmap for <display>.
tags: [roadmap, <slug>]
type: roadmap
status: living
updated: 2026-06-28
related: [<slug>]
---

# <Display> — Product Roadmap

Prioritized below; each links to its item. Lifecycle + format → [[planning-conventions]].

## Priority order
1. `<item-a-slug>` — _stage · one-line outcome_
2. `<item-b-slug>` — _stage · one-line outcome_

<!-- shards:begin -->
<!-- generated by `bin/wiki index` — do not hand-edit between the markers -->
<!-- shards:end -->
```

Priority is **hand-maintained** in the `## Priority order` list above the markers
(generated nav is alphabetical and can't express rank). The generated block is just a
complete index of the item subhubs.

### 2b. The roadmap item — `<item-slug>/_index.md`

Frontmatter carries the tracking metadata; the body carries the churny status and the
links to plan + shards.

```markdown
---
title: <Item Name>
description: <what this delivers and why, one line>
tags: [roadmap, <slug>]
type: roadmap
status: living
updated: 2026-06-28
related: [<slug>]
# --- roadmap-item tracking ---
priority: 1                 # rank within the project roadmap (mirror the _index order)
readiness: needs-shaping    # needs-shaping | shaping | ready-for-work
stage: backlog              # backlog | active | in-review | delivered | archived
delivered:                  # ISO date delivered; blank until done
archive_after:              # delivered + 30d; set on delivery → drives the archive pass
---

# <Item Name>

## Outcome
What "done" looks like — the user-visible result and why it matters.

## Present status
Free-text current note — the churny one ("blocked on X", "PR #42 in review",
"plan steps 1–3 landed"). Keep `updated:` in sync.

## Plan & detail
- [Plan](plan.md) — the sequenced steps
- `<shard-slug>` links for acceptance criteria, tool selection, and any other shaped shards

## Completion notes
_(filled on delivery: what shipped, where — PR#/commit — and any follow-ups spun out
as todos.)_

<!-- shards:begin -->
<!-- generated by `bin/wiki index` — do not hand-edit between the markers -->
<!-- shards:end -->
```

The item `_index.md` is itself a **hub** (its dir holds `plan.md` + shards), so it carries
the **shards markers** like §2a — `bin/wiki index` fills them with a generated index of the
item's `plan.md` + shards. The hand-kept `## Plan & detail` list stays the curated reading
order; the generated block is the complete leaf index. Omit the markers and `bin/wiki index`
warns.

**The two status axes are distinct** — don't overload them:

- `status:` (wiki frontmatter) is the **volatility** marker — always `living` here.
- `stage:` is the **lifecycle** bucket; `readiness:` is *is it shaped enough to start*.

`plan.md` is a checklist. Like **every** page in the wiki, it (and every shard) carries the
standard frontmatter — `bin/wiki lint` enforces `title`/`description`/`tags`/`type` on all
`.md` files, shards included:

```markdown
---
title: <Item Name> — Plan
description: <one line>
tags: [roadmap, <slug>]
type: roadmap
status: living
updated: 2026-06-28
related: [<slug>]
---

# <Item Name> — Plan

1. [ ] First step
2. [ ] Second step
3. [x] Done step
```

### 2c. Lifecycle & living-doc discipline

Roadmap docs are **living** — reviewed, expanded, revised right up to completion. The
state machine:

| stage       | meaning                    | on entry                                                                              |
|-------------|----------------------------|---------------------------------------------------------------------------------------|
| `backlog`   | captured, maybe not shaped | set `readiness` honestly                                                              |
| `active`    | being worked               | keep `## Present status` + `plan.md` current                                          |
| `in-review` | built, under review/PR     | link the PR in `## Present status`                                                    |
| `delivered` | shipped & validated        | set `delivered:` (today) + `archive_after:` (today + 30d); fill `## Completion notes` |
| `archived`  | aged out                   | item dir moved to `<project>/archive/`                                                |

Always bump `updated:` and re-run `bin/wiki index` after edits.

### 2d. Archiving (+30 days after delivery)

Delivered items stay visible for 30 days, then archive on a **user-triggered pass**
("archive old roadmap items"). The pass:

1. Find items with `stage: delivered` **and** today ≥ `archive_after`.
2. `git mv wiki/roadmaps/<project>/<item>/ wiki/roadmaps/<project>/archive/<item>/`
   (a structural move — by [[tending-the-garden]], commit before moving if the tree is
   dirty so nothing is lost).
3. Set `stage: archived` in the moved `_index.md`; bump `updated:`.
4. Re-run `bin/wiki lint` + `bin/wiki index`.

The `archive/` subdir keeps history discoverable but out of the active priority list.

---

## 3. The skills

- **`todo`** — `add a todo`, `what's on my todo list?`, `todo done`. Manages
  `wiki/todos/<slug>-todos.md` per §1.
- **`roadmap`** — `add to the roadmap`, `what's on the roadmap?`, `show roadmap`,
  `advance/update roadmap item`, `archive roadmap items`. Manages the
  `wiki/roadmaps/<project>/` tree per §2.

Both resolve the active project from the `⟦project: <name>⟧` marker / current work,
inject **this page** for the format, and always finish with `bin/wiki lint` +
`bin/wiki index`.
