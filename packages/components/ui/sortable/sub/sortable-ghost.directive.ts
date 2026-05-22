import { Directive } from '@angular/core';

/**
 * Marker directive placed on the `<ng-template>` that renders a custom
 * drop-target preview ("ghost") inside `<ui-sortable>`.
 *
 * Template context: `{ $implicit: T, index: number }` where `$implicit`
 * is the dragged item and `index` is the gap index it would land at.
 *
 * Usage:
 *   <ui-sortable [(items)]="rows">
 *     <ng-template uiSortableItem let-row let-i="index">…</ng-template>
 *     <ng-template uiSortableGhost let-row let-i="index">
 *       <div class="opacity-50 border-2 border-primary rounded">Drop here</div>
 *     </ng-template>
 *   </ui-sortable>
 */
@Directive({
    selector: '[uiSortableGhost]',
    standalone: true,
})
export class SortableGhostTemplateDirective {
    static ngTemplateContextGuard<T>(
        _dir: SortableGhostTemplateDirective,
        ctx: unknown,
    ): ctx is { readonly $implicit: T; readonly index: number } {
        return true;
    }
}
