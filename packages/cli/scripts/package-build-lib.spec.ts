/**
 * Unit tests for the pure structural gates in `package-build.ts` (T-23).
 *
 * The spec exempts T-6/T-23 from vitest because "they need a real ng-packagr
 * build (minutes)". That rationale holds for `assertLazyChunks`, which reads a
 * dist directory — but NOT for these two: `assertTarballContents` takes an
 * injected `npm pack --json` object, and `assertPackedManifest`'s only input is
 * a parsed `package.json`. Leaving them driven solely by a multi-minute build is
 * how the missing-README defect survived two review rounds, so the pure halves
 * get pinned here where a wrong branch fails in milliseconds.
 */
import { describe, expect, it } from 'vitest';

import { ANGULAR_PEER_RANGE, assertTarballContents, checkPackedManifest } from './package-build.js';

/** A tarball listing shaped like `npm pack --json`'s `files[]`. */
function packed(paths: readonly string[]) {
    return { filename: 'pkg-0.1.0.tgz', files: paths.map((p) => ({ path: p })) };
}

const HEALTHY_FILES = [
    'package.json',
    'README.md',
    'theme.css',
    'fesm2022/gilav21-shadcn-angular-rte.mjs',
    'fesm2022/gilav21-shadcn-angular-rte-pdf-readable-x5odr0qV.mjs',
    'types/gilav21-shadcn-angular-rte.d.ts',
];

describe('assertTarballContents (T-23)', () => {
    it('accepts a well-formed tarball listing', () => {
        expect(() => assertTarballContents('rte', packed(HEALTHY_FILES))).not.toThrow();
    });

    // Each required entry is the consumer's only copy of something: the manifest,
    // the install/usage contract, and the design tokens.
    it.each(['package.json', 'README.md', 'theme.css'])('rejects a tarball missing %s', (missing) => {
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

describe('checkPackedManifest (T-23)', () => {
    const HEALTHY = {
        name: '@gilav21/shadcn-angular-rte',
        sideEffects: false,
        exports: { './theme.css': './theme.css' },
        peerDependencies: { '@angular/core': ANGULAR_PEER_RANGE },
        dependencies: {
            'class-variance-authority': '^0.7.1',
            clsx: '^2.1.1',
            'tailwind-merge': '^3.4.0',
            tslib: '^2.3.0',
        },
    };

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
        ['a missing theme.css export', { ...HEALTHY, exports: {} }, /theme\.css/],
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
