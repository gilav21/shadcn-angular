import { describe, it, expect } from 'vitest';
import { parseRegistryEntries, diffRegistryEntries } from './impact';

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
