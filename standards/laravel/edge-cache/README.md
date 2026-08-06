# Edge-cacheable public pages — OPT-IN bundle

Serve an app's public marketing surface from the CDN instead of round-tripping
every visitor to the cluster. **Proven on [[acme]] (app PRs #23/#24)** —
`cf-cache-status: HIT` on the homepage, Inertia XHRs correctly bypassing.

## This is opt-in, and deliberately not a fleet ratchet

Audited against the live fleet on 2026-08-03: every other app's `app.blade.php`
already stamps the nonce (`<script nonce="{{ Vite::cspNonce() }}">`), so there is
no fleet-wide bug here to fix. acme's blade had simply *lost* that
attribute, which is why its theme script was silently CSP-blocked in production
until #23.

So the trade is real and it is per-app:

| | you gain | you give up |
|---|---|---|
| **Adopt** | first paint served from the edge for every anonymous visitor | `Vite::prefetch` — but see below, it is replaceable |
| **Don't** | one less moving part | every visitor pays a full round trip to the cluster |

**Adopt it for apps with a real anonymous marketing surface.** For an app that is
almost entirely behind auth, it is a straight loss — nothing gets cached, and you
still pay the complexity. Don't take it just because it exists.

### `Vite::prefetch` is replaceable, so the cost is smaller than it looks

Inertia (3.6+) ships its own prefetcher: `<Link prefetch>`, hover by default. It
rides the app bundle, so it is an external same-origin script already covered by
`script-src 'self'` and costs the CSP nothing — which is the entire reason
`Vite::prefetch` had to go. It also targets better: `Vite::prefetch` warmed
manifest chunks blindly after load, while `<Link prefetch>` fetches the page the
visitor is about to open, on hover, so nothing is spent until intent is shown.

Put it on the links that carry real navigation and leave it off auth links —
prefetching login for someone reading marketing copy spends their bandwidth on a
page most never open. Note the prefetch XHR carries `X-Inertia`, so the CDN rule
below bypasses it: prefetch warms the CLIENT ahead of a click, while the edge
cache serves full-document loads (first visit, direct navigation, crawlers).

## Why the nonce has to go

`Vite::useCspNonce()` emits a fresh nonce into `script-src` **and** onto every
asset tag. A CDN stores one copy of a response and replays it, so a per-response
nonce is frozen at whatever value it happened to store — wrong for every later
visitor, and a weaker policy than a hash besides. The document has to be
byte-identical too, which is why the theme must be resolved client-side rather
than from a server-rendered class.

## Apply

1. **`ThemeScript.php` → `app/Support/`.** Emit it from `app.blade.php` as
   `<script>{!! \App\Support\ThemeScript::JS !!}</script>` and **delete** the
   `@class(['dark' => …])` off `<html>`. Single-sourcing the bytes and the hash is
   the point: a CSP hash must match the script's text byte for byte, and a drifted
   one fails in production only, silently.

2. **`PubliclyCacheable.php` → `app/Http/Middleware/`.** Set `CACHEABLE_ROUTES`
   for the app. Register it **prepended**, not at route level:

   ```php
   $middleware->prependToGroup('web', PubliclyCacheable::class);
   ```

   Middleware unwinds in reverse, so a prepended entry post-processes *last* —
   after `StartSession` queued the session cookie and `EncryptCookies` sealed it.
   That is the only position from which it can strip `Set-Cookie`. Route-level
   registration runs far too early and strips nothing, while still marking the
   response `public` — which is the dangerous half.

3. **Drop the nonce and prefetch** from `AppServiceProvider` and switch the CSP in
   `SecurityHeaders` to `"script-src 'self' ".ThemeScript::cspHash()`. Both files
   are byte-locked by `bin/arch-drift`, so add an entry to
   `standards/laravel/arch-drift.allow` in the same PR (acme's is the
   worked example).

4. **Give every form on a cached page its own CSRF token.** A cached response
   carries no `Set-Cookie`, so a first-time visitor has no `XSRF-TOKEN` and any
   POST 419s. Sanctum's route already does this — call it before submitting:

   ```ts
   if (!document.cookie.includes('XSRF-TOKEN=')) {
       await fetch('/sanctum/csrf-cookie', { credentials: 'same-origin' });
   }
   ```

   Miss this and you break the app's conversion path for exactly the new visitors
   the caching was meant to serve.

5. **Add the Cloudflare Cache Rule.** Without it nothing changes — Cloudflare does
   not cache HTML on default settings regardless of origin headers.

## The Cloudflare rule

Cache Rule → **"Eligible for cache"**, then **"Use cache TTL from origin"** so
`s-maxage` governs:

```
(http.request.uri.path in {"/" "/our-story" "/mission" "/privacy"}
  or starts_with(http.request.uri.path, "/products"))
and http.request.method eq "GET"
and not any(http.request.headers["x-inertia"][*] != "")
and not http.cookie contains "<app>-session"
```

Both `not` clauses are load-bearing:

- **the session-cookie bypass** is what makes caching an authenticated response
  structurally impossible — such a request always carries the cookie, so it never
  reaches the cache. Without it, `HandleInertiaRequests` puts the full `auth.user`
  model into the page payload embedded in the HTML, and the CDN publishes it.
- **the `x-inertia` bypass** is required because Inertia returns JSON for the same
  URL a browser gets HTML for, and **Cloudflare honours `Vary` only for
  `Accept-Encoding`** — `Vary: X-Inertia` will *not* stop it serving one to a
  client expecting the other.

## Verify, don't assume

```bash
curl -sSI https://<host>/ | grep -iE 'cf-cache-status|cache-control|set-cookie'   # 2nd hit → HIT, no Set-Cookie
curl -sSI -H 'X-Inertia: true' https://<host>/ | grep -i cf-cache-status          # → DYNAMIC
```

Port the three tests with the bundle. The ones that matter are the negatives —
authenticated, `X-Inertia`, flashed state, validation errors, off-allowlist — plus:

- **byte-identical across visitors**, which is the precondition the whole scheme
  rests on and which nothing else catches;
- **every executable inline script is permitted by the CSP.** Count them. Asserting
  only the first one is how #23 shipped a CSP that silently blocked `Vite::prefetch`'s
  script: the document renders two inline scripts only in **build** mode, and a
  local suite renders in Vite dev mode whenever `public/hot` exists.

Never auto-hash the inline scripts found in the response body to "fix" that — it
would hash an injected script just as faithfully and hand XSS a free pass.
