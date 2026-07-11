---
description: Inject a project's wiki page plus its linked pages into context
argument-hint: <project-slug>
allowed-tools: Bash(bin/wiki:*), Bash(./bin/wiki:*)
---

Full wiki context for project "$ARGUMENTS" (page + everything it links to):

!`bin/wiki inject --page $ARGUMENTS --depth 1`

Use this as the working context for the project. If a fact here is stale, fix the
page per the wiki-maintenance mandate.
