/**
 * Unit tests for the pure structural gates in `package-build-lib.ts` (T-23).
 *
 * The spec exempts T-6/T-23 from vitest because "they need a real ng-packagr
 * build (minutes)". That rationale holds only for the FILE READS: the decisions
 * themselves take an injected `npm pack --json` object and a parsed
 * `package.json`. Leaving them driven solely by a multi-minute build is how the
 * missing-README defect survived two review rounds, so every gate now lives in
 * the lib and is pinned here, where a wrong branch fails in milliseconds.
 */
import { describe, expect, it } from 'vitest';

import {
    ANGULAR_PEER_RANGE,
    assertTarballContents,
    buildPackage,
    buildUsage,
    checkLazyChunks,
    checkPackedManifest,
    countDynamicImports,
    eagerGraph,
    distDir,
    entryBundleName,
    fesmDir,
    memoisedBuilder,
    nodeBuildEffects,
    packArgv,
    packsDir,
    parsePackOutput,
    resolveBuildId,
    runBuild,
    type BuildEffects,
    type BundleSources,
    type NodePrimitives,
} from './package-build-lib.js';
import { PACKAGE_NAMES, type PackageId } from './stage-package-lib.js';

/** A tarball listing shaped like `npm pack --json`'s `files[]`. */
function packed(paths: readonly string[]) {
    return { filename: 'pkg-0.1.0.tgz', files: paths.map((p) => ({ path: p })) };
}

const HEALTHY_FILES = [
    'package.json',
    'README.md',
    'styles.css',
    'schematics/collection.json',
    'schematics/ng-add/index.cjs',
    'schematics/ng-add/schema.json',
    'fesm2022/gilav21-shadcn-angular-rte.mjs',
    'fesm2022/gilav21-shadcn-angular-rte-pdf-readable-x5odr0qV.mjs',
    'types/gilav21-shadcn-angular-rte.d.ts',
];

describe('assertTarballContents (T-23)', () => {
    it('accepts a well-formed tarball listing', () => {
        expect(() => assertTarballContents('rte', packed(HEALTHY_FILES))).not.toThrow();
    });

    // Each required entry is the consumer's only copy of something: the manifest,
    // the usage contract, the compiled stylesheet, and the `ng add` schematic.
    it.each([
        'package.json',
        'README.md',
        'styles.css',
        'schematics/collection.json',
        'schematics/ng-add/index.cjs',
        'schematics/ng-add/schema.json',
    ])('rejects a tarball missing %s', (missing) => {
        const files = HEALTHY_FILES.filter((f) => f !== missing);
        expect(() => assertTarballContents('rte', packed(files))).toThrow(missing);
    });

    it('rejects a tarball with no fesm2022 bundle', () => {
        const files = HEALTHY_FILES.filter((f) => !f.startsWith('fesm2022/'));
        expect(() => assertTarballContents('rte', packed(files))).toThrow(/fesm2022/);
    });

    it('rejects a tarball shipping no type declarations', () => {
        const files = HEALTHY_FILES.filter((f) => !f.endsWith('.d.ts'));
        expect(() => assertTarballContents('rte', packed(files))).toThrow(/declaration/i);
    });

    // The whole point of a compiled package: sources stay in the repo.
    it.each([
        'src/ui/button/button.component.ts',
        'src/ui/button/button.component.spec.ts',
        'src/ui/button/button.stories.ts',
        'src/ui/button/__screenshots__/button.png',
    ])('rejects a tarball shipping %s', (leaked) => {
        expect(() => assertTarballContents('rte', packed([...HEALTHY_FILES, leaked]))).toThrow();
    });

    it('does not mistake a .d.ts for a leaked .ts source', () => {
        const files = [...HEALTHY_FILES, 'types/extra.d.ts'];
        expect(() => assertTarballContents('rte', packed(files))).not.toThrow();
    });

    it('normalises Windows separators before matching', () => {
        const files = HEALTHY_FILES.map((f) => f.replaceAll('/', '\\'));
        expect(() => assertTarballContents('rte', packed(files))).not.toThrow();
    });
});

/** A packed manifest that satisfies every clause of the T-23 gate. */
const HEALTHY_MANIFEST = {
    name: '@gilav21/shadcn-angular-rte',
    sideEffects: false,
    exports: { './styles.css': './styles.css' },
    schematics: './schematics/collection.json',
    peerDependencies: { '@angular/core': ANGULAR_PEER_RANGE },
    dependencies: {
        'class-variance-authority': '^0.7.1',
        clsx: '^2.1.1',
        'tailwind-merge': '^3.4.0',
        tslib: '^2.3.0',
    },
};

describe('checkPackedManifest (T-23)', () => {
    const HEALTHY = HEALTHY_MANIFEST;

    it('accepts a well-formed manifest', () => {
        expect(() => checkPackedManifest('rte', HEALTHY)).not.toThrow();
    });

    it('exposes the Angular peer range covering both supported majors', () => {
        // Spec C-17: partial-Ivy output is forward-compatible and its declared
        // minVersion floor is 17.2.0, so pinning ^21 would exclude Angular 20
        // consumers for no technical reason.
        expect(ANGULAR_PEER_RANGE).toBe('>=20.0.0 <22.0.0');
    });

    it.each([
        ['a wrong package name', { ...HEALTHY, name: '@gilav21/wrong' }, /packed name/],
        ['sideEffects not false', { ...HEALTHY, sideEffects: true }, /sideEffects/],
        ['a missing styles.css export', { ...HEALTHY, exports: {} }, /styles\.css/],
        ['no schematics entry (ng add would find nothing)', { ...HEALTHY, schematics: undefined }, /schematics/],
        [
            'an Angular-21-only peer range',
            { ...HEALTHY, peerDependencies: { '@angular/core': '^21.0.0' } },
            /peer must be/,
        ],
        [
            'a drifted runtime dependency set',
            { ...HEALTHY, dependencies: { ...HEALTHY.dependencies, lodash: '^4.0.0' } },
            /dependencies drifted/,
        ],
    ])('rejects %s', (_label, manifest, pattern) => {
        expect(() => checkPackedManifest('rte', manifest as never)).toThrow(pattern as RegExp);
    });
});

// ── T-6 ────────────────────────────────────────────────────────────────────

const ENTRY = 'gilav21-shadcn-angular-rte.mjs';
const MAIN = 'main-chunk.mjs';
const PARSER = 'pdf-readable-x5odr0qV.mjs';

/**
 * A FESM layout shaped like a healthy rte build: a thin entry barrel that
 * statically re-exports the main chunk, and a parser chunk reachable only
 * through the main chunk's dynamic `import()`.
 */
function healthyBundles(): Map<string, string> {
    return new Map([
        [ENTRY, `export * from './${MAIN}';`],
        [MAIN, `const load = () => import('./${PARSER}');\nexport { load };`],
        [PARSER, `function parsePdfReadable() { return 1; }\nexport { parsePdfReadable };`],
    ]);
}

describe('eagerGraph', () => {
    it('follows static imports transitively but never a dynamic one', () => {
        const eager = eagerGraph(ENTRY, healthyBundles());
        expect([...eager].sort((a, b) => a.localeCompare(b))).toEqual([ENTRY, MAIN]);
    });

    it('terminates on a static import cycle instead of looping forever', () => {
        const sources = new Map([
            [ENTRY, `export * from './${MAIN}';`],
            [MAIN, `export * from './${ENTRY}';`],
        ]);
        expect(eagerGraph(ENTRY, sources).size).toBe(2);
    });

    it('ignores a static import of a bundle that is not in this build', () => {
        const sources = new Map([[ENTRY, "export * from './not-emitted.mjs';"]]);
        expect([...eagerGraph(ENTRY, sources)]).toEqual([ENTRY]);
    });
});

describe('countDynamicImports', () => {
    it('counts every dynamic import in the given bundles', () => {
        const sources = new Map([[MAIN, "import('./a.mjs'); import('./b.mjs');"]]);
        expect(countDynamicImports([MAIN], sources)).toBe(2);
    });

    it('counts none when the only import is static', () => {
        expect(countDynamicImports([ENTRY], new Map([[ENTRY, "export * from './x.mjs';"]]))).toBe(0);
    });
});

describe('entryBundleName', () => {
    it.each([
        ['rte', 'gilav21-shadcn-angular-rte.mjs'],
        ['data-table', 'gilav21-shadcn-angular-data-table.mjs'],
    ] as const)('derives the %s entry bundle the way ng-packagr does', (id, expected) => {
        expect(entryBundleName(id)).toBe(expected);
    });
});

describe('checkLazyChunks (T-6)', () => {
    it('accepts a build whose parser is reachable only dynamically', () => {
        expect(() => checkLazyChunks('rte', healthyBundles(), 'fesm2022')).not.toThrow();
    });

    // The regression this gate exists to prevent: the parser ends up in a bundle
    // the entry reaches STATICALLY, so every consumer downloads ~680 kB of
    // parser code to render a toolbar.
    it('rejects a parser inlined into the statically-imported main chunk', () => {
        const sources = new Map([
            [ENTRY, `export * from './${MAIN}';`],
            [MAIN, `function parsePdfReadable() {}\nimport('./${PARSER}');`],
            [PARSER, 'export const unused = 1;'],
        ]);
        expect(() => checkLazyChunks('rte', sources, 'fesm2022')).toThrow(/eagerly-loaded graph/);
    });

    it('rejects a single-bundle build, where nothing can be lazy', () => {
        const sources = new Map([[ENTRY, 'function parsePdfReadable() {}']]);
        expect(() => checkLazyChunks('rte', sources, 'fesm2022')).toThrow(/at least one lazy chunk/);
    });

    it('rejects a build with no bundle named like the entry point', () => {
        const sources = new Map([
            ['renamed.mjs', "export * from './other.mjs';"],
            ['other.mjs', 'function parsePdfReadable() {}'],
        ]);
        expect(() => checkLazyChunks('rte', sources, 'fesm2022')).toThrow(/entry bundle named/);
    });

    it('rejects a build where every bundle is statically reachable', () => {
        const sources = new Map([
            [ENTRY, `export * from './${MAIN}';`],
            [MAIN, `export * from './${PARSER}';`],
            [PARSER, 'function parsePdfReadable() {}'],
        ]);
        expect(() => checkLazyChunks('rte', sources, 'fesm2022')).toThrow(/no longer lazy/);
    });

    it('rejects a build where the flattening dropped every dynamic import', () => {
        const sources = new Map([
            [ENTRY, `export * from './${MAIN}';`],
            [MAIN, 'export const x = 1;'],
            [PARSER, 'function parsePdfReadable() {}'],
        ]);
        expect(() => checkLazyChunks('rte', sources, 'fesm2022')).toThrow(/no dynamic import\(\)/);
    });

    it('rejects a build that dropped the parser entirely', () => {
        const sources = new Map([
            [ENTRY, `export * from './${MAIN}';`],
            [MAIN, `import('./${PARSER}');`],
            [PARSER, 'export const nothingUseful = 1;'],
        ]);
        expect(() => checkLazyChunks('rte', sources, 'fesm2022')).toThrow(/dropped entirely/);
    });

    // Only the rte package carries the file-import parsers, so the gate has
    // nothing to say about data-table and must not invent a failure for it.
    it('says nothing about data-table, which has no lazy parsers', () => {
        expect(() => checkLazyChunks('data-table', new Map(), 'fesm2022')).not.toThrow();
    });
});

// ── Entry contract ─────────────────────────────────────────────────────────

describe('parsePackOutput', () => {
    it('returns the first package of an npm pack --json payload', () => {
        const raw = JSON.stringify([{ filename: 'pkg-0.1.0.tgz', files: [{ path: 'package.json' }] }]);
        expect(parsePackOutput(raw).filename).toBe('pkg-0.1.0.tgz');
    });

    // "No package" and "a package of the wrong shape" are different faults and
    // must report differently: the first means npm packed nothing, the second
    // means npm changed its output format.
    it.each([
        ['an empty array', '[]'],
        ['a bare object instead of an array', '{"filename":"x.tgz","files":[]}'],
    ])('rejects %s as "returned no package"', (_label, raw) => {
        expect(() => parsePackOutput(raw)).toThrow(/returned no package/);
    });

    it('rejects a first entry missing filename or files as an unexpected shape', () => {
        expect(() => parsePackOutput('[{"files":[]}]')).toThrow(/unexpected shape/);
        expect(() => parsePackOutput('[{"filename":"x.tgz"}]')).toThrow(/unexpected shape/);
    });

    // A TypeError, not a plain Error: the fault is that npm's payload is not the
    // type this contract expects.
    it('raises a TypeError for a wrong-shaped entry', () => {
        expect(() => parsePackOutput('[{"files":[]}]')).toThrow(TypeError);
    });

    it('echoes the offending payload so the failure is diagnosable', () => {
        expect(() => parsePackOutput('[{"files":[]}]')).toThrow(/"files"/);
    });
});

describe('packArgv', () => {
    // `shell: true` is required to spawn npm's Windows `.cmd` shim, so a
    // destination containing a space would otherwise split into two arguments.
    it('JSON-quotes the destination so a path with spaces survives shell:true', () => {
        expect(packArgv('C:/My Packs')).toEqual(['pack', '--json', '--pack-destination', '"C:/My Packs"']);
    });
});

describe('resolveBuildId', () => {
    it.each(['rte', 'data-table'] as const)('accepts %s', (id) => {
        expect(resolveBuildId(id)).toBe(id);
    });

    it.each([undefined, '', 'rtee', 'data_table'])('rejects %s', (raw) => {
        expect(resolveBuildId(raw)).toBeNull();
    });

    it('names both ids in the usage line', () => {
        expect(buildUsage()).toBe('Usage: npm run build:package -- <rte|data-table>');
    });
});

// ── Build order ────────────────────────────────────────────────────────────

describe('buildPackage', () => {
    /**
     * A recording build port whose default answers all pass every gate.
     * `overrides` poses one step into failing so the ORDER can be observed by
     * what did and did not run before it.
     */
    function port(overrides: Partial<BuildEffects> = {}) {
        const calls: string[] = [];
        const record = <T>(name: string, value: T) => (): T => { calls.push(name); return value; };
        const fx: BuildEffects = {
            stage: record('stage', undefined),
            compileStyles: record('compileStyles', undefined),
            ngBuild: record('ngBuild', undefined),
            readBundles: record('readBundles', healthyBundles() as BundleSources),
            fesmLabel: () => 'fesm2022',
            readPackedManifest: record('readPackedManifest', HEALTHY_MANIFEST),
            ensurePacksDir: record('ensurePacksDir', undefined),
            pack: record('pack', JSON.stringify([{ filename: 'rte-0.1.0.tgz', files: HEALTHY_FILES.map((p) => ({ path: p })) }])),
            tarballPath: (filename) => `/packs/${filename}`,
            exists: () => { calls.push('exists'); return true; },
            ...overrides,
        };
        return { calls, fx };
    }

    it('returns the packed tarball path on a healthy build', () => {
        expect(buildPackage('rte', port().fx)).toBe('/packs/rte-0.1.0.tgz');
    });

    // ng-packagr compiles what staging wrote, so building first would compile
    // the previous run's closure.
    it('stages before it builds', () => {
        const { calls, fx } = port();
        buildPackage('rte', fx);
        expect(calls.indexOf('stage')).toBeLessThan(calls.indexOf('ngBuild'));
    });

    // The compile scans the STAGED sources, and ng-packagr copies its output as
    // an asset — compiled before staging it scans a stale tree, after ng build
    // the tarball ships the previous stylesheet.
    it('compiles the stylesheet after staging and before ng build', () => {
        const { calls, fx } = port();
        buildPackage('rte', fx);
        expect(calls.slice(0, 3)).toEqual(['stage', 'compileStyles', 'ngBuild']);
    });

    // A tarball that fails a structural gate must never reach disk: once packed
    // it is a file someone can publish.
    it('runs both structural gates before packing', () => {
        const { calls, fx } = port();
        buildPackage('rte', fx);
        expect(calls.indexOf('readBundles')).toBeLessThan(calls.indexOf('pack'));
        expect(calls.indexOf('readPackedManifest')).toBeLessThan(calls.indexOf('pack'));
    });

    it('does not pack when the lazy-chunk gate fails', () => {
        const inlined = new Map([[ENTRY, 'function parsePdfReadable() {}']]);
        const { calls, fx } = port({ readBundles: () => inlined });
        expect(() => buildPackage('rte', fx)).toThrow(/lazy chunk/);
        expect(calls).not.toContain('pack');
    });

    it('does not pack when the manifest gate fails', () => {
        const { calls, fx } = port({ readPackedManifest: () => ({ ...HEALTHY_MANIFEST, sideEffects: true }) });
        expect(() => buildPackage('rte', fx)).toThrow(/sideEffects/);
        expect(calls).not.toContain('pack');
    });

    it('rejects a packed tarball that ships forbidden files', () => {
        const leaky = JSON.stringify([{
            filename: 'rte-0.1.0.tgz',
            files: [...HEALTHY_FILES, 'ui/x.component.spec.ts'].map((p) => ({ path: p })),
        }]);
        expect(() => buildPackage('rte', port({ pack: () => leaky }).fx)).toThrow(/must not/);
    });

    // `npm pack --json` reports the name it INTENDED to write, so a pack that
    // failed after printing its plan would hand the e2e run a path to nothing.
    it('fails when npm pack reported a tarball it did not write', () => {
        const { fx } = port({ exists: () => false });
        expect(() => buildPackage('rte', fx)).toThrow(/not on disk/);
    });

    // data-table ships no lazy parsers, so the gate must not read its bundles
    // and must not fail it for lacking a chunk it never had.
    it('skips the lazy-chunk gate entirely for data-table', () => {
        const { calls, fx } = port({
            readPackedManifest: () => ({ ...HEALTHY_MANIFEST, name: '@gilav21/shadcn-angular-data-table' }),
        });
        expect(() => buildPackage('data-table', fx)).not.toThrow();
        expect(calls).not.toContain('readBundles');
    });
});

describe('memoisedBuilder', () => {
    /** Counts builds and resolves only when released, so concurrency is observable. */
    function counter() {
        const builds: PackageId[] = [];
        const build = memoisedBuilder({
            stage: (id) => { builds.push(id); },
            compileStyles: () => {},
            ngBuild: () => {},
            readBundles: () => healthyBundles(),
            fesmLabel: () => 'fesm2022',
            readPackedManifest: (id) => ({ ...HEALTHY_MANIFEST, name: PACKAGE_NAMES[id] }),
            ensurePacksDir: () => {},
            pack: () => JSON.stringify([{ filename: 'x.tgz', files: HEALTHY_FILES.map((p) => ({ path: p })) }]),
            tarballPath: (f) => `/packs/${f}`,
            exists: () => true,
        });
        return { builds, build };
    }

    // An ng-packagr build is minutes and the e2e run asks for the same tarball
    // under up to three labels; the second caller must join the first build.
    it('builds a package once however many times it is asked for', async () => {
        const { builds, build } = counter();
        const [a, b] = await Promise.all([build('rte'), build('rte')]);
        expect(builds).toEqual(['rte']);
        expect(a).toBe(b);
    });

    it('returns the identical promise to a second caller', () => {
        const { build } = counter();
        expect(build('rte')).toBe(build('rte'));
    });

    it('memoises per package, so the two do not share a tarball', async () => {
        const { builds, build } = counter();
        await Promise.all([build('rte'), build('data-table')]);
        expect([...builds].sort((a, b) => a.localeCompare(b))).toEqual(['data-table', 'rte']);
    });

    it('gives each builder its own memo rather than a module-wide one', async () => {
        const first = counter();
        const second = counter();
        await Promise.all([first.build('rte'), second.build('rte')]);
        expect(first.builds).toEqual(['rte']);
        expect(second.builds).toEqual(['rte']);
    });
});

describe('layout', () => {
    const norm = (p: string) => p.replaceAll('\\', '/');

    // `ng build <id>-package` writes here; a wrong guess surfaces minutes into
    // a build as an opaque "no such file".
    it('places each package dist under dist/<id>-package', () => {
        expect(norm(distDir('/repo', 'rte'))).toBe('/repo/dist/rte-package');
        expect(norm(distDir('/repo', 'data-table'))).toBe('/repo/dist/data-table-package');
    });

    it('places the FESM bundles under the dist directory', () => {
        expect(norm(fesmDir('/repo', 'rte'))).toBe('/repo/dist/rte-package/fesm2022');
    });

    // Under the e2e workers root, which is already gitignored — tarballs must
    // never show up as untracked files and trip the release's dirty-tree guard.
    it('drops tarballs under the gitignored e2e workers root', () => {
        expect(norm(packsDir('/repo'))).toBe('/repo/e2e/.workers/_packs');
    });
});

describe('nodeBuildEffects', () => {
    /** Records every primitive call so the composed argv and paths are assertable. */
    function io(overrides: Partial<NodePrimitives> = {}) {
        const calls: string[] = [];
        const primitives: NodePrimitives = {
            stage: (id) => { calls.push(`stage ${id}`); },
            exec: (command, args, cwd) => {
                calls.push(`${command} ${args.join(' ')} @ ${cwd.replaceAll('\\', '/')}`);
                return '{}';
            },
            readDir: () => { calls.push('readDir'); return ['entry.mjs', 'notes.txt']; },
            readFile: (p) => { calls.push(`read ${p.replaceAll('\\', '/')}`); return '{"name":"x"}'; },
            mkdirp: (p) => { calls.push(`mkdirp ${p.replaceAll('\\', '/')}`); },
            exists: () => true,
            ...overrides,
        };
        return { calls, fx: nodeBuildEffects('/repo', primitives) };
    }

    it('compiles the stylesheet with the package-styles script, from the repo root', () => {
        const { calls, fx } = io();
        fx.compileStyles('data-table');
        expect(calls).toEqual(['npx tsx packages/cli/scripts/package-styles.ts data-table @ /repo']);
    });

    it('builds the ng project named after the package, from the repo root', () => {
        const { calls, fx } = io();
        fx.ngBuild('rte');
        expect(calls).toEqual(['npx ng build rte-package @ /repo']);
    });

    // npm pack must run in the DIST folder — running it at the repo root would
    // pack the monorepo instead of the built package.
    it('packs from the dist folder into the packs directory', () => {
        const { calls, fx } = io();
        fx.pack('rte');
        const call = calls[0].replaceAll('\\\\', '/').replaceAll('\\', '/');
        expect(call).toContain('npm pack --json --pack-destination');
        expect(call).toContain('/repo/e2e/.workers/_packs');
        expect(call).toContain('@ /repo/dist/rte-package');
    });

    it('reads only .mjs bundles from the FESM directory', () => {
        const { fx } = io();
        expect([...fx.readBundles('rte').keys()]).toEqual(['entry.mjs']);
    });

    it('reads the packed manifest from the dist package.json', () => {
        const { calls, fx } = io();
        fx.readPackedManifest('rte');
        expect(calls).toContain('read /repo/dist/rte-package/package.json');
    });

    it('creates the packs directory and resolves tarballs inside it', () => {
        const { calls, fx } = io();
        fx.ensurePacksDir();
        expect(calls).toContain('mkdirp /repo/e2e/.workers/_packs');
        expect(fx.tarballPath('a.tgz').replaceAll('\\', '/')).toBe('/repo/e2e/.workers/_packs/a.tgz');
    });
});

describe('runBuild', () => {
    const relative = (p: string) => p.replace('/repo/', '');

    it('reports the built tarball relative to the repo root', async () => {
        const outcome = await runBuild(['rte'], async () => '/repo/e2e/.workers/_packs/rte.tgz', relative);
        expect(outcome.status).toBe(0);
        expect(outcome.stdout).toEqual(['[package-build] rte: e2e/.workers/_packs/rte.tgz']);
    });

    // A multi-minute build must not start on a typo.
    it.each([[], ['rtee']])('exits 1 with usage on %s without building', async (...argv) => {
        let built = false;
        const outcome = await runBuild(argv.flat(), async () => { built = true; return ''; }, relative);
        expect(outcome.status).toBe(1);
        expect(outcome.stderr).toEqual([buildUsage()]);
        expect(built).toBe(false);
    });
});
