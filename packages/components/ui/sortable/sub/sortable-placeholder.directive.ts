import { Directive } from '@angular/core';

/**
 * Marker directive placed on the `<ng-template>` that renders a custom
 * placeholder ("silhouette") shown at the lift origin while an item is
 * being dragged inside `<ui-sortable>`.
 *
 * Template context: `{ $implicit: T, index: number }` where `$implicit`
 * is the lifted item and `index` is its original position in the list.
 *
 * Usage:
 *   <ui-sortable [(items)]="rows">
 *     <ng-template uiSortableItem let-row let-i="index">…</ng-template>
 *     <ng-template uiSortablePlaceholder let-row>
 *       <div class="opacity-30 border-dashed border-2 rounded h-10"></div>
 *     </ng-template>
 *   </ui-sortable>
 */
@Directive({
    selector: '[uiSortablePlaceholder]',
    standalone: true,
})
export class SortablePlaceholderTemplateDirective {
    static ngTemplateContextGuard<T>(
        _dir: SortablePlaceholderTemplateDirective,
        _ctx: unknown,
    ): _ctx is { readonly $implicit: T; readonly index: number } {
        return true;
    }
}
