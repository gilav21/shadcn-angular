/**
 * Public types for `ui-sortable`. Kept in a dedicated file so consumers can
 * import them without pulling in the component's runtime imports.
 *
 * The `SortableLandEffect` and `SORTABLE_LAND_EFFECTS` constants live in
 * `sortable.component.ts` because they are bound to the matching CSS in
 * `sub/sortable-item.component.css` and feel more at home next to the
 * component definition. They are re-exported from the barrel.
 */

/** Layout axis the sortable lays its items along. */
export type SortableOrientation = 'vertical' | 'horizontal';

/** Endpoint of a reorder — the list and the position within that list. */
export interface SortableLocation {
    /** Stable identifier of the sortable list (assigned via `[listId]` or auto-generated). */
    readonly listId: string;
    /** Zero-based position within the list at the moment the reorder commits. */
    readonly index: number;
}

/**
 * Payload emitted by `(reorder)` when an item changes position — within a
 * single list or across two peers in the same group.
 */
export interface SortableReorderEvent<T> {
    /** Where the item came from. For a single-list reorder, `from.listId === to.listId`. */
    readonly from: SortableLocation;
    /** Where the item landed. */
    readonly to: SortableLocation;
    /** The item itself, by reference. */
    readonly item: T;
}

/** Template context shared by `uiSortableItem`, `uiSortableGhost`, `uiSortablePlaceholder`. */
export interface SortableContext<T> {
    readonly $implicit: T;
    readonly index: number;
}
