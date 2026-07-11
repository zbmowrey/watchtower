---
title: Laravel Sail
description: How the Sail apps are configured locally and how to run multiple stacks simultaneously without port collisions.
tags: [stack, sail, docker, local-dev, laravel]
type: stack
updated: 2026-06-22
related: [pre-commit-hooks]
---

# Laravel Sail (local dev)

The Laravel apps use **Laravel Sail** with a `compose.yaml` at the repo root.

## Services per app

- `laravel.test` (PHP app) — publishes `APP_PORT` and (where the app runs Reverb
  inline) `REVERB_PORT`.
- `pgsql` — Postgres, publishes `FORWARD_DB_PORT`.
- `redis` (where the app uses Redis) — publishes `FORWARD_REDIS_PORT`.
- **`vite`** — runs `npm run dev` (HMR) automatically; publishes `VITE_PORT`.
- **`queue`** — runs `php artisan queue:work` automatically.
- **`scheduler`** — runs `php artisan schedule:work` automatically.
- **`reverb`** (apps with realtime) — runs `php artisan reverb:start` automatically;
  publishes `REVERB_PORT`. (Some apps run Reverb inside `laravel.test` instead;
  giving it its own service means `sail up` brings realtime up too.)

So **`sail up` (or `just start`) is all you need** — Vite, the queue worker, and
the scheduler come up with the stack; no separate `npm run dev` / `queue:work`.

Each compose reads ports as env vars with defaults, so they're controlled entirely
from `.env`. See local dev ports for the assigned, non-colliding values.

### The `vite` service is the designated toolchain container

**The whole local toolchain runs INSIDE the `vite` container** — see
[[pre-commit-hooks]]. The `vite` service is the same uniform shape as the others
(`image: sail-8.x/app` = PHP + node, shared `.:/var/www/html` mount) and its command
is `sh -c "npm install && npm run dev"`, so on every `up`/`just start` it
installs/maintains the **single, container-owned (Linux) `node_modules`** in the shared
mount. That is the *intended* design, not a problem to work around: hooks, lint,
types, tests, even `composer stan` all run there via
`./vendor/bin/sail exec -T -u sail vite <cmd>` (the husky templates do this). **Don't
run npm on the host** — there's no host `node_modules` to keep in sync, which is the
whole point (it kills the old host↔container darwin/Linux thrash).

- It's the single canonical `node_modules`; everything goes through the `vite` container.
- The install runs as `sail` (host uid), so it doesn't change host file ownership; and
  `sail exec -T -u sail vite` keeps `prettier --write`/`pint` output host-owned too.
- The git hooks **fail fast if `vite` isn't running** — start the stack first
  (`just start <app>` / `./vendor/bin/sail up -d`).
- Add a package = edit `package.json`, then `just restart <app>` (vite re-installs in
  the container), or `./vendor/bin/sail exec -u sail vite npm install`.
- (A brief experiment ran the toolchain on the host instead; the maintainer reversed
  it in favour of this container model — `node_modules` stays container-owned.)

## Orchestrating with `just` (preferred)

The `justfile` in this repo brings the enabled apps up/down with one command:

```
just start [app...]     # sail up -d (or compose up -d) for each
just stop  [app...]
just restart [app...]   # down → up; this is how .env/port changes take effect
just status [app...]    # docker compose ps per app
```

A running container keeps the ports it was started with — change `.env` then
`just restart <app>` to apply. Registry/enabled list live in the `justfile`.

## Running one app (manual)

```
cd ~/code/<app>
./vendor/bin/sail up -d          # brings up app + vite + queue + scheduler + db/redis
./vendor/bin/sail artisan migrate
```

(Vite/queue/scheduler now run as their own services — no manual `npm run dev`.)

## Running several apps at once

Because the local dev ports scheme gives every host port a unique value,
you can `sail up -d` in several apps concurrently. Watch for:

- **Container names** derive from the compose project (the repo dir) — distinct per
  app, so no clash. Avoid *adding* `COMPOSE_PROJECT_NAME` to a running app — it
  renames the project and orphans the existing DB/redis volumes (data appears to
  vanish until you point back).
- **Vite HMR:** Vite must listen on `VITE_PORT` inside the container and advertise
  the same `clientPort` to the browser — see the `vite.config.ts` snippet in
  local dev ports.
- **Shared Docker network / resources:** all stacks share the Docker daemon; mind
  total memory if running several.

## Quick reference

| Task              | Command                                              |
|-------------------|------------------------------------------------------|
| Up / down         | `sail up -d` / `sail down`                           |
| Shell             | `sail shell`                                         |
| Artisan           | `sail artisan <...>`                                 |
| Composer          | `sail composer <...>`                                |
| Tests             | `sail pest` (see [[pest-testing]])                   |
| Vite              | auto (the `vite` service); logs: `sail logs -f vite` |
| Worker/sched logs | `sail logs -f queue` / `sail logs -f scheduler`      |
