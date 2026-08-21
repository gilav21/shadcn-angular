import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { InfiniteCanvasComponent } from './infinite-canvas.component';
import { DEFAULT_MAX_ZOOM, DEFAULT_MIN_ZOOM } from './infinite-canvas.transform';

@Component({
  standalone: true,
  imports: [InfiniteCanvasComponent],
  template: `
    <ui-infinite-canvas
      class="h-[400px] w-[600px]"
      [showGrid]="showGrid()"
      [gridSize]="gridSize()"
      ariaLabel="Test canvas"
    />
  `,
})
class HostComponent {
  readonly showGrid = signal(true);
  readonly gridSize = signal(24);
}

/**
 * Canonicalizes a CSS transform through the browser's own parser.
 *
 * `style.transform` is normalized on write — `0` becomes `0px`, and a scale is
 * re-serialized at the browser's precision — so comparing the raw string
 * against the value the engine wrote fails for formatting reasons that say
 * nothing about correctness. Round-tripping the expected value through a
 * throwaway element compares what the browser actually parsed.
 */
function normalizeTransform(value: string): string {
  const probe = document.createElement('div');
  probe.style.transform = value;
  return probe.style.transform;
}

/** Waits for the engine's rAF frame to land. */
function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

describe('InfiniteCanvasComponent (phase 1 — transform, pointer, keyboard)', () => {
  let fixture: ComponentFixture<HostComponent>;
  let canvas: InfiniteCanvasComponent;
  let root: HTMLElement;
  let wrapper: HTMLElement;

  function pointer(type: string, init: PointerEventInit): void {
    root.dispatchEvent(
      new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, button: 0, ...init }),
    );
  }

  function key(type: 'keydown' | 'keyup', init: KeyboardEventInit): KeyboardEvent {
    const event = new KeyboardEvent(type, { bubbles: true, cancelable: true, ...init });
    root.dispatchEvent(event);
    return event;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    canvas = fixture.debugElement.children[0].componentInstance as InfiniteCanvasComponent;
    root = fixture.nativeElement.querySelector('[data-slot="infinite-canvas"]') as HTMLElement;
    wrapper = fixture.nativeElement.querySelector('[data-slot="canvas-viewport"]') as HTMLElement;
    await nextFrame();
  });

  afterEach(() => {
    fixture.destroy();
  });

  describe('structure', () => {
    it('renders the root, the edge canvas and the transform wrapper', () => {
      expect(root).toBeTruthy();
      expect(wrapper).toBeTruthy();
      expect(fixture.nativeElement.querySelector('[data-slot="canvas-edges"]')).toBeTruthy();
    });

    it('keeps the transform wrapper ZERO-SIZED (decision 2 — no giant composited layer)', () => {
      const rect = wrapper.getBoundingClientRect();
      expect(rect.width).toBe(0);
      expect(rect.height).toBe(0);
    });

    it('anchors the wrapper transform at its top-left corner', () => {
      expect(getComputedStyle(wrapper).transformOrigin).toBe('0px 0px');
    });

    it('is reachable by Tab and exposes an accessible name (T-14)', () => {
      expect(root.getAttribute('tabindex')).toBe('0');
      expect(root.getAttribute('aria-label')).toBe('Test canvas');
      // A native <section> with an accessible name IS a region landmark, so no
      // explicit role attribute is needed (and Web:S6819 prefers the element).
      expect(root.tagName).toBe('SECTION');
      expect(root.hasAttribute('role')).toBe(false);
    });

    it('disables browser touch gestures so pinch reaches the engine', () => {
      expect(getComputedStyle(root).touchAction).toBe('none');
    });
  });

  describe('pan by dragging empty space', () => {
    it('writes the pan straight onto the wrapper transform', async () => {
      pointer('pointerdown', { clientX: 100, clientY: 100 });
      pointer('pointermove', { clientX: 160, clientY: 130 });
      await nextFrame();

      expect(canvas.viewport.x).toBe(60);
      expect(canvas.viewport.y).toBe(30);
      expect(wrapper.style.transform).toBe(normalizeTransform('translate3d(60px, 30px, 0) scale(1)'));
    });

    it('marks the root as panning while the drag is live and clears it after', async () => {
      pointer('pointerdown', { clientX: 0, clientY: 0 });
      fixture.detectChanges();
      expect(root.dataset['panning']).toBe('true');

      pointer('pointerup', { clientX: 0, clientY: 0 });
      fixture.detectChanges();
      expect(root.dataset['panning']).toBe('false');
    });

    it('promotes the wrapper only while interacting (decision 2 — no permanent layer)', () => {
      expect(wrapper.style.willChange).not.toBe('transform');

      pointer('pointerdown', { clientX: 0, clientY: 0 });
      expect(wrapper.style.willChange).toBe('transform');

      pointer('pointerup', { clientX: 0, clientY: 0 });
      expect(wrapper.style.willChange).toBe('auto');
    });

    it('stops panning when the canvas loses focus mid-drag', async () => {
      pointer('pointerdown', { clientX: 0, clientY: 0 });
      pointer('pointermove', { clientX: 50, clientY: 0 });
      root.dispatchEvent(new FocusEvent('blur', { bubbles: false }));

      expect(canvas.mode).toBe('idle');
      pointer('pointermove', { clientX: 500, clientY: 0 });
      await nextFrame();
      expect(canvas.viewport.x).toBe(50);
    });
  });

  describe('wheel', () => {
    it('pans on a plain wheel and does not change zoom', async () => {
      root.dispatchEvent(new WheelEvent('wheel', { deltaX: 0, deltaY: 120, bubbles: true, cancelable: true }));
      await nextFrame();

      expect(canvas.viewport.zoom).toBe(1);
      expect(canvas.viewport.y).toBe(-120);
    });

    it('zooms on ctrl+wheel', async () => {
      root.dispatchEvent(
        new WheelEvent('wheel', { deltaY: -100, ctrlKey: true, bubbles: true, cancelable: true }),
      );
      await nextFrame();

      expect(canvas.viewport.zoom).toBeGreaterThan(1);
      expect(wrapper.style.transform).toBe(
        normalizeTransform(`translate3d(${canvas.viewport.x}px, ${canvas.viewport.y}px, 0) scale(${canvas.viewport.zoom})`),
      );
    });

    it('prevents the default so the page does not scroll behind the canvas', () => {
      const event = new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true });
      root.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    });

    it('ignores a zero-delta wheel event', () => {
      const event = new WheelEvent('wheel', { deltaX: 0, deltaY: 0, bubbles: true, cancelable: true });
      root.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    });
  });

  describe('keyboard operability (T-14)', () => {
    it('pans with the arrow keys', async () => {
      key('keydown', { key: 'ArrowRight' });
      await nextFrame();
      expect(canvas.viewport.x).toBeLessThan(0);

      const afterRight = canvas.viewport.x;
      key('keydown', { key: 'ArrowLeft' });
      await nextFrame();
      expect(canvas.viewport.x).toBeGreaterThan(afterRight);
    });

    it('pans further when Shift is held', async () => {
      key('keydown', { key: 'ArrowDown' });
      await nextFrame();
      const plain = Math.abs(canvas.viewport.y);

      canvas.resetView();
      key('keydown', { key: 'ArrowDown', shiftKey: true });
      await nextFrame();

      expect(Math.abs(canvas.viewport.y)).toBeGreaterThan(plain);
    });

    it('zooms with + and -', async () => {
      key('keydown', { key: '+' });
      await nextFrame();
      expect(canvas.viewport.zoom).toBeGreaterThan(1);

      key('keydown', { key: '-' });
      key('keydown', { key: '-' });
      await nextFrame();
      expect(canvas.viewport.zoom).toBeLessThan(1);
    });

    it('resets the view with 0', async () => {
      key('keydown', { key: 'ArrowRight' });
      key('keydown', { key: '+' });
      key('keydown', { key: '0' });
      await nextFrame();

      expect(canvas.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
    });

    it('consumes the keys it handles and leaves others alone', () => {
      expect(key('keydown', { key: 'ArrowUp' }).defaultPrevented).toBe(true);
      expect(key('keydown', { key: 'q' }).defaultPrevented).toBe(false);
    });

    it('treats space as the pan modifier without scrolling the page', () => {
      const event = key('keydown', { key: ' ' });
      expect(event.defaultPrevented).toBe(true);
      expect(canvas.spacePressed()).toBe(true);

      key('keyup', { key: ' ' });
      expect(canvas.spacePressed()).toBe(false);
    });

    it('focus() moves keyboard focus to the canvas root', () => {
      canvas.focus();
      expect(document.activeElement).toBe(root);
    });
  });

  describe('imperative API (UC-8)', () => {
    it('screenToWorld and worldToScreen round-trip through the host offset', () => {
      canvas.zoomTo(2);
      canvas.panTo({ x: 10, y: 10 });

      const screen = canvas.worldToScreen({ x: 42, y: -8 });
      const world = canvas.screenToWorld(screen);

      expect(world.x).toBeCloseTo(42, 6);
      expect(world.y).toBeCloseTo(-8, 6);
    });

    it('screenToWorld accounts for the canvas origin, not just the pan', () => {
      const origin = root.getBoundingClientRect();
      const world = canvas.screenToWorld({ x: origin.left, y: origin.top });
      expect(world.x).toBeCloseTo(0, 6);
      expect(world.y).toBeCloseTo(0, 6);
    });

    it('zoomTo clamps to the configured limits', () => {
      canvas.zoomTo(9999);
      expect(canvas.viewport.zoom).toBe(DEFAULT_MAX_ZOOM);

      canvas.zoomTo(0);
      expect(canvas.viewport.zoom).toBe(DEFAULT_MIN_ZOOM);
    });

    it('zoomBy zooms about the viewport centre by default', () => {
      const before = canvas.screenToWorld(centreOfRoot());
      canvas.zoomBy(2);
      const after = canvas.screenToWorld(centreOfRoot());

      expect(after.x).toBeCloseTo(before.x, 4);
      expect(after.y).toBeCloseTo(before.y, 4);
      expect(canvas.viewport.zoom).toBeCloseTo(2, 6);
    });

    it('panTo centres the requested world point', () => {
      canvas.panTo({ x: 100, y: -50 });
      const screen = canvas.worldToScreen({ x: 100, y: -50 });
      const centre = centreOfRoot();

      expect(screen.x).toBeCloseTo(centre.x, 4);
      expect(screen.y).toBeCloseTo(centre.y, 4);
    });

    it('fitView returns the identity viewport while there is no content (phase 1)', () => {
      canvas.zoomTo(4);
      canvas.fitView();
      expect(canvas.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
    });

    it('visibleWorldRect grows as the canvas zooms out', () => {
      canvas.zoomTo(2);
      const near = canvas.visibleWorldRect();
      canvas.zoomTo(0.5);
      const far = canvas.visibleWorldRect();

      expect(far.width).toBeGreaterThan(near.width);
    });

    function centreOfRoot(): { x: number; y: number } {
      const rect = root.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
  });

  describe('viewportChange output', () => {
    it('does NOT emit per frame — only once the interaction settles', async () => {
      const seen: unknown[] = [];
      canvas.viewportChange.subscribe(v => seen.push(v));

      pointer('pointerdown', { clientX: 0, clientY: 0 });
      for (let i = 1; i <= 10; i++) pointer('pointermove', { clientX: i * 10, clientY: 0 });
      await nextFrame();

      expect(seen).toHaveLength(0);

      pointer('pointerup', { clientX: 100, clientY: 0 });
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(seen).toHaveLength(1);
      expect(seen[0]).toEqual({ x: 100, y: 0, zoom: 1 });
    });
  });

  describe('reference grid', () => {
    it('tracks the pan and zoom', async () => {
      pointer('pointerdown', { clientX: 0, clientY: 0 });
      pointer('pointermove', { clientX: 12, clientY: 34 });
      await nextFrame();

      expect(root.style.backgroundPosition).toBe('12px 34px');
      expect(root.style.backgroundSize).toBe('24px 24px');
    });

    it('is removed when disabled', async () => {
      fixture.componentInstance.showGrid.set(false);
      fixture.detectChanges();
      await nextFrame();

      expect(root.style.backgroundImage).toBe('none');
    });

    it('is hidden when the dots would be too dense to read', async () => {
      canvas.zoomTo(DEFAULT_MIN_ZOOM);
      await nextFrame();

      expect(root.style.backgroundImage).toBe('none');
    });
  });

  describe('teardown', () => {
    it('destroys cleanly with a frame in flight', async () => {
      pointer('pointerdown', { clientX: 0, clientY: 0 });
      pointer('pointermove', { clientX: 40, clientY: 40 });
      expect(() => fixture.destroy()).not.toThrow();
      await nextFrame();
    });
  });
});
