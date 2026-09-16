/**
 * The DECISION half of `npm run build:package` — every structural gate that
 * inspects a value rather than the filesystem.
 *
 * The gates (T-6, T-23) protect facts a consumer pays for: that the ~680 kB of
 * file-import parsers stay behind a dynamic `import()`, that the tarball carries
 * the README and theme a consumer's only install instructions live in, and that
 * the packed manifest keeps both Angular majors installable. Those facts are
 * produced by a multi-minute ng-packagr build, but they are DECIDED from a
 * bundle listing, a `npm pack --json` object and a parsed `package.json` — so
 * they are pinned here where a wrong branch fails in milliseconds, and
 * `package-build.ts` is left with only the reads and the spawns.
 */
import path from 'node:path';

import { PACKAGE_IDS, PACKAGE_NAMES, isPackageId, type PackageId } from './stage-package-lib.js';

// ── T-6: the parsers must stay lazy ────────────────────────────────────────

/** A body that only a lazily-loaded chunk may contain. */
export const LAZY_ONLY_MARKER = 'function parsePdfReadable';

/** The FESM bundles of one build: file name → source text. */
export type BundleSources = ReadonlyMap<string, string>;

/**
 * The entry bundle's file name, derived from the package name exactly as
 * ng-packagr derives it (`@scope/name` → `scope-name.mjs`).
 */
export function entryBundleName(id: PackageId): string {
    return `${PACKAGE_NAMES[id].replace('@', '').replaceAll('/', '-')}.mjs`;
}

/**
 * Every bundle reachable from the entry through STATIC imports — i.e. what a
 * consumer downloads before rendering anything.
 */
export function eagerGraph(entry: string, sources: BundleSources): ReadonlySet<string> {
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

export function countDynamicImports(files: Iterable<string>, sources: BundleSources): number {
    let total = 0;
    for (const file of files) {
        for (const _ of (sources.get(file) ?? '').matchAll(/import\(\s*'\.\/([^']+)'/g)) total++;
    }
    return total;
}

/**
 * Throws unless the file-import parsers are still lazily loaded.
 *
 * What matters is not WHICH file holds the parser but whether a consumer
 * downloads it to render a toolbar — so every assertion is about the EAGER
 * graph, not about the entry file. Checking the entry alone would be vacuous:
 * ng-packagr emits it as a thin re-export barrel (~3.5 kB) that declares nothing
 * and contains no dynamic import, so a parser inlined into the big main chunk it
 * statically imports — the real regression this exists to prevent — would never
 * touch it. See spec correction C-16.
 *
 * A failure here is a size regression for the maintainer to decide on, not
 * something to silently accept, so it fails the build loudly.
 *
 * Only `rte` carries the file-import parsers, so every other package is a
 * no-op: asserting a lazy chunk exists in a package that has none would fail
 * every data-table build for a property it was never supposed to have.
 */
export function checkLazyChunks(id: PackageId, sources: BundleSources, fesmLabel: string): void {
    if (id !== 'rte') return;

    const bundles = [...sources.keys()];
    if (bundles.length < 2) {
        throw new Error(
            `[package-build] ${id}: expected the entry FESM plus at least one lazy chunk in ${fesmLabel}, found ${bundles.length} bundle(s). ` +
            'The file-import parsers have been inlined into the entry point.',
        );
    }

    const entry = entryBundleName(id);
    if (!sources.has(entry)) {
        throw new Error(`[package-build] ${id}: expected an entry bundle named ${entry} in ${fesmLabel}.`);
    }

    const eager = eagerGraph(entry, sources);
    if (bundles.every((f) => eager.has(f))) {
        throw new Error(
            `[package-build] ${id}: every bundle is reachable by static import from the entry — ` +
            'the file-import parsers are no longer lazy.',
        );
    }
    if (countDynamicImports(eager, sources) === 0) {
        throw new Error(`[package-build] ${id}: no dynamic import() survived the FESM flattening.`);
    }

    const carriers = bundles.filter((f) => (sources.get(f) ?? '').includes(LAZY_ONLY_MARKER));
    if (carriers.length === 0) {
        throw new Error(
            `[package-build] ${id}: no bundle contains "${LAZY_ONLY_MARKER}" — the parser was dropped entirely.`,
        );
    }
    const eagerCarriers = carriers.filter((f) => eager.has(f));
    if (eagerCarriers.length > 0) {
        throw new Error(
            `[package-build] ${id}: "${LAZY_ONLY_MARKER}" is in the eagerly-loaded graph (${eagerCarriers.join(', ')}) — ` +
            'the lazy parsers were inlined, so every consumer downloads them up front.',
        );
    }
}

// ── T-23: what the tarball may and may not contain ─────────────────────────

/** The `npm pack --json` fields the tarball gate inspects. */
export interface PackJson {
    readonly filename: string;
    readonly files: readonly { readonly path: string }[];
}

/**
 * UC-5 / UC-7: the tarball must carry the consumer contract with it. The README
 * is not decoration — it is the only place the "selectors are fixed / config is
 * inputs-only" rules reach someone who installs from npm and never sees this
 * repo. The compiled stylesheet and the `ng add` schematic are the whole setup:
 * without either, a consumer is back to wiring Tailwind by hand.
 */
const REQUIRED_ENTRIES = [
    'package.json',
    'README.md',
    'styles.css',
    'schematics/collection.json',
    'schematics/ng-add/index.cjs',
    'schematics/ng-add/schema.json',
];

/** The packed manifest's `schematics` field, which `ng add` resolves. */
const SCHEMATICS_ENTRY = './schematics/collection.json';
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
    const offenders = paths.filter((p) => FORBIDDEN.test(p) && !p.endsWith('.d.ts'));
    if (offenders.length > 0) {
        throw new Error(`[package-build] ${id}: tarball ships files it must not: ${offenders.join(', ')}`);
    }
}

const EXPECTED_DEPENDENCIES = ['class-variance-authority', 'clsx', 'tailwind-merge', 'tslib'];

/** Angular majors a consumer may install these packages into (spec C-17). */
export const ANGULAR_PEER_RANGE = '>=20.0.0 <22.0.0';

/** The fields of a packed `package.json` the structural gate inspects. */
export interface PackedManifest {
    readonly name?: string;
    readonly sideEffects?: unknown;
    readonly exports?: Record<string, unknown>;
    readonly schematics?: unknown;
    readonly peerDependencies?: Record<string, string>;
    readonly dependencies?: Record<string, string>;
}

/**
 * The decision half of the packed-manifest gate, split from the file read so it
 * can be driven by a literal manifest instead of a real build.
 *
 * The `@angular/core` peer is checked against a RANGE, not a caret: the packages
 * are consumable by Angular 20 AND 21. Partial-Ivy output is forward-compatible
 * (an app on the same or a newer major can link it), and the compiled
 * declarations carry a `minVersion` of at most 17.2.0 — so the floor is a
 * packaging decision, not a technical one. Pinning `^21` would lock out every
 * Angular 20 consumer the README promises to support.
 */
export function checkPackedManifest(id: PackageId, manifest: PackedManifest): void {
    if (manifest.name !== PACKAGE_NAMES[id]) {
        throw new Error(`[package-build] ${id}: packed name is "${manifest.name}".`);
    }
    if (manifest.sideEffects !== false) {
        throw new Error(`[package-build] ${id}: sideEffects must be false for tree-shaking.`);
    }
    if (!manifest.exports?.['./styles.css']) {
        throw new Error(`[package-build] ${id}: the styles.css export is missing — consumers could not import it.`);
    }
    if (manifest.schematics !== SCHEMATICS_ENTRY) {
        throw new Error(`[package-build] ${id}: "schematics" must be "${SCHEMATICS_ENTRY}", or ng add cannot configure the app.`);
    }
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

// ── Entry contract ─────────────────────────────────────────────────────────

/**
 * The `npm pack --json` argv. Extracted because the `--pack-destination` value
 * is JSON-quoted to survive `shell: true` on a Windows path with spaces —
 * a detail worth pinning rather than re-deriving at a call site.
 */
export function packArgv(packsDir: string): readonly string[] {
    return ['pack', '--json', '--pack-destination', JSON.stringify(packsDir)];
}

/**
 * The first entry of an `npm pack --json` payload.
 *
 * npm reports an ARRAY even for a single package, so indexing it is the
 * contract; a shape that is not an array of objects with a `filename` means npm
 * changed its output and the build must stop rather than pack an unknown file.
 */
export function parsePackOutput(raw: string): PackJson {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error(`[package-build] npm pack --json returned no package: ${raw.slice(0, 200)}`);
    }
    const first = parsed[0] as PackJson;
    if (typeof first?.filename !== 'string' || !Array.isArray(first?.files)) {
        throw new TypeError(`[package-build] npm pack --json returned an unexpected shape: ${raw.slice(0, 200)}`);
    }
    return first;
}

/**
 * Validates the argv package id for the build entry, returning the narrowed id
 * or `null` when the caller must print usage and exit 1.
 */
export function resolveBuildId(raw: string | undefined): PackageId | null {
    return raw && isPackageId(raw) ? raw : null;
}

/** The usage line the build entry prints when {@link resolveBuildId} rejects. */
export function buildUsage(): string {
    return `Usage: npm run build:package -- <${PACKAGE_IDS.join('|')}>`;
}

// ── Layout ─────────────────────────────────────────────────────────────────

/**
 * Where the build's inputs and outputs live, all derived from the repo root.
 *
 * Composed here rather than at the entry so the layout is a tested fact: an
 * `ng build <id>-package` writes to `dist/<id>-package`, and a wrong guess at
 * that path would surface as an opaque "no such file" minutes into a build.
 */
export function distDir(repoRoot: string, id: PackageId): string {
    return path.join(repoRoot, 'dist', `${id}-package`);
}

export function fesmDir(repoRoot: string, id: PackageId): string {
    return path.join(distDir(repoRoot, id), 'fesm2022');
}

/** Where `npm pack` drops tarballs — under the already-gitignored e2e workers root. */
export function packsDir(repoRoot: string): string {
    return path.join(repoRoot, 'e2e/.workers/_packs');
}

// ── Orchestration ──────────────────────────────────────────────────────────

/**
 * Everything the package build does to the world, as one injected port.
 *
 * The ORDER matters and is the contract: stage before build (ng-packagr
 * compiles what staging wrote), both structural gates before pack (a tarball
 * that fails a gate must never reach disk), and the on-disk check after pack.
 * Naming the effects lets that order be pinned by a fake port instead of a
 * multi-minute real build.
 */
export interface BuildEffects {
    readonly stage: (id: PackageId) => void;
    /** Compiles `styles.css` from the staged sources; ng-packagr copies it as an asset. */
    readonly compileStyles: (id: PackageId) => void;
    readonly ngBuild: (id: PackageId) => void;
    /** The built FESM bundles, for the T-6 lazy-chunk gate. */
    readonly readBundles: (id: PackageId) => BundleSources;
    /** A label for the FESM directory, used only in error messages. */
    readonly fesmLabel: (id: PackageId) => string;
    readonly readPackedManifest: (id: PackageId) => PackedManifest;
    readonly ensurePacksDir: () => void;
    /** Runs `npm pack --json` and returns its raw stdout. */
    readonly pack: (id: PackageId) => string;
    /** The absolute tarball path, and whether npm actually wrote it. */
    readonly tarballPath: (filename: string) => string;
    readonly exists: (absPath: string) => boolean;
}

/**
 * Stage, compile, gate and pack one package. Returns the absolute tarball path.
 *
 * The final existence check is not paranoia: `npm pack --json` reports the name
 * it INTENDED to write, so a pack that failed after printing its plan would
 * otherwise hand the e2e run a path to nothing.
 */
export function buildPackage(id: PackageId, fx: BuildEffects): string {
    fx.stage(id);
    fx.compileStyles(id);
    fx.ngBuild(id);

    checkLazyChunks(id, id === 'rte' ? fx.readBundles(id) : new Map(), fx.fesmLabel(id));
    checkPackedManifest(id, fx.readPackedManifest(id));

    fx.ensurePacksDir();
    const packed = parsePackOutput(fx.pack(id));
    assertTarballContents(id, packed);

    const tarball = fx.tarballPath(packed.filename);
    if (!fx.exists(tarball)) {
        throw new Error(`[package-build] ${id}: npm pack reported "${packed.filename}" but it is not on disk.`);
    }
    return tarball;
}

/** The raw node primitives the build effects are composed from. */
export interface NodePrimitives {
    readonly stage: (id: PackageId) => void;
    /** Runs a command and returns its stdout; throws on a non-zero exit. */
    readonly exec: (command: string, args: readonly string[], cwd: string) => string;
    readonly readDir: (dir: string) => readonly string[];
    readonly readFile: (absPath: string) => string;
    readonly mkdirp: (dir: string) => void;
    readonly exists: (absPath: string) => boolean;
}

/**
 * Composes the real {@link BuildEffects} from node primitives and a repo root.
 *
 * This is where the two spawns get their argv and the three reads get their
 * paths — the last decisions in the build, which is why they are here rather
 * than inlined at the entry: `ng build <id>-package` and `npm pack --json` into
 * the packs directory are contracts, not incidental strings.
 */
export function nodeBuildEffects(repoRoot: string, io: NodePrimitives): BuildEffects {
    const packs = packsDir(repoRoot);
    return {
        stage: io.stage,
        compileStyles: (id) => { io.exec('npx', ['tsx', 'packages/cli/scripts/package-styles.ts', id], repoRoot); },
        ngBuild: (id) => { io.exec('npx', ['ng', 'build', `${id}-package`], repoRoot); },
        readBundles: (id) => new Map(
            io.readDir(fesmDir(repoRoot, id))
                .filter((f) => f.endsWith('.mjs'))
                .map((f) => [f, io.readFile(path.join(fesmDir(repoRoot, id), f))]),
        ),
        fesmLabel: (id) => fesmDir(repoRoot, id),
        readPackedManifest: (id) => JSON.parse(io.readFile(path.join(distDir(repoRoot, id), 'package.json'))),
        ensurePacksDir: () => { io.mkdirp(packs); },
        pack: (id) => io.exec('npm', packArgv(packs), distDir(repoRoot, id)),
        tarballPath: (filename) => path.join(packs, filename),
        exists: io.exists,
    };
}

/**
 * Wraps {@link buildPackage} in a per-process memo.
 *
 * The e2e run needs the same tarball for up to three labels (`pkg-rte`,
 * `pkg-mixed`, …) and an ng-packagr build is minutes, so the SECOND caller must
 * join the first build rather than start another. The in-flight promise is
 * cached, not its result, so concurrent callers share one build.
 */
export function memoisedBuilder(fx: BuildEffects): (id: PackageId) => Promise<string> {
    const inFlight = new Map<PackageId, Promise<string>>();
    return (id) => {
        const existing = inFlight.get(id);
        if (existing !== undefined) return existing;

        const started = (async () => buildPackage(id, fx))();
        inFlight.set(id, started);
        return started;
    };
}

/** What the build entry prints and exits with. */
export interface BuildOutcome {
    readonly status: number;
    readonly stdout: readonly string[];
    readonly stderr: readonly string[];
}

/**
 * The `build:package` entry flow: validate argv, build, report the tarball
 * relative to the repo root.
 */
export async function runBuild(
    argv: readonly string[],
    build: (id: PackageId) => Promise<string>,
    relative: (absPath: string) => string,
): Promise<BuildOutcome> {
    const id = resolveBuildId(argv[0]);
    if (!id) return { status: 1, stdout: [], stderr: [buildUsage()] };

    const tarball = await build(id);
    return { status: 0, stdout: [`[package-build] ${id}: ${relative(tarball)}`], stderr: [] };
}
