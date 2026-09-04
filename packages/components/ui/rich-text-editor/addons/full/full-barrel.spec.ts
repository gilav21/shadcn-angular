import { describe, expect, it } from 'vitest';
import * as fullBarrel from './index';
import { RTE_FULL } from './index';

/**
 * T-4 — the NG3004 contract, asserted against the real generated barrel.
 *
 * Angular's AOT reference emitter resolves a directive used through a
 * standalone `imports: [RTE_FULL]` via the module that declares the array, so
 * every class inside `RTE_FULL` must ALSO be a named export of this same file
 * or a consumer's production build fails with
 * "… is not exported from …/addons/full". `sync-registry` generates both lists
 * together (`renderCompositeBarrel`); this locks the generated result.
 */
describe('rich-text-editor addons/full barrel', () => {
    const exportedNames = new Set(Object.keys(fullBarrel));

    it('re-exports by name every directive that RTE_FULL contains', () => {
        const missing = RTE_FULL.map(d => d.name).filter(name => !exportedNames.has(name));
        expect(missing).toEqual([]);
    });

    it('carries every rich-text addon directive, so the one-import claim holds', () => {
        // 13 sibling addons today; the array is generated, so this guards a
        // silently-shrinking barrel rather than pinning a magic number.
        expect(RTE_FULL.length).toBeGreaterThanOrEqual(13);
        expect(RTE_FULL.every(d => typeof d === 'function')).toBe(true);
    });

    it('exports RTE_FULL itself alongside the classes', () => {
        expect(exportedNames.has('RTE_FULL')).toBe(true);
    });
});
