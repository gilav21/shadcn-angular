/**
 * T-17 — the package-spec catalogue contract.
 *
 * The three `pkg-*` entries are the only specs whose `names[]` may be empty:
 * they install a compiled npm tarball rather than CLI-copied components. That
 * exemption is exactly the sort of thing that rots silently, so the shape is
 * pinned here: empty names REQUIRE a `packages` list, and the `pkg-*` harness
 * folders must be claimed explicitly (auto-discovery would otherwise register
 * them as bogus single-component specs and abort the whole orchestrator).
 */
import { describe, expect, it } from 'vitest';

import {
    ALL_COMPONENTS,
    PACKAGE_IDS,
    type ComponentSpec,
    specHarness,
    specLabel,
    validateSpecs,
} from './specs.js';

function byLabel(label: string): ComponentSpec | undefined {
    return ALL_COMPONENTS.find((s) => specLabel(s) === label);
}

describe('package specs are registered (T-17)', () => {
    it.each([
        { label: 'pkg-rte', packages: ['rte'], names: [] as string[] },
        { label: 'pkg-data-table', packages: ['data-table'], names: [] as string[] },
        { label: 'pkg-mixed', packages: ['rte'], names: ['button'] },
    ])('$label is in ALL_COMPONENTS with the right packages/fixture', ({ label, packages, names }) => {
        const spec = byLabel(label);
        expect(spec, label).toBeDefined();
        expect(spec!.packages).toEqual(packages);
        expect(spec!.fixture).toBe('ng21');
        expect([...spec!.names]).toEqual(names);
    });

    it('pkg-mixed is the only package spec that also installs a CLI component', () => {
        const pkgSpecs = ALL_COMPONENTS.filter((s) => s.packages?.length);
        expect(pkgSpecs).toHaveLength(3);
        expect(pkgSpecs.filter((s) => s.names.length > 0).map(specLabel)).toEqual(['pkg-mixed']);
    });

    it('every package id referenced by a spec is a real package', () => {
        for (const spec of ALL_COMPONENTS) {
            for (const id of spec.packages ?? []) {
                expect(PACKAGE_IDS as readonly string[]).toContain(id);
            }
        }
    });

    it('the pkg-* harness folders are CLAIMED, never auto-discovered as components', () => {
        // Auto-discovery would produce `{ names: ['pkg-rte'] }`, and validateSpecs
        // rejects unknown component names — the module would throw at load.
        for (const label of ['pkg-rte', 'pkg-data-table', 'pkg-mixed']) {
            const claiming = ALL_COMPONENTS.filter((s) => specHarness(s) === label);
            expect(claiming, label).toHaveLength(1);
            expect(specLabel(claiming[0])).toBe(label);
        }
    });

    it('non-package specs are untouched: no fixture field means the ng20 default', () => {
        const button = byLabel('button');
        expect(button).toBeDefined();
        expect(button!.fixture).toBeUndefined();
        expect(button!.packages).toBeUndefined();
    });

    it('specLabel resolves for a package spec even though names is empty', () => {
        expect(specLabel({ names: [], packages: ['rte'], label: 'pkg-rte' })).toBe('pkg-rte');
    });
});

describe('validateSpecs rejects an unusable spec (T-17)', () => {
    it('throws when a spec has neither names nor packages', () => {
        expect(() => validateSpecs([{ names: [], label: 'empty' }])).toThrow(
            /neither names nor packages/,
        );
    });

    it('accepts an empty names list when packages is non-empty', () => {
        expect(() =>
            validateSpecs([{ names: [], packages: ['rte'], fixture: 'ng21', label: 'pkg-x' }]),
        ).not.toThrow();
    });

    it('still rejects an unknown component name in a package spec', () => {
        expect(() =>
            validateSpecs([
                { names: ['not-a-component'], packages: ['rte'], label: 'pkg-bad' },
            ]),
        ).toThrow(/unknown component/);
    });
});
