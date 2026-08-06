<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Marks anonymous renders of the public marketing pages as CDN-cacheable, so a
 * visitor in Frankfurt is served from a Cloudflare edge instead of round-tripping
 * to the cluster.
 *
 * THIS MIDDLEWARE IS SECURITY-CRITICAL. Everything it does is in service of one
 * invariant: a response that leaves here marked `public` must be identical for
 * every visitor on earth and must carry NOTHING about the person who happened to
 * trigger it. The checks below are the enforcement of that invariant, and the
 * failure mode of getting one wrong is publishing one visitor's session — or
 * their serialized user record — to everyone else. Do not relax them casually.
 *
 * Why an allowlist rather than an opt-out. A new route is uncached until someone
 * deliberately adds it here, so the accident is a slow page, never a leak. It is
 * also one place to audit, which is what you want for a control like this.
 *
 * WHY IT MUST BE PREPENDED TO THE `web` GROUP. Middleware unwinds in reverse on
 * the response path, so a prepended entry post-processes LAST — after
 * StartSession has queued the session cookie and AddQueuedCookies has attached
 * the rest. A route-level middleware would run too early and would strip
 * nothing, silently shipping `Set-Cookie` on a document the CDN then replays to
 * every subsequent visitor.
 *
 * THE CDN SIDE IS HALF THE CONTRACT. Cloudflare must be configured to bypass the
 * cache when the session cookie is present and when `X-Inertia` is present.
 * Cloudflare honours `Vary` only for `Accept-Encoding`, so `Vary: X-Inertia`
 * alone would NOT stop it serving cached HTML in response to an Inertia XHR for
 * the same URL. The rule is documented in the PR that introduced this class.
 */
final class PubliclyCacheable
{
    /**
     * ─── SET PER APP ────────────────────────────────────────────────────────
     * Routes whose anonymous render is identical for everyone. Route NAMES, not
     * paths, so a URL change cannot silently widen the surface.
     *
     * Add a route here only after checking three things:
     *   1. it renders no per-visitor data when logged out;
     *   2. any form on it can obtain a CSRF token WITHOUT relying on a
     *      Set-Cookie this response would have sent (see the bundle README);
     *   3. its content is stale-tolerant for the chosen TTL.
     *
     * The values below are acme's, left in as a worked example — replace
     * them wholesale. An empty list makes this middleware a no-op, which is the
     * correct state for an app that has not opted in.
     */
    private const CACHEABLE_ROUTES = [
        'home',
        'products.index',
        'products.show',
        'our-story',
        'mission',
        'privacy',
    ];

    /**
     * Session keys that mean "this render is about one specific visitor".
     * Presence of any of them disqualifies the response.
     */
    private const PERSONAL_SESSION_KEYS = ['errors', 'status', 'token', 'success', 'impersonator_id'];

    public function handle(Request $request, Closure $next, int $seconds = 300): Response
    {
        $response = $next($request);

        if (! $this->isShareable($request, $response)) {
            return $response;
        }

        // MANDATORY, not tidiness. A cached response replays its headers
        // verbatim to every later visitor, so a surviving Set-Cookie would hand
        // one person's session and CSRF token to strangers.
        $response->headers->remove('Set-Cookie');

        // s-maxage governs the CDN; max-age=0 keeps browsers revalidating so a
        // deploy is visible immediately to someone already holding the page.
        $response->headers->set('Cache-Control', "public, s-maxage={$seconds}, max-age=0, must-revalidate");

        return $response;
    }

    /**
     * Every condition under which this response may be shared between visitors.
     * Read as: cacheable ONLY if a plain anonymous full-page GET rendered fine
     * and nothing visitor-specific reached the session.
     */
    private function isShareable(Request $request, Response $response): bool
    {
        if (! $request->isMethodCacheable() || $response->getStatusCode() !== 200) {
            return false;
        }

        if (! in_array($request->route()?->getName(), self::CACHEABLE_ROUTES, true)) {
            return false;
        }

        // Authenticated renders differ per person — HandleInertiaRequests puts
        // the whole user model into the page payload embedded in the HTML.
        if ($request->user() !== null) {
            return false;
        }

        // Inertia XHR returns JSON for the same URL a browser gets HTML for.
        // Only full-document loads are cached; the CDN rule bypasses the rest.
        if ($request->header('X-Inertia') !== null) {
            return false;
        }

        return ! $this->sessionCarriesPersonalState($request);
    }

    /**
     * A flashed validation error or success message makes the render specific to
     * whoever just posted — e.g. the lead form's confirmation, which must never
     * be shown to the next visitor.
     */
    private function sessionCarriesPersonalState(Request $request): bool
    {
        if (! $request->hasSession()) {
            return false;
        }

        $session = $request->session();

        foreach (self::PERSONAL_SESSION_KEYS as $key) {
            if ($session->has($key)) {
                return true;
            }
        }

        return false;
    }
}
