import { describe, it, expect, beforeEach } from 'vitest';
import { CanvasPointerMachine } from './infinite-canvas.pointer';
import { DEFAULT_MAX_ZOOM, DEFAULT_MIN_ZOOM, screenToWorld, worldToScreen } from './infinite-canvas.transform';

const LIMITS = { minZoom: DEFAULT_MIN_ZOOM, maxZoom: DEFAULT_MAX_ZOOM };

function down(machine: CanvasPointerMachine, x: number, y: number, over: 'empty' | 'item' = 'empty', pointerId = 1, button = 0): boolean {
  return machine.pointerDown({ pointerId, clientX: x, clientY: y, button }, over === 'empty');
}

function move(machine: CanvasPointerMachine, x: number, y: number, pointerId = 1): boolean {
  return machine.pointerMove({ pointerId, clientX: x, clientY: y });
}

describe('CanvasPointerMachine', () => {
  let machine: CanvasPointerMachine;

  beforeEach(() => {
    machine = new CanvasPointerMachine(LIMITS);
  });

  describe('T-1 — drag on empty space pans; the transform updates', () => {
    it('starts idle', () => {
      expect(machine.mode).toBe('idle');
      expect(machine.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
    });

    it('enters panning on a primary drag over empty space and translates the viewport', () => {
      expect(down(machine, 100, 100)).toBe(true);
      expect(machine.mode).toBe('panning');

      expect(move(machine, 130, 90)).toBe(true);

      expect(machine.viewport.x).toBe(30);
      expect(machine.viewport.y).toBe(-10);
      expect(machine.viewport.zoom).toBe(1);
    });

    it('accumulates across successive moves', () => {
      down(machine, 0, 0);
      move(machine, 10, 10);
      move(machine, 25, 5);
      expect(machine.viewport).toEqual({ x: 25, y: 5, zoom: 1 });
    });

    it('pans by screen pixels regardless of zoom, so the grab point stays under the pointer', () => {
      machine.setViewport({ x: 0, y: 0, zoom: 4 });
      const grabbedWorld = screenToWorld({ x: 100, y: 100 }, machine.viewport);

      down(machine, 100, 100);
      move(machine, 150, 120);

      const nowAt = worldToScreen(grabbedWorld, machine.viewport);
      expect(nowAt.x).toBeCloseTo(150, 6);
      expect(nowAt.y).toBeCloseTo(120, 6);
    });

    it('does NOT pan when the drag starts on an item', () => {
      expect(down(machine, 100, 100, 'item')).toBe(false);
      expect(machine.mode).toBe('idle');
      expect(move(machine, 200, 200)).toBe(false);
      expect(machine.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
    });

    it('pans from a middle-button drag even when it starts on an item', () => {
      expect(down(machine, 10, 10, 'item', 1, 1)).toBe(true);
      expect(machine.mode).toBe('panning');
      move(machine, 20, 10);
      expect(machine.viewport.x).toBe(10);
    });

    it('returns to idle on pointerup and ignores further moves', () => {
      down(machine, 0, 0);
      move(machine, 10, 0);
      machine.pointerUp(1);

      expect(machine.mode).toBe('idle');
      expect(move(machine, 999, 999)).toBe(false);
      expect(machine.viewport.x).toBe(10);
    });

    it('ignores moves from a pointer it never captured', () => {
      down(machine, 0, 0, 'empty', 1);
      expect(move(machine, 50, 50, 7)).toBe(false);
      expect(machine.viewport.x).toBe(0);
    });

    it('cancel() drops the interaction (pointer leaving the window mid-drag)', () => {
      down(machine, 0, 0);
      move(machine, 10, 10);
      machine.cancel();

      expect(machine.mode).toBe('idle');
      expect(move(machine, 500, 500)).toBe(false);
      expect(machine.viewport).toEqual({ x: 10, y: 10, zoom: 1 });
    });

    it('reports no change for a zero-distance move', () => {
      down(machine, 40, 40);
      expect(move(machine, 40, 40)).toBe(false);
    });
  });

  describe('T-2 — ctrl+wheel zooms about the cursor', () => {
    it('zooms in on a negative deltaY and keeps the world point under the cursor fixed', () => {
      const cursor = { x: 160, y: 40 };
      const world = screenToWorld(cursor, machine.viewport);

      expect(machine.wheel({ deltaX: 0, deltaY: -100, ctrlKey: true, clientX: cursor.x, clientY: cursor.y })).toBe(true);

      expect(machine.viewport.zoom).toBeGreaterThan(1);
      const back = worldToScreen(world, machine.viewport);
      expect(back.x).toBeCloseTo(cursor.x, 6);
      expect(back.y).toBeCloseTo(cursor.y, 6);
    });

    it('zooms out on a positive deltaY about the same cursor', () => {
      const cursor = { x: 55, y: 210 };
      const world = screenToWorld(cursor, machine.viewport);

      machine.wheel({ deltaX: 0, deltaY: 120, ctrlKey: true, clientX: cursor.x, clientY: cursor.y });

      expect(machine.viewport.zoom).toBeLessThan(1);
      const back = worldToScreen(world, machine.viewport);
      expect(back.x).toBeCloseTo(cursor.x, 6);
      expect(back.y).toBeCloseTo(cursor.y, 6);
    });

    it('treats metaKey the same as ctrlKey (macOS trackpads)', () => {
      machine.wheel({ deltaX: 0, deltaY: -100, metaKey: true, clientX: 0, clientY: 0 });
      expect(machine.viewport.zoom).toBeGreaterThan(1);
    });

    it('never exceeds maxZoom no matter how many notches', () => {
      for (let i = 0; i < 200; i++) {
        machine.wheel({ deltaX: 0, deltaY: -100, ctrlKey: true, clientX: 100, clientY: 100 });
      }
      expect(machine.viewport.zoom).toBe(DEFAULT_MAX_ZOOM);
    });

    it('never drops below minZoom no matter how many notches', () => {
      for (let i = 0; i < 200; i++) {
        machine.wheel({ deltaX: 0, deltaY: 100, ctrlKey: true, clientX: 100, clientY: 100 });
      }
      expect(machine.viewport.zoom).toBe(DEFAULT_MIN_ZOOM);
    });

    it('scales line-mode deltas so a mouse wheel and a trackpad agree in direction', () => {
      const pixels = new CanvasPointerMachine(LIMITS);
      pixels.wheel({ deltaX: 0, deltaY: -3 * 16, ctrlKey: true, clientX: 0, clientY: 0 });

      const lines = new CanvasPointerMachine(LIMITS);
      lines.wheel({ deltaX: 0, deltaY: -3, deltaMode: 1, ctrlKey: true, clientX: 0, clientY: 0 });

      expect(lines.viewport.zoom).toBeCloseTo(pixels.viewport.zoom, 6);
    });

    it('reports no change for a zero-delta wheel event', () => {
      expect(machine.wheel({ deltaX: 0, deltaY: 0, ctrlKey: true, clientX: 0, clientY: 0 })).toBe(false);
    });
  });

  describe('T-3 — plain wheel pans, shift+wheel pans horizontally, space+drag pans', () => {
    it('plain wheel pans vertically and does not change zoom', () => {
      machine.wheel({ deltaX: 0, deltaY: 100, clientX: 0, clientY: 0 });
      expect(machine.viewport.zoom).toBe(1);
      expect(machine.viewport.y).toBe(-100);
      expect(machine.viewport.x).toBe(0);
    });

    it('plain wheel honours a horizontal deltaX (trackpad two-finger scroll)', () => {
      machine.wheel({ deltaX: 40, deltaY: 0, clientX: 0, clientY: 0 });
      expect(machine.viewport.x).toBe(-40);
      expect(machine.viewport.y).toBe(0);
    });

    it('shift+wheel maps a vertical delta onto horizontal panning', () => {
      machine.wheel({ deltaX: 0, deltaY: 100, shiftKey: true, clientX: 0, clientY: 0 });
      expect(machine.viewport.x).toBe(-100);
      expect(machine.viewport.y).toBe(0);
      expect(machine.viewport.zoom).toBe(1);
    });

    it('pans by the same screen distance at any zoom', () => {
      machine.setViewport({ x: 0, y: 0, zoom: 4 });
      machine.wheel({ deltaX: 0, deltaY: 100, clientX: 0, clientY: 0 });
      expect(machine.viewport.y).toBe(-100);
    });

    it('space+drag pans even when the drag starts on an item', () => {
      machine.setSpacePressed(true);
      expect(machine.spacePressed).toBe(true);

      expect(down(machine, 100, 100, 'item')).toBe(true);
      expect(machine.mode).toBe('panning');
      move(machine, 80, 130);

      expect(machine.viewport).toEqual({ x: -20, y: 30, zoom: 1 });
    });

    it('stops treating item drags as pans once space is released', () => {
      machine.setSpacePressed(true);
      machine.setSpacePressed(false);
      expect(down(machine, 100, 100, 'item')).toBe(false);
      expect(machine.mode).toBe('idle');
    });

    it('does not abort an in-flight pan when space is released mid-drag', () => {
      machine.setSpacePressed(true);
      down(machine, 0, 0, 'item');
      machine.setSpacePressed(false);

      expect(machine.mode).toBe('panning');
      expect(move(machine, 15, 0)).toBe(true);
      expect(machine.viewport.x).toBe(15);
    });
  });

  describe('T-4 — two pointers pinch-zoom about their midpoint', () => {
    function pinchStart(): void {
      machine.pointerDown({ pointerId: 1, clientX: 0, clientY: 0, button: 0 }, true);
      machine.pointerDown({ pointerId: 2, clientX: 100, clientY: 0, button: 0 }, true);
    }

    it('switches to pinching when a second pointer arrives', () => {
      down(machine, 0, 0);
      expect(machine.mode).toBe('panning');

      expect(machine.pointerDown({ pointerId: 2, clientX: 100, clientY: 0, button: 0 }, true)).toBe(true);
      expect(machine.mode).toBe('pinching');
    });

    it('doubling the pointer distance doubles the zoom', () => {
      pinchStart();

      move(machine, -50, 0, 1);
      move(machine, 150, 0, 2);

      expect(machine.viewport.zoom).toBeCloseTo(2, 6);
    });

    it('halving the pointer distance halves the zoom', () => {
      pinchStart();

      move(machine, 25, 0, 1);
      move(machine, 75, 0, 2);

      expect(machine.viewport.zoom).toBeCloseTo(0.5, 6);
    });

    it('keeps the world point under the pointer midpoint fixed', () => {
      machine.setViewport({ x: 17, y: -23, zoom: 1.4 });
      machine.pointerDown({ pointerId: 1, clientX: 40, clientY: 60, button: 0 }, true);
      machine.pointerDown({ pointerId: 2, clientX: 140, clientY: 160, button: 0 }, true);

      const midpoint = { x: 90, y: 110 };
      const world = screenToWorld(midpoint, machine.viewport);

      move(machine, 20, 40, 1);
      move(machine, 160, 180, 2);

      const back = worldToScreen(world, machine.viewport);
      expect(back.x).toBeCloseTo(midpoint.x, 6);
      expect(back.y).toBeCloseTo(midpoint.y, 6);
    });

    it('pans when both pointers translate without changing their separation', () => {
      pinchStart();

      move(machine, 30, 50, 1);
      move(machine, 130, 50, 2);

      expect(machine.viewport.zoom).toBeCloseTo(1, 6);
      expect(machine.viewport.x).toBeCloseTo(30, 6);
      expect(machine.viewport.y).toBeCloseTo(50, 6);
    });

    it('clamps pinch zoom to the limits', () => {
      pinchStart();
      move(machine, -10000, 0, 1);
      move(machine, 10000, 0, 2);
      expect(machine.viewport.zoom).toBe(DEFAULT_MAX_ZOOM);
    });

    it('falls back to single-pointer panning when one finger lifts', () => {
      pinchStart();
      machine.pointerUp(2);

      expect(machine.mode).toBe('panning');
      const before = machine.viewport.x;
      move(machine, 25, 0, 1);
      expect(machine.viewport.x).toBe(before + 25);
    });

    it('returns to idle when both fingers lift', () => {
      pinchStart();
      machine.pointerUp(1);
      machine.pointerUp(2);
      expect(machine.mode).toBe('idle');
    });

    it('ignores a degenerate pinch where both pointers coincide', () => {
      machine.pointerDown({ pointerId: 1, clientX: 50, clientY: 50, button: 0 }, true);
      machine.pointerDown({ pointerId: 2, clientX: 50, clientY: 50, button: 0 }, true);

      move(machine, 50, 50, 1);

      expect(Number.isFinite(machine.viewport.zoom)).toBe(true);
      expect(machine.viewport.zoom).toBeGreaterThan(0);
    });

    it('ignores a third pointer', () => {
      pinchStart();
      expect(machine.pointerDown({ pointerId: 3, clientX: 200, clientY: 200, button: 0 }, true)).toBe(false);
      expect(machine.mode).toBe('pinching');
    });
  });

  describe('limits and viewport plumbing', () => {
    it('setViewport copies rather than aliases the caller object', () => {
      const source = { x: 1, y: 2, zoom: 3 };
      machine.setViewport(source);
      source.x = 999;
      expect(machine.viewport.x).toBe(1);
    });

    it('setViewport clamps the incoming zoom', () => {
      machine.setViewport({ x: 0, y: 0, zoom: 1000 });
      expect(machine.viewport.zoom).toBe(DEFAULT_MAX_ZOOM);
    });

    it('setLimits re-clamps the current zoom', () => {
      machine.setViewport({ x: 0, y: 0, zoom: 4 });
      machine.setLimits({ minZoom: 0.5, maxZoom: 2 });
      expect(machine.viewport.zoom).toBe(2);
    });

    it('exposes the SAME mutable viewport object across frames (hot path must not allocate)', () => {
      const first = machine.viewport;
      down(machine, 0, 0);
      move(machine, 10, 10);
      machine.wheel({ deltaX: 0, deltaY: -100, ctrlKey: true, clientX: 0, clientY: 0 });
      expect(machine.viewport).toBe(first);
    });
  });

  describe('a release that never arrived must not turn the mouse into a pinch', () => {
    /*
     * Reported from the desktop: "after dragging it fakes that I still hold
     * the mouse, and moving the mouse zooms in and out".
     *
     * A mouse reuses one `pointerId` for every press. A press on an ITEM is
     * tracked with mode `idle` (deliberately — a finger resting on a node is
     * still a finger), so if its release goes missing the next press was
     * pushed as a SECOND tracked pointer, which is a pinch. Every mouse move
     * from then on zoomed. A release can genuinely be missed: the capturing
     * element is a virtualised card, and recycling it mid-drag detaches it.
     */
    it('treats the second press as a first press, from its own origin', () => {
      down(machine, 100, 100);
      // No pointerUp: this is the missed release.
      down(machine, 120, 120);

      const zoomBefore = machine.viewport.zoom;
      move(machine, 140, 120);

      /*
       * Panning twenty, not forty.
       *
       * Refusing the duplicate outright would also avoid the pinch — and
       * would leave the STALE entry, so the press did nothing and the pan
       * measured its delta from where the pointer had been long ago. The
       * second press is a real press; it has to replace what it duplicates.
       */
      expect(machine.mode).not.toBe('pinching');
      expect(machine.viewport.zoom).toBe(zoomBefore);
      expect(machine.viewport.x).toBe(20);
      expect(machine.tracks(1)).toBe(true);
    });

    it('still pinches for two genuinely different pointers', () => {
      down(machine, 100, 100, 'item', 1);
      down(machine, 200, 200, 'item', 2);

      expect(machine.mode).toBe('pinching');
    });
  });
});
