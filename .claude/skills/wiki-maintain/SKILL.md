---
name: wiki-maintain
description: Add, update, validate, and reorganize pages in the watchtower wiki (the on-disk memory). Use when capturing something newly learned, correcting a stale fact, splitting/merging pages, or fixing frontmatter/links. Encodes the self-organizing rules.
---

# wiki-maintain

The wiki is the project's permanent memory. This skill is the explicit, on-demand
version of the standing mandate in `CLAUDE.md` and [wiki-conventions].

## When to write

- You learned something durable (from the web, a repo, or debugging).
- A fact in the wiki is wrong or out of date.
- A page is covering two concepts and should be split, or two pages overlap.

## How

1. **Find the home:** `bin/wiki search <keywords>`. Update an existing page if one
   fits; only create a new page for a genuinely new concept.
2. **One concept per file.** Path: `wiki/<area>/<slug>.md`
   (`area` ∈ projects | infra | stack | meta | reference).
3. **Valid frontmatter** (required: `title, description, tags, type`; `type` ∈
   project|infra|stack|meta|reference). Bump `updated:`. Write a `description`
   that's useful in a search index.
4. **Link generously** with `[[slug]]`; add `related:` slugs. A link to a
   not-yet-written page is fine — it's a TODO marker.
5. **Correct in place** — make the page true as-of-now; don't append "actually…".
6. **Validate:** `bin/wiki lint` (the edit hook also lints on save).
7. **Wire it in:** add new top-level pages to `wiki/_index.md`.

## Quality bar

- Concise and scannable; tables for matrices; commands in fenced blocks.
- Distinguish **verified** facts from recon/assumptions — flag the latter so a
  future pass knows to confirm.
- Prune or fix wrong content; a confidently-wrong memory is worse than none.

Reference: [wiki-conventions], [wiki-tool].
