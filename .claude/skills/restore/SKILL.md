---
name: restore
description: Resume a saved work session. Lists the JSON snapshots written by /save (newest first, scoped to the current project), lets the user pick one, then loads it and its referenced context (wiki pages, files, memories, git/PR state) and gives a brief "where we left off / what's next" before continuing. Use when the user says /restore, "pick up where we left off", "resume", "load a snapshot", or "what was I working on".
---

# restore

Re-hydrate a work-stream from a `/save` snapshot and get to **high-value work fast**,
spending as few tokens as possible doing it. Snapshots are read via **`bin/snap.sh`**.

The golden rule: **survey with the digest, hydrate only the chosen one.** Never read
every snapshot's full body to decide — that defeats the point of saving.

## 1. Survey (cheap — digest only)

- Infer the **current project** from the conversation / active `⟦project: …⟧` marker.
  If clear, scope to it; otherwise show all.
- List candidates, newest first:
  ```bash
  bin/snap.sh list <project>     # or: bin/snap.sh list   (all projects)
  ```
  This prints a compact table (id, status, updated, goals done/total, # next
  actions, title) — enough to choose without loading any full snapshot.
- **Let the user choose.** If they already named the stream, skip straight to it. If
  not, present the list (numbered, newest first) and ask which to restore. If exactly
  one matches an unambiguous request, you may proceed and say which you picked.

## 2. Hydrate the chosen snapshot

- Load the full body once:
  ```bash
  bin/snap.sh show <project>/<slug>
  ```
- **Audit as you read** — a snapshot reflects what was true *when saved*. Before
  acting on a claim, sanity-check the volatile parts: `git -C ~/code/<project> log
  --oneline -10`, branch/PR state (`tea pr list` / `gh pr list`). If reality has
  moved, trust reality and flag the drift to the user.
- **Pull referenced context selectively** — load what you need to contribute, not
  everything:
    - `pointers.wiki[]` → `bin/wiki inject --page <slug> --depth 1` (batch them).
    - `pointers.files[]` → Read the few that matter most for the next actions (respect
      `environment.isolation_note` — don't disturb the user's working tree).
    - `pointers.memories[]` → the relevant `~/.claude` memory slugs are already
      surfaced in session context; cross-reference, don't re-read blindly.
    - `pointers.commands[]` → run only read-only orientation commands; never anything
      mutating without the user's go.
    - Skip anything not needed for the immediate `next_actions`. You can load more on
      demand once work begins.

## 3. Brief, then stop

Give the user a **tight** orientation — no JSON dump, no file dumps:

1. **Where we left off** — one line: status + the one-paragraph `summary`.
2. **What's next** — the `next_actions` (and any `open_questions` with
   `blocking: true`, since those gate progress).
3. **Watch-outs** — only if material: open `risks`, `constraints`, or drift you
   found in step 2.

Then **stop and await direction.** The user said they'll tell you to proceed — don't
start changing code until they do. Re-confirm the active project marker so the status
line is correct.

## Notes

- If `bin/snap.sh list` is empty for the project, say so and offer `/save` — don't
  invent a snapshot.
- `bin/snap.sh validate <project>/<slug>` surfaces stale pointers / structural drift;
  run it if a snapshot looks suspect, and offer to refresh it via `/save`.
- `bin/snap.sh index <project> --json` gives a machine-readable digest if you need to
  reason over several streams at once (still far cheaper than reading bodies).
- Restoring is read-only orientation. It never edits, commits, or pushes.
