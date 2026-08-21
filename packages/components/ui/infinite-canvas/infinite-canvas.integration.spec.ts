import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { InfiniteCanvasComponent } from './infinite-canvas.component';
import { InfiniteCanvasItemDirective } from './infinite-canvas-item.directive';
import type { CanvasEdge, CanvasItem } from './infinite-canvas.types';

@Component({
  standalone: true,
  imports: [InfiniteCanvasComponent, InfiniteCanvasItemDirective],
  template: `
    <ui-infinite-canvas class="h-[400px] w-[600px]" [items]="items()" [edges]="edges()" [overscan]="overscan()">
      <ng-template uiInfiniteCanvasItem let-item let-i="index">
        <div class="node" [attr.data-id]="item.id" [attr.data-index]="i">{{ item.id }}</div>
      </ng-template>
    </ui-infinite-canvas>
  `,
})
class HostComponent {
  readonly items = signal<CanvasItem[]>([]);
  readonly edges = signal<CanvasEdge[]>([]);
  readonly overscan = signal(0);
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

const ITEMS: CanvasItem[] = [
  { id: 'a', x: 0, y: 0, width: 100, height: 60 },
  { id: 'b', x: 300, y: 150, width: 100, height: 60 },
  { id: 'far', x: 8000, y: 8000, width: 100, height: 60 },
];

describe('InfiniteCanvasComponent — items, edges, hit-testing, serialization', () => {
  let fixture: ComponentFixture<HostComponent>;
  let canvas: InfiniteCanvasComponent<CanvasItem>;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    canvas = fixture.debugElement.children[0].componentInstance as InfiniteCanvasComponent<CanvasItem>;
    root = fixture.nativeElement.querySelector('[data-slot="infinite-canvas"]') as HTMLElement;
    await nextFrame();
  });

  afterEach(() => {
    fixture.destroy();
  });

  async function setItems(items: CanvasItem[]): Promise<void> {
    fixture.componentInstance.items.set(items);
    fixture.detectChanges();
    await fixture.whenStable();
    await nextFrame();
  }

  function nodeIds(): string[] {
    return [...root.querySelectorAll<HTMLElement>('.node')].map(el => el.dataset['id'] ?? '');
  }

  describe('item projection (UC-4)', () => {
    it('renders only the items intersecting the viewport', async () => {
      await setItems(ITEMS);

      expect([...nodeIds()].sort((a, b) => a.localeCompare(b))).toEqual(['a', 'b']);
      expect(nodeIds()).not.toContain('far');
    });

    it('renders nothing when the item list is empty', async () => {
      await setItems([]);
      expect(nodeIds()).toEqual([]);
    });

    it('brings a distant item into the DOM once panned to', async () => {
      await setItems(ITEMS);
      expect(nodeIds()).not.toContain('far');

      canvas.panTo({ x: 8050, y: 8030 });
      await nextFrame();

      expect(nodeIds()).toContain('far');
    });

    it('reacts to the item list changing', async () => {
      await setItems(ITEMS);
      await setItems([{ id: 'solo', x: 10, y: 10, width: 50, height: 50 }]);

      expect(nodeIds()).toEqual(['solo']);
    });

    it('gives each mounted item the canvas-item slot used by the perf gate', async () => {
      await setItems(ITEMS);
      const hosts = root.querySelectorAll('[data-slot="canvas-item"]');
      expect(hosts).toHaveLength(2);
    });
  });

  describe('fitView over real content (UC-8)', () => {
    it('scales and centres so every item is visible', async () => {
      await setItems([
        { id: 'a', x: 0, y: 0, width: 100, height: 60 },
        { id: 'b', x: 900, y: 500, width: 100, height: 60 },
      ]);
      canvas.fitView();
      await nextFrame();

      const visible = canvas.visibleWorldRect();
      expect(visible.x).toBeLessThanOrEqual(0);
      expect(visible.y).toBeLessThanOrEqual(0);
      expect(visible.x + visible.width).toBeGreaterThanOrEqual(1000);
      expect(visible.y + visible.height).toBeGreaterThanOrEqual(560);
    });

    it('clamps to minZoom rather than exceeding it, and still centres', async () => {
      // 0..8100 x 0..8060 into 600x400 minus padding needs zoom ~0.038, below
      // the 0.05 floor — so the content CANNOT all fit. The clamp must win, and
      // the content must stay centred rather than drifting to a corner.
      await setItems(ITEMS);
      canvas.fitView();
      await nextFrame();

      expect(canvas.viewport.zoom).toBeCloseTo(0.05, 10);

      const visible = canvas.visibleWorldRect();
      const contentCentre = { x: 8100 / 2, y: 8060 / 2 };
      expect(visible.x + visible.width / 2).toBeCloseTo(contentCentre.x, 3);
      expect(visible.y + visible.height / 2).toBeCloseTo(contentCentre.y, 3);
    });

    it('falls back to the identity viewport with no items', async () => {
      await setItems([]);
      canvas.zoomTo(4);
      canvas.fitView();

      expect(canvas.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
    });

    it('centres a single item', async () => {
      await setItems([{ id: 'one', x: 500, y: 500, width: 100, height: 100 }]);
      canvas.fitView();
      await nextFrame();

      const screen = canvas.worldToScreen({ x: 550, y: 550 });
      const rect = root.getBoundingClientRect();
      expect(screen.x).toBeCloseTo(rect.left + rect.width / 2, 3);
      expect(screen.y).toBeCloseTo(rect.top + rect.height / 2, 3);
    });
  });

  describe('T-11 — hitTest has one entry point and a defined z-order (UC-9)', () => {
    beforeEach(async () => {
      fixture.componentInstance.edges.set([{ id: 'edge-ab', source: 'a', target: 'b' }]);
      await setItems(ITEMS);
    });

    function screenOf(world: { x: number; y: number }): { x: number; y: number } {
      return canvas.worldToScreen(world);
    }

    it('returns the item under the point', () => {
      expect(canvas.hitTest(screenOf({ x: 50, y: 30 }))).toEqual({ kind: 'item', id: 'a' });
    });

    it('returns the edge when the point is on the line but on no item', () => {
      expect(canvas.hitTest(screenOf({ x: 200, y: 105 }))).toEqual({ kind: 'edge', id: 'edge-ab' });
    });

    it('prefers the ITEM when an item and an edge overlap', () => {
      const hit = canvas.hitTest(screenOf({ x: 50, y: 30 }));
      expect(hit?.kind).toBe('item');
    });

    it('returns null over empty space', () => {
      expect(canvas.hitTest(screenOf({ x: 250, y: 380 }))).toBeNull();
    });

    it('hits an item that is not currently mounted', () => {
      expect(canvas.hitTest(screenOf({ x: 8050, y: 8030 }))).toEqual({ kind: 'item', id: 'far' });
    });
  });

  describe('pointer behaviour with items present', () => {
    it('does not pan when the drag starts on an item', async () => {
      await setItems(ITEMS);
      const node = root.querySelector('[data-slot="canvas-item"]') as HTMLElement;

      node.dispatchEvent(
        new PointerEvent('pointerdown', { pointerId: 1, clientX: 10, clientY: 10, bubbles: true, cancelable: true }),
      );
      root.dispatchEvent(
        new PointerEvent('pointermove', { pointerId: 1, clientX: 90, clientY: 90, bubbles: true, cancelable: true }),
      );
      await nextFrame();

      expect(canvas.viewport.x).toBe(0);
    });

    it('pans when the drag starts on empty space', async () => {
      await setItems(ITEMS);

      root.dispatchEvent(
        new PointerEvent('pointerdown', { pointerId: 1, clientX: 550, clientY: 380, bubbles: true, cancelable: true }),
      );
      root.dispatchEvent(
        new PointerEvent('pointermove', { pointerId: 1, clientX: 570, clientY: 400, bubbles: true, cancelable: true }),
      );
      await nextFrame();

      expect(canvas.viewport.x).toBe(20);
    });
  });

  describe('T-13 — toJSON / fromJSON round-trip (UC-11)', () => {
    it('captures the viewport, items and edges', async () => {
      fixture.componentInstance.edges.set([{ id: 'e', source: 'a', target: 'b' }]);
      await setItems(ITEMS);

      canvas.zoomTo(2);
      canvas.panTo({ x: 40, y: 60 });

      const snapshot = canvas.toJSON();

      expect(snapshot.version).toBe(1);
      expect(snapshot.viewport).toEqual({ ...canvas.viewport });
      expect(snapshot.items).toHaveLength(3);
      expect(snapshot.edges).toEqual([{ id: 'e', source: 'a', target: 'b' }]);
    });

    it('snapshots by value, so later mutation cannot corrupt it', async () => {
      const items = ITEMS.map(item => ({ ...item }));
      await setItems(items);

      const snapshot = canvas.toJSON();
      items[0].x = 99_999;

      expect(snapshot.items[0].x).toBe(0);
    });

    it('restores the viewport exactly', async () => {
      await setItems(ITEMS);
      canvas.zoomTo(3);
      canvas.panTo({ x: 123, y: -45 });
      const snapshot = canvas.toJSON();

      canvas.resetView();
      expect(canvas.viewport.zoom).toBe(1);

      canvas.fromJSON(snapshot);
      await nextFrame();

      expect({ ...canvas.viewport }).toEqual(snapshot.viewport);
    });

    it('survives a JSON string round-trip', async () => {
      await setItems(ITEMS);
      canvas.zoomTo(1.75);

      const revived = JSON.parse(JSON.stringify(canvas.toJSON())) as ReturnType<typeof canvas.toJSON>;
      canvas.resetView();
      canvas.fromJSON(revived);
      await nextFrame();

      expect(canvas.viewport.zoom).toBeCloseTo(1.75, 6);
    });

    it('re-culls after a restore so the DOM matches the restored viewport', async () => {
      await setItems(ITEMS);
      canvas.panTo({ x: 8050, y: 8030 });
      await nextFrame();
      const snapshot = canvas.toJSON();

      canvas.resetView();
      await nextFrame();
      expect(nodeIds()).not.toContain('far');

      canvas.fromJSON(snapshot);
      await nextFrame();
      expect(nodeIds()).toContain('far');
    });

    it('clamps a restored zoom that is outside the configured limits', async () => {
      await setItems(ITEMS);
      canvas.fromJSON({ version: 1, viewport: { x: 0, y: 0, zoom: 9999 }, items: [], edges: [] });
      await nextFrame();

      expect(canvas.viewport.zoom).toBeLessThanOrEqual(8);
    });
  });

  describe('edge rendering integration (UC-6)', () => {
    it('sizes the edge canvas for the device pixel ratio (UC-10)', async () => {
      await setItems(ITEMS);
      const edgeCanvas = root.querySelector<HTMLCanvasElement>('[data-slot="canvas-edges"]');

      const dpr = globalThis.devicePixelRatio || 1;
      const rect = root.getBoundingClientRect();

      expect(edgeCanvas?.width).toBe(Math.max(1, Math.round(rect.width * dpr)));
      expect(edgeCanvas?.height).toBe(Math.max(1, Math.round(rect.height * dpr)));
    });

    it('keeps the edge canvas out of the pointer path so items stay hittable', async () => {
      await setItems(ITEMS);
      const edgeCanvas = root.querySelector<HTMLCanvasElement>('[data-slot="canvas-edges"]');
      expect(getComputedStyle(edgeCanvas as Element).pointerEvents).toBe('none');
    });

    it('leaves the decorative edge canvas out of the accessibility tree', async () => {
      await setItems(ITEMS);
      const edgeCanvas = root.querySelector('[data-slot="canvas-edges"]');

      // <canvas> counts as an interactive element, so BOTH aria-hidden (a
      // focusable-but-silent trap) and role="presentation" (a non-interactive
      // role on an interactive element) are wrong here. A bare canvas with no
      // fallback content contributes nothing to the a11y tree, which is exactly
      // what a decorative layer wants.
      expect(edgeCanvas?.hasAttribute('role')).toBe(false);
      expect(edgeCanvas?.hasAttribute('aria-hidden')).toBe(false);
      expect(edgeCanvas?.childElementCount).toBe(0);
    });
  });

  describe('resize', () => {
    it('re-culls after the host is resized', async () => {
      await setItems([{ id: 'edge-of-view', x: 700, y: 20, width: 60, height: 60 }]);
      expect(nodeIds()).toEqual([]);

      root.style.width = '1200px';
      await new Promise(resolve => setTimeout(resolve, 60));
      await nextFrame();

      expect(nodeIds()).toEqual(['edge-of-view']);
    });
  });
});
