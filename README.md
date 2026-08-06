# watchtower

139 wiki pages, 66 runnable config artifacts, and 12 agent skills, in one repo you clone and
point at your own work.

Watchtower is a scaffold for building software to a standard and then getting people to use it.
It carries three things: an opinionated Laravel + React engineering standard you can actually run,
a growth corpus for the part after the code ships, and the agent tooling that operates both from
[Claude Code](https://claude.com/claude-code). It holds no product, client, or infrastructure
specifics. Those are yours to fill in.

## Three pillars

| Pillar | What it is | Where |
|---|---|---|
| **Build** | The engineering standard: specs, arch tests, CI templates, static-analysis config, git hooks | `standards/`, `wiki/standards/`, `wiki/stack/` |
| **Grow** | The growth engine: positioning, conversion, lifecycle, SEO, channels, measurement | `wiki/growth/` |
| **Operate** | The agent layer: an on-disk wiki, a search CLI, reusable skills | `bin/`, `.claude/`, `wiki/meta/` |

Most scaffolds stop at the first pillar. Shipping clean code to nobody is still shipping to nobody.

## Build

`standards/laravel/` is the bundle an app copies to get linted, typed, tested, and gated the same
way every time: PHPStan at level 8 with no baseline, Pint, PHPMD complexity ceilings, Psalm taint
analysis, a six-file architecture-test suite, CI and Renovate workflow templates, husky hooks,
nonce-based security headers, structured logging. `standards/laravel/README.md` is the apply-guide,
and `scaffold/apply.sh` does most of it for you.

`standards/react/` is the front-end half: the mechanical/expressive split (plumbing converges
byte-for-byte, look and motion stay free), the no-god-components rule, React 19 idioms, front-end
testing.

`wiki/standards/` holds the specs themselves, written as requirements rather than suggestions: the
app spec, the front-end spec, the testing doctrine, and the engineering philosophy behind them.

`wiki/stack/` is a 50-page reference, including a 44-page Laravel architecture manual
(domain-oriented structure, DTOs, actions, repositories, query builders, Eloquent performance, Pest
architecture testing) plus Sail, Inertia/React, and pre-commit guidance.

## Grow

`wiki/growth/` is 52 execution pages covering the work that starts when the code is done:
positioning and ICP, landing-page anatomy, offer and pricing, A/B testing statistics, activation
and onboarding, trial-to-paid conversion, retention and churn, referral, a full SEO program
(keyword research, search intent, technical SEO, structured data, topical authority, programmatic
SEO, local SEO, AI search and GEO, site migrations, monitoring), acquisition channels, and the
measurement stack underneath all of it.

Every page is a direct execution checklist: what to do, when to use it, how to run it, what to
watch, what to avoid. Start at `wiki/growth/growth-engine-overview.md` to pick a stage, or
`wiki/growth/growth-principles-runbook.md` for the compressed rule set.

## Operate

The wiki is on-disk permanent memory: plain markdown with frontmatter, one fact with one owner,
everything else pointing at it with `[[wikilinks]]`.

`bin/wiki` searches it, injects a page plus everything that page links to, lints the frontmatter
contract, and regenerates the domain hubs. It needs nothing beyond Python, and uses `rg` when it
finds one.

The same procedures run under more than one agent runtime: `AGENTS.md` is Codex's entry point
and points at `CLAUDE.md` as the shared law, `.agents/skills` symlinks to `.claude/skills` so a
workflow is never hand-copied, and `bin/codex-setup check` validates the wiring.

`.claude/skills/` holds 12 reusable agent procedures: wiki maintenance, Pest testing, architecture
mapping, code review, roadmap and todo planning, session save and restore, and a copywriting
standard. `bin/check` is the mechanical anti-rot suite, wired to a pre-commit hook.

## What is deliberately not here

The private-by-nature domains ship as empty structural stubs, tracked with a `.gitkeep` and a
`.gitignore` rule that blocks their contents. The shape stays legible and nothing project-specific
leaks:

`wiki/roadmaps/` · `wiki/projects/` · `wiki/infra/` · `wiki/logs/` · `wiki/todos/` ·
`wiki/security/` · `saves/` · `reports/` · `content/`

Fill them in your own clone. Infra and fleet-ops skills (deploy tracing, CI-log fetching,
spec-conformance scorecards, multi-app orchestration) are left out as well, because they assume a
specific stack. Bring your own.

Placeholders you will see and should replace: `your-org`, `git.example.com`, `__APP__`, `acme`,
`<host>`.

## Using it

```bash
git config core.hooksPath .githooks       # activate the pre-commit guard, once per clone
bin/wiki search <keyword>                 # find a page
bin/wiki inject --page <slug> --depth 1   # pull a page plus everything it links to
bin/wiki lint                             # validate frontmatter
bin/wiki index                            # regenerate the domain hubs
```

To adopt the engineering standard in a Laravel app, start at
[`standards/laravel/README.md`](standards/laravel/README.md). To put the growth corpus to work on a
property, start at [`wiki/growth/_index.md`](wiki/growth/_index.md). To understand how the wiki
itself works, read [`wiki/meta/wiki-conventions.md`](wiki/meta/wiki-conventions.md).
[`CLAUDE.md`](CLAUDE.md) is the operating manual an agent reads first.

## License

See [`LICENSE`](LICENSE).
