#!/usr/bin/env bash
# PostToolUse hook for Codex edits. This is deliberately best-effort: it only
# checks files that are currently changed in git, and exits cleanly when no
# relevant files changed.
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT" || exit 0

changed="$(
  {
    git diff --name-only -- wiki .claude/skills .agents/skills 2>/dev/null || true
    git ls-files --others --modified --exclude-standard -- wiki .claude/skills .agents/skills 2>/dev/null || true
  } | sort -u
)"

[ -n "$changed" ] || exit 0

rc=0
while IFS= read -r file; do
  case "$file" in
    wiki/*.md)
      if ! out="$(bin/wiki lint --file "$file" 2>&1)"; then
        echo "wiki frontmatter check failed for $file:" >&2
        echo "$out" >&2
        rc=2
      fi
      ;;
  esac
done <<EOF
$changed
EOF

if printf '%s\n' "$changed" | grep -Eq '^(\.claude|\.agents)/skills/.+/SKILL\.md$'; then
  if ! out="$(bin/skill-lint --all 2>&1)"; then
    echo "$out" >&2
    rc=2
  fi
fi

exit "$rc"
