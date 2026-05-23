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

/**
 * Persistent class assigned to each item by index. Re-evaluated whenever
 * `items()` changes; the resulting class is added to the item's wrapper.
 * Consumers supply their own CSS (e.g., `.is-first { background: green }`).
 */
export type SortablePositionClassFn<T> = (
    item: T,
    index: number,
    total: number,
    listId: string,
) => string;

/**
 * Transient class added to the landed item after a successful reorder.
 * Returned class is applied to the wrapper and removed after the animate
 * duration. Return `null` to skip the effect for a particular drop.
 */
export type SortableLandEffectFn<T> = (
    item: T,
    from: SortableLocation,
    to: SortableLocation,
) => string | null;

/** Identity function for `@for ... track`. Returns a key stable per item. */
export type SortableTrackByFn<T> = (item: T, index: number) => unknown;

/**
 * Predicate that decides whether a foreign item may drop into this list.
 * Receivers may return `true`, `false`, or a `{ ok, reason? }` object so
 * sortable can surface the reason as a `data-reject` attribute that
 * consumer CSS can pick up.
 */
export type SortableAccepts<T> =
    | boolean
    | ((
        item: T,
        ctx: { readonly fromListId: string; readonly toListId: string; readonly toIndex: number },
    ) => boolean | { readonly ok: boolean; readonly reason?: string });

/** Payload emitted by `(dropRejected)` when accepts() refused a drop. */
export interface SortableDropRejectedEvent<T> {
    readonly item: T;
    readonly fromListId: string;
    readonly toListId: string;
    readonly toIndex: number;
    readonly reason: string | null;
}

/** Payload emitted by `(itemEnter)` / `(itemLeave)` on the receiving list. */
export interface SortableForeignHoverEvent<T> {
    readonly item: T;
    readonly fromListId: string;
}
