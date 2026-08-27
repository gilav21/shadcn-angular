import type { CanvasItemContext } from './infinite-canvas-item.directive';
import type { CanvasItemView, CanvasItemViewPool } from './infinite-canvas.item-pool';
import { SpatialHash } from './infinite-canvas.spatial-hash';
import { boundsOf, inflateRect, rectContains } from './infinite-canvas.transform';
import type { CanvasItem, CanvasRect } from './infinite-canvas.types';

/**
 * Culling + DOM virtualization for canvas items.
 *
 * Owns the spatial index, decides which items are visible, and drives the view
 * pool to mount/unmount them. Kept out of the component so it can be unit
 * tested on its own and so the component's hot path stays readable.
 *
 * ### Overscan hysteresis
 *
 * Items are mounted for the viewport rect **inflated by the overscan margin**,
 * and that inflated rect is remembered as the `safeRect`. Re-culling happens
 * only once the bare viewport rect stops fitting inside `safeRect`. Panning
 * therefore re-queries a few times per second rather than every frame, and
 * zooming in place never re-queries at all — which is exactly what keeps the
 * one signal-free frame budget intact.
 */

interface MountedItem<T extends CanvasItem> {
  item: T;
  index: number;
  view: CanvasItemView<CanvasItemContext<T>>;
}

/** Cell size relative to the median item size, per the spatial-hash rationale. */
const CELL_SIZE_FACTOR = 2;
const FALLBACK_CELL_SIZE = 256;

export class CanvasItemLayer<T extends CanvasItem> {
  private readonly mounted = new Map<string | number, MountedItem<T>>();
  private readonly indexById = new Map<string | number, number>();

  private hash = new SpatialHash<T>(FALLBACK_CELL_SIZE);
  private items: readonly T[] = [];
  private safeRect: CanvasRect | null = null;
  private cellSize = FALLBACK_CELL_SIZE;

  constructor(private readonly pool: CanvasItemViewPool<CanvasItemContext<T>>) {}

  /** Items currently instantiated in the DOM. */
  get mountedCount(): number {
    return this.mounted.size;
  }

  /** Items known to the index, visible or not. */
  get itemCount(): number {
    return this.hash.size;
  }

  /**
   * Replaces the whole item set and forces the next update to re-cull.
   *
   * The cell size is recomputed from the new items rather than fixed at
   * construction, so swapping in a set with a very different item scale does
   * not leave the index tuned for the old one.
   */
  setItems(items: readonly T[]): void {
    if (this.tryMoveOnly(items)) return;

    this.items = items;
    this.indexById.clear();
    items.forEach((item, index) => this.indexById.set(item.id, index));

    const cellSize = CanvasItemLayer.cellSizeFor(items);
    if (cellSize !== this.cellSize) {
      this.cellSize = cellSize;
      this.hash = new SpatialHash<T>(cellSize);
    }
    this.hash.rebuild(items);
    this.invalidate();
  }

  /**
   * The drag frame: same items, same order, a few of them moved.
   *
   * Dragging a node hands us an array in which every untouched item is the
   * SAME OBJECT as before — the editor rebuilds only what it moved — so an
   * identity walk finds exactly the moved ones without reading a coordinate.
   * Those go through `SpatialHash.move`, which re-buckets only if the item
   * actually left its cells and is otherwise free.
   *
   * The full path it skips costs a cleared index, N re-inserts, and an
   * O(N log N) sort inside `cellSizeFor` — 53ms at 100,000 items, to relocate
   * one node by three pixels.
   *
   * Returns false for anything structural (a different length, or an id that
   * moved position in the array), which falls through to the full rebuild.
   *
   * The cell size is deliberately NOT retuned here. It is a tuning parameter:
   * a stale one costs query speed and can never cost correctness, and any
   * change to the item COUNT takes the full path and retunes it there.
   */
  private tryMoveOnly(items: readonly T[]): boolean {
    const previous = this.items;
    if (previous.length === 0 || previous.length !== items.length) return false;

    const moved: T[] = [];
    for (let i = 0; i < items.length; i++) {
      const before = previous[i];
      const after = items[i];
      if (before === after) continue;
      if (before.id !== after.id) return false;
      moved.push(after);
    }

    this.items = items;
    for (const item of moved) this.hash.move(item);
    if (moved.length > 0) this.invalidate();
    return true;
  }

  /** Forgets the hysteresis window so the next {@link update} re-queries. */
  invalidate(): void {
    this.safeRect = null;
  }

  /**
   * Mounts/unmounts item views for `viewRect`, honouring the overscan margin.
   *
   * Returns whether a cull pass actually ran. Most frames it returns `false`
   * immediately because the viewport is still inside the hysteresis window,
   * which is the whole point: culling is viewport-crossing work, not per-frame
   * work.
   */
  update(viewRect: CanvasRect, overscan: number): boolean {
    if (this.safeRect && rectContains(this.safeRect, viewRect)) return false;

    this.safeRect = inflateRect(viewRect, overscan);

    const visible = this.hash.query(this.safeRect);
    const keep = new Set<string | number>(visible.map(item => item.id));

    // Release BEFORE mounting. Mounting first would drain an empty pool and
    // allocate a fresh view for every item scrolling in, while the views
    // scrolling out were freed a moment too late to be reused — recycling
    // would never happen on a pan, which is the one case it exists for.
    const stale: (string | number)[] = [];
    for (const [id, entry] of this.mounted) {
      if (keep.has(id)) continue;
      this.pool.release(entry.view);
      stale.push(id);
    }
    for (const id of stale) this.mounted.delete(id);

    for (const item of visible) this.mount(item);
    return true;
  }

  /** Topmost item under a world point, or `null`. Later items win, as in paint order. */
  hitTest(x: number, y: number): T | null {
    const candidates = this.hash.queryPoint(x, y);
    if (candidates.length === 0) return null;

    let best = candidates[0];
    let bestIndex = this.indexById.get(best.id) ?? -1;
    for (const candidate of candidates) {
      const index = this.indexById.get(candidate.id) ?? -1;
      if (index > bestIndex) {
        best = candidate;
        bestIndex = index;
      }
    }
    return best;
  }

  /** World bounds of every item, or `null` when there are none. */
  bounds(): CanvasRect | null {
    return boundsOf(this.items);
  }

  /** Unmounts everything and drops the index. */
  clear(): void {
    for (const entry of this.mounted.values()) this.pool.release(entry.view);
    this.mounted.clear();
    this.hash.clear();
    this.indexById.clear();
    this.items = [];
    this.safeRect = null;
  }

  /** A cell size of roughly 2x the median item size, per the design rationale. */
  static cellSizeFor(items: readonly CanvasItem[]): number {
    if (items.length === 0) return FALLBACK_CELL_SIZE;

    const spans = items.map(item => Math.max(item.width, item.height)).sort((a, b) => a - b);
    const median = spans[Math.floor(spans.length / 2)];
    return median > 0 ? median * CELL_SIZE_FACTOR : FALLBACK_CELL_SIZE;
  }

  private mount(item: T): void {
    const index = this.indexById.get(item.id) ?? 0;
    const existing = this.mounted.get(item.id);

    if (existing) {
      this.position(existing.view, item);
      if (existing.item === item && existing.index === index) return;
      existing.item = item;
      existing.index = index;
      this.applyContext(existing);
      return;
    }

    const view = this.pool.acquire();
    const entry: MountedItem<T> = { item, index, view };
    this.mounted.set(item.id, entry);
    this.position(view, item);
    this.applyContext(entry);
  }

  private applyContext(entry: MountedItem<T>): void {
    entry.view.view.context.$implicit = entry.item;
    entry.view.view.context.index = entry.index;
    this.pool.render(entry.view);
  }

  /**
   * Positions a host at world coordinates with a `translate` rather than
   * `left`/`top`: it is a compositor-only change and never triggers layout.
   */
  private position(view: CanvasItemView<CanvasItemContext<T>>, item: T): void {
    const style = view.host.style;
    style.transform = `translate(${item.x}px, ${item.y}px)`;
    style.width = `${item.width}px`;
    style.height = `${item.height}px`;
  }
}
