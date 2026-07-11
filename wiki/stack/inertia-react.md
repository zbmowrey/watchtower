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

## Testing

- Component/unit tests: Vitest, or via the PHP feature layer for page rendering.
  `pest-plugin-browser` covers true E2E.
- See [[pest-testing]].
