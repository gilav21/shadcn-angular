import { describe, it, expect } from 'vitest';
import { parseRegistryEntries, diffRegistryEntries, blockForFile, computeImpact } from './impact';
import { registry, getComponentNames } from '../../packages/cli/src/registry/index.js';
import { ALL_COMPONENTS, specLabel } from './specs.js';

/**
 * Faithful slice of the real registry shape — `defineRegistry({ <name>: {...} })`
 * with both bare and quoted keys at 2-space indent.
 */
const REGISTRY_BASE = `
export const registry = defineRegistry({
  button: {
    name: 'button',
    files: ['button/button.component.ts', 'button/index.ts'],
    dependencies: ['ripple'],
  },
  'color-picker': {
    name: 'color-picker',
    files: ['color-picker/color-picker.component.ts', 'color-picker/index.ts'],
    dependencies: ['popover'],
  },
  eyedropper: {
    name: 'eyedropper',
    files: ['eyedropper/eyedropper.component.ts'],
    dependencies: ['icon'],
  },
});
`;

describe('parseRegistryEntries', () => {
    it('extracts bare and quoted entry names', () => {
        const entries = parseRegistryEntries(REGISTRY_BASE);
        expect([...entries.keys()].sort((a, b) => a.localeCompare(b))).toEqual(['button', 'color-picker', 'eyedropper']);
    });

    it('captures the full block per entry', () => {
        const entries = parseRegistryEntries(REGISTRY_BASE);
        const button = entries.get('button');
        expect(button).toContain("name: 'button'");
        expect(button).toContain("dependencies: ['ripple']");
        // Block ends at its own closing brace — must not bleed into the next entry.
        expect(button).not.toContain('color-picker');
    });
});

describe('diffRegistryEntries', () => {
    it('returns empty set when sources are identical', () => {
        expect(diffRegistryEntries(REGISTRY_BASE, REGISTRY_BASE).size).toBe(0);
    });

    it('detects an expanded files[] on one entry', () => {
        const head = REGISTRY_BASE.replace(
            "files: ['color-picker/color-picker.component.ts', 'color-picker/index.ts']",
            "files: ['color-picker/color-picker.component.ts', 'color-picker/color-picker.utils.ts', 'color-picker/index.ts']",
        );
        const changed = diffRegistryEntries(REGISTRY_BASE, head);
        expect([...changed]).toEqual(['color-picker']);
    });

    it('detects an added dependency on one entry', () => {
        const head = REGISTRY_BASE.replace(
            "dependencies: ['popover']",
            "dependencies: ['eyedropper', 'popover']",
        );
        const changed = diffRegistryEntries(REGISTRY_BASE, head);
        expect([...changed]).toEqual(['color-picker']);
    });

    it('detects a newly-added entry', () => {
        const head = REGISTRY_BASE.replace(
            '});',
            `  badge: {
    name: 'badge',
    files: ['badge/badge.component.ts'],
  },
});`,
        );
        const changed = diffRegistryEntries(REGISTRY_BASE, head);
        expect([...changed]).toEqual(['badge']);
    });

    it('detects a removed entry', () => {
        const head = REGISTRY_BASE.replace(
            /\n[^\S\n]*eyedropper:\s*\{[^}]+\},\n/,
            '\n',
        );
        const changed = diffRegistryEntries(REGISTRY_BASE, head);
        expect([...changed]).toEqual(['eyedropper']);
    });

    it('detects multiple independent edits', () => {
        const head = REGISTRY_BASE
            .replace("dependencies: ['ripple']", "dependencies: ['icon', 'ripple']")
            .replace("dependencies: ['popover']", "dependencies: ['eyedropper', 'popover']");
        const changed = diffRegistryEntries(REGISTRY_BASE, head);
        expect([...changed].sort((a, b) => a.localeCompare(b))).toEqual(['button', 'color-picker']);
    });
});

// T-12 — a change to a block must schedule that block's own e2e spec.
// Blocks live in `packages/blocks/`, which the registry's `getComponentForFile`
// (ui/ and lib/ only) does not recognise; before `blockForFile` existed, every
// block edit mapped to NO component and the analyzer scheduled NOTHING.
describe('block impact analysis', () => {
    const blockNames = getComponentNames().filter(n => registry[n].type === 'block');

    it('has blocks to analyse', () => {
        expect(blockNames.length).toBeGreaterThan(0);
    });

    it('maps every block source file back to its block', () => {
        for (const name of blockNames) {
            for (const file of registry[name].files) {
                expect(blockForFile(`packages/blocks/${file}`), file).toBe(name);
            }
        }
    });

    it('ignores paths outside packages/blocks/', () => {
        expect(blockForFile('packages/components/ui/button/button.component.ts')).toBeNull();
        expect(blockForFile('docs/directives.md')).toBeNull();
    });

    it('returns null for an unregistered file under packages/blocks/', () => {
        expect(blockForFile('packages/blocks/login/not-a-real-file.ts')).toBeNull();
    });

    it('every block has an e2e spec the analyzer can schedule', () => {
        const labels = new Set(ALL_COMPONENTS.map(specLabel));
        for (const name of blockNames) {
            const scheduled = ALL_COMPONENTS.some(s => s.names.includes(name));
            expect(scheduled, `no e2e spec installs block "${name}"`).toBe(true);
            expect(labels.has(name), `no spec labelled "${name}"`).toBe(true);
        }
    });
});

// ── T-18 — package impact rules ────────────────────────────────────────────
//
// The pkg-* legs are the slowest in the suite (tarball build + prod build +
// serve, ~2 min each), so scheduling them on an unrelated component change
// would be a real cost. These assertions pin both directions: the closure
// schedules them, and `accordion` does not.
describe('package spec impact (T-18)', () => {
    function subsetFor(file: string): readonly string[] {
        const result = computeImpact('HEAD', [file]);
        expect(result.kind, `${file} -> ${result.kind}`).toBe('subset');
        return result.specs;
    }

    it('an RTE addon file schedules the rte package legs on both majors', () => {
        const specs = subsetFor(
            'packages/components/ui/rich-text-editor/addons/emoji/rich-text-emoji.directive.ts',
        );
        expect(specs).toEqual(expect.arrayContaining(['pkg-rte', 'pkg-rte-ng21', 'pkg-mixed']));
        expect(specs).not.toContain('pkg-data-table');
        expect(specs).not.toContain('pkg-data-table-ng21');
    });

    it('the data-table component schedules the data-table legs only', () => {
        const specs = subsetFor('packages/components/ui/data-table/data-table.component.ts');
        expect(specs).toEqual(expect.arrayContaining(['pkg-data-table', 'pkg-data-table-ng21']));
        expect(specs).not.toContain('pkg-rte');
    });

    it('a package folder file schedules that package’s own specs on both majors', () => {
        const rte = subsetFor('packages/rte-package/README.md');
        expect(rte).toEqual(expect.arrayContaining(['pkg-rte', 'pkg-rte-ng21', 'pkg-mixed']));
        expect(rte).not.toContain('pkg-data-table');

        const dt = subsetFor('packages/data-table-package/ng-package.json');
        expect(dt).toEqual(expect.arrayContaining(['pkg-data-table', 'pkg-data-table-ng21']));
        expect(dt).not.toContain('pkg-rte');
    });

    it('the stage script is under the packages/cli tripwire, so it runs everything', () => {
        expect(computeImpact('HEAD', ['packages/cli/scripts/stage-package-lib.ts']).kind).toBe('all');
    });

    // `lib/utils.ts` is a BASELINE lib file: no registry entry declares it, yet
    // it is staged into BOTH packages and every component's `cn()` depends on
    // it. Without an explicit rule the registry lookup finds no owner and it
    // would schedule nothing — a change to the one file every component imports
    // would skip the package legs entirely.
    it('the baseline lib/utils.ts schedules every package leg', () => {
        const result = computeImpact('HEAD', ['packages/components/lib/utils.ts']);
        if (result.kind === 'all') return; // a tripwire is also safe
        expect(result.kind).toBe('subset');
        expect(result.specs).toEqual(
            expect.arrayContaining(['pkg-rte', 'pkg-rte-ng21', 'pkg-data-table', 'pkg-data-table-ng21']),
        );
    });

    it('an unrelated component schedules no package spec', () => {
        const specs = subsetFor('packages/components/ui/accordion/accordion.component.ts');
        for (const label of ['pkg-rte', 'pkg-rte-ng21', 'pkg-data-table', 'pkg-data-table-ng21', 'pkg-mixed']) {
            expect(specs, label).not.toContain(label);
        }
    });
});
