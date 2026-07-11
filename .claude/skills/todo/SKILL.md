---
name: todo
description: Manage a project's one-off todo backlog (the small "do it at some point" items). Use when the user says "add a todo", "what's on my todo list?", "remove/clear a todo", or reports a todo done. Each project's list is a status:living markdown table at wiki/todos/<slug>-todos.md; items are DELETED on confirmed + validated completion, never marked done. Deeper, multi-step work belongs on the roadmap skill instead, not here.
---

# todo

Maintain a project's **one-off backlog** — small items worth doing eventually that
don't warrant a roadmap item. One file per project: `wiki/todos/<slug>-todos.md`.

The format and lifecycle are owned by **[[planning-conventions]]** §1 — inject it for
the canonical table shape, don't restate it:
`bin/wiki inject --page planning-conventions --depth 0`.

## 1. Resolve the project

The `<slug>` is the active project — read it from the latest `⟦project: <name>⟧`
marker / the work in flight (any project in your project list, plus cross-cutting
scopes like `k8s`, `watchtower`, or `fleet`). If it's genuinely ambiguous, ask which
one; don't guess across apps. Re-emit the `⟦project: <slug>⟧` marker.

File path: `wiki/todos/<slug>-todos.md`.

## 2. The actions

**Add** ("add a todo …") — append a row. If the file doesn't exist, create it with the
§1 frontmatter + header + table (lazily — never pre-seed empty files for other apps).

- Description = one imperative line.
- Detail = a `[[wikilink]]` to a deeper page if one exists (often a roadmap item), else `—`.
- Status = `open` (or `doing`/`blocked` if the user says so).
- Updated = today (ISO).
- `#` is just a handle — next integer, gaps are fine.
- If the item is clearly multi-step / needs shaping, say so and offer to make it a
  **roadmap item** instead (via the roadmap skill), pointing the todo's Detail at it.

**List** ("what's on my todo list?") — read the file and show the table as-is. If
empty/missing, say the list is clear. Offer to `bin/wiki inject` any Detail pages the
user wants to dig into. For a fleet-wide view, scan `wiki/todos/*-todos.md`.

**Done** (user reports an item finished) — this list has **no done state**. Confirm
the item is *actually* done **and its result validated** (merged/landed/verified — not
just "I think so"); if you can cheaply check (PR/commit/test), do. Once confirmed,
**delete the row entirely** and renumber or leave gaps. If it's done but *not* yet
validated, leave it and note why.

**Remove/clear** — delete the named row(s) on request, same as Done minus the
validation (the user is explicitly dropping it).

## 3. Finish

Bump frontmatter `updated:` on any change, then run `bin/wiki lint` +
`bin/wiki index` so the todos hub stays honest. Give a one-line confirmation (what
changed + the live count), not a dump of the whole table unless asked.
