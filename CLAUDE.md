# Watchtower

A reusable base for building software to one standard and then getting people to use it. Three
pillars: **Build** (the engineering standard in `standards/` and `wiki/standards/`), **Grow** (the
growth corpus in `wiki/growth/`), **Operate** (the wiki, `bin/wiki`, and the skills). It is
brand-neutral and carries no product, client, or infrastructure specifics. Fill those into the
private stub folders in your own clone.

## The law

1. **Wiki first.** Search the wiki before the web: `bin/wiki search <kw>`, then `bin/wiki inject
   --page <slug> --depth 1`. You have standing authority to **write back** what you learn.
   Contract: [[wiki-conventions]]. Tool: [[wiki-tool]].
2. **One fact, one owner.** Record a durable fact at its canonical page; everywhere else *points*
   at it with a `[[wikilink]]`. Never copy a fact into a second page. Link it.
3. **Law vs news.** Dated or status facts ("as of...", version rollouts) are `status: living` and
   belong in `wiki/logs/`, never in a normative page and never in this file.
4. **Correct in place** and bump `updated:`. After wiki edits run `bin/wiki lint` and `bin/wiki
   index`. The pre-commit guard (`bin/check`) enforces the mechanical rules.

## Tending the garden

You maintain this repo as you use it: fix stale facts, collapse duplication into pointers, file new
knowledge at its one owner, regenerate hubs. Full charter: [[tending-the-garden]]. Keep this file
lean. Before adding a line, ask whether it must be true in context before the first tool call. If
not, it is a pointer, not a fact.

## Where things live

**Build.** The rule of record is [[fleet-app-specification]]; the philosophy is
[[laravel-engineering-standard]]; the runnable artifacts every app copies are in
`standards/laravel/`, and its `README.md` is the apply-guide. Front-end architecture is
[[fleet-frontend-specification]], bundled in `standards/react/`. Testing judgment is
[[fleet-testing-doctrine]], with the smell catalog in [[testing-antipattern-catalog]]. The stack
manual is the [stack hub](wiki/stack/_index.md): Laravel architecture, Sail, Inertia/React, Pest,
pre-commit hooks, runtime guardrails.

**Grow.** The corpus hub is [wiki/growth/](wiki/growth/_index.md). Pick a stage with
[[growth-engine-overview]]; get the compressed rule set from [[growth-principles-runbook]]; apply it
to one property with [[product-growth-roadmap-template]]. The five domains are channels,
conversion, lifecycle, measurement, and SEO. Anything public-facing you write is governed by the
`copywriting` skill.

**Operate.** How the wiki works: [[wiki-conventions]], [[wiki-tool]]. How roadmaps and todos are
shaped: [[planning-conventions]].

## Skills

Skills live in `.claude/skills/` and the harness injects each one's description, so invoke when the
task matches. They are **procedure**, not facts: a skill injects the relevant wiki page at runtime
rather than hardcoding a value. Included: wiki maintenance, Pest testing, architecture mapping,
code review, roadmap, roadmap-eval, todo, save, restore, and copywriting. Slash commands: `/wiki`
runs `bin/wiki`, and `/project <slug>` injects a project page once you have created one.

## Your private content

These folders are tracked as empty stubs and `.gitignore`d, so nothing project-specific lands in a
public clone. Fill them in your own private fork:

`wiki/roadmaps/` · `wiki/projects/` · `wiki/infra/` · `wiki/logs/` · `wiki/todos/` ·
`saves/` · `reports/` · `content/`

`wiki/security/` is a partial case: the doctrine ships, your posture does not.

Placeholders to replace with your own values: `your-org`, `git.example.com`, `__APP__`, `acme`,
`<host>`.
