#!/usr/bin/env bash
# PostToolUse hook: after a Write/Edit, if the touched file is a wiki page,
# validate its frontmatter. Non-blocking — the edit has already happened; we
# just feed any problem back to Claude (exit 2) so it self-corrects.
set -euo pipefail

# Repo root = two dirs up from this hook (.claude/hooks/ -> repo root).
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WIKI="$ROOT/wiki"
TOOL="$ROOT/bin/wiki"

# Hook input arrives as JSON on stdin.
payload="$(cat)"
file="$(printf '%s' "$payload" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)"

# Only act on markdown files inside the wiki.
case "$file" in
  "$WIKI"/*.md) ;;
  *) exit 0 ;;
esac

[ -x "$TOOL" ] || exit 0

if ! out="$("$TOOL" lint --file "$file" 2>&1)"; then
  echo "wiki frontmatter check failed for ${file#"$ROOT/"}:" >&2
  echo "$out" >&2
  echo "Fix the frontmatter (required: title, description, tags, type) and re-validate with: bin/wiki lint --file \"$file\"" >&2
  exit 2
fi
exit 0
