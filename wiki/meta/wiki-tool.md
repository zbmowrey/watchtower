---
title: Wiki Tool
description: bin/wiki — fast search/inject/lint over the markdown wiki. Syntax reference.
tags: [meta, wiki, tooling, search]
type: meta
updated: 2026-06-13
related: [wiki-conventions]
---

# Wiki Tool (`bin/wiki`)

Zero-dependency Python 3 CLI (stdlib only). Uses ripgrep when available, else a
fast pure-python scan. Corpus root resolves to `../wiki` relative to the script,
or `$WATCHTOWER_WIKI` if set, or `--root DIR`.

> If a command below is ever wrong, **fix it here and in CLAUDE.md** — that's
> part of the [[wiki-conventions|self-organizing mandate]].

## Search → lightweight index

```
bin/wiki search <kw>...           # OR-match across all pages
bin/wiki search laravel deploy    # pages mentioning laravel OR deploy
bin/wiki search reverb --type project
bin/wiki search sail --tag docker --tag ports
bin/wiki search k8s --json        # machine-readable rows
```

Output is a compact tree grouped by directory: `path (matches) — description [tags]`,
plus a suggested `inject` command.

## Inject → full content into the chat

```
bin/wiki inject --page projects/acme.md                 # one page, verbatim
bin/wiki inject --page acme --depth 1                    # acme + everything it links to
bin/wiki inject laravel deploy --depth 1                 # search hits + their links
bin/wiki inject --all                                    # whole corpus (small wikis)
bin/wiki inject --page acme --depth 2 --max-bytes 60000  # bounded by byte budget
```

- `--page` accepts a path (`projects/acme.md`), a slug (`acme`), or a title slug.
  Repeatable.
- `--depth N` follows wiki links, markdown `.md` links, and frontmatter
  `related:` slugs, BFS, N hops out (default 0 = just the seeds).
- Output is each page's full body delimited by `===== FILE: <relpath> =====`.

## Validate frontmatter

```
bin/wiki lint                         # whole corpus; non-zero exit on failure
bin/wiki lint --file wiki/projects/acme.md  # one file (used by the edit hook)
```

## Graph helpers

```
bin/wiki links <page>    # inbound + outbound links for a page
bin/wiki tags            # all tags with counts
```

## Enabling the ripgrep fast path

A real `rg` on PATH is used automatically. Otherwise set `$WIKI_RG` to a
ripgrep binary — or to the Claude Code executable (`$CLAUDE_CODE_EXECPATH`),
whose bundled ripgrep runs when invoked with argv0 `rg`. Without either, the
pure-python scan is used (plenty fast for this corpus).

See also: [[wiki-conventions]].
