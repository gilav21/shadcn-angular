import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component, TemplateRef, ViewContainerRef, viewChild } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { CanvasItemContext } from './infinite-canvas-item.directive';
import { CanvasItemLayer } from './infinite-canvas.item-layer';
import { CanvasItemViewPool } from './infinite-canvas.item-pool';
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
