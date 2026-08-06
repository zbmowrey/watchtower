#!/usr/bin/env node
/**
 * Fleet static-asset precompressor. Zero dependencies — node:fs + node:zlib.
 * SOURCE OF TRUTH: copy this file verbatim to <app>/bin/compress-assets.mjs;
 * there is NO per-app divergence.
 *
 * Writes `<asset>.br` and `<asset>.gz` sidecars next to every compressible file
 * under public/build. Caddy's `file_server { precompressed br gzip }` (see
 * docker/Caddyfile) then serves the sidecar directly instead of compressing the
 * asset on the fly on every cache miss.
 *
 * Why this is worth a build step:
 *   - QUALITY. An on-the-fly encoder has to stay cheap — Caddy's brotli runs
 *     around quality 4. Offline we can afford quality 11, which is typically
 *     15-20% smaller on JS/CSS. Every visitor downloads less, forever.
 *   - CPU. The web pod runs on a 500m limit with 2 PHP threads. Compression
 *     cycles spent per-request are cycles not spent on PHP.
 *
 * Sidecars are only kept when they actually win: if the compressed form is not
 * smaller than the original, the sidecar is dropped so Caddy serves the raw
 * bytes rather than a larger payload with a Content-Encoding round trip.
 *
 * Runs from `npm run build`. It is idempotent and safe to re-run.
 */
import { readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const BUILD_DIR = 'public/build';

// Text-ish assets only. Fonts (woff2), images (png/webp/avif) and the sidecars
// themselves are already compressed — re-compressing them burns build time to
// produce a LARGER file, and the "only keep a win" guard would discard it anyway.
const COMPRESSIBLE = /\.(js|mjs|css|html|json|svg|xml|txt|map|ico)$/i;

// Below this, the Content-Encoding round trip costs more than it saves and most
// clients are on a single MTU anyway.
const MIN_BYTES = 1024;

const walk = (dir) => {
    const found = [];

    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);

        if (entry.isDirectory()) {
            found.push(...walk(path));
        } else if (entry.isFile() && COMPRESSIBLE.test(entry.name)) {
            found.push(path);
        }
    }

    return found;
};

let files;

try {
    files = walk(BUILD_DIR);
} catch {
    console.error(`compress — cannot read ${BUILD_DIR}. Run \`npm run build\` first.`);
    process.exit(2);
}

/**
 * Write `<path><ext>` when the compressed form is genuinely smaller; otherwise
 * remove any stale sidecar from an earlier build so Caddy never serves one that
 * no longer matches the asset. Returns the bytes saved.
 */
const emit = (path, ext, compressed, rawBytes) => {
    const sidecar = `${path}${ext}`;

    if (compressed.length >= rawBytes) {
        try {
            unlinkSync(sidecar);
        } catch {
            // No stale sidecar to clear — nothing to do.
        }

        return 0;
    }

    writeFileSync(sidecar, compressed);

    return rawBytes - compressed.length;
};

let rawTotal = 0;
let brTotal = 0;
let gzTotal = 0;
let written = 0;

for (const path of files) {
    const bytes = statSync(path).size;

    if (bytes < MIN_BYTES) {
        continue;
    }

    const raw = readFileSync(path);

    const br = brotliCompressSync(raw, {
        params: {
            [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
            [constants.BROTLI_PARAM_SIZE_HINT]: bytes,
        },
    });
    const gz = gzipSync(raw, { level: 9 });

    const brSaved = emit(path, '.br', br, bytes);
    const gzSaved = emit(path, '.gz', gz, bytes);

    if (brSaved > 0 || gzSaved > 0) {
        written += 1;
        rawTotal += bytes;
        brTotal += bytes - brSaved;
        gzTotal += bytes - gzSaved;
    }
}

const kb = (n) => `${(n / 1024).toFixed(1)} kB`;

if (written === 0) {
    console.log('compress — nothing compressible under public/build.');
    process.exit(0);
}

console.log(
    `compress — ${written} assets precompressed: ` +
        `${kb(rawTotal)} raw → ${kb(brTotal)} br / ${kb(gzTotal)} gzip`,
);
