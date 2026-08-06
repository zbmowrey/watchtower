---
name: roadmap-eval
description: Evaluate and shape product-roadmap items against the watchtower roadmap process — score an item on the quality rubric, shape it toward ready-for-work, conform a pre-spec item to the canonical shape, or run a whole-roadmap coherence sweep. Use when the user asks to evaluate / assess / grade a roadmap item, shape or flesh out an item to ready, conform an item to the spec, check whether a roadmap is coherent / consistent, reconcile an item against its launch/convergence/project docs, or run a coherence sweep. This is the QUALITY companion to the `roadmap` skill (which owns item CRUD + lifecycle) — that one manages the list; this one judges and improves it. Distinct from `convergence-audit` (spec-parity of app code) and the `todo` skill (one-off backlog).
---

# roadmap-eval

Apply the **watchtower roadmap process** — the quality/evaluation standard — to a roadmap
item or a whole project roadmap. The standard is owned by your own **roadmap process
spec** — write it once, keep it beside the roadmaps it governs; **inject it first** and
follow it, don't restate it here:

```
bin/wiki inject --page roadmap-process-spec --depth 1
```

If you have not written that spec yet, [[planning-conventions]] carries enough of the
shape to work from, and the rubric in §2 below stands on its own.

(`--depth 1` pulls the four shards — item rubric, coherence rules, evaluation process,
decisions log.)

This is the **quality** layer ("is the item *good*?"). The *mechanics* — creating dirs,
frontmatter, lifecycle transitions (`stage:`), archiving — belong to the `roadmap` skill
and [[planning-conventions]] ("will it *lint*?"). Don't duplicate those here; hand
lifecycle/CRUD work to `roadmap`.

## 1. Resolve the target

- **Project** = the active project (latest `⟦project: <name>⟧` marker / work in flight;
  any project in your project list plus cross-cutting scopes like `k8s`, `watchtower`,
  `fleet`). Re-emit the marker. Root: `wiki/roadmaps/<project>/`.
- **Scope** = one item (`wiki/roadmaps/<project>/<item-slug>/`) or the whole project
  roadmap. Ask only if genuinely ambiguous.

## 2. The actions (the spec's five-step process, on demand)

**Evaluate an item** ("evaluate / assess / is this well-shaped?") — run the spec's
**item evaluation checklist** against the item. Report a short pass/fail per criterion
with `file:line`, and the **honest `readiness`** it actually clears per the gates. Read
only — don't edit unless asked.

**Shape an item** ("shape / flesh out X to ready") — drive it up the readiness gates:
sharpen `## Outcome` to a user-visible result; surface `## Open decisions` (each with
options + a recommendation + an owner); write testable `## Acceptance criteria`; state
`## Dependencies`; then **reconcile against sibling planning docs (coherence R-4)** — the
project page, launch/commercial plan, convergence roadmap, and any newer ideation
council. Ratify already-locked decisions (don't re-litigate); keep only the
genuinely-open as open. Set `readiness:` to the gate it now clears.

**Conform a pre-spec item** ("conform this to the spec") — bring it to the canonical
section shape with the **fixed names** (`## Why this rank`, `## Acceptance criteria`,
`## Dependencies`), fix the `priority:` mirror, resolve links. This is the
**conform-on-touch** path (decision D8): do it whenever you touch an item that predates
the spec — including the fleet roadmaps migrated before it existed.

**Coherence sweep** ("is the roadmap coherent? / run a coherence sweep") — run coherence
rules **R-1…R-6** across the whole project: unexplained ranks, uphill dependency gates,
overlapping owners, items that contradict a sibling doc, stale/`delivered`-but-future
items, naming/order drift. Output a short **violations list** with a fix for each; apply
only if asked.

Match rigor to stakes (spec → "Scaling the rigor"): a small item needs Outcome +
acceptance + honest readiness; a keystone/launch-blocking item gets the full rubric +
reconciliation + a recommendation on every open decision; a disputed *priority order*
may warrant a scoring/ideation council (record it in `wiki/logs/`).

## 3. Evolve the spec when it falls short

If an evaluation hits something the spec doesn't cover or gets wrong, **change the spec
first**: add an entry to its decisions log (a new `Dn`, or an open question), then update
the affected rule page. The spec changes by *logged decision* — a rule you can't trace to
a decision is a rule nobody owns.

## 4. Finish

Bump `updated:` on every touched page; run `bin/wiki lint` + `bin/wiki index` so the hubs
stay honest. **This repo is a shared working tree** — if you commit, use explicit paths
(`git commit -- <your paths>`), never `git add -A`. Confirm in a line or two; surface any
maintainer-only open decisions and coherence violations rather than guessing them.
