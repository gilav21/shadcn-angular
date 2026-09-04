/**
 * `npm run build:package -- <rte|data-table>` — stage → ng build → npm pack.
 *
 * Also the module the e2e orchestrator and the release preflight import for
 * `buildPackageTarball`, which is why the structural gates (T-6, T-23) live
 * HERE as thrown errors rather than as vitest tests: they need a real
 * ng-packagr build (minutes), so they run wherever a package is actually built
 * and fail that run loudly.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    PACKAGE_IDS,
    PACKAGE_NAMES,
    type PackageId,
    isPackageId,
    stagePackage,
} from './stage-package-lib.js';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../../..');

/** Where `npm pack` drops tarballs — under the already-gitignored e2e workers root. */
export const PACKS_DIR = path.join(REPO_ROOT, 'e2e/.workers/_packs');

function distDir(id: PackageId): string {
    return path.join(REPO_ROOT, 'dist', `${id}-package`);
}

function run(command: string, args: readonly string[], cwd: string): string {
    return execFileSync(command, [...args], {
        cwd,
        encoding: 'utf-8',
        shell: true,
        stdio: ['ignore', 'pipe', 'inherit'],
    });
}

// ── T-6: the parsers must stay lazy ────────────────────────────────────────

/**
 * The file-import addon reaches ~20 parser files (pdf, docx, ttf, zip) through
 * three dynamic `import()`s. ng-packagr flattens each entry point with a rollup
 * `dir` build, which SHOULD emit those targets as sibling chunks — but nothing
 * in this repo exercised that before, so it is asserted rather than assumed.
 *
 * If this ever fails, the parsers have been inlined into the entry FESM and
 * every consumer downloads ~680 kB of parser code to render a toolbar. That is
 * a size regression for the user to decide on, not something to silently accept.
 */
/** A body that only a lazily-loaded chunk may contain. */
const LAZY_ONLY_MARKER = 'function parsePdfReadable';

/**
 * Every bundle reachable from the entry through STATIC imports — i.e. what a
 * consumer downloads before rendering anything.
 */
function eagerGraph(entry: string, sources: ReadonlyMap<string, string>): ReadonlySet<string> {
    const eager = new Set<string>();
    const queue = [entry];
    while (queue.length > 0) {
        const current = queue.pop() ?? '';
        if (eager.has(current)) continue;
        eager.add(current);
        for (const match of (sources.get(current) ?? '').matchAll(/from\s*'\.\/([^']+)'/g)) {
            if (sources.has(match[1])) queue.push(match[1]);
        }
    }
    return eager;
}

function countDynamicImports(files: Iterable<string>, sources: ReadonlyMap<string, string>): number {
    let total = 0;
    for (const file of files) {
        for (const _ of (sources.get(file) ?? '').matchAll(/import\(\s*'\.\/([^']+)'/g)) total++;
    }
    return total;
}

export function assertLazyChunks(id: PackageId): void {
    if (id !== 'rte') return;

    const fesm = path.join(distDir(id), 'fesm2022');
    const bundles = readdirSync(fesm).filter((f) => f.endsWith('.mjs'));
    if (bundles.length < 2) {
        throw new Error(
            `[package-build] rte: expected the entry FESM plus at least one lazy chunk in ${fesm}, found ${bundles.length} bundle(s). ` +
            'The file-import parsers have been inlined into the entry point.',
        );
    }

    const sources = new Map(bundles.map((f) => [f, readFileSync(path.join(fesm, f), 'utf-8')]));
    const entry = `${PACKAGE_NAMES[id].replace('@', '').replaceAll('/', '-')}.mjs`;
    if (!sources.has(entry)) {
        throw new Error(`[package-build] rte: expected an entry bundle named ${entry} in ${fesm}.`);
    }

    // What matters is not WHICH file holds the parser but whether a consumer
    // downloads it to render a toolbar — so the assertion is about the eager
    // graph, not about the entry file.
    //
    // Checking the entry alone would be vacuous: ng-packagr emits it as a thin
    // re-export barrel (~3.5 kB) that declares nothing and contains no dynamic
    // import, so a parser inlined into the big main chunk it statically imports
    // — the real regression C-14 exists to prevent — would never touch it. See
    // spec correction C-16.
    const eager = eagerGraph(entry, sources);

    if (bundles.every((f) => eager.has(f))) {
        throw new Error(
            '[package-build] rte: every bundle is reachable by static import from the entry — ' +
            'the file-import parsers are no longer lazy.',
        );
    }
    if (countDynamicImports(eager, sources) === 0) {
        throw new Error('[package-build] rte: no dynamic import() survived the FESM flattening.');
    }

    const carriers = bundles.filter((f) => (sources.get(f) ?? '').includes(LAZY_ONLY_MARKER));
    if (carriers.length === 0) {
        throw new Error(
            `[package-build] rte: no bundle contains "${LAZY_ONLY_MARKER}" — the parser was dropped entirely.`,
        );
    }
    const eagerCarriers = carriers.filter((f) => eager.has(f));
    if (eagerCarriers.length > 0) {
        throw new Error(
            `[package-build] rte: "${LAZY_ONLY_MARKER}" is in the eagerly-loaded graph (${eagerCarriers.join(', ')}) — ` +
            'the lazy parsers were inlined, so every consumer downloads them up front.',
        );
    }
}

// ── T-23: what the tarball may and may not contain ─────────────────────────

interface PackJson {
    readonly filename: string;
    readonly files: readonly { readonly path: string }[];
}

/**
 * UC-5 / UC-7: the tarball must carry the consumer contract with it. The README
 * is not decoration — it is the only place the three required CSS lines and the
 * "selectors are fixed / config is inputs-only" rules reach someone who installs
 * from npm and never sees this repo. ng-packagr copies it from the package root.
 */
const REQUIRED_ENTRIES = ['package.json', 'README.md', 'theme.css'];
const FORBIDDEN = /(\.spec\.|\.stories\.|__screenshots__|\.ts$)/;

export function assertTarballContents(id: PackageId, packed: PackJson): void {
    const paths = packed.files.map((f) => f.path.replaceAll('\\', '/'));

    for (const required of REQUIRED_ENTRIES) {
        if (!paths.includes(required)) {
            throw new Error(`[package-build] ${id}: tarball is missing "${required}".`);
        }
    }
    if (!paths.some((p) => p.startsWith('fesm2022/'))) {
        throw new Error(`[package-build] ${id}: tarball has no fesm2022/ bundle.`);
    }
    if (!paths.some((p) => p.endsWith('.d.ts'))) {
        throw new Error(`[package-build] ${id}: tarball ships no type declarations.`);
    }
    // `.d.ts` files legitimately end in `.ts`, so exempt them from the source check.
    const offenders = paths.filter((p) => FORBIDDEN.test(p) && !p.endsWith('.d.ts'));
    if (offenders.length > 0) {
        throw new Error(`[package-build] ${id}: tarball ships files it must not: ${offenders.join(', ')}`);
    }
}

const EXPECTED_DEPENDENCIES = ['class-variance-authority', 'clsx', 'tailwind-merge', 'tslib'];

/** Angular majors a consumer may install these packages into (spec C-17). */
export const ANGULAR_PEER_RANGE = '>=20.0.0 <22.0.0';

export function assertPackedManifest(id: PackageId): void {
    const manifest = JSON.parse(readFileSync(path.join(distDir(id), 'package.json'), 'utf-8'));

    if (manifest.name !== PACKAGE_NAMES[id]) {
        throw new Error(`[package-build] ${id}: packed name is "${manifest.name}".`);
    }
    if (manifest.sideEffects !== false) {
        throw new Error(`[package-build] ${id}: sideEffects must be false for tree-shaking.`);
    }
    if (!manifest.exports?.['./theme.css']) {
        throw new Error(`[package-build] ${id}: the theme.css export is missing — consumers could not import it.`);
    }
    // The packages are consumable by Angular 20 AND 21. Partial-Ivy output is
    // forward-compatible (an app on the same or a newer major can link it), and
    // the compiled declarations here carry a `minVersion` of at most 17.2.0 —
    // so the floor is a packaging decision, not a technical one. Pinning ^21
    // would lock out every Angular 20 consumer the README promises to support.
    if (manifest.peerDependencies?.['@angular/core'] !== ANGULAR_PEER_RANGE) {
        throw new Error(
            `[package-build] ${id}: @angular/core peer must be "${ANGULAR_PEER_RANGE}", ` +
            `found "${manifest.peerDependencies?.['@angular/core']}".`,
        );
    }
    const deps = Object.keys(manifest.dependencies ?? {}).sort((a, b) => a.localeCompare(b));
    if (deps.join(',') !== EXPECTED_DEPENDENCIES.join(',')) {
        throw new Error(`[package-build] ${id}: runtime dependencies drifted: ${deps.join(', ')}`);
    }
}

// ── Build ──────────────────────────────────────────────────────────────────

/**
 * Stage, compile and pack one package. Returns the absolute tarball path.
 *
 * Memoised per process: the e2e run needs the same tarball for up to three
 * labels (`pkg-rte`, `pkg-mixed`, …) and an ng-packagr build is minutes.
 */
const inFlight = new Map<PackageId, Promise<string>>();

export function buildPackageTarball(id: PackageId): Promise<string> {
    const existing = inFlight.get(id);
    if (existing !== undefined) return existing;

    const started = (async (): Promise<string> => {
        stagePackage(id, REPO_ROOT);
        run('npx', ['ng', 'build', `${id}-package`], REPO_ROOT);

        assertLazyChunks(id);
        assertPackedManifest(id);

        mkdirSync(PACKS_DIR, { recursive: true });
        const raw = run('npm', ['pack', '--json', '--pack-destination', JSON.stringify(PACKS_DIR)], distDir(id));
        const packed = JSON.parse(raw)[0] as PackJson;
        assertTarballContents(id, packed);

        const tarball = path.join(PACKS_DIR, packed.filename);
        if (!existsSync(tarball)) {
            throw new Error(`[package-build] ${id}: npm pack reported "${packed.filename}" but it is not on disk.`);
        }
        return tarball;
    })();

    inFlight.set(id, started);
    return started;
}

async function main(): Promise<number> {
    const id = process.argv[2];
    if (!id || !isPackageId(id)) {
        console.error(`Usage: npm run build:package -- <${PACKAGE_IDS.join('|')}>`);
        return 1;
    }

    const tarball = await buildPackageTarball(id);
    console.log(`[package-build] ${id}: ${path.relative(REPO_ROOT, tarball)}`);
    return 0;
}

// Only run as a CLI when invoked directly, so the orchestrator can import
// `buildPackageTarball` without the module exiting the process.
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
    process.exit(await main());
}
