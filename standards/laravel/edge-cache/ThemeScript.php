<?php

declare(strict_types=1);

namespace App\Support;

/**
 * The pre-paint theme bootstrap — the ONE inline script in the document, and
 * the single source of both its bytes and its CSP hash.
 *
 * WHY IT IS INLINE. It has to run before first paint or the page flashes light
 * before React's initializeTheme() lands. An external <script src> in <head>
 * would cost a blocking round trip to do the same job.
 *
 * WHY IT IS HASHED, NOT NONCED. A nonce has to change per response, which makes
 * the Content-Security-Policy header per-response, which makes the whole
 * document uncacheable at the edge. A hash is a constant, so the CSP header is a
 * constant, so the public marketing pages can be served from a CDN
 * (see PubliclyCacheable). Security is equivalent — arguably better, since a
 * static hash cannot be replayed the way a leaked nonce can.
 *
 * WHY THE SCRIPT IS A CONSTANT, NOT A BLADE TEMPLATE. A CSP hash must match the
 * script element's text content BYTE FOR BYTE, including whitespace. Rendering
 * it through Blade would let indentation or an interpolated value drift from
 * whatever we hashed and silently break the script in production only. Here the
 * blade emits `{!! ThemeScript::JS !!}` and the header hashes that same
 * constant, so the two cannot disagree.
 *
 * WHY IT READS THE COOKIE ITSELF. It used to interpolate a server-side
 * `$appearance`, which both varied the bytes per visitor AND baked one
 * visitor's theme into a cacheable document. Reading document.cookie keeps the
 * script constant and makes the theme a purely client-side concern.
 */
final class ThemeScript
{
    /**
     * Mirrors the resolution order in resources/js/hooks/use-appearance: an
     * explicit 'dark'/'light' cookie wins, otherwise follow the OS preference.
     * Kept terse deliberately — every byte here is inside the hash.
     */
    public const JS = <<<'JS'
(function(){try{var m=document.cookie.match(/(?:^|;\s*)appearance=([^;]*)/);var a=m?decodeURIComponent(m[1]):'system';var d=a==='dark'||(a!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();
JS;

    /**
     * The `'sha256-…'` source expression for script-src. Computed from the same
     * constant the document emits, so it is correct by construction.
     */
    public static function cspHash(): string
    {
        return "'sha256-".base64_encode(hash('sha256', self::JS, true))."'";
    }
}
