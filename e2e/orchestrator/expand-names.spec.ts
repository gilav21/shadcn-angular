import { describe, expect, it } from 'vitest';
import { expandRequestedNames } from './expand-names.js';
import type { ComponentSpec } from './specs.js';

/**
 * T-25 / T-26 — `npm run e2e -- rich-text-editor` used to exit 2 ("Unknown
 * name"), and even once the base harness exists, running only it would skip
 * the 14 addon specs that also install the editor. Expansion makes a base
 * component's name mean "everything about this component", using the
 * registry's own `addons[]` as the group definition — no separate map.
 */
describe('expandRequestedNames', () => {
    const specs: readonly ComponentSpec[] = [
        { names: ['rich-text-editor'] },
        { names: ['rich-text-editor', 'rich-text-editor/actions', 'dialog'], label: 'rte-actions' },
        { names: ['rich-text-editor', 'rich-text-editor/tables'], label: 'rte-tables' },
        // Installs an addon WITHOUT naming the base — reachable only through
        // the base's registry `addons[]`, which is what makes the group real.
        { names: ['rich-text-editor/emoji'], label: 'rte-emoji-only' },
        { names: ['data-table', 'data-table/export'], label: 'data-table-export' },
        { names: ['button'] },
        { names: ['input', 'label', 'button', 'dialog'], label: 'form-flow' },
    ];

    it('expands a base component to the base spec and every addon spec', () => {
        expect(expandRequestedNames(['rich-text-editor'], specs)).toEqual([
            'rich-text-editor',
            'rte-actions',
            'rte-tables',
            'rte-emoji-only',
        ]);
    });

    it('expands a base whose specs are all explicit labels', () => {
        expect(expandRequestedNames(['data-table'], specs)).toEqual(['data-table-export']);
    });

    it('leaves an exact addon spec label alone', () => {
        expect(expandRequestedNames(['rte-tables'], specs)).toEqual(['rte-tables']);
    });

    it('leaves a component with no registry addons alone, even when other specs install it', () => {
        // `button` also appears in `form-flow`, but it has no addons[] — so
        // `npm run e2e -- button` keeps meaning exactly one spec, as today.
        expect(expandRequestedNames(['button'], specs)).toEqual(['button']);
    });

    it('passes an unknown name through untouched so run.ts can still exit 2', () => {
        expect(expandRequestedNames(['rich-text'], specs)).toEqual(['rich-text']);
    });

    // T-26 — `rich-text-editor` is BOTH a requested label and a name produced
    // by its own expansion; it must appear once.
    it('dedupes a requested label that its own expansion also produces', () => {
        const out = expandRequestedNames(['rich-text-editor'], specs);
        expect(out.filter(n => n === 'rich-text-editor')).toHaveLength(1);
    });

    it('dedupes across two requested names that expand to overlapping specs', () => {
        const out = expandRequestedNames(['rich-text-editor', 'rte-actions'], specs);
        expect(out).toEqual(['rich-text-editor', 'rte-actions', 'rte-tables', 'rte-emoji-only']);
    });

    it('is order-stable: requested order first, expansion in spec order', () => {
        expect(expandRequestedNames(['button', 'rich-text-editor'], specs)).toEqual([
            'button',
            'rich-text-editor',
            'rte-actions',
            'rte-tables',
            'rte-emoji-only',
        ]);
    });

    it('returns an empty list unchanged', () => {
        expect(expandRequestedNames([], specs)).toEqual([]);
    });
});
