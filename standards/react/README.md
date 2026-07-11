# standards/react — the front-end enforcement artifacts

The **golden source** for the *front end* of every managed Inertia + React app — the peer of
`standards/laravel/` (which owns the backend). The managed Inertia siblings share the **same
front-end stack** — React 19 + Inertia v3 + Vite 8 + Tailwind 4 + TypeScript 6 — so the
**mechanical** parts of that stack are kept identical here and synced out; each app's **look,
motion, copy, and domain behavior stay free**. A sibling on a different stack (e.g. Next.js) is
**out of scope** — a sanctioned different stack.

> **The rule of record is the spec, not this README.** The single mandated value for every
> front-end concern is [`fleet-frontend-specification`](../../wiki/standards/fleet-frontend-specification.md)
> (`bin/wiki inject --page fleet-frontend-specification`). Versions, lint config, CI wiring, and
> Vite runtime guardrails remain owned by
> [`fleet-app-specification`](../../wiki/standards/fleet-app-specification.md) — this bundle does
> **not** duplicate them. When a value here and the spec disagree, the spec wins and this bundle
> is brought to it.

## The mechanical / expressive split (spec §1)

Every front-end file is one of three tiers. This bundle only owns the first two:

- **M-1 — Converged identical** — non-visual plumbing (auth/2FA/passkey/settings scaffold, the
  starter hooks, `cn`, the `app.tsx` shape, tooling configs). **Byte-identical fleet-wide**, held
  here, drift-guarded. Fix once, sync everywhere.
- **M-2 — Converged pattern** — brand-bearing primitives (`components/ui/*`, layout scaffolding).
  **Same public API + a11y semantics; look flexes per app via tokens.** Structure-parity only.
- **E — Expressive** — pages, `@theme` tokens, motion, copy, the bespoke surfaces. **Not here,
  not converged.** Bound only by spec §2–§5 (well-shaped, modern, tested) — never "match another app."

The exact paths in each converged tier are listed in [`converged-set.md`](./converged-set.md).

## What's here / what will be here

```
README.md            # this apply-guide
converged-set.md     # the manifest: every M-1 (byte-parity) + M-2 (structural-parity) path
react-drift.allow    # justified per-app divergences from the manifest (mirrors §8 of the spec)
```

**Migrating in (tracked as backlog B-2 → fleet frontend variance backlog):**

```
scaffold/            # M-1 canonical .tsx: two-factor-*, passkey-*, delete-user, pages/auth/*, pages/settings/*, layouts/*
hooks/               # M-1 canonical starter hooks: use-appearance, use-mobile, use-mobile-navigation,
                     #   use-initials, use-two-factor-auth, use-clipboard, use-current-url, use-flash-toast
                     # + promoted shared hooks: use-realtime-fallback, use-server-action, use-local-storage
lib/utils.ts         # M-1 canonical cn()
ui/                  # M-2 primitive templates (button, input, dialog, sidebar, …) — API/a11y parity, themed per app
configs/             # eslint.config.js, tsconfig.json, .prettierrc, vitest.config.ts
                     #   (today these live in standards/laravel/configs; they move here — see below)
```

> **Config-home note.** The front-end tooling configs (eslint / tsconfig / prettier / vitest)
> currently ship from `standards/laravel/configs/`. Per maintainer decision (2026-07-08) their
> go-forward home is **here**. The physical move is a coordinated backlog item (B-2) — it must
> update [`fleet-app-specification`](../../wiki/standards/fleet-app-specification.md) §2/§3's
> references in the same change — not done silently, because the backend spec points at them today.

## Enforcement — `bin/react-drift`

`bin/react-drift` (parallels `bin/arch-drift`) reads `converged-set.md` and, in the CI `static`
job, asserts **M-1 paths are byte-identical** to this bundle and **M-2 paths keep API/export
parity**. Justified divergences go in `react-drift.allow` and §8 of the spec — never silent.
The guard itself is **backlog item B-1**; until it ships, parity is a review checklist.

## Applying to an app (go-forward)

1. Read the spec: `bin/wiki inject --page fleet-frontend-specification`.
2. New shared primitive/hook? Author it **here first**, then sync to the apps — never five times.
3. Touching an M-1 file in an app? Reconcile it to this bundle (don't fork it locally).
4. New feature code? Follow spec §2 (no god components), §3 (React-19/Inertia-v3 idioms), §5 (tests).
