---
name: goal
description: Run a "goal" — a mini-roadmap followed by a mad dash to implement it. Use when the user says /goal, "call that a goal", or asks for a compact plan immediately executed end-to-end ("plan it then build it all"). Produces a short dependency-ordered sprint table (ratified in-chat, not a wiki ceremony), then ships each sprint as its own gate-green PR, merging as CI passes when the user has authorized ship-as-you-go.
---

# goal

A **goal** = a mini-roadmap + a mad dash. Plan tersely, then build relentlessly,
shipping increments as they go green.

## 1. The mini-roadmap (minutes, not meetings)

- Derive 3–6 **sprints** from the ask + the project's existing wiki roadmap (don't
  duplicate it — the goal is an execution ordering OVER it). Each sprint = one
  shippable PR with a one-line "ships" definition.
- Order by dependency, then by user-visible value. Present as a compact table in
  chat and START — a goal is ratified by the user's "go", not by ceremony. Only
  pause for AskUserQuestion when an axis genuinely forks the build.
- If the project has `wiki/roadmaps/<project>/` items, note which item each sprint
  advances; update those items' status as sprints deliver (per [[planning-conventions]]).

## 2. The mad dash

Per sprint, in order:

1. Branch from fresh `origin/main` (`feat/<sprint-slug>`).
2. Build the increment. Follow the project's conventions (for a Laravel app on
   this standard: the data-access chain, arch tiers, no `App\Models` in
   controllers, Pest + Vitest coverage for what shipped).
3. Run the FULL local gate; fix until green. Verify behavior for real (browser/
   curl) — not just tests.
4. Open the PR the way this project opens PRs; watch CI to green.
5. **Ship-as-you-go:** if the user authorized the dash on a repo where merge
   deploys, state that interpretation ONCE up front, then merge each green PR
   and verify the deploy actually landed before starting the next sprint. If
   merge is not authorized, queue PRs and keep moving on stacked branches.
6. One line of progress to the user per sprint — what shipped, what's next.
   No mid-dash essays.

## 3. Landing the goal

- When the last sprint ships (or the dash must stop): update the project roadmap
  items (deliver/advance), append gotchas to their files, and give a single
  closing table: sprint → PR → deployed-state.
- A goal that can't finish in-session ends with a checkpoint good enough to
  resume cold (branch names, next sprint, open questions).
