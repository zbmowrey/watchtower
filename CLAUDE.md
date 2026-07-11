# Watchtower — a general-purpose engineering scaffold

This repo is a **reusable base** for engineering a set of apps to one standard: an
on-disk **wiki** (searched with `bin/wiki`), the **standards** artifacts every app
copies (`standards/`), and the **skills** (`.claude/skills/`). It is brand-neutral —
it carries no product, client, or infrastructure specifics. Fill those into the
private stub folders (see below) in your own clone.

## The law

1. **Wiki first.** Search the wiki before the web — `bin/wiki search <kw>` then
   `bin/wiki inject --page <slug> --depth 1`. You have standing authority to **write
   back** what you learn. Contract → [[wiki-conventions]]; tool → [[wiki-tool]].
2. **One fact, one owner.** Record a durable fact at its canonical page; everywhere
   else *points* to it with a `[[wikilink]]`. Never copy a fact into a second page —
   link it.
3. **Law vs news.** Dated/status facts ("as of…", version rollouts) are `status:
   living` and belong in `wiki/logs/`, never in a normative page or in this file.
4. **Correct in place** and bump `updated:`; after wiki edits run `bin/wiki lint` +
   `bin/wiki index`. The pre-commit guard (`bin/check`) enforces the mechanical rules.

## Tending the garden

You maintain this repo as you use it: fix stale facts, collapse duplication into
pointers, file new knowledge at its one owner, regenerate hubs. Full charter →
[[tending-the-garden]]. Keep this file lean — before adding a line, ask whether it
must be true in-context before the first tool call; if not, it's a pointer, not a fact.

## Where things live

- **The engineering standard** — the rule of record → [[fleet-app-specification]]; the
  philosophy → [[laravel-engineering-standard]]; the runnable artifacts every app
  copies → `standards/laravel/` (its `README.md` is the apply-guide). **Front-end** →
  [[fleet-frontend-specification]]; its bundle → `standards/react/`.
- **The stack manual** → [[stack]] hub (Laravel architecture, Sail, Inertia/React,
  Pest, pre-commit, runtime guardrails).
- **Testing doctrine** → [[fleet-testing-doctrine]].
- **How the wiki works** → [[wiki-conventions]], [[wiki-tool]], [[planning-conventions]].

## Skills

Skills live in `.claude/skills/`; the harness injects each one's description — invoke
when the task matches. They are **procedure**, not facts. Included: wiki maintenance,
Pest testing, architecture-mapping, code review, roadmap/roadmap-eval/todo planning,
session save/restore, and a copywriting standard. Slash commands: `/wiki` (runs
`bin/wiki`), `/project <slug>` (inject a project page once you've created one).

## Your private content (structural stubs)

These folders are tracked as empty stubs and `.gitignore`d so nothing project-specific
lands in a public clone. Fill them in your own private fork:

`wiki/security/` · `wiki/growth/` · `wiki/roadmaps/` · `wiki/projects/` ·
`wiki/infra/` · `wiki/logs/` · `wiki/todos/` · `saves/` · `reports/` · `content/`

Placeholders to replace with your own values: `your-org`, `git.example.com`, `__APP__`,
`acme`, `<host>`.
