---
name: review-response
description: Process an incoming code review (PR comments or pasted feedback) — validate each point, adversarially test claims, accept what's true and valuable, reject what's wrong with rationale, and apply accepted changes per project guidelines. Use when the user shares review feedback, asks you to address PR comments, or to respond to a reviewer.
---

# review-response (accept incoming review)

Treat a review as input to be **evaluated**, not orders to be obeyed. Accept what's
true and valuable; push back, with evidence, on what isn't. Always comply with
project guidelines.

## 0. Gather the review

- From a PR: `gh pr view <n> -R <owner>/<repo> --comments` and `gh pr diff <n> -R <owner>/<repo>`.
- Or use the pasted text the user gave you.
- Load project guidelines: `CLAUDE.md`/`AGENTS.md` in the repo and
  `bin/wiki inject --page <repo> --depth 0`. Accepted changes must conform to these.

## 1. Triage every point

For each comment, classify:

- **Valid bug** — real defect. → fix.
- **Valid improvement** — correct and worth it (perf, clarity, security, tests). → fix.
- **Preference/style** — adopt if it matches project conventions; otherwise note
  the convention and move on.
- **Incorrect** — reviewer is mistaken. → reject with evidence.
- **Out of scope** — valid but belongs in a separate change. → acknowledge, defer
  (offer a follow-up issue).

## 2. Adversarially test before accepting

Do **not** accept on authority. For a claimed bug, reproduce it — ideally write a
failing test first, then confirm the fix makes it pass. For a claimed improvement,
verify it actually improves things (benchmark/measure if it's a perf claim). For a
rejection, construct the concrete evidence (code path, test, doc) that proves the
reviewer wrong.

## 3. Apply accepted changes

- Implement minimally and on-scope; don't smuggle in unrelated edits.
- Conform to project lint/types/idioms. Re-run the relevant checks (`sail pest`,
  `pint --test`, Larastan, ESLint/tsc) — see [pest-testing] in the wiki.

## 4. Respond

- For each comment: state the disposition — *done* (with commit ref), *won't do*
  (with respectful rationale + evidence), or *deferred* (with follow-up link).
- Be concise and collegial. Disagreement is fine; condescension is not.
- If posting back to GitHub, reply on threads and/or summarize in a single comment;
  resolve threads you've addressed.

## 5. Capture learnings

If the review surfaced a durable lesson (a pattern to follow, a gotcha, a
convention), record it in the wiki per the self-organizing mandate.
