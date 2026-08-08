# converged-set — the front-end drift manifest

The machine-and-human list of every front-end path that converges across the managed Inertia apps,
and to what degree. Consumed by `bin/react-drift` (backlog B-1). Paths are relative to each app's
`resources/js/` unless noted. The rule of record is
[`fleet-frontend-specification`](../../wiki/standards/fleet-frontend-specification.md) §1.

Legend: **M-1** = byte-identical fleet-wide (compared to `standards/react/`); **M-2** = structural
/ API parity (same exports, props, a11y semantics — look flexes per app). Everything not listed is
**Tier E (expressive)** — free per app, never drift-checked.

## M-1 — byte-identical (non-visual plumbing)

```
lib/utils.ts                              # cn()
app.tsx                                   # bootstrap SHAPE only (layout switch + withApp providers);
                                          #   VITE_APP_NAME, progress color, layout list are per-app (E).
                                          #   The SHAPE includes: createRoot onCaughtError/onUncaughtError
                                          #   → Sentry (spec §5) and the test-excluding page glob
                                          #   import.meta.glob(['./pages/**/*.tsx', '!./pages/**/*.test.tsx'])
                                          #   (spec §6 — makes colocated page tests safe)
components/error-boundary.tsx             # recovery-only boundary (spec §5) — authored: scaffold/components/
hooks/use-route-announcer.ts              # SPA-navigation a11y (spec §3) — authored: hooks/
hooks/use-appearance.tsx
hooks/use-mobile.tsx
hooks/use-mobile-navigation.ts
hooks/use-initials.tsx
hooks/use-clipboard.ts
hooks/use-current-url.ts
hooks/use-flash-toast.ts
hooks/use-two-factor-auth.ts
components/two-factor-recovery-codes.tsx
components/two-factor-setup-modal.tsx      # ⚠️ 3 divergent versions today — reconcile (backlog B-3)
components/passkey-item.tsx                # where passkeys are enabled
components/passkey-register.tsx
components/passkey-verify.tsx
components/delete-user.tsx
components/input-error.tsx
components/text-link.tsx
components/heading.tsx
components/password-input.tsx
components/alert-error.tsx
pages/auth/**                              # login, register, forgot/reset, verify, confirm, 2FA challenge
pages/settings/**                          # profile, password, appearance, two-factor
layouts/auth/**
layouts/settings/**
configs/eslint.config.js                   # (home migrating here — B-2)
configs/tsconfig.json
configs/.prettierrc
configs/vitest.config.ts
```

## M-1 — promoted shared hooks (adopt, don't reinvent — spec §3)

```
hooks/use-realtime-fallback.ts + useCoalescedTick   # degraded-link realtime resilience
hooks/use-server-action.ts                          # mutate→snapshot→settle guard
hooks/use-local-storage.ts                          # useSyncExternalStore, SSR-safe, cross-tab
hooks/use-reduced-motion.ts                         # ONE canonical name (collapses use-motion-safe / use-prefers-reduced-motion)
```

> On React 19.2 the ref-mirroring hooks above (`use-realtime-fallback`, `useCoalescedTick`,
> `use-server-action`) are refactored to `useEffectEvent` **once, here** — spec §3.

## M-2 — structural / API parity (brand-bearing primitives; look free)

```
components/ui/button.tsx        # ⚠️ one app hand-edited away from base — reconcile API, keep its tokens
components/ui/input.tsx
components/ui/dialog.tsx         # ⚠️ one app has drifted — reconcile
components/ui/dropdown-menu.tsx
components/ui/card.tsx
components/ui/select.tsx
components/ui/sheet.tsx
components/ui/sidebar.tsx        # migrate <Context.Provider> → <Context> (React 19) once, here
components/ui/toggle-group.tsx   # migrate <Context.Provider> → <Context>
components/ui/input-otp.tsx      # migrate forwardRef → ref-as-prop (React 19)
components/ui/popover.tsx        # migrate forwardRef → ref-as-prop
components/ui/*                  # remaining shadcn primitives: same API, per-app tokens
components/app-shell.tsx         # structure parity; chrome look is E
components/app-content.tsx
components/nav-main.tsx / nav-user.tsx / nav-footer.tsx / user-menu-content.tsx / user-info.tsx / breadcrumbs.tsx
layouts/app-layout.tsx + layouts/app/**
```

## Tier E — explicitly NOT converged (each app owns its identity)

```
pages/**  (except auth/ + settings/)      resources/css/** + Tailwind @theme tokens
components/<feature>/**                    motion / animation
hooks/** (app-specific)                    lib/** (app-specific: domain logic, formatters, data)
brand primitives (BrandButton, Eyebrow…)   the bespoke surfaces (game, simulator, demos, tracker, workshop)
```
