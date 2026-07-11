# watchtower

## Reference

You can read more about why this project exists [here](https://zbmowrey.com/blog/watchtower-pattern/).

## Introduction

A **general-purpose engineering scaffold** — an opinionated Laravel + React
standard, a searchable on-disk knowledge base, and the agent tooling to operate
both from [Claude Code](https://claude.com/claude-code). Clone it, point your apps
at the standard, and grow the wiki as you learn. It carries no product, client, or
infrastructure specifics — those are yours to fill in.

It is the public, brand-neutral cut of a private "watchtower" repo used to hold a
set of sibling apps to one engineering bar.

| Thing                     | What                                                          | Start here                                                   |
|---------------------------|--------------------------------------------------------------|--------------------------------------------------------------|
| [`CLAUDE.md`](CLAUDE.md)  | The operating manual for an agent working in this repo       | the agent's entry point                                      |
| [`wiki/`](wiki/_index.md) | On-disk permanent memory (a Karpathy-style LLM wiki)         | `bin/wiki search <kw>`                                        |
| [`bin/wiki`](bin/wiki)    | Fast search / inject / lint / index over the wiki            | [`wiki-tool`](wiki/meta/wiki-tool.md)                        |
| `standards/`              | The runnable engineering-standard artifacts your apps copy   | [`standards/laravel/README.md`](standards/laravel/README.md) |
| `.claude/`                | Skills, slash commands, and a harness hook                   | —                                                            |

## What's inside

- **`standards/laravel/`** — the golden config artifacts an app copies to converge on
  the standard: PHPStan/Pint/PHPMD, an architecture-test suite, CI + Renovate workflow
  templates, git hooks, security headers, structured logging. `standards/laravel/README.md`
  is the apply-guide.
- **`standards/react/`** — the front-end companion (the mechanical/expressive split,
  no-god-components, React-19 idioms, FE testing).
- **`wiki/stack/`** — a ~50-page Laravel architecture manual (domain-oriented structure,
  DTOs, actions, repositories, query builders, Eloquent performance, Pest architecture
  testing) plus Sail, Inertia/React, and pre-commit guidance.
- **`wiki/standards/`** — the specs themselves: the rule of record, the engineering
  philosophy, the front-end spec, the testing doctrine.
- **`wiki/meta/`** — how the knowledge base itself works: the frontmatter/linking
  contract, the `bin/wiki` reference, the gardening charter, and planning conventions.
- **`bin/wiki`** — a dependency-light CLI (`rg` if present, else a pure-Python scan) to
  search, inject (page + its links), lint frontmatter, and regenerate the domain hubs.
- **`.claude/skills/`** — reusable agent procedures: wiki maintenance, Pest testing,
  architecture-mapping, code review, roadmap/todo planning, session save/restore, and a
  copywriting standard.

## What's deliberately not inside

This scaffold ships the reusable half of a knowledge base. The private-by-nature
domains are present only as **empty structural stubs** (a tracked `.gitkeep` with a
`.gitignore` rule that blocks their content), so the shape is legible but nothing
project-specific leaks:

`wiki/security/` · `wiki/growth/` · `wiki/roadmaps/` · `wiki/projects/` ·
`wiki/infra/` · `wiki/logs/` · `wiki/todos/` · `saves/` · `reports/` · `content/`

Fill them in your own private clone. Likewise, infra/fleet-ops skills (deploy tracing,
CI-log fetching, spec-conformance scorecards, multi-app orchestration) were left out
because they assume a specific stack — bring your own.

Placeholders you'll see and should replace: `your-org`, `git.example.com`, `__APP__`,
`acme`, `<host>`.

## Using it

```bash
git config core.hooksPath .githooks   # activate the wiki pre-commit guard (once per clone)
bin/wiki search <keyword>             # find a page
bin/wiki inject --page <slug> --depth 1   # pull a page + everything it links to
bin/wiki lint                         # validate frontmatter
bin/wiki index                        # regenerate the domain hubs
```

To adopt the engineering standard in a Laravel app, start at
[`standards/laravel/README.md`](standards/laravel/README.md).

## License

See [`LICENSE`](LICENSE).
