import { describe, expect, it } from 'vitest';
import * as barrel from './index';
import type { RichTextCustomToolbarItem, RichTextEditorRef } from './index';

/**
 * The public surface a consumer imports from one barrel. `RichTextCustomToolbarItem`
 * and `RichTextEditorRef` are interfaces, so they vanish at runtime; the typed
 * declarations below are the assertion — the file stops type-checking the
 * moment either leaves the barrel.
 */
const item: RichTextCustomToolbarItem = { id: 'x', icon: 'x', tooltip: 'x', onClick: (ref: RichTextEditorRef) => ref.focus() };

describe('rich-text-editor barrel', () => {
    const exported = new Set(Object.keys(barrel));

    it('still exports the editor, the addon host and the typed toolbar table', () => {
        expect(exported.has('RichTextEditorComponent')).toBe(true);
        expect(exported.has('RichTextEditorAddonHost')).toBe(true);
        expect(exported.has('RichTextToolbarComponent')).toBe(true);
        expect(exported.has('TOOLBAR_BUTTONS')).toBe(true);
    });

    it('exports the toolbar item unions the typed table is keyed by', () => {
        // Runtime proof the table itself (not just its type) crossed the barrel.
        expect(Object.keys(barrel.TOOLBAR_BUTTONS).length).toBeGreaterThan(20);
        expect(Object.keys(barrel.TOOLBAR_BUTTONS)).not.toContain('separator');
    });

    it('keeps the data-driven custom toolbar types public', () => {
        expect(item.id).toBe('x');
    });
});
