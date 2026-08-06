---
title: Inertia + React
description: The shared frontend architecture — Inertia v3, React 19, Vite 8, Tailwind 4, Wayfinder typed routes.
tags: [stack, inertia, react, vite, tailwind, wayfinder, frontend]
type: stack
updated: 2026-06-13
related: [laravel-sail]
---

# Inertia + React

The Laravel apps share one frontend stack.

## The stack

| Layer        | Choice                                                                                                               |
|--------------|----------------------------------------------------------------------------------------------------------------------|
| Bridge       | **Inertia v3** (`inertiajs/inertia-laravel`, `@inertiajs/react`)                                                     |
| UI           | **React 19** (with `babel-plugin-react-compiler`)                                                                    |
| Build        | **Vite 8** + `laravel-vite-plugin` + `@vitejs/plugin-react`                                                          |
| Styling      | **Tailwind 4** (`@tailwindcss/vite`), Radix UI primitives, `lucide-react`, `tailwind-merge`                          |
| Typed routes | **Laravel Wayfinder** (`laravel/wayfinder` + `@laravel/vite-plugin-wayfinder`) — generates TS for routes/controllers |
| Types        | TypeScript 5/6, ESLint, Prettier (`prettier-plugin-tailwindcss`)                                                     |

Apps add libraries as they need them — e.g. `zustand` for state, `@headlessui/react`,
`recharts` for charts, `react-day-picker`, `break_infinity.js`.

## Patterns

- **Pages** live under `resources/js/pages`; controllers return `Inertia::render`.
- **Wayfinder** gives typed route/controller helpers in TS — regenerate after
  changing routes (Vite plugin handles it in dev). Don't hand-edit generated files.
- **Props are the contract** between controller and page — keep them explicit and
  typed; avoid leaking Eloquent models directly (use resources/DTOs).
- **HMR** behind Sail: see local dev ports for the `vite.config.ts` server/hmr
  setup that makes hot reload work through the container.

## View transitions (Inertia 3.6+) — three traps

Inertia performs the component swap inside `document.startViewTransition` when a visit
carries `viewTransition`, so page transitions are declarative. Enable app-wide through
`createInertiaApp({ defaults: { visitOptions } })`, which Inertia calls for **every** visit.

1. **`<Link>` passes `viewTransition: false` on every click** — that is the React
   component's own prop default, not caller intent. Treating a falsy value as an opt-out
   therefore disables the feature on every link in the app, silently. Honor only a
   **truthy** value as an opt-in and decide the rest from the visit's shape. Nothing is
   lost: everywhere Inertia forces `false` itself (prefetches, the instant-swap follow-up)
   the visit is also marked `async`/`prefetch`/`preserve*`.
2. **Elect visits deliberately.** Partial reloads (`only`/`except`), `replace`, and
   `preserve*` visits are how a tool page re-queries itself (filters, sliders). A global
   transition on those flashes the whole viewport on every slider nudge.
3. **`document.visibilityState === 'hidden'` skips the transition entirely** — an explicit
   guard in Inertia's `swap()`. This makes browser-driven verification look like a total
   failure: the driven tab is backgrounded, so nothing fires. Foreground the tab first,
   then act. Applies to *any* `startViewTransition`-gated behavior, not just Inertia's.

Scope custom `::view-transition-old/new(root)` rules behind a state class on `<html>` if
anything else on the site drives its own root transition (e.g. a theme toggle's circular
reveal) — the pseudo-element rules are global otherwise. Kill them under
`prefers-reduced-motion` in CSS rather than JS, so motion gating keeps one owner.

## Testing

- Component/unit tests: Vitest, or via the PHP feature layer for page rendering.
  `pest-plugin-browser` covers true E2E.
- See [[pest-testing]].
