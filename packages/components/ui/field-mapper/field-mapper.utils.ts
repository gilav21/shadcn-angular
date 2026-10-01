import type { FieldMapperItem, FieldMapperLink, FieldMapperMaxLinks } from './field-mapper.types';

/** The outcome of one edit to the links: the new list and what it took out and put in. */
export interface FieldMapperLinkChange {
    readonly links: readonly FieldMapperLink[];
    readonly added: FieldMapperLink | null;
    readonly removed: readonly FieldMapperLink[];
}

/** Resolved per-side limits. */
export interface FieldMapperLimits {
    readonly start: number;
    readonly end: number;
}

/** Whether two links join the same pair of items. */
export function sameLink(a: FieldMapperLink, b: FieldMapperLink): boolean {
    return a.startId === b.startId && a.endId === b.endId;
}

function clampLimit(value: number | undefined): number {
    if (value === undefined || Number.isNaN(value)) return 1;
    return Math.max(1, value);
}

/** Fills in the default of 1 for a missing side; a limit below 1 is read as 1. */
export function resolveMaxLinks(max: FieldMapperMaxLinks | null | undefined): FieldMapperLimits {
    return { start: clampLimit(max?.start), end: clampLimit(max?.end) };
}

/**
 * Drops the oldest links that `belongs` matches until one more fits under
 * `limit`. Array order is age order: links are only ever appended.
 */
function evictOldest(
    links: readonly FieldMapperLink[],
    belongs: (link: FieldMapperLink) => boolean,
    limit: number,
    removed: FieldMapperLink[],
): FieldMapperLink[] {
    let excess = links.filter(belongs).length - limit + 1;
    const kept: FieldMapperLink[] = [];
    for (const link of links) {
        if (excess > 0 && belongs(link)) {
            removed.push(link);
            excess--;
        } else {
            kept.push(link);
        }
    }
    return kept;
}

/**
 * Adds `link`, moving rather than doubling up: when either item is already at
 * its limit, that item's oldest link is removed to make room. Adding a link
 * that already exists changes nothing.
 */
export function addLink(
    links: readonly FieldMapperLink[],
    link: FieldMapperLink,
    limits: FieldMapperLimits,
): FieldMapperLinkChange {
    if (links.some(existing => sameLink(existing, link))) {
        return { links, added: null, removed: [] };
    }
    const removed: FieldMapperLink[] = [];
    const afterStart = evictOldest(links, l => l.startId === link.startId, limits.start, removed);
    const afterEnd = evictOldest(afterStart, l => l.endId === link.endId, limits.end, removed);
    return { links: [...afterEnd, { startId: link.startId, endId: link.endId }], added: link, removed };
}

/** Removes every link `matches` selects. */
export function removeLinks(
    links: readonly FieldMapperLink[],
    matches: (link: FieldMapperLink) => boolean,
): FieldMapperLinkChange {
    const removed = links.filter(matches);
    if (removed.length === 0) return { links, added: null, removed };
    return { links: links.filter(link => !matches(link)), added: null, removed };
}

/** Items whose label contains `query`, ignoring case. An empty query keeps everything. */
export function filterItems(items: readonly FieldMapperItem[], query: string): readonly FieldMapperItem[] {
    const needle = query.trim().toLocaleLowerCase();
    if (needle === '') return items;
    return items.filter(item => item.label.toLocaleLowerCase().includes(needle));
}

/** Row of each end item's highest visible partner, keyed by end id. */
function partnerRows(
    start: readonly FieldMapperItem[],
    links: readonly FieldMapperLink[],
): Map<string, number> {
    const startRow = new Map(start.map((item, index) => [item.id, index]));
    const rows = new Map<string, number>();
    for (const link of links) {
        const row = startRow.get(link.startId);
        if (row === undefined) continue;
        const current = rows.get(link.endId);
        if (current === undefined || row < current) rows.set(link.endId, row);
    }
    return rows;
}

/**
 * Orders the end list so each linked item sits on the same row as its
 * (highest) start partner, which is what lets a line run straight across.
 *
 * Unlinked end items keep their original order and take the rows nobody
 * linked claimed, top first, then any rows past the end. A row can stay empty
 * (`null`) when a linked item had to sit further down than the unlinked ones
 * could fill. When two end items want the same row — one start item linked to
 * several — the later one takes the next free row below.
 */
export function alignEndRows(
    start: readonly FieldMapperItem[],
    end: readonly FieldMapperItem[],
    links: readonly FieldMapperLink[],
): (FieldMapperItem | null)[] {
    const desired = partnerRows(start, links);
    const linked = end
        .filter(item => desired.has(item.id))
        .sort((a, b) => (desired.get(a.id) ?? 0) - (desired.get(b.id) ?? 0));
    const unlinked = end.filter(item => !desired.has(item.id));

    const slots = new Map<number, FieldMapperItem>();
    let cursor = 0;
    for (const item of linked) {
        const row = Math.max(desired.get(item.id) ?? 0, cursor);
        slots.set(row, item);
        cursor = row + 1;
    }

    const rows: (FieldMapperItem | null)[] = [];
    let next = 0;
    for (let row = 0; row < cursor; row++) {
        const placed = slots.get(row) ?? unlinked[next++] ?? null;
        rows.push(placed);
    }
    for (const item of unlinked.slice(next)) rows.push(item);
    return rows;
}

/**
 * An S-curve from one handle to the other: control points sit halfway across
 * at each end's own height, so a level pair draws a straight line and the
 * curve's midpoint is exactly the midpoint of the two ends.
 */
export function linkPath(x1: number, y1: number, x2: number, y2: number): string {
    const mid = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${mid} ${y1} ${mid} ${y2} ${x2} ${y2}`;
}

/**
 * The id to focus after a navigation key, over `ids` in visual order.
 * Returns `null` for a key that does not navigate.
 */
export function navigate(ids: readonly string[], current: string | null, key: string): string | null {
    if (ids.length === 0) return null;
    const index = current === null ? -1 : ids.indexOf(current);
    switch (key) {
        case 'ArrowDown':
            return ids[Math.min(index + 1, ids.length - 1)];
        case 'ArrowUp':
            return ids[Math.max(index - 1, 0)];
        case 'Home':
            return ids[0];
        case 'End':
            return ids.at(-1) ?? null;
        default:
            return null;
    }
}
