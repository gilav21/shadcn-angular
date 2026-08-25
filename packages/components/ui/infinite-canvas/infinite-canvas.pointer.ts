import {
  clampZoom,
  panBy,
  zoomAbout,
} from './infinite-canvas.transform';
import type { CanvasPoint, CanvasViewport, CanvasZoomLimits } from './infinite-canvas.types';

/**
 * The engine's pointer/wheel state machine.
 *
 * Node editors accumulate bugs at the seams between interactions, so there are
 * no seams here: one machine owns every pointer, and the caller feeds it raw
 * events from a single set of root handlers.
 *
 * It is deliberately **DOM-free** — it takes plain event-shaped objects and
 * mutates one plain viewport object. That makes it directly unit-testable and,
 * more importantly, keeps the hot path off signals: nothing here schedules
 * Angular change detection, so a pan frame costs a `style.transform` write and
 * a canvas redraw and nothing else.
 */

/** Which interaction currently owns the pointers. */
export type CanvasInteractionMode = 'idle' | 'panning' | 'pinching';

/** The subset of `PointerEvent` the machine needs. */
export interface CanvasPointerInput {
  pointerId: number;
  clientX: number;
  clientY: number;
  /** `MouseEvent.button`; 1 is the middle button. Defaults to 0. */
  button?: number;
}

/** The subset of `WheelEvent` the machine needs. */
export interface CanvasWheelInput {
  deltaX: number;
  deltaY: number;
  /** `WheelEvent.deltaMode`; 1 means the deltas are in lines, not pixels. */
  deltaMode?: number;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  clientX: number;
  clientY: number;
}

export interface CanvasPointerOptions extends CanvasZoomLimits {
  /**
   * Exponent applied to a pixel-mode wheel delta when zooming. The default
   * A 100px notch is clamped to {@link MAX_ZOOM_DELTA} first, so the default
   * gives roughly a 1.16x step per notch — granular enough to creep up on a
   * scale, rather than jumping past it.
   */
  zoomSensitivity?: number;
}

/** Chrome reports ~16px per line for `deltaMode === 1`. */
const PIXELS_PER_LINE = 16;

/**
 * How much zoom one notch of scrolling is worth.
 *
 * Was `0.01`, which made a single 100px mouse notch a **0.37x** change — two
 * notches took the graph from full size to 13%, and there was no way to stop
 * anywhere in between. Reported as "it's either very close or very far".
 *
 * At `0.003`, paired with the clamp below, a notch is about 1.16x: sixteen
 * percent, repeatable, and reversible by scrolling back the same amount.
 */
const DEFAULT_ZOOM_SENSITIVITY = 0.003;

/**
 * The largest per-event delta zoom will act on.
 *
 * One device's "notch" is another's fine-grained stream. A mouse wheel sends
 * ~100 per notch while a trackpad pinch sends single digits many times a
 * second, so a sensitivity tuned for one is unusable on the other. Clamping
 * the mouse's coarse jump lets a single curve serve both: the pinch stays
 * proportional and smooth, and the notch stops overshooting.
 */
const MAX_ZOOM_DELTA = 50;
/** Below this pointer separation a pinch ratio is numerically meaningless. */
const MIN_PINCH_DISTANCE = 1e-3;

interface TrackedPointer {
  id: number;
  x: number;
  y: number;
}

export class CanvasPointerMachine {
  /**
   * The live viewport. **Mutated in place** every frame and never replaced, so
   * callers may hold a reference across frames — and so a pan allocates
   * nothing. Never wrap this in a signal.
   */
  readonly viewport: CanvasViewport = { x: 0, y: 0, zoom: 1 };

  private limits: CanvasZoomLimits;
  private readonly zoomSensitivity: number;

  private readonly pointers: TrackedPointer[] = [];
  private _mode: CanvasInteractionMode = 'idle';
  private _spacePressed = false;
  private lastPinchDistance = 0;
  private lastPinchCentre: CanvasPoint = { x: 0, y: 0 };

  constructor(options: CanvasPointerOptions) {
    this.limits = { minZoom: options.minZoom, maxZoom: options.maxZoom };
    this.zoomSensitivity = options.zoomSensitivity ?? DEFAULT_ZOOM_SENSITIVITY;
    this.viewport.zoom = clampZoom(this.viewport.zoom, this.limits);
  }

  get mode(): CanvasInteractionMode {
    return this._mode;
  }

  /** Whether the space key is held — the Figma/tldraw "pan anywhere" modifier. */
  get spacePressed(): boolean {
    return this._spacePressed;
  }

  setSpacePressed(down: boolean): void {
    this._spacePressed = down;
  }

  /** Replaces the viewport by copying, so the caller's object is not aliased. */
  setViewport(viewport: CanvasViewport): void {
    this.viewport.x = viewport.x;
    this.viewport.y = viewport.y;
    this.viewport.zoom = clampZoom(viewport.zoom, this.limits);
  }

  /** Updates the zoom bounds and re-clamps the current zoom into them. */
  setLimits(limits: CanvasZoomLimits): void {
    this.limits = { minZoom: limits.minZoom, maxZoom: limits.maxZoom };
    this.viewport.zoom = clampZoom(this.viewport.zoom, this.limits);
  }

  /**
   * Feeds a pointerdown. `onEmptySpace` tells the machine whether the press
   * landed on the plane rather than on an item — the engine's only piece of
   * hit-test knowledge.
   *
   * Returns `true` when an interaction started, which is the caller's cue to
   * call `setPointerCapture`.
   */
  /**
   * Feeds a pointerdown. Returns `true` when the engine took the gesture.
   *
   * ### Why every pointer is tracked, even one it will not act on
   *
   * A finger that lands on a node is not a pan — but it is still a finger, and
   * the engine has to know it is down. It used not to: a press on a node was
   * dropped entirely, so when a second finger arrived there was nothing to
   * pinch against, and the two-finger gesture never started. What happened
   * instead was the node kept dragging while the other finger moved, which is
   * the opposite of what two fingers mean.
   *
   * So the pointer is always recorded; only the MODE is conditional. The
   * second finger then finds a partner and a pinch begins regardless of what
   * either finger happens to be resting on — which is what every canvas app
   * does.
   */
  pointerDown(event: CanvasPointerInput, onEmptySpace: boolean): boolean {
    if (this.pointers.length >= 2) return false;

    this.pointers.push({ id: event.pointerId, x: event.clientX, y: event.clientY });

    if (this.pointers.length === 2) {
      this.beginPinch();
      return true;
    }
    if (this.shouldPan(event, onEmptySpace)) {
      this._mode = 'panning';
      return true;
    }

    // Tracked, but idle: this press belongs to whatever is under it.
    this._mode = 'idle';
    return false;
  }

  /** Feeds a pointermove. Returns `true` when the viewport actually changed. */
  pointerMove(event: CanvasPointerInput): boolean {
    const tracked = this.pointers.find(p => p.id === event.pointerId);
    if (!tracked) return false;

    const dx = event.clientX - tracked.x;
    const dy = event.clientY - tracked.y;
    tracked.x = event.clientX;
    tracked.y = event.clientY;

    if (this._mode === 'pinching') return this.updatePinch();
    if (this._mode !== 'panning') return false;
    if (dx === 0 && dy === 0) return false;

    this.applyViewport(panBy(this.viewport, dx, dy));
    return true;
  }

  /**
   * Feeds a pointerup/pointercancel. Lifting one finger out of a pinch demotes
   * the gesture to a pan on the remaining finger rather than ending it, which
   * is what users expect from a two-finger gesture.
   */
  pointerUp(pointerId: number): void {
    const index = this.pointers.findIndex(p => p.id === pointerId);
    if (index === -1) return;

    this.pointers.splice(index, 1);
    if (this.pointers.length === 1) {
      this._mode = 'panning';
    } else if (this.pointers.length === 0) {
      this._mode = 'idle';
    }
  }

  /** Abandons any interaction — used when the pointer leaves the window. */
  cancel(): void {
    this.pointers.length = 0;
    this._mode = 'idle';
  }

  /**
   * Feeds a wheel event, following the conventions developers already have
   * muscle memory for: `ctrl`/`cmd`+wheel (and therefore trackpad pinch) zooms
   * about the cursor, plain wheel pans, `shift`+wheel pans horizontally.
   *
   * Returns `true` when the viewport actually changed.
   */
  wheel(event: CanvasWheelInput): boolean {
    const scale = event.deltaMode === 1 ? PIXELS_PER_LINE : 1;
    const deltaX = event.deltaX * scale;
    const deltaY = event.deltaY * scale;
    if (deltaX === 0 && deltaY === 0) return false;

    if (event.ctrlKey || event.metaKey) {
      const clamped = Math.max(-MAX_ZOOM_DELTA, Math.min(MAX_ZOOM_DELTA, deltaY));
      const factor = Math.exp(-clamped * this.zoomSensitivity);
      this.applyViewport(
        zoomAbout(this.viewport, factor, { x: event.clientX, y: event.clientY }, this.limits),
      );
      return true;
    }

    if (event.shiftKey) {
      this.applyViewport(panBy(this.viewport, -(deltaY || deltaX), 0));
      return true;
    }

    this.applyViewport(panBy(this.viewport, -deltaX, -deltaY));
    return true;
  }

  /**
   * Pan starts on a primary press over empty space, on any middle-button press,
   * or on any press while space is held.
   */
  private shouldPan(event: CanvasPointerInput, onEmptySpace: boolean): boolean {
    const button = event.button ?? 0;
    if (button === 1) return true;
    if (this._spacePressed) return true;
    return button === 0 && onEmptySpace;
  }

  private beginPinch(): void {
    this._mode = 'pinching';
    this.lastPinchDistance = this.pinchDistance();
    this.lastPinchCentre = this.pinchCentre();
  }

  /**
   * Applies one pinch frame: the separation ratio drives the zoom about the
   * pointer midpoint, and the midpoint's own travel drives a pan, so a
   * two-finger drag translates and a two-finger spread scales — from the same
   * two samples.
   */
  private updatePinch(): boolean {
    const distance = this.pinchDistance();
    const centre = this.pinchCentre();

    const panned = panBy(
      this.viewport,
      centre.x - this.lastPinchCentre.x,
      centre.y - this.lastPinchCentre.y,
    );

    const usable = distance > MIN_PINCH_DISTANCE && this.lastPinchDistance > MIN_PINCH_DISTANCE;
    const next = usable
      ? zoomAbout(panned, distance / this.lastPinchDistance, centre, this.limits)
      : panned;

    this.lastPinchDistance = distance;
    this.lastPinchCentre = centre;
    this.applyViewport(next);
    return true;
  }

  private pinchDistance(): number {
    const [a, b] = this.pointers;
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  private pinchCentre(): CanvasPoint {
    const [a, b] = this.pointers;
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  /** Copies a computed viewport onto the live object without replacing it. */
  private applyViewport(next: CanvasViewport): void {
    this.viewport.x = next.x;
    this.viewport.y = next.y;
    this.viewport.zoom = next.zoom;
  }
}
