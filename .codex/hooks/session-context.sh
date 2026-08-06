#!/usr/bin/env bash
# SessionStart hook for Codex. Reuse whatever Claude startup helpers this clone
# has, so both agents receive the same project context. Every helper is optional:
# a fresh clone ships none of them and this hook is then a clean no-op.
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

for hook in "$ROOT"/.claude/hooks/*.sh; do
  [ -e "$hook" ] || continue
  case "$(basename "$hook")" in
    # Edit-time guards are wired separately by PostToolUse; only startup
    # context helpers belong here.
    wiki-lint.sh|skill-lint.sh) continue ;;
  esac
  [ -x "$hook" ] && "$hook" || true
done
