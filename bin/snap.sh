#!/usr/bin/env bash
# snap.sh — work-in-progress snapshot helper for the /save and /restore skills.
#
# Deterministic backbone so the LLM never hand-rolls fragile bits:
#   * timestamps (UTC ISO-8601)              * kebab-case slugs / file paths
#   * JSON merge: preserve created_at,        * structural + staleness validation
#     stamp updated_at, own the history log   * compact digest so /restore stays cheap
#
# Bash/Zsh-runnable. Zero deps beyond python3 (used for all JSON work).
#
# Snapshots live at  <repo>/saves/<project>/<slug>.json  (gitignored).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SAVES_DIR="${SNAP_SAVES_DIR:-$ROOT/saves}"
WIKI_DIR="${SNAP_WIKI_DIR:-$ROOT/wiki}"

now()  { date -u +%Y-%m-%dT%H:%M:%SZ; }
slug() {
  printf '%s\n' "${1:-}" | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//'
}

usage() {
  cat <<'EOF'
snap.sh — WIP snapshot helper (used by /save and /restore)

  snap.sh now                              UTC ISO-8601 timestamp
  snap.sh slug "<text>"                    kebab-case a string
  snap.sh path <project> <slug>            absolute path of a snapshot file
  snap.sh list [project]                   human digest table, newest first
  snap.sh index [project] [--json]         machine digest (tsv, or JSON array)
  snap.sh show <project/slug>              full JSON of one snapshot
  snap.sh validate <project/slug | --all>  structural + staleness check
  snap.sh write <project/slug> [--note N]  merge JSON from stdin -> file
  snap.sh rm <project/slug>                delete a snapshot

Env: SNAP_SAVES_DIR (default <repo>/saves), SNAP_WIKI_DIR (default <repo>/wiki)
EOF
}

# All JSON-aware subcommands route through one python program (mode = $1).
# NB: the python source arrives on python's stdin via the heredoc, so data that
# needs stdin (write) is captured to a temp file first and passed as an argv path.
_py() {
  SAVES_DIR="$SAVES_DIR" WIKI_DIR="$WIKI_DIR" python3 - "$@" <<'PY'
import sys, os, json, glob

SAVES = os.environ["SAVES_DIR"]
WIKI  = os.environ.get("WIKI_DIR", "")
mode  = sys.argv[1] if len(sys.argv) > 1 else ""
args  = sys.argv[2:]

SNAP_STATUS = {"planning", "in_progress", "blocked", "review", "done", "abandoned"}
ITEM_STATUS = {"todo", "doing", "in_progress", "done", "blocked", "dropped"}
REQUIRED = ["schema_version", "id", "project", "title", "slug",
            "created_at", "updated_at", "status", "summary", "objective"]

def files(project=None):
    pat = os.path.join(SAVES, project or "*", "*.json")
    return sorted(glob.glob(pat))

def load(path):
    with open(path) as f:
        return json.load(f)

def digest(d):
    goals = d.get("goals") or []
    return {
        "id": d.get("id"),
        "project": d.get("project"),
        "title": d.get("title"),
        "status": d.get("status"),
        "updated_at": d.get("updated_at"),
        "created_at": d.get("created_at"),
        "summary": d.get("summary", "") or "",
        "next_actions": len(d.get("next_actions") or []),
        "open_questions": len(d.get("open_questions") or []),
        "goals_done": sum(1 for g in goals if g.get("status") == "done"),
        "goals_total": len(goals),
    }

def load_all(project=None):
    out = []
    for p in files(project):
        try:
            out.append((p, load(p)))
        except Exception as e:
            sys.stderr.write(f"WARN: cannot parse {p}: {e}\n")
    out.sort(key=lambda t: t[1].get("updated_at", ""), reverse=True)
    return out

def validate_dict(d, label):
    errs, warns = [], []
    for k in REQUIRED:
        if k not in d or d[k] in (None, ""):
            errs.append(f"missing required field '{k}'")
    if d.get("status") not in SNAP_STATUS:
        errs.append(f"status '{d.get('status')}' not in {sorted(SNAP_STATUS)}")
    expect = f"{d.get('project')}/{d.get('slug')}"
    if d.get("id") != expect:
        warns.append(f"id '{d.get('id')}' != project/slug '{expect}'")
    for coll in ("goals", "plan"):
        for it in (d.get(coll) or []):
            st = it.get("status")
            if st is not None and st not in ITEM_STATUS:
                warns.append(f"{coll} item status '{st}' is unusual")
    ptr = d.get("pointers") or {}
    for f in (ptr.get("files") or []):
        fp = f.get("path") if isinstance(f, dict) else f
        if fp and not os.path.exists(os.path.expanduser(fp)):
            warns.append(f"pointer file missing (stale?): {fp}")
    if WIKI and os.path.isdir(WIKI):
        for w in (ptr.get("wiki") or []):
            if not glob.glob(os.path.join(WIKI, "**", f"{w}.md"), recursive=True):
                warns.append(f"wiki page not found (stale?): {w}")
    return errs, warns

# ----- modes ---------------------------------------------------------------
if mode == "list":
    project = args[0] if args and not args[0].startswith("-") else None
    rows = load_all(project)
    if not rows:
        print("(no snapshots%s)" % (f" for {project}" if project else ""))
        sys.exit(0)
    print(f"{'ID':40} {'STATUS':12} {'UPDATED':17} {'GOALS':6} {'NEXT':4} TITLE")
    for _, d in rows:
        g = digest(d)
        upd = (g["updated_at"] or "")[:16].replace("T", " ")
        goals = f"{g['goals_done']}/{g['goals_total']}"
        print(f"{(g['id'] or '')[:40]:40} {(g['status'] or '')[:12]:12} "
              f"{upd:17} {goals:6} {str(g['next_actions']):4} {g['title'] or ''}")

elif mode == "index":
    as_json = "--json" in args
    pos = [a for a in args if not a.startswith("-")]
    rows = load_all(pos[0] if pos else None)
    digs = [digest(d) for _, d in rows]
    if as_json:
        print(json.dumps(digs, indent=2))
    else:
        for g in digs:
            print(f"{g['id']}\t{g['status']}\t{g['updated_at']}\t{g['summary'][:80]}")

elif mode == "show":
    if not args:
        sys.stderr.write("show: need <project/slug>\n"); sys.exit(2)
    path = os.path.join(SAVES, args[0] + ".json")
    if not os.path.exists(path):
        sys.stderr.write(f"no such snapshot: {args[0]}\n"); sys.exit(1)
    print(json.dumps(load(path), indent=2))

elif mode == "validate":
    if "--all" in args:
        targets = files()
    else:
        pos = [a for a in args if not a.startswith("-")]
        if not pos:
            sys.stderr.write("validate: need <project/slug> or --all\n"); sys.exit(2)
        targets = [os.path.join(SAVES, pos[0] + ".json")]
    errs = warns = 0
    for path in targets:
        label = os.path.relpath(path, SAVES)
        if not os.path.exists(path):
            print(f"ERROR {label}: file not found"); errs += 1; continue
        try:
            d = load(path)
        except Exception as e:
            print(f"ERROR {label}: invalid JSON: {e}"); errs += 1; continue
        e, w = validate_dict(d, label)
        for m in e: print(f"ERROR {label}: {m}"); errs += 1
        for m in w: print(f"WARN  {label}: {m}"); warns += 1
    print(f"\n{len(targets)} checked — {errs} error(s), {warns} warning(s)")
    sys.exit(1 if errs else 0)

elif mode == "write":
    # args: <json_src_path> <project/slug> <note> <nowts>
    src, ident, note, nowts = args[0], args[1], args[2], args[3]
    with open(src) as f:
        new = json.load(f)
    project, _, slug = ident.partition("/")
    if not slug:
        sys.stderr.write("write: id must be project/slug\n"); sys.exit(2)
    path = os.path.join(SAVES, project, slug + ".json")
    old = None
    if os.path.exists(path):
        try: old = load(path)
        except Exception: old = None
    # snap.sh is authoritative for identity + timestamps + history
    new["schema_version"] = new.get("schema_version", 1)
    new["id"], new["project"], new["slug"] = ident, project, slug
    new["created_at"] = (old or {}).get("created_at") or new.get("created_at") or nowts
    new["updated_at"] = nowts
    hist = list((old or {}).get("history") or [])
    hist.append({"at": nowts, "note": note or ("updated" if old else "created")})
    new["history"] = hist
    # refuse to persist a structurally broken snapshot
    errs, warns = validate_dict(new, ident)
    if errs:
        for m in errs: sys.stderr.write(f"ERROR: {m}\n")
        sys.stderr.write("write aborted — fix the errors above.\n"); sys.exit(1)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(new, f, indent=2); f.write("\n")
    os.replace(tmp, path)
    for m in warns: sys.stderr.write(f"WARN: {m}\n")
    print(path)

else:
    sys.stderr.write(f"unknown mode: {mode}\n"); sys.exit(2)
PY
}

cmd_write() {
  local ident="${1:-}"; shift || true
  local note=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --note) note="${2:-}"; shift 2;;
      *) shift;;
    esac
  done
  [ -n "$ident" ] || { echo "write: need <project/slug>" >&2; exit 2; }
  local tmp; tmp="$(mktemp)"
  cat > "$tmp"                 # capture the snapshot JSON from stdin
  local rc=0
  _py write "$tmp" "$ident" "$note" "$(now)" || rc=$?
  rm -f "$tmp"
  return "$rc"
}

cmd="${1:-}"; shift || true
case "$cmd" in
  now)       now ;;
  slug)      slug "${1:-}" ;;
  path)      printf '%s\n' "$SAVES_DIR/${1:?need project}/${2:?need slug}.json" ;;
  list)      _py list "$@" ;;
  index)     _py index "$@" ;;
  show)      _py show "$@" ;;
  validate)  _py validate "$@" ;;
  write)     cmd_write "$@" ;;
  rm)        f="$SAVES_DIR/${1:?need project/slug}.json"
             [ -f "$f" ] || { echo "no such snapshot: $1" >&2; exit 1; }
             rm -f "$f"; echo "removed $1" ;;
  ""|-h|--help|help) usage ;;
  *)         echo "unknown command: $cmd" >&2; usage; exit 2 ;;
esac
