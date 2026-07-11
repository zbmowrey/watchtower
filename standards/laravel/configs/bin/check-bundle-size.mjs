#!/usr/bin/env node
/**
 * Fleet bundle-size budget gate. Zero dependencies — node:fs + node:zlib.
 * SOURCE OF TRUTH: copy this file verbatim to <app>/bin/check-bundle-size.mjs;
 * the ONLY per-app divergence is the BUDGETS_KB block below.
 *
 * Reads the Vite client manifest (public/build/manifest.json) and measures
 * three AGGREGATE gzip metrics over the built JS:
 *
 *   1. first-load — the entry chunk plus its transitive *static* `imports`
 *      (what every visitor downloads before any page renders). Inertia pages
 *      are dynamic imports and intentionally excluded.
 *   2. largest single chunk — worst-case lazy-route download.
 *   3. total JS — the whole built surface.
 *
 * Aggregates only, never chunk file names: rolldown is free to regroup or
 * rename chunks between vite versions, and a budget keyed to a name would rot
 * silently. Gzip level is pinned to 9 so local and CI runs agree byte-for-byte.
 *
 * CALIBRATE PER APP: set the three BUDGETS_KB constants to a clean
 * `npm run build` measurement + ~10% headroom. Raising a budget is allowed but
 * must be CONSCIOUS — bump the constant in the same PR that adds the heavy
 * feature, state the new measurement in the PR description, never inflate to
 * silence the gate.
 */
import {readFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';

// ─── CALIBRATE PER APP (clean `npm run build` measurement + ~10% headroom) ───
const BUDGETS_KB = {
    firstLoad: 0,
    largestChunk: 0,
    totalJs: 0,
};

const MANIFEST_PATH = 'public/build/manifest.json';

let manifest;

try {
    manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
} catch {
    console.error(
        `bundle:check — cannot read ${MANIFEST_PATH}. Run \`npm run build\` first.`,
    );
    process.exit(2);
}

const gzipKb = (file) => {
    const bytes = readFileSync(`public/build/${file}`);

    return gzipSync(bytes, {level: 9}).length / 1024;
};

const isJs = (record) => record.file.endsWith('.js');

// First-load set: every JS entry plus its transitive static imports.
const firstLoadKeys = new Set();
const walk = (key) => {
    if (firstLoadKeys.has(key) || manifest[key] === undefined) {
        return;
    }

    firstLoadKeys.add(key);

    for (const imported of manifest[key].imports ?? []) {
        walk(imported);
    }
};

for (const [key, record] of Object.entries(manifest)) {
    if (record.isEntry && isJs(record)) {
        walk(key);
    }
}

let firstLoad = 0;
let firstLoadCount = 0;

for (const key of firstLoadKeys) {
    if (!isJs(manifest[key])) {
        continue;
    }

    firstLoad += gzipKb(manifest[key].file);
    firstLoadCount += 1;
}

let totalJs = 0;
let chunkCount = 0;
let largestChunk = 0;
let largestName = '';

for (const record of Object.values(manifest)) {
    if (!isJs(record)) {
        continue;
    }

    const kb = gzipKb(record.file);
    totalJs += kb;
    chunkCount += 1;

    if (kb > largestChunk) {
        largestChunk = kb;
        largestName = record.file;
    }
}

const rows = [
    ['first-load JS', firstLoad, BUDGETS_KB.firstLoad, `${firstLoadCount} files`],
    ['largest chunk', largestChunk, BUDGETS_KB.largestChunk, largestName],
    ['total JS', totalJs, BUDGETS_KB.totalJs, `${chunkCount} chunks`],
];

let failed = false;

console.log('Bundle size budget (gzip -9, from public/build/manifest.json):');

for (const [label, measured, budget, detail] of rows) {
    const status = measured <= budget ? 'OK  ' : 'OVER';

    if (measured > budget) {
        failed = true;
    }

    console.log(
        `  ${status} ${label.padEnd(14)} ${measured.toFixed(1).padStart(7)} kB / budget ${budget} kB  (${detail})`,
    );
}

if (failed) {
    console.error(
        '\nbundle:check FAILED — a metric exceeds its budget. If this growth is intentional,',
    );
    console.error(
        'raise the budget constant in bin/check-bundle-size.mjs in this same PR (see header).',
    );
    process.exit(1);
}
