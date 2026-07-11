---
name: save
description: Capture a structured JSON snapshot of the current work session — the plan (goals/tasks, done or not), the why/how behind it, locked decisions, risks, open questions, and pointers to the files/wiki/PRs/commands needed to resume. Use when the user says /save, "save our progress", "snapshot this", "checkpoint where we are", or before context is about to be lost. Updates the existing snapshot for this work-stream if one exists.
---

# save

Persist everything needed to **resume this work-stream cold** into one structured
JSON snapshot under `saves/<project>/<slug>.json`. These snapshots are the **source
of truth for work in progress**, so accuracy matters more than completeness — an
honest "unknown" beats a confident stale claim.

The deterministic mechanics (timestamps, slug, JSON merge, history log, validation)
all live in **`bin/snap.sh`** — never hand-write the file. You own the *content* and
its *truthfulness*; the script owns the *plumbing*.

## 0. Identify the work-stream

- **Project** — the slug of the sibling this work belongs to (any project in your
  list, plus `k8s` or this repo). Cross-cutting work → `fleet`; anything else →
  `misc`. (This is the directory under `saves/`.) Emit the `⟦project: <name>⟧`
  status marker for it.
- **Slug** — a short topic kebab from the work itself:
  `bin/snap.sh slug "Acme v1 client API"` → `acme-v1-client-api`. Keep it stable
  across saves of the same stream so re-saves *update* rather than fork.
- **The id is `<project>/<slug>`.** Check for an existing snapshot:
  `bin/snap.sh show <project>/<slug>` (prints it, or errors if new). If the user's
  intent is ambiguous, `bin/snap.sh list <project>` to see what streams exist.

## 1. Reconcile — audit before you trust (this is the point)

A snapshot is only useful if it's true. **Do not copy the old snapshot or the chat
forward uncritically.** For an update, load the prior file and treat every claim as
a hypothesis to re-verify against reality:

- **Plan/goal status** — is each "done" item actually merged/landed? Check:
  `git -C ~/code/<project> log --oneline -15`, branch state, and PR status
  (`tea pr list` on Forgejo, or `gh pr list` on GitHub).
- **Pointers** — do referenced files still exist and still matter? Stale paths are
  a warning, not a fixture to preserve.
- **Decisions/open questions** — has anything been resolved, reversed, or
  invalidated since the last save? Move resolved questions into `decisions`; retire
  dead ones.
- **Demote, don't delete history** — if you can't confirm something, downgrade its
  status (e.g. `done`→`doing`) and say why in its `notes`, rather than asserting it.

Pull project facts you're unsure of from the wiki first:
`bin/wiki inject --page <project> --depth 0`.

## 2. Assemble the snapshot (schema below)

Fill the schema with what you genuinely know. **Omit** fields you have nothing real
for — an empty array is fine; a fabricated entry is not. Every plan/goal item should
carry a falsifiable `evidence` pointer where one exists (PR#, commit SHA, file:line,
test name). Write `summary`, `why`, and `next_actions` so a fresh session with zero
chat history could pick up and add value immediately.

## 3. Write it

Pipe the full JSON to the helper. It preserves `created_at`, stamps `updated_at`,
appends a `history` entry, validates, and writes atomically — refusing to persist a
structurally broken snapshot:

```bash
bin/snap.sh write <project>/<slug> --note "<what changed this save>" <<'JSON'
{ ...the snapshot object... }
JSON
```

The script forces `id`/`project`/`slug`/timestamps/`history`, so you don't set
those. If it reports `ERROR`, fix and re-run. Heed `WARN` lines (stale pointers,
odd statuses) — fix the snapshot or note the staleness deliberately.

## 4. Confirm

Run `bin/snap.sh validate <project>/<slug>` and give the user a **two-line**
confirmation: where it saved, and the headline state (status + N next actions +
any blockers). Don't dump the JSON back.

## Schema

```jsonc
{
  "schema_version": 1,                  // set by snap.sh
  "id": "acme/v1-client-api",           // set by snap.sh (= project/slug)
  "project": "acme",                    // set by snap.sh
  "slug": "v1-client-api",              // set by snap.sh
  "title": "Acme v1 Client API",        // human-friendly name of the work-stream
  "status": "in_progress",              // planning|in_progress|blocked|review|done|abandoned
  "summary": "One short paragraph: where we are and what's next, in plain prose.",
  "created_at": "...", "updated_at": "...", "history": [],   // all set by snap.sh

  // (a) THE PLAN — goals & tasks, done or not
  "objective": "The single north-star outcome this work is driving toward.",
  "goals": [
    { "id": "g1", "text": "Read-only client API shipped",
      "status": "done",                 // todo|doing|done|blocked|dropped
      "evidence": "PR #NN-#NN", "notes": "" }
  ],
  "plan": [                             // ordered tasks / working todo
    { "id": "t1", "text": "Add rate limiting per API key",
      "status": "todo", "evidence": "", "blocked_by": [] }
  ],
  "next_actions": [                     // the prioritized, immediately-actionable next steps
    "Decide per-key vs per-IP rate limit (see open question q1)",
    "Run ./vendor/bin/sail pest --filter ClientApi and confirm 80% gate"
  ],

  // (b) WHY / HOW — context, not restatement of the plan
  "why": "Motivation & business context — why this work exists and why now.",
  "approach": "The chosen strategy / 'how', when known. Empty if still open.",

  // extra dimensions (all opted-in for this fleet)
  "decisions": [                        // ADR-lite: settled choices, so we don't re-litigate
    { "id": "d1", "decision": "Sanctum token auth for the client API",
      "rationale": "...", "alternatives": "session cookies; signed URLs",
      "status": "locked" }              // locked|tentative|revisit
  ],
  "risks": [                            // known issues & hazards
    { "risk": "Pre-existing IDOR on the web step endpoint",
      "severity": "high",               // low|medium|high|critical
      "mitigation": "Out of scope for this stream; tracked separately",
      "status": "open" }                // open|mitigated|accepted|closed
  ],
  "open_questions": [                   // unknowns that must be resolved to proceed
    { "id": "q1", "q": "Rate limit per-key or per-IP?",
      "owner": "user", "blocking": true }
  ],
  "constraints": ["80% Pest coverage gate", "Branch from latest origin/main"],
  "assumptions": ["Client keys are issued manually for v1"],
  "glossary": [ { "term": "client", "def": "An external API consumer, not an app user" } ],

  // (c) POINTERS — fast, cheap onboarding (each is a channel /restore will load)
  "environment": {
    "repo": "~/code/acme", "default_branch": "main",
    "working_branch": "feat/client-api",
    "isolation_note": "User edits ~/code/acme concurrently — park their WIP on a named stash before branching (see memory)."
  },
  "pointers": {
    "files":    [ { "path": "~/code/acme/app/Http/Controllers/Api/ClientController.php", "note": "main entrypoint" } ],
    "wiki":     ["acme", "argocd-deploy-flow"],        // bin/wiki inject targets
    "memories": ["acme-client-api-build"],             // ~/.claude memory slugs
    "branches": ["feat/client-api"],
    "prs":      ["#NN", "#NN"],
    "commands": [ "git -C ~/code/acme log --oneline -10",
                  "./vendor/bin/sail pest --filter ClientApi" ],
    "external": []                                     // URLs, dashboards, tickets
  },
  "tags": ["api", "launch-blocker"]
}
```

## Rules

- **Never fabricate.** No invented PR numbers, file paths, or "done" claims. If
  unverified, mark it and say so. The snapshot's value is that it can be trusted.
- **One stream per file.** Re-saving the same work updates its file; genuinely new
  work gets a new slug.
- **Don't put secrets in snapshots.** Reference where a credential lives, never the
  value. (`saves/` is gitignored, but treat it as shareable-by-accident.)
- **Stay token-lean on resume.** `pointers` should let `/restore` load *only* what's
  needed — prefer a wiki page or a precise file:line over pasting large content.
- **Only save when asked** (the user ran `/save` or asked to). This skill writes a
  file; it never commits or pushes.
