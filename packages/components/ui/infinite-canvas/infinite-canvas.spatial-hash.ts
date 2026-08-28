import type { CanvasRect } from './infinite-canvas.types';

/**
 * A uniform spatial hash over the infinite plane.
 *
 * Chosen over a quadtree deliberately: items move constantly (drags, layout),
 * and a quadtree pays a restructuring cost on **every** move that a hash grid
 * does not. Insert, move and remove are O(1) with no rebalancing, and a query
 * costs O(cells overlapping the rect + items in them) — that is, O(visible).
 *
 * A quadtree's one advantage is adapting to non-uniform density, which does not
 * pay for itself here because item sizes in an editor are broadly uniform by
 * construction.
 *
 * Pick `cellSize` at roughly 2x the median item size: too small and large items
 * are registered in many buckets, too large and every query degenerates towards
 * a linear scan.
 */

/** The minimum shape the hash needs: an identity and a world-space box. */
export interface SpatialItem {
  id: string | number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Registration<T> {
  item: T;
  keys: string[];
}

export class SpatialHash<T extends SpatialItem> {
  private readonly cells = new Map<string, Set<T>>();
  private readonly registry = new Map<string | number, Registration<T>>();

  constructor(private readonly cellSize: number = 256) {
    if (cellSize <= 0 || !Number.isFinite(cellSize)) {
      throw new Error(`SpatialHash cellSize must be a positive finite number, got ${cellSize}`);
    }
  }

  /** Number of indexed items. */
  get size(): number {
    return this.registry.size;
  }

  /** Number of occupied buckets. Exposed so tests can prove buckets are freed. */
  get cellCount(): number {
    return this.cells.size;
  }

  /** Indexes an item, replacing any previous entry with the same id. */
  insert(item: T): void {
    this.remove(item.id);

    const keys = this.keysFor(item);
    for (const key of keys) {
      let bucket = this.cells.get(key);
      if (!bucket) {
        bucket = new Set<T>();
        this.cells.set(key, bucket);
      }
      bucket.add(item);
    }
    this.registry.set(item.id, { item, keys });
  }

  /**
   * Re-indexes an item after its box changed. Bails out early when the item
   * still occupies exactly the same cells, which is the common case during a
   * drag and makes a move genuinely free most frames.
   */
  move(item: T): void {
    const existing = this.registry.get(item.id);
    if (!existing) {
      this.insert(item);
      return;
    }

    const keys = this.keysFor(item);
    if (sameKeys(existing.keys, keys)) {
      for (const key of keys) {
        const bucket = this.cells.get(key);
        if (!bucket) continue;
        bucket.delete(existing.item);
        bucket.add(item);
      }
      existing.item = item;
      return;
    }
    this.insert(item);
  }

  /** Removes an item by id. Returns whether anything was removed. */
  remove(id: string | number): boolean {
    const existing = this.registry.get(id);
    if (!existing) return false;

    for (const key of existing.keys) {
      const bucket = this.cells.get(key);
      if (!bucket) continue;
      bucket.delete(existing.item);
      if (bucket.size === 0) this.cells.delete(key);
    }
    this.registry.delete(id);
    return true;
  }

  /** Drops every item and bucket. */
  clear(): void {
    this.cells.clear();
    this.registry.clear();
  }

  /** Clears and re-indexes from scratch. */
  rebuild(items: Iterable<T>): void {
    this.clear();
    for (const item of items) this.insert(item);
  }

  /**
   * Every indexed item whose box intersects `rect`, each returned once.
   *
   * Iterating cells costs O(area / cellSize^2), which is the right trade for a
   * viewport-sized rect but catastrophic for a very large one — a fully
   * zoomed-out viewport, or a query over an empty index, would otherwise walk
   * billions of empty buckets. So when the rect spans more cells than there are
   * indexed items, this falls back to a linear scan, which is strictly cheaper.
   * Either way the work is bounded by `min(cells, items)`.
   */
  query(rect: CanvasRect): T[] {
    const minX = Math.floor(rect.x / this.cellSize);
    const minY = Math.floor(rect.y / this.cellSize);
    const maxX = Math.floor((rect.x + rect.width) / this.cellSize);
    const maxY = Math.floor((rect.y + rect.height) / this.cellSize);

    const spannedCells = (maxX - minX + 1) * (maxY - minY + 1);
    if (spannedCells > this.registry.size) return this.linearQuery(rect);

    const found: T[] = [];
    const seen = new Set<T>();

    for (let cy = minY; cy <= maxY; cy++) {
      for (let cx = minX; cx <= maxX; cx++) {
        this.collectCell(`${cx},${cy}`, rect, seen, found);
      }
    }
    return found;
  }

  /** Appends a bucket's not-yet-seen, intersecting items to `found`. */
  private collectCell(key: string, rect: CanvasRect, seen: Set<T>, found: T[]): void {
    const bucket = this.cells.get(key);
    if (!bucket) return;

    for (const item of bucket) {
      if (seen.has(item)) continue;
      seen.add(item);
      if (intersects(item, rect)) found.push(item);
    }
  }

  /** Fallback for query rects that span more cells than the index holds items. */
  private linearQuery(rect: CanvasRect): T[] {
    const found: T[] = [];
    for (const { item } of this.registry.values()) {
      if (intersects(item, rect)) found.push(item);
    }
    return found;
  }

  /** Every indexed item whose box contains the world point. */
  queryPoint(x: number, y: number): T[] {
    return this.query({ x, y, width: 0, height: 0 });
  }

  /** The bucket keys an item's box touches. */
  private keysFor(item: SpatialItem): string[] {
    const minX = Math.floor(item.x / this.cellSize);
    const minY = Math.floor(item.y / this.cellSize);
    const maxX = Math.floor((item.x + item.width) / this.cellSize);
    const maxY = Math.floor((item.y + item.height) / this.cellSize);

    /*
     * A box that is not a box gets no cells.
     *
     * `for (cx = minX; cx <= maxX; cx++)` against an infinite or NaN bound
     * never terminates, and it allocates a string every turn — one item with
     * `width: Infinity`, or an `x` that arrived as NaN from a malformed
     * document, hangs the tab and then exhausts memory. This is consumer data:
     * the index is rebuilt from whatever array is handed to `setItems`.
     *
     * Registering nothing is the right answer rather than a thrown error. The
     * item keeps its place in the list and still renders; it is only absent
     * from spatial QUERIES, so it cannot be culled into view or hit-tested —
     * which is the honest outcome for a shape with no position.
     *
     * `query` already guards its own loop this way, bailing to a linear scan
     * when a rect spans more cells than the index holds items. This loop had
     * no such guard.
     */
    if (!Number.isFinite(minX) || !Number.isFinite(minY)) return [];
    if (!Number.isFinite(maxX) || !Number.isFinite(maxY)) return [];

    const keys: string[] = [];
    for (let cy = minY; cy <= maxY; cy++) {
      for (let cx = minX; cx <= maxX; cx++) keys.push(`${cx},${cy}`);
    }
    return keys;
  }
}

/** Edge-touching counts as intersecting, matching the transform helpers. */
function intersects(item: SpatialItem, rect: CanvasRect): boolean {
  return (
    item.x <= rect.x + rect.width &&
    rect.x <= item.x + item.width &&
    item.y <= rect.y + rect.height &&
    rect.y <= item.y + item.height
  );
}

function sameKeys(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
