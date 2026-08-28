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

/**
 * Most item views mounted at once, however many are in view.
 *
 * Culling bounds the mounted set by the VIEWPORT, which is the right rule
 * until someone zooms out: the world rect then covers the whole board, every
 * item is "visible", and the layer dutifully mounts a real component for each.
 * A 100,000-node graph zoomed out mounted 2,022 cards and froze the tab; one
 * more zoom step out froze it outright.
 *
 * At that zoom a card is a few pixels of illegible smudge, so the ones beyond
 * this cap were never readable. The edges still draw — they are canvas, not
 * DOM — so the shape of the graph is unaffected by the cap.
 */
export const DEFAULT_MAX_MOUNTED = 600;


export class CanvasItemLayer<T extends CanvasItem> {
  private readonly mounted = new Map<string | number, MountedItem<T>>();
  private readonly indexById = new Map<string | number, number>();
  /**
   * The items themselves, by id.
   *
   * Kept here because the edge renderer needs exactly this and was building
   * its own copy on every call - a fresh hundred-thousand-entry Map per drag
   * frame, discarded immediately. Maintained rather than rebuilt: the drag
   * fast path below writes only the items that actually moved.
   */
  private readonly byId = new Map<string | number, T>();

  private hash = new SpatialHash<T>(FALLBACK_CELL_SIZE);
  private items: readonly T[] = [];
  private safeRect: CanvasRect | null = null;
  private cellSize = FALLBACK_CELL_SIZE;
  /** Area of the box containing every item, for estimating items per unit. */
  private worldArea = 0;

  constructor(
    private readonly pool: CanvasItemViewPool<CanvasItemContext<T>>,
    private readonly maxMounted: number = DEFAULT_MAX_MOUNTED,
  ) {}

  /** Items currently instantiated in the DOM. */
  get mountedCount(): number {
    return this.mounted.size;
  }

  /** Items known to the index, visible or not. */
  get itemCount(): number {
    return this.hash.size;
  }

  /** The items by id, for a consumer that needs to resolve one. */
  get itemsById(): ReadonlyMap<string | number, T> {
    return this.byId;
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
    this.byId.clear();
    items.forEach((item, index) => {
      this.indexById.set(item.id, index);
      this.byId.set(item.id, item);
    });

    const cellSize = CanvasItemLayer.cellSizeFor(items);
    if (cellSize !== this.cellSize) {
      this.cellSize = cellSize;
      this.hash = new SpatialHash<T>(cellSize);
    }
    this.hash.rebuild(items);
    const bounds = boundsOf(items);
    this.worldArea = bounds ? Math.max(1, bounds.width * bounds.height) : 0;
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
   * **Items must be replaced, never mutated in place.** An item edited through
   * its existing object reference is invisible here — identity is unchanged,
   * so nothing looks moved and the index keeps the old box. That requirement
   * is not new to this method: the engine already returns the SAME array from
   * `withMaterializedTypes` when nothing changed, and `mount` skips a view
   * whose item is referentially equal, so a mutated item was already a stale
   * card before it was a stale bucket. It is written down here because this is
   * the first place where breaking it costs correctness rather than a wasted
   * repaint.
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
    for (const item of moved) {
      this.hash.move(item);
      this.byId.set(item.id, item);
    }
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
    /*
     * The hysteresis holds only while `safeRect` describes what is MOUNTED.
     *
     * Filtering a query's RESULTS quietly broke that sentence, and the bug it
     * caused was worse than the one it fixed: `safeRect` stayed the whole
     * inflated viewport while only a few hundred of its items were mounted, so
     * panning and zooming inside it never re-queried and the cards from
     * wherever you started stayed on screen while everything you moved towards
     * never appeared.
     *
     * Bounding the REGION instead makes the sentence true again — the rect is
     * exactly what was mounted for — and the check below then needs no special
     * case for a capped view, because there is nothing special about one.
     */
    const region = this.affordable(inflateRect(viewRect, overscan), viewRect);
    if (this.safeRect && rectContains(this.safeRect, viewRect)) return false;

    this.safeRect = region;

    const found = this.hash.query(region);
    if (found.length <= this.maxMounted) {
      this.mountExactly(found);
      return true;
    }

    /*
     * The region was shrunk and STILL holds too many - a board dense in one
     * spot and empty around it, where the even-density estimate does not hold.
     * Slicing is the only way to stay under the cap, and it re-breaks the
     * sentence `safeRect` is supposed to mean: the rect would describe more
     * than was mounted, which is exactly the stranding bug. So the hysteresis
     * is given up here rather than allowed to lie, and the next frame re-culls.
     * The query is bounded by the region, so paying for it every frame is the
     * cheap half of this trade.
     */
    this.safeRect = null;
    this.mountExactly(this.nearestToCentre(found, viewRect));
    return true;
  }

  /**
   * The `maxMounted` items closest to the middle of the screen.
   *
   * Taking the first `maxMounted` the index happened to return took them in
   * bucket order, which is row-major — so the cap was spent on the top of the
   * screen and the whole bottom band went blank, with the edges still drawn
   * into it. Which cards are dropped should depend on where the user is
   * looking, not on the iteration order of a hash.
   *
   * Selected, not sorted. This branch gives up the hysteresis on purpose, so
   * it runs on EVERY frame — and the honest answer to "which six hundred of
   * these hundred thousand" is not to copy all hundred thousand and order
   * them completely. Sorting cost 1.7 million comparisons with a square root
   * inside each; keeping the best `cap` in a heap costs one pass and a
   * comparison against the worst kept so far, which almost always fails.
   * Distances stay SQUARED: monotonic in distance, and no square root.
   */
  private nearestToCentre(found: readonly T[], viewRect: CanvasRect): readonly T[] {
    return nearestTo(
      found,
      this.maxMounted,
      viewRect.x + viewRect.width / 2,
      viewRect.y + viewRect.height / 2,
    );
  }

  /**
   * Makes the mounted set exactly `visible`.
   *
   * Release BEFORE mounting. Mounting first would drain an empty pool and
   * allocate a fresh view for every item scrolling in, while the views
   * scrolling out were freed a moment too late to be reused — recycling would
   * never happen on a pan, which is the one case it exists for.
   */
  private mountExactly(visible: readonly T[]): void {
    const keep = new Set<string | number>(visible.map(item => item.id));

    const stale: (string | number)[] = [];
    for (const [id, entry] of this.mounted) {
      if (keep.has(id)) continue;
      this.pool.release(entry.view);
      stale.push(id);
    }
    for (const id of stale) this.mounted.delete(id);

    for (const item of visible) this.mount(item);
  }

  /**
   * `wanted`, or as much of it around the viewport centre as can be afforded.
   *
   * Culling bounds the mounted set by the VIEWPORT, which is the right rule
   * until someone zooms out: the region then covers the whole board, every
   * item counts as visible, and a real component is mounted for each. A
   * 100,000-node graph mounted 2,022 cards that way and froze the tab.
   *
   * Bounding the REGION rather than filtering its contents is what keeps this
   * honest. The query stays proportional to what it returns, `safeRect` still
   * means "the rect these mounted items came from", and the hysteresis above
   * keeps working because that sentence is true again.
   *
   * How much fits is estimated from the board's own density - items divided by
   * the area they occupy - rather than guessed, so a sparse board zooms out
   * further before anything is dropped than a dense one does.
   */
  private affordable(wanted: CanvasRect, viewRect: CanvasRect): CanvasRect {
    // A board that fits entirely is never worth bounding, and the density
    // estimate below is meaningless for one: items stacked at a single point
    // occupy no area at all, which reads as infinite density and shrank the
    // region to nothing. Three items vanished on a board of three.
    if (this.hash.size <= this.maxMounted) return wanted;

    const density = this.worldArea > 0 ? this.hash.size / this.worldArea : 0;
    if (density <= 0) return wanted;

    /*
     * Slack, so a board only a little over the cap is not cropped.
     *
     * The density estimate is exactly that — an estimate — and shrinking the
     * region the moment it is exceeded by any margin at all cost far more
     * than it saved. At seven hundred items against a cap of six hundred the
     * scale came out at 0.93, which mounts a region 93% of the viewport
     * CENTRED in it: a band around all four edges of the screen with no cards
     * in it, while the edge renderer went on drawing their wires into the
     * blank. Nobody at that zoom was looking at an illegible smudge; they
     * were looking at a hole.
     *
     * Below the slack the overshoot is a few dozen extra views, which the
     * pool absorbs. Far above it — the hundred-thousand case this exists for
     * — the shrink is unchanged.
     */
    const area = wanted.width * wanted.height;
    const affordableArea = this.maxMounted / density;
    if (area <= affordableArea) return wanted;

    /*
     * Never smaller than what is actually on screen.
     *
     * Only the OVERSCAN is negotiable. Shrinking below the viewport unmounts
     * cards the user is looking at: at seven hundred items against a cap of
     * six hundred the scale came out at 0.93, which left a band around all
     * four edges of the screen with no cards in it while the edge renderer
     * went on drawing their wires into the blank. If even the bare viewport
     * holds more than the cap, that is for the caller to ration — it can at
     * least ration it evenly, which cropping cannot.
     */
    const scale = Math.sqrt(affordableArea / area);
    const width = Math.max(viewRect.width, wanted.width * scale);
    const height = Math.max(viewRect.height, wanted.height * scale);
    return {
      x: viewRect.x + viewRect.width / 2 - width / 2,
      y: viewRect.y + viewRect.height / 2 - height / 2,
      width,
      height,
    };
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

    // `byId` too. It is handed out live to the edge rebuild, so leaving it
    // populated both retains every item a `clear()` was meant to release and
    // answers with items that are no longer there.
    this.byId.clear();
    this.worldArea = 0;
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

/** Squared distance from an item's centre to a point. Monotonic, and no root. */
function centreDistanceSquared(item: CanvasItem, x: number, y: number): number {
  const dx = item.x + item.width / 2 - x;
  const dy = item.y + item.height / 2 - y;
  return dx * dx + dy * dy;
}

/** Restores the max-heap property upwards from `index`. */
function siftUp(keys: number[], items: unknown[], index: number): void {
  let child = index;
  while (child > 0) {
    const parent = (child - 1) >> 1;
    if (keys[parent] >= keys[child]) return;
    [keys[parent], keys[child]] = [keys[child], keys[parent]];
    [items[parent], items[child]] = [items[child], items[parent]];
    child = parent;
  }
}

/** Restores the max-heap property downwards from the root. */
function siftDown(keys: number[], items: unknown[]): void {
  const size = keys.length;
  let parent = 0;
  for (;;) {
    const left = parent * 2 + 1;
    const right = left + 1;
    let largest = parent;
    if (left < size && keys[left] > keys[largest]) largest = left;
    if (right < size && keys[right] > keys[largest]) largest = right;
    if (largest === parent) return;

    [keys[parent], keys[largest]] = [keys[largest], keys[parent]];
    [items[parent], items[largest]] = [items[largest], items[parent]];
    parent = largest;
  }
}

/**
 * The `cap` items whose centres are nearest to (`x`, `y`), in no order.
 *
 * A heap of the best `cap` so far, so the pass is O(n log cap) with one array
 * of `cap` — rather than O(n log n) over a copy of everything. The order of
 * the result does not matter: the caller mounts a SET.
 */
function nearestTo<T extends CanvasItem>(
  found: readonly T[],
  cap: number,
  x: number,
  y: number,
): readonly T[] {
  const items: T[] = [];
  const keys: number[] = [];

  for (const item of found) {
    const key = centreDistanceSquared(item, x, y);

    if (items.length < cap) {
      items.push(item);
      keys.push(key);
      siftUp(keys, items, items.length - 1);
      continue;
    }

    // Further away than the worst one kept: almost always true, and the only
    // comparison most of a hundred thousand items ever cost.
    if (key >= keys[0]) continue;

    keys[0] = key;
    items[0] = item;
    siftDown(keys, items);
  }

  return items;
}
