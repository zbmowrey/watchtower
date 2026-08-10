---
title: Real-Time & Broadcasting Guidance (Reverb)
description: Best-practice guidance for apps that adopt realtime — when a websocket is warranted at all, Laravel Reverb's config and k8s footprint (own Deployment, `/app/…` ingress, single-instance-first scaling), channel naming and the public/private/presence decision rule, channel authorization and tenant scoping in `routes/channels.php`, broadcast payload discipline, and the Echo + React client wiring under [[fleet-frontend-specification]]. The realtime substrate for [[notifications-standard]]; not the outbound-delivery model ([[fleet-webhook-specification]]).
tags: [ standard, realtime, broadcasting, reverb, websockets, echo, channels, laravel, k8s ]
type: standard
status: reference
updated: 2026-08-08
related: [ fleet-frontend-specification, fleet-queue-doctrine, fleet-app-specification, fleet-webhook-specification, notifications-standard, fleet-testing-doctrine, inertia-react, laravel-sail ]
---

# Real-Time & Broadcasting Guidance (Reverb)

**Guidance, not mandate.** Realtime is an infra add-on adopted **per app** — [[fleet-app-specification]]'s
"MAY (app-need)" band, alongside Valkey and MinIO; most apps never run it. The server of record is
**Laravel Reverb**: first-party, runs from the image split the app already builds, speaks the Pusher
protocol so `laravel-echo` needs no bespoke client. What follows is firm defaults with stated
trade-offs; the few hard **MUST**s are reserved for choices that leak data or silently drop events.

**Boundary — this page is not webhooks.** Broadcasting pushes to *browsers we authenticated*, over a
connection *they* opened, with no delivery guarantee. Outbound webhooks push to *third-party servers*
with signing, retries, and a delivery ledger — a different model with different failure semantics,
owned entirely by [[fleet-webhook-specification]].

## §1 When realtime is warranted — and when it isn't

- **The judgment rule — SHOULD:** reach for a websocket only when **the user is watching a surface
  that changes without them acting on it** and acceptable staleness is **seconds**. Everything else
  is a refresh problem — and realtime never substitutes for the mutation response, which already
  updates the actor's own screen. Broadcasting is for changes originating **elsewhere**: another
  user, a queue worker, a webhook receiver, a scheduled job.
- **Below that threshold, use what Inertia already owns:** `router.reload({ only: [...] })` after a
  mutation, `usePoll` on a live-ish panel, `Deferred`/`WhenVisible` for heavy props. A 15–30s poll on
  one page costs nothing to operate; a websocket tier costs a Deployment, an ingress route, a
  reconnect story, and a channel-authorization surface **forever**.
- **Fits:** the in-app notification flyout ([[notifications-standard]]), a board several people work
  at once, long-running job progress, presence. **Doesn't:** single-user dashboards, anything a page
  transition already refreshes, "live" counts nobody watches, analytics firehoses (metrics pipeline,
  not a socket).

## §2 Configuration & environment conventions

- **Server-side vs client-side vars — MUST keep the secret server-side.** `REVERB_APP_ID` /
  `REVERB_APP_KEY` / `REVERB_APP_SECRET` are the app server's *publish* credential; `VITE_`-prefixed
  key/host/port/scheme are compiled **into the browser bundle** and public by construction. The key
  is meant to be public; the **secret never appears in a `VITE_` var** — it lets its holder publish
  to any channel.
- **The two hosts are different hosts — SHOULD:** the app server publishes over the cluster-internal
  Service (`REVERB_HOST=__APP__-reverb`, plain HTTP inside the mesh); the browser connects to the
  public `<host>` on 443. Pointing the publish host at the public name works locally, then routes
  every broadcast out through the ingress and back — the "why is broadcasting slow in production" bug.
- **`BROADCAST_CONNECTION`:** `reverb` where realtime is adopted, **`log` in CI and the test suite**
  so no test opens a socket, `null` elsewhere — `ShouldBroadcast` in a non-realtime app should be
  inert, not an error.
- **CSP and local dev are already owned:** the fleet `SecurityHeaders` middleware ships a Reverb-aware
  `connect-src` that collapses to `'self'` without Reverb config (`standards/laravel/` apply-guide) —
  hand-widening it means your hosts are wrong, not the policy; the `reverb` Sail service is
  [[laravel-sail]].

## §3 Channel naming

- **A channel name is an address, not a payload — SHOULD:** dotted, lowercase, resource-scoped, every
  segment a stable identifier — `orders.{orderId}`, `tenant.{tenantId}.board.{boardId}`. Never encode
  state or permissions; names travel in the clear through logs, devtools, and the handshake. Keep the
  framework default for user-directed streams (`App.Models.User.{id}` — [[notifications-standard]]
  builds the flyout on exactly that channel).
- **Names SHOULD be derivable on both sides from data the page already has.** If the client must ask
  the server "what channel am I allowed on", the design is inverted — the server sends the
  identifiers as page props and the name is a pure function of them. And never a bare guessable
  global (`updates`, `notifications`) for scoped data: the authorization callback is the fence, but
  a name that invites every client to try is a fence you're testing in production.

## §4 Public / private / presence — the decision rule

Default to **private** — one authorization callback bought against the guarantee that subscription
is a checked operation. Move off it only with a reason from this list:

- **Public — only for data already served to anonymous visitors** on a page that requires no login:
  a status board, a public live counter. If you'd hesitate to put the payload in an unauthenticated
  JSON endpoint, it isn't public.
- **Presence — only when the roster is itself the feature:** who's viewing, who's typing, live
  collaborator avatars. It broadcasts **every member's identifying data to every other member**, so
  the array your callback returns *is* a payload under §6 — the minimum (id, display name, avatar),
  never emails, roles, or internal flags. Presence as "private plus a member count" trades a real
  disclosure for a number you could compute server-side.
- **Client events (`whisper`) — MAY, for ephemeral UX only:** typing indicators, cursor positions.
  They travel client→client without touching the app server, carrying **no validation, no
  authorization beyond channel membership, and no audit trail**. **MUST NOT** drive state changes;
  mutations go over HTTP where the rules live.

## §5 Channel authorization & tenant scoping

- **Every private/presence channel gets a callback in `routes/channels.php` — MUST**, returning a
  real authorization decision, never a bare `true`. `Broadcast::channel()` with model binding
  resolves the record; the body asks what a policy would — reuse the policy where one exists
  (`$user->can('view', $order)`) rather than re-deriving ownership beside it.
- **Tenant scoping — MUST derive the tenant from the authenticated context, never from the channel
  name.** The name's tenant segment is *client-supplied input*: it says which stream they want and
  proves nothing about entitlement. The callback compares it against the tenant resolved from the
  session/subdomain and refuses on mismatch — apps on the subdomain-per-tenant model taking that
  resolution from the request context they already trust ([[fleet-app-specification]]'s carve-out).
- **Check every binding, not just the interesting one.** A callback on
  `tenant.{tenantId}.board.{boardId}` receives both — verify the board belongs to that tenant. A
  board id from tenant A under tenant B's prefix is the cross-tenant leak that sails past a naive
  single-binding check.
- **The auth endpoint** is `/broadcasting/auth` on the **web** group — session-cookie authenticated,
  which an Inertia app already has. Apps with a token-authenticated API surface route it through
  their guard explicitly rather than loosening the web group.
- **What a channel-auth test looks like — SHOULD.** Channel callbacks are authorization code and get
  authorization coverage: **assert the deny, not just the allow** (placement per
  [[fleet-testing-doctrine]]).

  ```php
  it('refuses a board belonging to another tenant', function () {
      [$user, $foreign] = boardInForeignTenant();
      $this->actingAs($user)->post('/broadcasting/auth', [
          'channel_name' => "private-tenant.{$user->tenant_id}.board.{$foreign->id}",
          'socket_id' => '123.456',
      ])->assertForbidden();
  });
  ```

  Pair it with the allow case, but *this* is the one that earns its keep — it fails loudly the day
  someone "simplifies" the callback down to a single binding check.

## §6 Events & payload discipline

- **A broadcast is a signal, not a state transport — SHOULD.** The server stays the source of truth;
  the socket says *"something changed, come look"*. Clients rendering straight from broadcast
  payloads diverge the moment a message is missed (§7 — and one **will** be, every deploy). Send an
  identifier and a verb; let the client `router.reload({ only: [...] })`.
- **Channels are untrusted transport — MUST NOT broadcast anything you wouldn't hand a client
  directly.** No PII beyond what the subscriber already sees, no secrets, no internal state, no
  fields excluded from that user's serialized view. `broadcastWith()` returns an explicit allow-list;
  a bare model in the payload ships every column you later add.
- **Name the wire contract — SHOULD:** `broadcastAs()` gives a stable event name, decoupling the JS
  from the PHP class path; without it, renaming or moving an event class breaks every listener.
- **`ShouldBroadcast` (queued) over `ShouldBroadcastNow` — SHOULD.** Broadcast jobs ride the queue
  like any other job under [[fleet-queue-doctrine]] — partition, retry policy, and worker operation
  are that page's rules, not restated here; they belong on `default` (user-facing async) until a
  blast-radius argument earns a partition. `ShouldBroadcastNow` puts a socket write on the request's
  critical path — acceptable only where the queue hop is visibly the latency problem.
- **`toOthers()` on actor-originated events — SHOULD.** The actor's screen was already updated by their
  mutation's response; re-applying the broadcast is the double-apply flicker. It needs the client's
  socket id to reach the server — Echo wires that automatically, so verify it survives a custom HTTP
  client. And queued broadcasts inherit the connection's `after_commit` default
  ([[fleet-app-specification]] §5): without it you announce a row a rolled-back transaction never wrote.

## §7 The client — Echo + React

Client architecture is owned by [[fleet-frontend-specification]]; this is its realtime slice and
defers there on every general question (hook shape, component limits, where shared hooks live).

- **Initialize once, at the bootstrap** — a single `echo.ts` imported from `app.tsx`, never
  per-component; **SHOULD** be imported lazily where realtime lives on a few authenticated surfaces,
  so anonymous pages neither open a socket nor pay the bundle.
- **Subscribe through a hook, not a raw `useEffect` — SHOULD.** Prefer the first-party
  `@laravel/echo-react` hooks (`useEcho`, `useEchoPublic`, `useEchoPresence`); where they don't fit,
  one shared hook in `standards/react/`. The frontend spec's "realtime tick → partial reload routes
  through a single shared hook" rule binds here — a copy-pasted subscribe effect is the drift it exists
  to prevent.
- **Every subscribe has a matching unsubscribe in the effect's cleanup.** Leaked subscriptions are the
  standard realtime memory bug: handlers firing against unmounted trees, a server-side subscription
  per abandoned mount. `Echo.leave(name)` also drops that name's `private-`/`presence-` variants;
  `leaveChannel(name)` drops exactly one — prefer the latter unless you mean the sweep.
- **Reconnection is the hot path, not the edge case — SHOULD design for it.** Every deploy rolls the
  Reverb pods and drops every socket; laptops sleep, mobile networks flap. `pusher-js` reconnects with
  backoff on its own, but **events during the gap are gone** — so on reconnect **resync from the
  server** (a partial reload of the affected props) instead of assuming continuity. This is why §6
  keeps payloads to signals; the bundle's `use-realtime-fallback` + `useCoalescedTick` are the proven
  degraded-link pattern, and the latter also keeps a burst of ticks from becoming a burst of reloads.
- **Degrade, don't break.** A surface whose socket never connects **SHOULD** stay usable on normal
  navigation. Realtime is an enhancement; if the page is dead without it, a websocket has become a
  hard dependency of your product.

## §8 Reverb in Kubernetes

- **Its own Deployment + Service — SHOULD.** Reverb is a long-lived process with a connection budget;
  it does not share a pod with the web tier. It runs `php artisan reverb:start --host=0.0.0.0
  --port=8080` on the hardened internet-facing image the web workload already uses — `reverb` is one
  of the optional workloads an app's chart enables (`standards/laravel/` deploy-harness notes).
- **Expose `/app/…` publicly — and nothing else. MUST NOT route `/apps/…` through the ingress.**
  `/app/{key}` is the client websocket handshake and belongs on the public route; `/apps/{id}/…` is
  the **publish API**, authenticated only by the app secret, and reaches Reverb over the internal
  Service. Publishing it externally hands anyone who obtains the secret a broadcast tap.
- **Websocket-capable ingress:** an nginx ingress upgrades connections with no special config, but
  its **default 60s read/send timeouts kill idle sockets** — raise `proxy-read-timeout` /
  `proxy-send-timeout` past the heartbeat interval on that route's annotations. Behind Cloudflare
  websockets pass through on the proxied hostname; the usual failure is an origin timeout, not the
  edge. **Session affinity SHOULD NOT** be enabled reflexively — a websocket is one long-lived
  connection, not a series of requests to pin.
- **Scale vertically first — SHOULD.** One instance holds far more concurrent connections than most
  apps will ever have; start at a single replica with a generous memory/file-descriptor budget, and
  size on connections, not requests.
- **Horizontal scaling — MUST enable the Redis/Valkey scaling mode** (`REVERB_SCALING_ENABLED`)
  before raising replicas above one. Without it each instance broadcasts only to *its own*
  connections, and the symptom is the worst kind: **some** users miss **some** events, intermittently,
  with nothing in the logs. Valkey is already fleet infra ([[fleet-queue-doctrine]] §2).
- **Probes and deploys:** a TCP socket probe on the Reverb port is the honest liveness check (`/up`
  belongs to the web workload and says nothing about the socket server). The GitOps image roll
  replaces Reverb pods exactly as it replaces workers, so every deploy drops every connection by
  design — don't engineer around that, engineer the reconnect (§7).

## §9 Considered and rejected

- **Hosted Pusher / Ably** — no infra to run, against per-message billing, a third-party dependency
  in the hot path of an authenticated surface, and app data leaving the cluster. Reverb is
  first-party, speaks the same protocol, and rides infrastructure the fleet already operates.
  **Revisit trigger:** a real global-edge presence requirement, or connection counts a
  vertically-scaled pod pair can't hold.
- **Soketi / other community Pusher-compatible servers** — solved a real problem before Reverb
  existed; carrying a third-party server for a first-party capability is now maintenance debt.
- **A bespoke SSE endpoint** — genuinely simpler for one-directional fan-out, and tempting. Rejected
  as the *fleet* answer: an app that adopts realtime almost always grows a second need (presence,
  per-channel authorization, client events) that SSE answers with hand-rolled code, while `usePoll`
  already covers everything too small for a socket. One standard transport plus polling beats two,
  one of them bespoke.
- **Websockets as an RPC channel** (client→server commands over the socket) — bypasses validation,
  authorization, rate limiting, and request logs. Mutations go over HTTP; `whisper` stays ephemeral (§4).
- **Realtime everywhere by default** — a websocket tier on an app whose users refresh every few
  minutes is a standing operational cost against a benefit nobody asked for (§1).
