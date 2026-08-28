import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component, TemplateRef, ViewContainerRef, viewChild } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { CanvasItemContext } from './infinite-canvas-item.directive';
import { CanvasItemLayer } from './infinite-canvas.item-layer';
import { CanvasItemViewPool } from './infinite-canvas.item-pool';
import { SpatialHash } from './infinite-canvas.spatial-hash';
import type { CanvasItem, CanvasRect } from './infinite-canvas.types';

@Component({
  standalone: true,
  template: `
    <ng-container #anchor />
    <div #mount></div>
    <ng-template #tpl let-item let-i="index">
      <span class="cell" [attr.data-id]="item?.id" [attr.data-index]="i">{{ item?.id }}</span>
    </ng-template>
  `,
})
class HostComponent {
  readonly anchor = viewChild.required('anchor', { read: ViewContainerRef });
  readonly mount = viewChild.required<import('@angular/core').ElementRef<HTMLElement>>('mount');
  readonly tpl = viewChild.required<TemplateRef<CanvasItemContext>>('tpl');
}

function grid(count: number, columns = 100, step = 200, size = 120): CanvasItem[] {
  const items: CanvasItem[] = [];
  for (let i = 0; i < count; i++) {
    items.push({ id: i, x: (i % columns) * step, y: Math.floor(i / columns) * step, width: size, height: size });
  }
  return items;
}

const VIEW: CanvasRect = { x: 0, y: 0, width: 1000, height: 700 };

describe('CanvasItemLayer + CanvasItemViewPool (virtualization and recycling)', () => {
  let fixture: ComponentFixture<HostComponent>;
  let pool: CanvasItemViewPool<CanvasItemContext>;
  let layer: CanvasItemLayer<CanvasItem>;
  let mount: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const host = fixture.componentInstance;
    mount = host.mount().nativeElement;
    pool = new CanvasItemViewPool<CanvasItemContext>(host.anchor(), host.tpl(), mount, () => ({
      $implicit: undefined as unknown as CanvasItem,
      index: 0,
    }));
    layer = new CanvasItemLayer<CanvasItem>(pool);
  });

  afterEach(() => {
    pool.clear();
    fixture.destroy();
  });

  function mountedHosts(): HTMLElement[] {
    return [...mount.querySelectorAll<HTMLElement>('[data-slot="canvas-item"]')];
  }

  describe('T-5 — only viewport + overscan items are in the DOM at 10k', () => {
    it('mounts a bounded slice of a 10,000-item graph', () => {
      layer.setItems(grid(10_000));
      layer.update(VIEW, 200);

      expect(layer.itemCount).toBe(10_000);
      expect(layer.mountedCount).toBeGreaterThan(0);
      expect(layer.mountedCount).toBeLessThan(200);
      expect(mountedHosts()).toHaveLength(layer.mountedCount);
    });

    it('mounts nothing when no item intersects the viewport', () => {
      layer.setItems([{ id: 'far', x: 50_000, y: 50_000, width: 10, height: 10 }]);
      layer.update(VIEW, 200);

      expect(layer.mountedCount).toBe(0);
      expect(mountedHosts()).toHaveLength(0);
    });

    it('handles an empty item set', () => {
      layer.setItems([]);
      expect(layer.update(VIEW, 200)).toBe(true);
      expect(layer.mountedCount).toBe(0);
    });

    it('handles a single item', () => {
      layer.setItems([{ id: 'only', x: 10, y: 10, width: 50, height: 50 }]);
      layer.update(VIEW, 200);

      expect(layer.mountedCount).toBe(1);
      expect(mountedHosts()[0].dataset['slot']).toBe('canvas-item');
    });

    it('mounts every item stacked at the same coordinate', () => {
      layer.setItems([
        { id: 'a', x: 0, y: 0, width: 10, height: 10 },
        { id: 'b', x: 0, y: 0, width: 10, height: 10 },
        { id: 'c', x: 0, y: 0, width: 10, height: 10 },
      ]);
      layer.update(VIEW, 200);
      expect(layer.mountedCount).toBe(3);
    });

    it('includes items outside the viewport but inside the overscan margin', () => {
      layer.setItems([{ id: 'just-outside', x: VIEW.width + 50, y: 0, width: 20, height: 20 }]);

      layer.update(VIEW, 0);
      expect(layer.mountedCount).toBe(0);

      layer.invalidate();
      layer.update(VIEW, 200);
      expect(layer.mountedCount).toBe(1);
    });

    it('positions hosts at world coordinates with a compositor-only transform', () => {
      layer.setItems([{ id: 'a', x: 40, y: 90, width: 33, height: 44 }]);
      layer.update(VIEW, 0);

      const host = mountedHosts()[0];
      expect(host.style.transform).toBe('translate(40px, 90px)');
      expect(host.style.width).toBe('33px');
      expect(host.style.height).toBe('44px');
      expect(host.style.position).toBe('absolute');
    });

    it('renders the projected template with the item and its index', () => {
      layer.setItems([{ id: 'x', x: 0, y: 0, width: 10, height: 10 }]);
      layer.update(VIEW, 0);

      const cell = mount.querySelector('.cell') as HTMLElement;
      expect(cell.dataset['id']).toBe('x');
      expect(cell.dataset['index']).toBe('0');
    });
  });

  describe('overscan hysteresis', () => {
    it('skips the cull entirely while the viewport stays inside the margin', () => {
      layer.setItems(grid(400));
      expect(layer.update(VIEW, 300)).toBe(true);

      expect(layer.update({ ...VIEW, x: VIEW.x + 10 }, 300)).toBe(false);
      expect(layer.update({ ...VIEW, x: VIEW.x + 100 }, 300)).toBe(false);
    });

    it('re-culls once the viewport leaves the margin', () => {
      layer.setItems(grid(400));
      layer.update(VIEW, 300);

      expect(layer.update({ ...VIEW, x: VIEW.x + 5000 }, 300)).toBe(true);
    });

    it('re-culls after the item set changes', () => {
      layer.setItems(grid(400));
      layer.update(VIEW, 300);

      layer.setItems(grid(10));
      expect(layer.update(VIEW, 300)).toBe(true);
    });
  });

  describe('T-6 — pool recycles: recycle count rises while create count plateaus', () => {
    it('creates only up to the peak visible count, then recycles forever', () => {
      layer.setItems(grid(10_000));

      layer.update(VIEW, 100);
      const afterFirst = pool.createCount;
      expect(afterFirst).toBeGreaterThan(0);
      expect(pool.recycleCount).toBe(0);

      for (let step = 1; step <= 40; step++) {
        layer.update({ ...VIEW, x: step * 900, y: step * 300 }, 100);
      }

      expect(pool.recycleCount).toBeGreaterThan(0);
      expect(pool.createCount).toBeLessThanOrEqual(afterFirst * 2);
    });

    it('reuses the very same view object rather than rebuilding it', () => {
      layer.setItems([
        { id: 'a', x: 0, y: 0, width: 10, height: 10 },
        { id: 'b', x: 9000, y: 0, width: 10, height: 10 },
      ]);

      layer.update(VIEW, 0);
      const firstHost = mountedHosts()[0];

      layer.update({ ...VIEW, x: 9000 }, 0);
      const secondHost = mountedHosts()[0];

      expect(pool.recycleCount).toBe(1);
      expect(secondHost).toBe(firstHost);
      expect((mount.querySelector('.cell') as HTMLElement).dataset['id']).toBe('b');
    });

    it('does not re-create views for items that stay visible across a cull', () => {
      layer.setItems(grid(400));
      layer.update(VIEW, 100);
      const created = pool.createCount;

      layer.update({ ...VIEW, x: 60 }, 100);

      expect(pool.createCount).toBeLessThanOrEqual(created + 10);
    });
  });

  describe('T-17 — no view leak across sustained panning', () => {
    it('keeps the total live view count flat over a long pan', () => {
      layer.setItems(grid(10_000));
      layer.update(VIEW, 150);

      const settled: number[] = [];
      for (let step = 1; step <= 120; step++) {
        layer.update({ ...VIEW, x: step * 640, y: (step % 20) * 400 }, 150);
        if (step % 20 === 0) settled.push(pool.totalViews);
      }

      const peak = Math.max(...settled);
      expect(peak).toBeLessThan(400);
      expect(settled[settled.length - 1]).toBeLessThanOrEqual(peak);
      expect(mountedHosts()).toHaveLength(layer.mountedCount);
    });

    it('detaches released views from change detection, not just from the DOM', () => {
      layer.setItems([
        { id: 'a', x: 0, y: 0, width: 10, height: 10 },
        { id: 'b', x: 9000, y: 0, width: 10, height: 10 },
      ]);
      layer.update(VIEW, 0);
      expect(fixture.componentInstance.anchor()).toHaveLength(1);

      layer.update({ ...VIEW, x: 9000 }, 0);
      expect(fixture.componentInstance.anchor()).toHaveLength(1);
      expect(pool.poolSize).toBe(0);
    });

    it('caps the pool and destroys the excess instead of hoarding it', () => {
      const small = new CanvasItemViewPool<CanvasItemContext>(
        fixture.componentInstance.anchor(),
        fixture.componentInstance.tpl(),
        mount,
        () => ({ $implicit: undefined as unknown as CanvasItem, index: 0 }),
        3,
      );

      const acquired = Array.from({ length: 10 }, () => small.acquire());
      for (const view of acquired) small.release(view);

      expect(small.poolSize).toBe(3);
      expect(small.activeCount).toBe(0);
      small.clear();
    });

    it('clear() unmounts and destroys everything', () => {
      layer.setItems(grid(400));
      layer.update(VIEW, 100);
      expect(layer.mountedCount).toBeGreaterThan(0);

      layer.clear();
      pool.clear();

      expect(layer.mountedCount).toBe(0);
      expect(mountedHosts()).toHaveLength(0);
      expect(pool.totalViews).toBe(0);
    });

    it('releasing the same view twice is a no-op', () => {
      const view = pool.acquire();
      pool.release(view);
      expect(() => pool.release(view)).not.toThrow();
      expect(pool.poolSize).toBe(1);
    });
  });

  describe('hitTest', () => {
    it('returns the item under a world point', () => {
      layer.setItems([{ id: 'a', x: 0, y: 0, width: 100, height: 100 }]);
      expect(layer.hitTest(50, 50)?.id).toBe('a');
      expect(layer.hitTest(500, 500)).toBeNull();
    });

    it('returns the LAST item in paint order when several overlap', () => {
      layer.setItems([
        { id: 'under', x: 0, y: 0, width: 100, height: 100 },
        { id: 'over', x: 10, y: 10, width: 50, height: 50 },
      ]);
      expect(layer.hitTest(20, 20)?.id).toBe('over');
    });

    it('finds items that are not currently mounted', () => {
      layer.setItems([{ id: 'offscreen', x: 40_000, y: 40_000, width: 100, height: 100 }]);
      layer.update(VIEW, 100);

      expect(layer.mountedCount).toBe(0);
      expect(layer.hitTest(40_050, 40_050)?.id).toBe('offscreen');
    });
  });

  describe('bounds', () => {
    it('is null with no items and the union otherwise', () => {
      expect(layer.bounds()).toBeNull();

      layer.setItems([
        { id: 'a', x: 0, y: 0, width: 10, height: 10 },
        { id: 'b', x: 90, y: 40, width: 10, height: 10 },
      ]);
      expect(layer.bounds()).toEqual({ x: 0, y: 0, width: 100, height: 50 });
    });
  });

  describe('cellSizeFor', () => {
    it('falls back to a default for an empty set', () => {
      expect(CanvasItemLayer.cellSizeFor([])).toBe(256);
    });

    it('is roughly twice the median item span', () => {
      const items = grid(9, 3, 200, 50);
      expect(CanvasItemLayer.cellSizeFor(items)).toBe(100);
    });

    it('falls back when every item is zero-sized', () => {
      expect(CanvasItemLayer.cellSizeFor([{ id: 1, x: 0, y: 0, width: 0, height: 0 }])).toBe(256);
    });
  });
});

/*
 * The drag frame: `setItems` takes a fast path when the array is the same
 * length, in the same order, with only some items replaced — which is exactly
 * what dragging produces, because the editor rebuilds only the nodes it moved.
 *
 * The risk is a moved item left in its old bucket, so every test here asks the
 * INDEX where things are rather than trusting the call returned. Forcing the
 * fast path to be taken unconditionally was verified to fail these.
 */
describe('CanvasItemLayer — the drag fast path', () => {
  let fixture: ComponentFixture<HostComponent>;
  let pool: CanvasItemViewPool<CanvasItemContext>;
  let layer: CanvasItemLayer<CanvasItem>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const host = fixture.componentInstance;
    pool = new CanvasItemViewPool<CanvasItemContext>(
      host.anchor(),
      host.tpl(),
      host.mount().nativeElement,
      () => ({ $implicit: undefined as unknown as CanvasItem, index: 0 }),
    );
    layer = new CanvasItemLayer<CanvasItem>(pool);
  });

  afterEach(() => {
    pool.clear();
    fixture.destroy();
  });

  /** Ids the layer would mount for a rect, via a cull pass. */
  function visibleIn(rect: CanvasRect): (string | number)[] {
    layer.invalidate();
    layer.update(rect, 0);
    fixture.detectChanges();
    return [...fixture.nativeElement.querySelectorAll('.cell')]
      .map((el: Element) => el.getAttribute('data-id'))
      .filter((id): id is string => id !== null)
      .sort((a, b) => a.localeCompare(b));
  }

  const NEAR: CanvasRect = { x: 0, y: 0, width: 300, height: 300 };
  const FAR: CanvasRect = { x: 9000, y: 9000, width: 300, height: 300 };

  it('finds an item at its new position, not its old one', () => {
    const items = grid(40);
    layer.setItems(items);
    expect(visibleIn(NEAR)).toContain('0');
    expect(visibleIn(FAR)).toEqual([]);

    // Same array shape, one item replaced — the drag frame.
    const dragged = items.map(item =>
      item.id === 0 ? { ...item, x: 9050, y: 9050 } : item,
    );
    layer.setItems(dragged);

    expect(visibleIn(FAR)).toContain('0');
    expect(visibleIn(NEAR)).not.toContain('0');
  });

  it('keeps every other item indexed while one moves', () => {
    const items = grid(40);
    layer.setItems(items);
    const before = visibleIn(NEAR).filter(id => id !== '0');

    layer.setItems(items.map(item => (item.id === 0 ? { ...item, x: 9050, y: 9050 } : item)));
    expect(visibleIn(NEAR).filter(id => id !== '0')).toEqual(before);
    expect(layer.itemCount).toBe(items.length);
  });

  it('falls back to a rebuild when the ids change at the same length', () => {
    const items = grid(10);
    layer.setItems(items);

    const renamed = items.map(item => ({ ...item, id: `x${item.id}` }));
    layer.setItems(renamed);

    expect(layer.itemCount).toBe(10);
    expect(visibleIn(NEAR)).toContain('x0');
    expect(visibleIn(NEAR)).not.toContain('0');
  });

  it('rebuilds when an item is added or removed', () => {
    const items = grid(10);
    layer.setItems(items);
    layer.setItems(items.slice(0, 5));
    expect(layer.itemCount).toBe(5);

    layer.setItems(grid(12));
    expect(layer.itemCount).toBe(12);
  });

  it('handles every item moving at once, as a select-all drag does', () => {
    const items = grid(30);
    layer.setItems(items);
    layer.setItems(items.map(item => ({ ...item, x: item.x + 9000, y: item.y + 9000 })));

    expect(visibleIn(NEAR)).toEqual([]);
    expect(visibleIn(FAR).length).toBeGreaterThan(0);
    expect(layer.itemCount).toBe(30);
  });
});

/*
 * The regression gate for the drag fast path.
 *
 * Counting spatial-hash insertions is exact and cannot flake, unlike the
 * milliseconds the workload benchmark logs. Reverting `setItems` to a full
 * rebuild would re-insert every item on every frame of a drag and break no
 * other test.
 */
describe('CanvasItemLayer — a drag re-indexes only what moved', () => {
  let fixture: ComponentFixture<HostComponent>;
  let pool: CanvasItemViewPool<CanvasItemContext>;
  let layer: CanvasItemLayer<CanvasItem>;
  let inserts: number;
  let restore: () => void;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const host = fixture.componentInstance;
    pool = new CanvasItemViewPool<CanvasItemContext>(
      host.anchor(),
      host.tpl(),
      host.mount().nativeElement,
      () => ({ $implicit: undefined as unknown as CanvasItem, index: 0 }),
    );
    layer = new CanvasItemLayer<CanvasItem>(pool);

    inserts = 0;
    const proto = SpatialHash.prototype as unknown as { insert: (item: CanvasItem) => void };
    const real = proto.insert;
    proto.insert = function counted(item: CanvasItem): void {
      inserts++;
      real.call(this, item);
    };
    restore = () => {
      proto.insert = real;
    };
  });

  afterEach(() => {
    restore();
    pool.clear();
    fixture.destroy();
  });

  it('re-inserts nothing when one item moves inside its cell', () => {
    const items = grid(200);
    layer.setItems(items);
    inserts = 0;

    layer.setItems(items.map(i => (i.id === 5 ? { ...i, x: i.x + 2, y: i.y + 2 } : i)));
    expect(inserts).toBe(0);
  });

  it('re-inserts only the item that crossed a cell boundary', () => {
    const items = grid(200);
    layer.setItems(items);
    inserts = 0;

    layer.setItems(items.map(i => (i.id === 5 ? { ...i, x: 90_000, y: 90_000 } : i)));
    expect(inserts).toBe(1);
  });

  it('rebuilds the whole index only when the set itself changed', () => {
    const items = grid(200);
    layer.setItems(items);
    inserts = 0;

    layer.setItems(items.slice(0, 199));
    expect(inserts).toBe(199);
  });
});

/*
 * The regression gate for the mount cap.
 *
 * Culling bounds the mounted set by the VIEWPORT, which is right until someone
 * zooms out: the world rect then covers the whole board, every item counts as
 * visible, and a real component is mounted for each. A 100,000-node graph
 * zoomed out mounted 2,022 cards and froze the tab.
 *
 * Counting mounted views is exact and cannot flake.
 */
describe('CanvasItemLayer — zooming out cannot mount the whole board', () => {
  let fixture: ComponentFixture<HostComponent>;
  let pool: CanvasItemViewPool<CanvasItemContext>;

  function layerWithCap(cap: number): CanvasItemLayer<CanvasItem> {
    return new CanvasItemLayer<CanvasItem>(pool, cap);
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const host = fixture.componentInstance;
    pool = new CanvasItemViewPool<CanvasItemContext>(
      host.anchor(),
      host.tpl(),
      host.mount().nativeElement,
      () => ({ $implicit: undefined as unknown as CanvasItem, index: 0 }),
    );
  });

  afterEach(() => {
    pool.clear();
    fixture.destroy();
  });

  /** The whole board at once, as a full zoom-out asks for. */
  const EVERYTHING: CanvasRect = { x: -1e6, y: -1e6, width: 2e6, height: 2e6 };

  it('mounts no more than the cap however far out you zoom', () => {
    const layer = layerWithCap(50);
    layer.setItems(grid(2000));

    layer.update(EVERYTHING, 0);
    expect(layer.mountedCount).toBeLessThanOrEqual(50);
  });

  it('still mounts everything when everything fits under the cap', () => {
    const layer = layerWithCap(500);
    layer.setItems(grid(40));

    layer.update(EVERYTHING, 0);
    expect(layer.mountedCount).toBe(40);
  });

  it('keeps items near the middle of the screen, not an arbitrary corner', () => {
    const layer = layerWithCap(20);
    // grid(): 100 columns, 200 apart — so column 50, row 5 sits near (10000, 1000).
    layer.setItems(grid(2000));

    const centred: CanvasRect = { x: 9000, y: 0, width: 2000, height: 2000 };
    layer.update(centred, 0);
    fixture.detectChanges();

    const mounted = [...fixture.nativeElement.querySelectorAll('.cell')]
      .map((el: Element) => Number(el.getAttribute('data-id')))
      .filter((id: number) => !Number.isNaN(id));

    expect(mounted.length).toBeGreaterThan(0);

    /*
     * Straddling the centre is the assertion, not merely "inside the region".
     * Taking the first N of the query answer also lands inside the region —
     * the hash returns cells in row-major order, so an arbitrary slice is the
     * TOP-LEFT corner of it, and a looser check passed that happily. What
     * separates a centred selection from a corner one is items on both sides
     * of the middle.
     */
    const items = grid(2000);
    const ys = mounted.map(id => items[id].y);
    const centreY = 1000;
    expect(Math.min(...ys)).toBeLessThan(centreY);
    expect(Math.max(...ys)).toBeGreaterThan(centreY);

    for (const id of mounted) {
      expect(items[id].x).toBeGreaterThanOrEqual(8000);
      expect(items[id].x).toBeLessThanOrEqual(12000);
    }
  });

  it('releases views back to the pool when the cap pushes items out', () => {
    const layer = layerWithCap(30);
    layer.setItems(grid(2000));

    layer.update({ x: 0, y: 0, width: 1000, height: 1000 }, 0);
    const first = layer.mountedCount;
    layer.update(EVERYTHING, 0);

    expect(first).toBeGreaterThan(0);
    expect(layer.mountedCount).toBeLessThanOrEqual(30);
  });
});
