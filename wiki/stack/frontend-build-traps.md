---
title: Front-end build and dev-server traps
description: Vite, React and Tailwind behaviours that differ between the dev server and the production build, or between the host and the Sail container — stale HMR on host edits, CSS url() resolving to the wrong origin, named breakpoints inverting the cascade, colocated tests shipping to prod, and a CSP that only bites in production.
tags: [stack, vite, react, tailwind, csp, frontend, gotcha]
type: stack
status: reference
updated: 2026-08-08
related: [inertia-react, fleet-frontend-specification, fleet-local-gate]
---

# Front-end build and dev-server traps

The unifying theme: **dev and prod disagree**, or **host and container disagree**, and
the gate runs in whichever one is not broken.

## The dev server misses host edits

Editing a file on the host does not always reach the Vite dev server running inside
Sail: the file watcher misses the change and HMR never fires, so the browser keeps
serving the previous module and you debug a change that was never applied.

Fix: touch the file from inside the container.

```
docker exec <app>-vite-1 touch resources/js/app.tsx
```

The tell is a change that has no effect at all (not a wrong effect) while the file on
disk is clearly correct.

## CSS `url()` resolves against the Vite origin in dev

A Tailwind arbitrary background like `bg-[url(/img/hero.png)]` is resolved by the
**dev server**, not the app origin, so it 404s in dev while being perfectly correct
for the production build.

Fix: set the image with an inline `style={{ backgroundImage: ... }}` rather than an
arbitrary CSS url, so the path is resolved by the browser against the page origin.

## Tailwind v4: named breakpoints beat arbitrary ones

Named breakpoints (`md:`) are emitted **after** arbitrary ones (`min-[992px]:`) in the
generated stylesheet. Mixing the two forms on the same property silently inverts the
cascade you intended: the arbitrary breakpoint loses regardless of pixel value.

Pick one form per property. If you need a non-standard width, define it as a named
breakpoint rather than reaching for the arbitrary syntax next to existing `md:` rules.

## Colocated page tests ship to production

A `.test.tsx` file placed under `resources/js/pages/` is picked up by the page glob
and **bundled into the production build**. It inflates the bundle, and it can drag
test-only imports into prod chunks.

**Resolved by standard** ([[fleet-frontend-specification]] §6, v1.4): the M-1
`app.tsx` page resolver excludes tests —
`import.meta.glob(['./pages/**/*.tsx', '!./pages/**/*.test.tsx'])` — which makes the
spec's colocation convention safe everywhere, including under `pages/`. The trap
bites only an app still on the bare single-pattern glob: fix the glob, don't
relocate the tests.

## `useWorker` CSP failures appear only in production

`canvas-confetti` with `useWorker: true` creates a **blob: Worker**, which a strict
production CSP blocks. In dev the looser policy allows it, so the effect works
locally and silently no-ops in prod. There is no error the user would notice, just
nothing happening.

Set `useWorker: false`, or widen the policy deliberately. The general shape of this
trap (CSP enforced only in prod) is worth remembering beyond confetti.

## React Fast Refresh goes stale on mixed exports

A non-component export living in a component `.tsx` file breaks Fast Refresh for that
module: edits stop taking effect and the module serves stale until a full reload.

Keep components and non-component exports (constants, helpers, types) in separate
files. Type-only exports are erased at compile and are generally safe, but a runtime
value export is not.

## The budget is not in `composer ci:check`

Bundle size is checked by a separate step. See [[fleet-local-gate]] — a green local
`ci:check` can still fail CI on bundle weight, and a chunker bump can breach a budget
with zero code growth.
