import type { EmbeddedViewRef, TemplateRef, ViewContainerRef } from '@angular/core';

/**
 * Recycles the embedded views used to render culled canvas items.
 *
 * ### Why this exists rather than `ComponentPoolService`
 *
 * `lib/component-pool.service.ts` pools `ComponentRef`s. Canvas items are
 * projected through a `TemplateRef` — the only way to virtualize 10,000 items,
 * since you cannot statically project 10,000 elements and then cull them — and
 * a template instantiates to an `EmbeddedViewRef`, which shares no recycling
 * API with `ComponentRef`. So this pool is local to the engine and
 * `ComponentPoolService` is left untouched. It deliberately exposes the same
 * `createCount` / `recycleCount` counters, so the recycling assertions read the
 * same way.
 *
 * ### How recycling works
 *
 * A released view is `detach()`ed from the `ViewContainerRef` — removed from
 * the DOM and, crucially, from change detection, so off-screen items cost
 * nothing — and kept alive in the pool. Acquiring re-`insert()`s it. Nothing is
 * destroyed while the pool has room, so scrolling a 10k graph creates views
 * only up to the peak visible count and then plateaus forever.
 *
 * Each view's root nodes live inside a host element the pool owns, which is
 * what carries `data-slot="canvas-item"` and the world-space positioning. A
 * template may legally have several root nodes, so the host is what gets
 * positioned, not the nodes themselves.
 */

/** One mounted item: the pool-owned host element and the view inside it. */
export interface CanvasItemView<C> {
  /** Absolutely positioned, world-coordinate host. Carries `data-slot="canvas-item"`. */
  readonly host: HTMLElement;
  readonly view: EmbeddedViewRef<C>;
}

/**
 * How many detached views the pool will hoard.
 *
 * Must be at least the layer's mount cap, and is deliberately the same number.
 * A pool smaller than the mounted set is worse than no pool: every cull past
 * its size destroys the surplus and the next one builds it again, so a pan at
 * a wide zoom creates and throws away hundreds of embedded views - the most
 * expensive thing either class does, paid forever.
 *
 * Not imported from the layer, which imports this file; kept as its own
 * constant with the coupling written down instead of a circular import.
 */
const DEFAULT_MAX_POOL_SIZE = 600;

export class CanvasItemViewPool<C extends object> {
  private readonly pool: CanvasItemView<C>[] = [];
  private readonly active = new Set<CanvasItemView<C>>();

  private _createCount = 0;
  private _recycleCount = 0;

  constructor(
    private readonly container: ViewContainerRef,
    private readonly template: TemplateRef<C>,
    /** Element the item hosts are appended to — the zero-sized transform wrapper. */
    private readonly mount: HTMLElement,
    /** Produces the initial context for a brand-new view. */
    private readonly createContext: () => C,
    private readonly maxPoolSize: number = DEFAULT_MAX_POOL_SIZE,
  ) {}

  /** Views instantiated from the template since construction. Should plateau. */
  get createCount(): number {
    return this._createCount;
  }

  /** Views taken from the pool instead of created. Should keep rising. */
  get recycleCount(): number {
    return this._recycleCount;
  }

  /** Views currently mounted and visible. */
  get activeCount(): number {
    return this.active.size;
  }

  /** Views held detached, ready to be reused. */
  get poolSize(): number {
    return this.pool.length;
  }

  /** Every live view, mounted or pooled. The number T-17 asserts stays flat. */
  get totalViews(): number {
    return this.active.size + this.pool.length;
  }

  /**
   * Returns a mounted view, recycled when one is available. The caller mutates
   * `view.context` and then calls {@link render} to flush it.
   */
  acquire(): CanvasItemView<C> {
    const recycled = this.pool.pop();
    if (recycled) {
      this._recycleCount++;
      this.container.insert(recycled.view);
      this.adopt(recycled);
      this.active.add(recycled);
      return recycled;
    }

    const created = this.create();
    this._createCount++;
    this.active.add(created);
    return created;
  }

  /** Flushes context changes into the DOM without a global change-detection pass. */
  render(item: CanvasItemView<C>): void {
    item.view.detectChanges();
  }

  /**
   * Unmounts a view and returns it to the pool. Views beyond the cap are
   * destroyed rather than hoarded, so a huge one-off zoom-out cannot leave the
   * pool permanently bloated.
   */
  release(item: CanvasItemView<C>): void {
    if (!this.active.delete(item)) return;
    this.unmount(item);

    if (this.pool.length < this.maxPoolSize) {
      this.pool.push(item);
    } else {
      item.view.destroy();
    }
  }

  /**
   * Destroys every view, mounted or pooled.
   *
   * Active views are DESTROYED here, not unmounted. Unmounting is what happens
   * when a view scrolls out of sight and may be wanted again in a moment — it
   * detaches the view and keeps it alive on purpose. At teardown nothing is
   * coming back, and `detach` has already taken the view out of the
   * `ViewContainerRef`, so Angular no longer owns it either: an unmounted
   * active view is one nothing will ever destroy.
   *
   * Everything visible is active, so that was the whole working set — every
   * consumer component the canvas had rendered, left with its `DestroyRef`
   * callbacks, effects and listeners still pending, once per route change away
   * from the canvas.
   */
  clear(): void {
    for (const item of this.active) this.destroy(item);
    this.active.clear();

    for (const item of this.pool) this.destroy(item);
    this.pool.length = 0;
  }

  /** Detaches a view from the DOM and from change detection, keeping it alive. */
  private unmount(item: CanvasItemView<C>): void {
    const index = this.container.indexOf(item.view);
    if (index !== -1) this.container.detach(index);
    item.host.remove();
  }

  private destroy(item: CanvasItemView<C>): void {
    item.host.remove();
    if (!item.view.destroyed) item.view.destroy();
  }

  private create(): CanvasItemView<C> {
    const view = this.container.createEmbeddedView(this.template, this.createContext());
    const host = document.createElement('div');
    host.dataset['slot'] = 'canvas-item';
    host.style.position = 'absolute';
    host.style.left = '0';
    host.style.top = '0';

    const item: CanvasItemView<C> = { host, view };
    this.adopt(item);
    return item;
  }

  /**
   * Moves the view's root nodes into the pool-owned host and mounts it.
   * `insert()` puts the nodes back at the container's anchor, so this runs on
   * every acquire, not only on create.
   */
  private adopt(item: CanvasItemView<C>): void {
    for (const node of item.view.rootNodes as Node[]) item.host.append(node);
    this.mount.append(item.host);
  }
}
