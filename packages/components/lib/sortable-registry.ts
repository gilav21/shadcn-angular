/**
 * Group registry for cross-list drag-and-drop between sortable instances.
 *
 * Sortable lists that share a `group` string can drop items into each
 * other. The registry is module-scoped (one shared instance per JS bundle)
 * and decoupled from any specific component class — anything that
 * implements `SortableRegistryEntry` can participate, which lets kanban
 * columns and other future consumers join the same group as a plain
 * `<ui-sortable>` without inheriting from it.
 *
 * Each entry registers in its constructor / OnInit and unregisters in
 * `destroyRef.onDestroy`. The registry surface is intentionally small:
 *
 *   - `registerSortable(entry)` adds the entry and returns an unsubscribe.
 *   - `peersInGroup(group, exclude?)` returns siblings; DOM order is NOT
 *     guaranteed — the source list hit-tests them by `entry.element`'s
 *     bounding rect each frame.
 *   - `groupSize(group)` is exposed for testing and diagnostics only.
 *   - `clearRegistry()` resets all state — testing only.
 *
 * Source-side flow during a cross-list drag:
 *   1. Get `peersInGroup(group, self)`.
 *   2. For each peer, check `peer.element.getBoundingClientRect()`
 *      against the pointer to find the hover target.
 *   3. When hover changes, call `oldHover.onForeignLeave()` then
 *      `newHover.onForeignEnter(item, sourceListId)`.
 *   4. Compute drop index from `newHover.getItemRects()`.
 *   5. On release, call `newHover.canAccept(item, ctx)` — if ok,
 *      `self.removeItem(item)` and `newHover.receiveItem(item, atIndex)`.
 */

export type AcceptResult = boolean | { readonly ok: boolean; readonly reason?: string };

export interface ForeignDropContext {
    readonly fromListId: string;
    readonly toIndex: number;
}

export interface SortableRegistryEntry {
    /** Stable identifier — appears in reorder/itemEnter/itemLeave payloads. */
    readonly listId: string;

    /** Group key — peers share the same string to be linked. */
    readonly group: string;

    /** Container element used for pointer hit-testing by source lists. */
    readonly element: HTMLElement;

    /** Layout axis — receiving list uses this to render its own indicator. */
    readonly orientation: 'vertical' | 'horizontal';

    /** Item-wrapper rects in DOM order; the source list uses these to compute the drop index. */
    getItemRects(): DOMRect[];

    /** Predicate gate; receiver decides whether a foreign item may drop here. */
    canAccept(item: unknown, ctx: ForeignDropContext): AcceptResult;

    /** Show "a foreign item is hovering" affordance (e.g. drop-zone highlight). */
    onForeignEnter(item: unknown, fromListId: string): void;

    /** Clear the foreign-hovering affordance. */
    onForeignLeave(): void;

    /**
     * Live-update the receiving list's reject visual. Passed by the source on
     * every hover so the receiver can re-evaluate accepts as the target index
     * shifts. Pass `null` to clear (accepted).
     */
    setRejectReason(reason: string | null): void;

    /** Commit: insert a foreign item at `atIndex` (caller has already validated `canAccept`). */
    receiveItem(item: unknown, atIndex: number): void;

    /** Source-side commit: remove the item from this list by reference. */
    removeItem(item: unknown): void;
}

const groups = new Map<string, Set<SortableRegistryEntry>>();

/** Add an entry to its group. Returns an unsubscribe; safe to call multiple times. */
export function registerSortable(entry: SortableRegistryEntry): () => void {
    let bucket = groups.get(entry.group);
    if (bucket === undefined) {
        bucket = new Set<SortableRegistryEntry>();
        groups.set(entry.group, bucket);
    }
    bucket.add(entry);

    let unsubscribed = false;
    return (): void => {
        if (unsubscribed) return;
        unsubscribed = true;
        const current = groups.get(entry.group);
        if (current === undefined) return;
        current.delete(entry);
        if (current.size === 0) groups.delete(entry.group);
    };
}

/** Snapshot of peers in `group`, optionally excluding one entry (typically `self`). */
export function peersInGroup(
    group: string,
    exclude?: SortableRegistryEntry,
): SortableRegistryEntry[] {
    const bucket = groups.get(group);
    if (bucket === undefined) return [];
    if (exclude === undefined) return Array.from(bucket);
    const out: SortableRegistryEntry[] = [];
    for (const entry of bucket) {
        if (entry !== exclude) out.push(entry);
    }
    return out;
}

/** Number of entries currently registered under `group`. Diagnostics / testing only. */
export function groupSize(group: string): number {
    return groups.get(group)?.size ?? 0;
}

/** Reset the entire registry. Testing only. */
export function clearRegistry(): void {
    groups.clear();
}
