import { describe, it, expect } from 'vitest';
import { SortableGhostTemplateDirective } from './sortable-ghost.directive';
import { SortablePlaceholderTemplateDirective } from './sortable-placeholder.directive';

describe('Sortable template-marker directives', () => {
    it('SortableGhostTemplateDirective exposes a passthrough ngTemplateContextGuard', () => {
        const guard = SortableGhostTemplateDirective.ngTemplateContextGuard;
        expect(typeof guard).toBe('function');
        expect(guard({} as SortableGhostTemplateDirective, { $implicit: { id: 1 }, index: 0 })).toBe(true);
        expect(guard({} as SortableGhostTemplateDirective, null)).toBe(true);
    });

    it('SortablePlaceholderTemplateDirective exposes a passthrough ngTemplateContextGuard', () => {
        const guard = SortablePlaceholderTemplateDirective.ngTemplateContextGuard;
        expect(typeof guard).toBe('function');
        expect(guard({} as SortablePlaceholderTemplateDirective, { $implicit: 'x', index: 2 })).toBe(true);
    });

    it('directives are decorated as standalone with the expected selectors', () => {
        const ghostMeta = (SortableGhostTemplateDirective as unknown as {
            ɵdir: { standalone: boolean; selectors: unknown[][] };
        }).ɵdir;
        const placeholderMeta = (SortablePlaceholderTemplateDirective as unknown as {
            ɵdir: { standalone: boolean; selectors: unknown[][] };
        }).ɵdir;
        expect(ghostMeta.standalone).toBe(true);
        expect(placeholderMeta.standalone).toBe(true);
        const ghostAttr = ghostMeta.selectors.flat();
        const placeholderAttr = placeholderMeta.selectors.flat();
        expect(ghostAttr).toContain('uiSortableGhost');
        expect(placeholderAttr).toContain('uiSortablePlaceholder');
    });
});
