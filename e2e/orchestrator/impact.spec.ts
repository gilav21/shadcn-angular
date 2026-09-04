import { describe, it, expect } from 'vitest';
import { parseRegistryEntries, diffRegistryEntries, blockForFile } from './impact';
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

/**
 * T-27 / T-28 — the base editor's own harness. Before this, `e2e/harness/` held
 * 14 `rte-*` folders and nothing installing the base alone, so a refactor of
 * the 4.6k-line editor was covered only incidentally by whichever addon spec
 * happened to touch the same path.
 */
describe('rich-text-editor base harness', () => {
    const base = ALL_COMPONENTS.filter(s => specLabel(s) === 'rich-text-editor');

    it('is auto-discovered exactly once, installing only the base', () => {
        expect(base).toHaveLength(1);
        expect(base[0].names).toEqual(['rich-text-editor']);
    });

    it('is not claimed by an EXPLICIT_SPECS entry (no label, no initArgs override)', () => {
        // An auto-discovered spec carries neither — that is what distinguishes
        // it from the hand-registered multi-component entries.
        expect(base[0].label).toBeUndefined();
        expect(base[0].initArgs).toBeUndefined();
        expect(base[0].harnessFolder).toBeUndefined();
    });

    it('schedules the base label and every rte-* label for an editor source change', () => {
        const scheduled = ALL_COMPONENTS
            .filter(s => s.names.includes('rich-text-editor'))
            .map(specLabel);
        expect(scheduled).toContain('rich-text-editor');
        expect(scheduled.filter(l => l.startsWith('rte-')).length).toBeGreaterThanOrEqual(14);
    });
});
