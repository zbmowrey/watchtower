---
name: architecture-map
description: Quickly resurface a project's key architectural patterns and orient before making changes. Use when starting work on a Laravel app and you need a fast mental model — stack, layering, deploy, gotchas — before diving in.
---

# architecture-map

Fast orientation for a project. Don't reverse-engineer from scratch — start from
the wiki, then confirm against the code.

## Steps

1. **Inject the project page + its links:**
   `bin/wiki inject --page <project> --depth 1`
   This gives stack, architecture, local ports, testing, and the deploy flow.
2. **Confirm the load-bearing facts** against the repo (versions drift): glance at
   `composer.json` / `package.json`, `routes/`, `app/` layout, `compose.yaml`.
3. **Summarize for the user**: framework + version, frontend approach, how data
   flows (controllers → Inertia props / API), queue/realtime usage, where the
   domain logic lives, how it deploys, and the top 2–3 gotchas.
4. **If reality differs from the wiki, fix the wiki** (self-organizing mandate)
   before proceeding.

## Shared patterns to expect

- The Laravel apps: Inertia v3 + React 19 + Vite 8 + Tailwind 4 + Wayfinder
  (typed routes). See [inertia-react] in the wiki.

_Scaffold — expand with per-project architecture deep-dives as we learn them._
