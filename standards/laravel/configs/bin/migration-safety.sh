#!/usr/bin/env bash
# Fleet migration-safety gate — fleet-app-specification §6 (expand/contract).
#
# WHY: migrations run in an ArgoCD PreSync hook, BEFORE the new code serves —
# and a GitOps tag revert rolls back code but cannot un-migrate. Destructive
# DDL (drops/renames/type changes) therefore breaks either the still-running
# old pods (during sync) or the reverted code (after a rollback). The fleet
# rule is expand/contract: the EXPAND PR adds the new shape (nullable column,
# dual-write) and ships; only a LATER contract PR removes the old shape, once
# no deployable revision still reads it.
#
# WHAT: scans migrations ADDED relative to the base ref for destructive DDL.
# A destructive migration must carry a marker comment acknowledging the
# contract phase:
#
#     // expand-contract: <why this drop is safe now — what stopped reading it>
#
# Usage: migration-safety.sh [<base-ref>]     (default: origin/main)
# CI: the checkout is depth-1, so fetch the base first (the ci.yml step does
# `git fetch --depth=1 origin main` before invoking). The two-endpoint tree
# diff below needs no merge base, so shallow clones are fine.
set -euo pipefail

BASE="${1:-origin/main}"
PATTERN='dropColumn|dropTable|dropIfExists.*(rename|old)|renameColumn|renameTable|->change\(|dropForeign|dropConstrainedForeignId'

fail=0
while IFS= read -r f; do
  [ -f "$f" ] || continue
  if grep -qE "$PATTERN" "$f" && ! grep -q 'expand-contract:' "$f"; then
    echo "✗ $f — destructive DDL without an 'expand-contract:' marker"
    grep -nE "$PATTERN" "$f" | head -5
    fail=1
  fi
done < <(git diff --name-only --diff-filter=A "$BASE" HEAD -- 'database/migrations/*.php')

if [ "$fail" -ne 0 ]; then
  cat <<'MSG'

Destructive migrations must follow expand/contract (fleet-app-specification §6):
  1. EXPAND PR — add the new column/table (nullable/defaulted), dual-write,
     backfill; nothing is dropped. Ships normally.
  2. CONTRACT PR — later, after no deployable revision reads the old shape,
     drop it and mark the migration:
         // expand-contract: <what stopped reading this, and when>
The marker is an acknowledgement, not a bypass — write the reason.
MSG
  exit 1
fi
echo "migration-safety: OK (no unmarked destructive migrations added vs ${BASE})"
