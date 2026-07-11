---
description: Search / inject / lint the watchtower wiki via bin/wiki
argument-hint: search <kw>... | inject --page <slug> --depth 1 | lint | links <slug> | tags
allowed-tools: Bash(bin/wiki:*), Bash(./bin/wiki:*)
---

Output of `bin/wiki $ARGUMENTS`:

!`bin/wiki $ARGUMENTS`

Use the result above. If this was a `search`, consider following up with
`bin/wiki inject` on the most relevant hits to pull their full content.
