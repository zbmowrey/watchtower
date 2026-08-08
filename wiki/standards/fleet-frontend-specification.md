---
title: Fleet Front-End Specification (v1 — mandated front-end mechanics)
description: The normative Specification for how every fleet Inertia+React app is built on the front end — the mechanical/expressive split, component-architecture rules (no god components), React-19 & Inertia-v3 idioms, client state & data patterns, runtime error handling, the appearance-independent testing strategy, dependency bands, and the standards/react convergence bundle + drift guard. Locks the front-end "how" (mechanics) to a single standard while leaving each app's look, motion, copy, and domain behavior deliberately free. Peer to [[fleet-app-specification]] (which owns versions/lint/CI/runtime); this page owns front-end architecture. Derived from a front-end audit + maintainer decisions; v1.1 folds in an adversarially-verified external best-practices research pass (the anti-over-adoption guardrail — Inertia already owns routing/query/forms — plus performance/CLS, vendor bundle-splitting, and SSR-per-surface); v1.2 adds the verified Inertia `optimistic()` mandate, the corrected React-Compiler/Vite-8 wiring (one app was silently off), and a second research pass (AssertableInertia over MSW, vitest-axe, build-time prerender for public surfaces); v1.3 reconciles §4 rendering around the SEO/GEO split — search crawlers render JS (head + JSON-LD suffices) but AI answer engines do not, so a paint-guarded semantic-body partial seeds the marketing copy into `#app` for GEO. v1.4 (2026-08-08) is the React-19.2 reconciliation pass — a new runtime-error-handling section (§5: createRoot error hooks + the M-1 ErrorBoundary + Sentry FE wiring), 19.2 verdicts (useEffectEvent for the promoted hooks, transitions/useDeferredValue with the never-wrap-Inertia-visits guard, Activity MAY, use(Context) on the migration list), the single-client-head-owner rule, INP + field RUM + intra-page lazy, the route-announcer a11y hook, the no-danger rule, and the enforcement reconciliation that closed the gap where the golden bundle lagged the spec's own MUSTs (react-x idiom lint, react-refresh, size ratchets in the golden eslint, the missing bundle deps, the colocation/page-glob contradiction).
tags: [ spec, standard, frontend, react, inertia, parity, mechanics, mandate ]
type: standard
updated: 2026-08-08
related: [ fleet-app-specification, laravel-engineering-standard, pest-testing, inertia-react, frontend-build-traps ]
---

# Fleet Front-End Specification — v1

The **requirement of record** for the *front end* of every fleet Inertia+React app. Its sister
[[fleet-app-specification]] owns the operational "how" of the whole app — **runtime & framework
versions (§1), static-analysis & lint config (§2), the Vitest suite's existence & CI wiring
(§3), and the Vite runtime guardrails (§5)** — and **this page does not restate any of it; it
points there.** What that spec leaves unsaid, and this one now mandates, is the **front-end
*architecture*: how components are shaped, how React 19 & Inertia v3 are used, how client state
and tests are organized, and which files converge across the fleet versus flex per app.**

Its governing idea is a **mechanical / expressive split.** The
*mechanics* converge and stay in-band fleet-wide; the *expression* — visual design, tokens,
motion, copy, and domain behavior — stays free, so each app keeps its own identity. Where
[[fleet-app-specification]] §6 is "Architecture (the flexible axis)" for the domain, **§1 below is
the flexible axis for the front end.**

## Scope, intent, and conformance

- **Governs (the locked front-end mechanics):** the converged-file set (§1), component
  architecture & the no-god-components rule (§2), React-19 / Inertia-v3 idioms **and what NOT to
  bolt on** (§3), client state, data, performance & rendering (§4), runtime error handling (§5),
  the appearance-independent test strategy (§6), front-end dependency bands (§7), the
  `standards/react` bundle + drift guard (§8), and the accepted-deviations register (§9).
- **The governing risk is over-adoption, not under-adoption.** A 2026 external best-practices
  review of this exact stack found that **Inertia already owns most concerns a conventional React
  SPA reaches for a library to solve** — client-side routing, request caching/prefetch/polling,
  and form+validation plumbing. So the spec's job is as much to say *don't add that* as to say
  *do this*. The "AVOID" verdicts in §3 are load-bearing, not asides.
- **Does NOT govern (the expressive axis, deliberately free):** each app's **visual design,
  Tailwind `@theme` tokens, motion & animation, copy, page layout, feature set, and domain
  behavior.** The bespoke surfaces — each app's signature features — are *expressive by
  definition*. The spec mandates the *mechanics they're built from*, never their *look or feel*.
- **Applies to:** every **Inertia + React** app in your fleet. An app on a **sanctioned
  different stack** (e.g. a Next.js internal tool) is **OUT OF SCOPE**, governed by its own
  `AGENTS.md`/`CLAUDE.md`. Universal *ideas* here (no god components, modern-React idioms, a
  test strategy) are good practice everywhere, but nothing in this spec is *enforced* on a
  differently-stacked app.
- **Normative language:** **MUST / MUST NOT** = required, drift-guard- / eslint- / CI-enforced
  where possible. **SHOULD** = required absent a documented reason. **MAY** = allowed app-need.
  **ACCEPTED-DEVIATION** = a known, justified departure recorded in §9 — never silent.
- **Deviation policy (inherited from [[fleet-app-specification]]):** if a control breaks an app,
  that is signal — **refactor the app so the control holds; never weaken the control.** A genuine
  dead-end is documented in §9, never `eslint-disable`'d or `--no-verify`'d away silently.
- **Rollout — go-forward + backlog:** normative for **new and changed code now**; existing debt
  (the copy-pasted scaffold, god-component pages, the React-19 gap, the coverage ratchet) is a
  tracked burndown in the front-end convergence backlog, **not** a retroactive block. This is
  not an immediate campaign — it converges opportunistically as files are touched.
- **Enforcement:** this repo's **`standards/react/`** bundle is the golden source the apps
  copy from; **`bin/react-drift`** checks parity of the converged set (§8); eslint + the Vitest
  ratchet carry the rest. The bundle MUST be kept at the values below.

---

## §1 The mechanical / expressive split — three tiers

Every front-end file sits in exactly one tier. The tier decides *how much it must match its
twin in the other four apps.* "Non-visual → identical; visual → pattern-only; domain → free."

| Tier | What it is | Convergence rule | Examples |
|------|-----------|------------------|----------|
| **M-1 — Converged identical** | Non-visual plumbing with no brand surface. | **Byte-identical fleet-wide**, owned by `standards/react/`, drift-guarded (§8). Fixed once, synced everywhere. | The auth/2FA/passkey/settings scaffold (`two-factor-*`, `passkey-*`, `delete-user`, `pages/auth/*`, `pages/settings/*`); the recovery boundary (`error-boundary`, §5); the starter hooks (`use-appearance`, `use-mobile`, `use-mobile-navigation`, `use-initials`, `use-two-factor-auth`, `use-clipboard`, `use-current-url`, `use-flash-toast`, `use-route-announcer`); `lib/utils.ts` (`cn`); the `app.tsx` bootstrap **shape** (which per §5/§6 includes the `createRoot` error hooks and the test-excluding page glob); the front-end tooling configs (eslint/tsconfig/prettier/vitest — the copies [[fleet-app-specification]] §2/§3 mandate). |
| **M-2 — Converged pattern** | Structural primitives that carry brand. | **Same public API, prop shape, and a11y semantics** across apps; **look flexes freely via tokens/`@theme`.** Drift-guarded on *structure*, not bytes. New primitives added to the bundle so all apps share the API. | The shadcn `components/ui/*` base primitives (button, input, dialog, dropdown, card, sidebar…); the `app-shell` / sidebar / nav *structure*; the layout scaffolding (`layouts/{app,auth,settings}`). |
| **E — Expressive** | Everything visual and everything domain. | **Free per app. Not converged, not drift-guarded.** Bound only by §2–§6 (must still be well-shaped, modern, and tested) — never by "must match another app." | Pages & feature components; Tailwind `@theme` tokens & `resources/css`; motion/animation; brand primitives (`BrandButton`, `Eyebrow`); the game / simulator / demos / tracker; per-app `hooks/` & `lib/`. |

**The line, stated once:** *non-visual mechanics are identical (M-1); brand-bearing primitives
share an API but not a look (M-2); pages, tokens, motion, copy and domain are free (E).* When
unsure which tier a file is, ask: *does it encode a brand or domain decision?* If yes → E (or M-2
if it's a shared primitive); if it's pure plumbing → M-1.

**Security-sensitive scaffold is M-1 on purpose.** The 2FA/passkey enrollment flow is not a
place for per-app creativity; it MUST be identical so a fix lands everywhere at once. *(A
security-sensitive scaffold like this can drift into divergent per-app versions — e.g. a
`two-factor-setup-modal.tsx` that forks across apps; reconciling it to one M-1 source is a
first-order convergence-backlog item.)*

---

## §2 Component architecture — no god components

The front-end parallel to the backend's "no god classes" (the PHPMD complexity caps in
[[fleet-app-specification]] §2). A large component is a design failure, not a milestone.

- **Single responsibility — MUST:** a component file renders one coherent thing. A **page MUST
  NOT inline its own sub-components, hooks, and utilities** — those get extracted to
  `components/<feature>/`, `hooks/`, and `lib/` respectively.
- **Pure logic lives in `lib/` — MUST:** formatting, derivation, reducers, parsing, and any
  branchy business math **MUST NOT be inlined in a `.tsx` body**; it moves to a `lib/*.ts`
  module so it is **unit-testable without rendering** (this is what makes §6 achievable). A
  reducer over nested state (e.g. a workout draft, a vote tally) is pure logic — extract it.
- **Reused stateful logic → a hook — MUST:** any effect/state pattern used in more than one place
  (a debounced partial reload, a countdown, a realtime reload, a reduced-motion query) **MUST**
  be a single shared `hooks/use-*.ts`, **never copy-pasted**. One concept → one hook, one name
  (don't ship one concept — e.g. a reduced-motion hook — under multiple names; collapse to one).
- **Size ceilings — SHOULD / MUST:** a component file **SHOULD** stay **under ~250 lines** and a
  function **under ~80**; a file **MUST** be refactored before it crosses **~400 lines**. These
  are enforced as **ratcheted eslint `max-lines` / `max-lines-per-function` warnings** (the §6
  ratchet policy: a per-app threshold that may only fall toward target — an app above it may not
  regress, an app at it may not exceed). **The golden `eslint.config.js` now carries the fleet
  targets (250/80, warn)** with a documented per-app override point; the ~400 MUST-ceiling is
  review-enforced. Existing god files (e.g. a 2000+-line page component) are burndown, not
  day-one blocks. *(`components/ui/**` is exempt from the size/padding style rules only — shadcn's
  generated shape is not first-party style — but is fully linted for a11y, hooks, and the §3
  idiom rules; that is the M-2 promise.)*
- **Types centralized — SHOULD:** shared/prop types live in `resources/js/types`, not redeclared
  inline per page. Inertia page props **MUST** be typed (no untyped `usePage()` reads) — via the
  **native mechanism**, not a third-party layer: augment the `InertiaConfig` interface in
  `@inertiajs/core` (`sharedPageProps` / `flashDataType` / `errorValueType`, typically a
  `types/global.d.ts`) and pass a generic to `usePage<…>()` / `useForm<…>()` (a shared
  `types/global.d.ts` is the reference). **Wayfinder's stable, route-only generation is the
  typed-route foundation; its broader model/enum/validation/shared-prop type-gen is a pre-1.0 beta
  (`v0.1.x`, "API subject to change") — track it, don't build on it yet.**
- **Component typing idioms — SHOULD:** derive DOM-element prop types with
  `ComponentProps<'button'>` / `ComponentProps<typeof X>` rather than redeclaring attribute
  lists; model mutually-exclusive prop combinations as **discriminated unions**, not optional
  soup; **no `React.FC`** — type the props parameter directly (React 19 removed the implicit
  `children` rationale for `FC` long ago; it's noise).

---

## §3 React 19 & Inertia v3 idioms — make best use of the tools

"Modern React, used on purpose." These are the mechanics that were the audit's biggest gap: the
concurrent React-19 surface is currently at **zero** call sites fleet-wide.

- **React Compiler — MUST** be enabled **and actually wired for Vite 8.** On `@vitejs/plugin-react`
  **v6 the inline `react({ babel })` option was removed** (oxc replaced Babel), so the compiler
  **MUST** run via **`@rolldown/plugin-babel` + `reactCompilerPreset()`**, ordered **`react()` then
  `babel(...)`**. *(Watch the trap: **an app on plugin-react v6 that keeps the old inline-`babel` form
  has its compiler silently OFF** — verify by checking that the built bundle references
  `react/compiler-runtime`, not by reading the config; apps still on plugin-react v5 where the inline
  form works **MUST** adopt the v6 pattern when they bump.)* **Scope it right: the Compiler only fixes update / re-render
  performance** — not bundle size, initial load, or list virtualization (those stay your job, §4) —
  and it does **not** fully replace `useMemo`/`useCallback` (valid escape hatches), so **don't
  reflexively strip existing memoization**. The flip side, now that the Compiler is on: **new code
  SHOULD NOT add `useMemo`/`useCallback`/`React.memo` without a profiled reason** — manual
  memoization is the escape hatch, not the default. **`eslint-plugin-react-hooks` MUST resolve
  ≥ 6** so `recommended-latest` carries the compiler-powered rules (on v5 that preset is only the
  two classic rules). *(The compiler deps — `babel-plugin-react-compiler`,
  `@rolldown/plugin-babel` — ship in the bundle's `package.fragment.json`.)*
- **Forms — MUST** use Inertia v3's **`<Form>`** component or **`useForm`**. Hand-rolling
  `useState(processing)` + `router.post({ onFinish })` is a **violation for new code**
  (the `<Form {...store.form()}>` render-prop usage is the reference pattern).
- **Optimistic UI — SHOULD, via Inertia's own API:** user-action-feedback paths (votes, likes,
  status flips, tracker logs, goal progress) **SHOULD** reflect instantly with automatic rollback —
  not a full round-trip — using **Inertia v3's first-class `optimistic` API** *(verified against the
  v3 docs, 2026-07-08)*: `router.optimistic((props) => partial).post(…)`, the `<Form optimistic>`
  prop, and `form.optimistic()` on `useForm` / `useHttp`. The callback returns a partial that is
  shallow-merged into page props immediately; Inertia snapshots **only the changed keys** and
  **auto-reverts on any non-2xx / 422 / interrupted visit**, handling concurrent updates safely.
  This is the in-framework mechanism — **use it, not a hand-rolled `useOptimistic`**, for anything
  that round-trips to the server. Reserve React 19's **`useOptimistic`** for purely client-side
  state that never hits Inertia. `useActionState` / `useFormStatus` **SHOULD** carry pending /
  form-scoped status.
- **Concurrent updates — SHOULD (and one MUST NOT):** an **expensive, purely client-side** state
  update — filtering a large in-memory list, recomputing a simulator/game panel, search-as-you-type
  over local data — **SHOULD** be marked non-urgent with **`startTransition`/`useTransition`**, or
  consumed through **`useDeferredValue`** (React 19 adds `initialValue`), so typing and clicking
  stay responsive while the heavy render lags behind. This is the INP lever (§4) the Compiler does
  not pull for you. **MUST NOT wrap Inertia visits in transitions** — Inertia owns the visit
  lifecycle, progress indicator, and interrupt semantics; a transition around `router.visit` fights
  the framework for no gain.
- **`useEffectEvent` — SHOULD (React 19.2):** the canonical fix for "the effect needs the latest
  callback/props without re-subscribing" — extract the non-reactive read into `useEffectEvent`
  instead of mirroring values through refs. The promoted M-1 hooks (`use-realtime-fallback`,
  `useCoalescedTick`, `use-server-action`) are the poster children: **refactor them once, in the
  bundle**, when the fleet is on 19.2. It is for extracting non-reactive logic out of effects —
  not a general replacement for callback props. `eslint-plugin-react-hooks` ≥ 6 understands it.
- **`<Activity>` — MAY (React 19.2):** for a surface that should **keep its state (and pause its
  effects) while hidden** — tab-like panels, wizard steps, a heavy simulator view behind a toggle —
  `<Activity mode="hidden">` replaces both the unmount-and-lose-state pattern and the
  `display:none`-with-live-effects hack. It is for state-preserving hide/show, not a general
  substitute for conditional rendering.
- **Refs, context & the 19 API surface — MUST (via M-1/M-2):** **ref-as-prop, not `forwardRef`**;
  **`<Context>`, not `<Context.Provider>`** (React 19 removed the need for both; both are on the
  official deprecation path). New code **SHOULD** read context with **`use(Context)`** rather than
  `useContext` (same semantics, conditional-read capable), and ref callbacks that set up
  observers/measurement **SHOULD return a cleanup** rather than null-checking. Run the React 19
  **codemods** (`npx codemod@latest react/19/remove-forward-ref` — the codemod-registry route; the
  old `react-codemod` package is stale) on the converged `ui/` stragglers (`input-otp`, `popover`,
  `sidebar`, `toggle-group`) — fixed **once** in `standards/react/`, synced to every app. These
  idioms are now **machine-enforced** in the golden eslint config: **`react-x/no-forward-ref`** and
  **`react-x/no-context-provider`** (error) and **`react-x/no-use-context`** (warn) — CI-gated,
  not review-remembered.
- **Navigation a11y — MUST:** an Inertia visit moves **neither focus nor a screen-reader
  announcement** — the classic SPA regression versus server-rendered pages, and one `vitest-axe`
  (§6) structurally cannot catch. Every app mounts the **M-1 `use-route-announcer`** hook in its
  root layout: on each completed visit it moves focus to the `<main>` landmark (without scrolling —
  Inertia owns scroll) and announces the new `document.title` via a polite live region. The hook is
  authored in the bundle (`standards/react/hooks/use-route-announcer.ts`).
- **`dangerouslySetInnerHTML` — MUST NOT, without a sanitizer:** never with anything but
  fully-server-controlled HTML; content that genuinely must render as HTML goes through
  **DOMPurify** first. **`react/no-danger` is an error** in the golden eslint config; each disable
  carries a one-line justification naming why the input is trusted.
- **Realtime & partial reloads — MUST:** the "reload on a Reverb tick" / "debounced
  `router.reload({ only })`" pattern **MUST** route through a **single shared hook**, never a
  copy-pasted `useEffect`. **`Deferred` / `WhenVisible` / prefetch SHOULD** be used for
  below-the-fold or heavy props (faster mobile first paint). Partial reloads **SHOULD** name
  `only:` rather than refetching every page prop.
- **Reuse the fleet's proven hooks — SHOULD (don't reinvent):** promote the audit's
  cross-pollination winners into `standards/react/` and reuse them rather than rebuild:
  `use-realtime-fallback` + `useCoalescedTick` (degraded-link resilience), `use-server-action`
  (mutate→snapshot→settle guard), `use-local-storage` (`useSyncExternalStore`, SSR-safe,
  cross-tab). Charts **SHOULD** follow a zero-dependency, a11y-labelled SVG discipline rather
  than adding a charting library.
- **Don't reinvent what Inertia owns — AVOID (do NOT bolt on).** External review confirmed
  Inertia already owns these; adding a library for them is drift, not progress:
    - **No client-side router.** Inertia *is* the router (routes server-side, Wayfinder-typed
      links); it already gives route-level code-splitting, prefetch (hover/mousedown/mount), and
      scroll restoration. **Adding React Router / TanStack Router fights the framework** — anti-pattern.
    - **No TanStack Query / SWR for standard server data.** Partial reloads, deferred props,
      `WhenVisible`, `usePoll`, prefetch, and Inertia's stale-while-revalidate cache cover the
      client-cache / background-refetch / polling roles. A query library is warranted **only** for a
      genuinely client-only, cross-component query graph — never for page props.
    - **No React Hook Form + Zod for standard forms.** `<Form>` / `useForm` + Laravel validation
      (auto-surfaced in `errors`) is the path; for live pre-submit validation use **Laravel
      Precognition** (it reuses the *server* rules) rather than re-encoding them in client Zod.
      RHF/Zod is additive only for a bespoke instant-UX case.
    - **No React `<ViewTransition>` (experimental).** Inertia 3.6+ owns view transitions — the
      component swap already runs inside `document.startViewTransition` ([[inertia-react]]
      documents the three traps). Layering React's experimental API on top double-drives the same
      browser primitive.
    - Adopting any of these is an **ACCEPTED-DEVIATION (§9)** with a written justification — never a
      silent per-app dependency.

---

## §4 Client state, data & performance

- **Server state stays server-owned — MUST:** data that lives in the database reaches the page as
  **Inertia props**; it **MUST NOT** be mirrored into a client store as a second source of truth.
  Refresh it with a partial reload, not by hand-syncing a cache.
- **Client state — MAY:** genuinely client-only state (ephemeral UI, a 60fps game loop, a wizard
  draft) **MAY** use `useReducer` or **zustand**. Zustand **MUST** use **atomic selectors** (no
  whole-store or object-returning subscriptions) — a well-built store (atomic selectors, a
  `stateVersion` guard against reordered responses) is the reference. Multi-value selection goes
  through **`useShallow`**, the one sanctioned non-atomic subscription — never a bare
  object-returning selector.
- **Browser-only externals — SHOULD `useSyncExternalStore`:** any read of a browser API that
  changes outside React — `matchMedia`, storage, network status, the URL — goes through a
  `useSyncExternalStore`-based hook (`use-local-storage` is the reference), **never**
  `useEffect`+`setState` mirroring (wrong first frame, tears under concurrent rendering).
- **No ad-hoc globals — MUST NOT:** shared client state goes through a store or context, never a
  module-level mutable singleton (e.g. a `let counter` minting ids — use `useId`/`crypto.randomUUID`).

**Performance — the parts the tools DON'T do for you.** React Compiler (§3) fixes re-render cost
only; the rest is still owned here:

- **Vendor bundle-splitting — SHOULD:** Inertia already code-splits each page; the **shared vendor
  bundle is not split** — **no app splits it** today. Define a vendor strategy in `vite.config.ts` via
  **`build.rollupOptions.output.advancedChunks` (`{ groups: [{ name, test }] }`)** — the Vite 8 /
  Rolldown API (`manualChunks` is deprecated on Rolldown) — isolating React / Radix / heavy libs so
  touching one page doesn't re-download the world. **SHOULD** wire a bundle visualizer for on-demand
  analysis. The `bundle:check` budget gate ([[fleet-app-specification]] §3) stays the CI backstop,
  **recalibrated after the split.**
- **Heavy client-only components — SHOULD `React.lazy`:** page-level splitting (Inertia) and
  vendor splitting (above) still leave a heavy component *inside* a page — a chart, an editor, the
  game core — in that page's chunk. `React.lazy` + `Suspense` it out, with a **reserved-space
  fallback** per the CLS rule below.
- **Long lists — SHOULD** virtualize (e.g. TanStack Virtual) past ~100 rows; the Compiler does not
  help here.
- **CLS is the SPA liability — MUST mind:** Core Web Vitals are measured against the *hard*
  navigation and **do not reset on Inertia soft navigations**, so layout shift **accumulates across
  the whole session**. Reserve space for async/deferred content (fixed-dimension skeletons,
  width/height on images) — budget CLS across the session, not per page. Most acute on public surfaces.
- **INP joins CLS — MUST mind:** INP (the responsiveness vital, successor to FID) accumulates
  across the same session-long window. The Compiler trims re-render cost *inside* an interaction
  but does nothing for a long synchronous handler or an unyielded loop — break heavy interaction
  work up (transitions per §3, chunked/yielding loops). Most acute on the game/simulator surfaces
  and 100+-row lists — exactly where virtualization and transitions overlap.
- **Field measurement — SHOULD (public surfaces):** beacon LCP/CLS/INP from real sessions via the
  **`web-vitals`** library to a **first-party endpoint** — budgets without field data are lab-only
  guesses. No vendor: the library is ~2 kB and the endpoint is yours. (React 19.2's DevTools
  performance tracks are the matching lab-side profiling surface.)

**Document head — one client owner (MUST):** three mechanisms can now write head tags — React 19's
native metadata hoisting (`<title>`/`<meta>`/`<link>` rendered anywhere), Inertia's **`<Head>`**,
and the Blade SEO partial below. The split is: **the Blade partial owns the crawler-critical head
server-side (below); Inertia `<Head>` owns the human-visible per-page title/meta client-side;
React-19 native metadata tags are used for neither** — mixing two client writers yields duplicate
and fighting tags. (`react-dom`'s `preload`/`preinit`/`preconnect` **calls** are fine — they emit
resource hints, not competing metadata; **SHOULD** be used for the webfont + LCP image on public
landers, with `fetchPriority="high"` on the LCP image itself.)

**Rendering for public surfaces — the split: SEO crawlers render JS, GEO crawlers don't.** Two
classes of crawler set two different requirements, and one pattern serves **both with no runtime
SSR.** Runtime Inertia SSR (a Node process in the internet-facing pod conflicts with the hardened,
shell-less runtime image, [[fleet-app-specification]] §5), build-time prerender (marketing content is
**DB-backed + maintainer-editable**, so a prerender goes stale), and a **full-fidelity Blade/SSR body
port** (a large rebuild for low marginal gain) are all **rejected.** What each crawler class needs:

- **Search crawlers execute JavaScript.** Rendering the SPA body is enough for them; only the
  **crawler-critical head + structured data** must be server-rendered: `<title>`, meta description,
  canonical, robots, OpenGraph/Twitter, and **JSON-LD** (LocalBusiness, plus **FAQPage** where a page
  has FAQs, BreadcrumbList where nested) — from a **Blade partial fed by shared Inertia props**
  (`seo` / `jsonLd`), reading the same Eloquent models so it never lies after a maintainer edit.
  **Reference:** a `partials/seo.blade.php` partial fed by `App\Support\Seo\*`.
- **AI answer-engine crawlers do NOT execute JavaScript** (GPTBot, ClaudeBot, PerplexityBot,
  Meta-ExternalAgent). A CSR-only body is invisible to them, which makes the app **uncitable**. Where
  being cited by answer engines matters — any public marketing lander — the **body copy MUST also
  live in the raw HTML**, but as a **lightweight Blade semantic-body partial** (plain semantic HTML
  from the same `marketing.*` lang lines), **NOT** a full SSR rebuild. Seed it **into `#app`**,
  mirroring `<x-inertia::app />` (the `data-page` script + the `#app` div); with **no
  `data-server-rendered`** attribute Inertia `createRoot()`-**replaces** it for humans, so it never
  hydrates and there is no markup-parity constraint.

**Guard the paint.** Seeded into `#app`, the partial **paints unstyled during the bundle-load
window** before `createRoot()` replaces it — an "LLM copy flicker". Guard it at the **top of the
partial**:

```blade
<style>#app > main { display: none }</style>
<noscript><style>#app > main { display: block }</style></noscript>
```

`display:none` removes it from **paint and layout**; crawlers read raw HTML and never apply CSS, so
GEO legibility is unchanged; `<noscript>` restores it for JS-less humans; React clears `#app` on
mount, so the guard evaporates for human visitors. **MUST NOT** color-match text to the background
instead — that leaves ghost layout and reads as **cloaking**. A Pest test **MUST** pin the guard's
presence on the lander and its absence off it.

The visible, high-fidelity **body stays the Inertia SPA** — the semantic partial is a minimal
GEO/legibility seed, never a second rendering of the real page.

---

## §5 Runtime error handling — the crash doctrine

*New in v1.4 — the audit's largest omission.* Build-time guardrails are owned elsewhere; this
section owns what happens when the front end **throws at runtime**. The doctrine in one line:
**reporting is centralized in the bootstrap; recovery UX is owned by boundaries; both are M-1.**

- **`createRoot` error hooks — MUST:** the M-1 `app.tsx` bootstrap shape passes
  **`onUncaughtError`** and **`onCaughtError`** (React 19) to `createRoot`, both wired to the
  app's error reporter — **Sentry's browser SDK** (`@sentry/react`, `Sentry.reactErrorHandler()`
  as the reference wiring). This completes the front-end half of [[fleet-app-specification]] §5's
  Sentry mandate, previously an open follow-up. A crash a boundary catches is still a defect —
  **"caught" MUST NOT mean "unreported."**
- **`ErrorBoundary` — the M-1 recovery primitive:** the bundle's
  `scaffold/components/error-boundary.tsx` is the one implementation — hand-rolled, zero-dep (no
  `react-error-boundary`; the anti-over-adoption rule applies here too). It owns **recovery
  only** — reporting stays in the bootstrap hooks above, so nothing is double-reported. It renders
  an app-supplied fallback (the fallback's *look* is expressive-tier, passed as a prop) and
  **auto-resets on the next successful Inertia navigation**, so a crashed page never outlives the
  visit that caused it. Placement: **one at the root — MUST; one around each heavy bespoke
  surface — SHOULD** (game, simulator, tracker), so a crash degrades one panel, not the page.
- **HTTP error responses — MUST have a decided shape:** production **500/503** render the
  server-side error/maintenance pages (never Inertia's dev error modal — it is dev-only by
  default, but each app **MUST** verify `APP_DEBUG=false` behavior once); **419** (expired
  session/CSRF) **MUST** resolve to a clean retry via the Laravel-side redirect-back recipe from
  Inertia's error-handling docs ("the page expired" flash → fresh token), never a dead white
  modal. Which pages exist is expressive; *that* the three cases are handled is mechanical.
- **Debugging surface — note, no config:** React 19.1+ **owner stacks** make dev component
  stacks accurate, and 19.2's **DevTools performance tracks** profile the interactions §4's INP
  rule governs. Awareness, not wiring.

---

## §6 Testing — the appearance-independent standard

Coverage strategy is **independent of how an app looks or behaves** — it tests *logic and
contracts*, which every app has regardless of its visual identity. [[fleet-app-specification]]
§3 already owns **Vitest 4's existence, the `tests/js/**` include, and the CI wiring**; this
section owns **what to test and to what bar.**

- **Strategy — MUST:**
    - **Pure logic** (everything extracted to `lib/` per §2) **MUST** have Vitest unit tests — the
      highest-value, lowest-cost coverage, non-negotiable for new logic modules. Test hooks through a
      component with RTL's `render`, **not** `renderHook` (exercise the real usage path).
    - **Complex interactive components** (multi-state widgets, forms, the bespoke surfaces)
      **SHOULD** have React Testing Library behavior/smoke tests (role-based queries).
    - **Interactions drive through `@testing-library/user-event` — MUST**, not `fireEvent` —
      user-event runs the real event pipeline (focus, keyboard, pointer sequencing); `fireEvent`
      is the narrow escape for low-level events user-event cannot produce. Enforced:
      `testing-library/prefer-user-event` is an error in the golden config.
    - **Inertia page props — assert server-side.** A page's data contract **SHOULD** be tested with
      Laravel's **`AssertableInertia`** (`->has()` / `->where()` / `->missing()`) in a Pest Feature
      test — props are server-returned, so assert them at the endpoint, not by mocking a client fetch.
      **AVOID MSW for page data:** Inertia's transport is server-driven, so there is no client request
      to intercept; MSW earns its keep only if a component calls a *non-Inertia* HTTP API.
    - **Interactive elements** **SHOULD** carry a11y assertions via **`vitest-axe`** (axe-core) plus
      role/label queries, reinforcing the jsx-a11y lint from [[fleet-app-specification]] §2. (Both
      `vitest-axe` and `@testing-library/user-event` now ship in the bundle's `package.fragment.json`.)
    - **String pins — MUST NOT pin marketing prose.** A test **MAY** assert a rendered string only
      when (a) **the string is the requirement** — honesty/compliance labels ("sample data · nothing
      is saved"), price figures sourced from pricing data, legal/billing wording — or (b) **the
      interpolation is the logic under test** (assert the dynamic fragment, not the sentence around
      it). Everything else anchors on **roles, form-control labels, `data-testid`, and counts**;
      control labels via `getByRole('button', { name })` are fine (they're a11y affordances).
      Rationale: a test whose only failure mode is "someone reworded a sentence" catches no bugs and
      gives CI veto power over the copywriter (established when a trust-panel test broke on a
      deliberate copy correction and re-pinning it verified nothing).
- **Test lint — MUST:** `eslint-plugin-testing-library` (`flat/react` + `prefer-user-event`) and
  `eslint-plugin-jest-dom` run **scoped to test files** in the golden config — the §6 query
  discipline is machine-checked, not remembered.
- **Location — MUST:** tests are **colocated** as `*.test.tsx` next to their source — *including
  under `pages/`*, which is safe **iff** the M-1 bootstrap's page resolver excludes tests from the
  glob: `import.meta.glob(['./pages/**/*.tsx', '!./pages/**/*.test.tsx'])`. The resolver shape is
  M-1 precisely so this exclusion is fleet-wide; **an app still on the bare single-pattern glob
  ships its page tests to production** ([[frontend-build-traps]]) — fix the glob, don't relocate
  the tests. Cross-cutting or page-level suites **MAY** live under `tests/js/`. One convention per
  app — no split-brain.
- **Environment — verdict recorded (v1.4): jsdom stays.** Vitest 4's Browser Mode is stable and
  upstream-recommended for component tests, but this fleet's strategy makes it low-marginal-value:
  appearance-independent tests + `AssertableInertia` (server-side props) + `vitest-axe` don't need
  a real browser, and true E2E is already the per-app Playwright deviation
  ([[fleet-app-specification]] §7 A-05). **jsdom remains the fleet default; a Browser Mode or
  Playwright component suite is an ACCEPTED-DEVIATION (§9), not a silent add.** Related verdict:
  **Vitest runs the uncompiled source** (plain `@vitejs/plugin-react` in `vitest.config.ts`, no
  Compiler) — accepted and deliberate; tests assert behavior the Compiler must preserve. Don't
  "fix" either.
- **Coverage — ratchet toward ~60% (MUST, ratchet policy):** each app runs `vitest run --coverage`
  with a **per-app minimum that may only rise toward the fleet target of ~60% line coverage.** Not
  a hard day-one gate (an app at ~2% or 0% would block all work) — it is a **one-way ratchet**
  identical in spirit to [[fleet-app-specification]] §2's baseline policy: set each app's floor at
  its current number, forbid regression, raise it as coverage lands. Apps already in the ~24-34%
  range show the bar is reachable. **`components/ui/**` is deliberately excluded from coverage**
  (vendored primitives; their parity is owned by the drift guard, §8) — stated here so nobody
  "fixes" the exclusion.

---

## §7 Front-end dependency bands — in-band, not identical

The **major-boundary version pins are owned by [[fleet-app-specification]] §1** (React 19 · Vite
8 · Tailwind 4 · TS 6 · Inertia v3) — not restated here. This section adds the *band* rule for the
shared front-end libraries **below** those majors:

- **Shared FE deps MUST stay within one major across the fleet.** A **major-version gap between
  apps rendering the same thing is a violation** — e.g. `lucide-react` at
  **`0.475`** in some apps versus **`1.x`** in others. Libraries in this class: `lucide-react`,
  `@radix-ui/*`, `class-variance-authority`, `clsx`, `tailwind-merge`, `framer-motion` (where
  present). Converge the band; the committed lockfile pins the exact version per [[fleet-app-specification]]
  §1's pinning principle.
- **The converged tooling configs are byte-identical (M-1)** and drift-guarded — eslint, tsconfig,
  prettier, vitest configs move in lockstep with the `standards/react/` bundle.
- **Automated band-keeping — SHOULD:** a Renovate/Dependabot config **SHOULD** keep the shared-dep
  band closed so drift is caught as a PR, not discovered in an audit.

---

## §8 The convergence mechanism — `standards/react/` + `bin/react-drift`

- **`standards/react/` is the golden source** for the front end (peer to `standards/laravel/` for
  the backend). It houses: the **M-1 converged scaffold** (chrome, hooks, `cn`, `app.tsx` shape),
  the **M-2 primitive templates** (`ui/*`), the **front-end tooling configs**, the promoted shared
  hooks (§3), a **`README.md` apply-guide**, and a **`converged-set.md` manifest** naming every
  M-1 (byte-parity) and M-2 (structural-parity) path. As of v1.4 the bundle also carries its
  **first authored M-1 sources** — `scaffold/components/error-boundary.tsx` (§5) and
  `hooks/use-route-announcer.ts` (§3) — ahead of the full scaffold migration (backlog B-2); apps
  adopt them like any M-1 file.
- **`bin/react-drift`** (parallels `bin/arch-drift`) checks the manifest in the **`static` CI
  job**: **M-1 paths byte-identical** to the bundle, **M-2 paths structurally parity-checked**
  (same exports/API). Justified divergences are recorded in **`standards/react/react-drift.allow`**
  and mirrored to §9 — never silent. *(Until the guard ships, parity is a review checklist.)*
- **Adding to the standard:** a new shared primitive or hook lands in `standards/react/` first,
  then syncs out — never authored five times. The bundle **MUST** be kept at this spec's values.

---

## §9 Accepted-deviations register

These rows are illustrative of the *kinds* of deviation this register records and their format;
record your own apps' deviations the same way.

| ID | App(s) | Deviation | Why |
|----|--------|-----------|-----|
| F-01 | acme | only app carrying `framer-motion` | used in a few files, appropriate; motion is an **expressive-tier** choice, not a mandated dep |
| F-02 | acme | game bypasses Tailwind tokens for a runtime `theme` object (inline `style={{}}`) | a data-driven runtime theme; **expressive-tier**, wants a `panelStyle(theme)` helper (backlog), not token conversion |
| F-03 | acme | no appearance/theme feature (inherits [[fleet-app-specification]] §7 A-03) | FrankenPHP writable-volume constraint; no dark-mode toggle, so `use-appearance` is absent |

> Divergence that is merely **not-yet-converged** (a multi-version 2FA modal, god-component pages,
> a dependency band gap, near-zero coverage) is **burndown in the front-end convergence backlog,
> not a deviation** — it is debt against this target, tracked there, not waived here.

Any new deviation **MUST** be added here with a justification before it ships.

---

Convergence is tracked in a front-end convergence backlog (the burndown; this spec is the
target). Versions, lint, CI, and runtime guardrails remain owned by [[fleet-app-specification]];
this page owns front-end architecture and does not duplicate them.
