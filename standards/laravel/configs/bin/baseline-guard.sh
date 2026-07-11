#!/usr/bin/env sh
# baseline-guard — enforce engineering-standard §2's one-way ratchet: a static-analysis
# baseline may SHRINK but never GROW (never re-generated to absorb new findings). It
# counts the suppressed findings in each baseline file on HEAD vs the branch's MERGE-BASE
# with the base branch and fails if any grew. Comparing at the merge-base (not the base
# tip) isolates the PR's own effect, so a teammate shrinking a baseline on main can't
# false-positive an untouched PR.
#
# Pure POSIX sh + git/grep/awk — no language runtime required (CI, a git hook, anywhere).
#
#   baseline-guard.sh [--base=origin/main] [file ...]
# CI must make the base reachable first:  git fetch --depth=50 origin main
# Exit 0 = all baselines held or shrank · 1 = a baseline grew · 2 = can't compare.
set -u

base="${BASELINE_GUARD_BASE:-origin/main}"
files=""
for arg in "$@"; do
  case "$arg" in
    --base=*) base=${arg#--base=} ;;
    *)        files="$files $arg" ;;
  esac
done
[ -n "${files# }" ] || files="phpstan-baseline.neon phpmd.baseline.xml psalm-baseline.xml"

# Count suppressed findings from stdin; format auto-detected by content:
#   phpmd  -> number of <violation> elements
#   psalm  -> sum of occurrences="N"
#   phpstan/larastan NEON -> sum of `count: N`
count() {
  awk '
    { s=$0; while ((i=index(s,"<violation"))>0) { v++; s=substr(s,i+10) } }
    { s=$0; while (match(s,/occurrences="[0-9]+"/)) {
        t=substr(s,RSTART,RLENGTH); gsub(/[^0-9]/,"",t); o+=t; s=substr(s,RSTART+RLENGTH) } }
    /^[ \t]*count:[ \t]*[0-9]+[ \t]*$/ { c=$0; gsub(/[^0-9]/,"",c); n+=c; seen=1 }
    /ignoreErrors/ { neon=1 }
    END { if (v>0) print v; else if (o>0) print o; else if (seen) print n;
          else if (neon) print 0; else print 0 }
  '
}

# The base ref MUST be reachable — otherwise we would silently pass a grown baseline.
if ! git rev-parse --verify --quiet "${base}^{commit}" >/dev/null 2>&1; then
  echo "baseline-guard: base ref '$base' not reachable — run 'git fetch --depth=50 origin main' first." >&2
  exit 2
fi
cmp=$(git merge-base "$base" HEAD 2>/dev/null) || cmp=""
if [ -z "$cmp" ]; then
  cmp="$base"
  echo "baseline-guard: no merge-base (shallow history?) — comparing against $base tip." >&2
fi

failed=0
checked=0
for f in $files; do
  head_exists=0; [ -f "$f" ] && head_exists=1
  base_blob=$(git show "$cmp:$f" 2>/dev/null); base_rc=$?
  base_exists=0; [ "$base_rc" -eq 0 ] && base_exists=1
  [ "$head_exists" -eq 0 ] && [ "$base_exists" -eq 0 ] && continue
  checked=$((checked + 1))

  if [ "$head_exists" -eq 1 ]; then head_count=$(count < "$f"); else head_count=0; fi
  if [ "$base_exists" -eq 1 ]; then base_count=$(printf '%s\n' "$base_blob" | count); else base_count=0; fi

  if [ "$base_exists" -eq 0 ]; then
    echo "•  $f: NEW baseline ($head_count suppressed) — first adoption, allowed"
  elif [ "$head_count" -gt "$base_count" ]; then
    echo "✗  $f: baseline GREW $base_count → $head_count (+$((head_count - base_count))) — a baseline may only shrink."
    echo "     Fix the new finding(s); never re-run --generate-baseline to absorb them."
    failed=1
  elif [ "$base_count" -gt "$head_count" ]; then
    echo "✓  $f: $base_count → $head_count (shrank $((base_count - head_count)))"
  else
    echo "✓  $f: $base_count → $head_count (unchanged)"
  fi
done

[ "$checked" -eq 0 ] && echo "baseline-guard: no baseline files present — nothing to ratchet (OK)."
exit "$failed"
