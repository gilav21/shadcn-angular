import { describe, expect, it } from 'vitest';
import * as barrel from './index';

/**
 * T-11 — Rec 16: the dead custom-toolbar API is gone from the public surface.
 *
 * `RichTextCustomToolbarItem` / `RichTextEditorRef` described the third (and
 * weakest) way to add a toolbar button — the one whose inserts recorded no
 * undo entry. Addons registering through `RichTextEditorAddonHost.toolbarSlots`
 * are now the only extension path, so these names must not come back.
 *
 * Both are interfaces, so they vanish at runtime and no `Object.keys` check can
 * see them: the `@ts-expect-error` lines below are the real assertion. They are
 * a compile-time failure (TS2578 "unused '@ts-expect-error' directive") the
 * moment either type is re-exported from the barrel, which fails this file's
 * type-check leg — `npm run lint` / the Angular build, not the vitest run.
 */
// @ts-expect-error — RichTextCustomToolbarItem was removed from the public API.
import type { RichTextCustomToolbarItem } from './index';
// @ts-expect-error — RichTextEditorRef was removed from the public API.
import type { RichTextEditorRef } from './index';

type _RemovedCustomItem = RichTextCustomToolbarItem;
type _RemovedEditorRef = RichTextEditorRef;

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
});
