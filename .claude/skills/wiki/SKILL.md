---
name: wiki
description: Run Watchtower wiki search, inject, lint, links, tags, or index commands through bin/wiki. Use when the user asks to search the wiki, inject wiki context, validate wiki pages, inspect wikilinks, list tags, or run the old /wiki command behavior.
---

# wiki

Use `bin/wiki` from the watchtower repo. The wiki is the durable memory, so search
it before using the web or relying on memory for project facts.

## Common Commands

```bash
bin/wiki search <keywords>
bin/wiki inject --page <slug> --depth 1
bin/wiki lint
bin/wiki lint --file wiki/<domain>/<page>.md
bin/wiki links <slug>
bin/wiki tags
bin/wiki index
```

After `search`, inspect the best owning page with `inject` before acting on the
fact. If a wiki fact is stale, correct it at the owning page and validate with
`bin/wiki lint` plus `bin/wiki index` when hubs may change.
