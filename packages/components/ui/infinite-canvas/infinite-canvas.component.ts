import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ContentChild,
  ElementRef,
  OnDestroy,
  TemplateRef,
  ViewContainerRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { cn } from '../../lib/utils';
import {
  InfiniteCanvasItemDirective,
  type CanvasItemContext,
} from './infinite-canvas-item.directive';
import { CanvasEdgeRenderer } from './infinite-canvas.edge-renderer';
import { CanvasItemLayer } from './infinite-canvas.item-layer';
import { CanvasItemViewPool } from './infinite-canvas.item-pool';
import {
  CanvasPointerMachine,
  type CanvasInteractionMode,
} from './infinite-canvas.pointer';
import {
  DEFAULT_FIT_PADDING,
  DEFAULT_MAX_ZOOM,
  DEFAULT_MIN_ZOOM,
  boundsOf,
  fitView,
  panTo,
  screenToWorld,
  transformCss,
  visibleWorldRect,
  worldToScreen,
  zoomAbout,
  zoomToLevel,
} from './infinite-canvas.transform';
import type {
  CanvasEdge,
  CanvasHit,
  CanvasItem,
  CanvasPoint,
  CanvasRect,
  CanvasSize,
  CanvasSnapshot,
  CanvasViewport,
} from './infinite-canvas.types';

/** Screen pixels an arrow key pans; Shift multiplies it. */
const KEYBOARD_PAN_STEP = 64;
const KEYBOARD_PAN_MULTIPLIER = 4;
/** Multiplicative zoom applied by the `+` / `-` keys. */
const KEYBOARD_ZOOM_FACTOR = 1.25;
/** Below this on-screen dot spacing the grid is noise, so it is hidden. */
const MIN_GRID_SPACING_PX = 4;
/** Quiet period after the last input before `viewportChange` is emitted. */
const VIEWPORT_SETTLE_MS = 120;
/** Screen-pixel margin of extra items mounted beyond the viewport edge. */
const DEFAULT_OVERSCAN = 240;

/**
 * Placeholder context for a freshly created view. The real item is written and
 * flushed before the view is ever change-detected, so this is never rendered —
 * it exists only because `createEmbeddedView` requires an initial context.
 */
function emptyItemContext<T extends CanvasItem>(): CanvasItemContext<T> {
  return { $implicit: undefined as unknown as T, index: 0 };
}

/**
 * The infinite-canvas engine: an infinitely pannable and zoomable plane.
 *
 * It knows nothing about nodes, ports or connections — those belong to products
 * built on top of it (`node-editor`, `whiteboard`, `mind-map`). What it owns is
 * the hard part: the transform model, the pointer state machine, and (from
 * phase 2) culling and recycling.
 *
 * ### Why the hot path looks the way it does
 *
 * The app is **zoneless**, so every signal write schedules a change-detection
 * pass. Writing the viewport to a signal on `pointermove` would cost a full CD
 * tick per frame and burn the frame budget before a pixel is drawn. So pan and
 * zoom mutate one plain object and write `style.transform` directly from a
 * `requestAnimationFrame` callback — Angular is not involved in a pan frame at
 * all. That is what keeps panning smooth even when projected item components
 * are expensive.
 *
 * `viewportChange` is therefore emitted when the interaction **settles**, not
 * per frame. Read {@link viewport} for the live value.
 *
 * @example Simple mode
 * ```html
 * <ui-infinite-canvas class="h-[600px] w-full" #c="uiInfiniteCanvas" />
 * <ui-button (click)="c.resetView()">Reset</ui-button>
 * ```
 */
@Component({
  selector: 'ui-infinite-canvas',
  exportAs: 'uiInfiniteCanvas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './infinite-canvas.component.html',
  styleUrl: './infinite-canvas.component.css',
  host: { class: 'contents' },
})
export class InfiniteCanvasComponent<T extends CanvasItem = CanvasItem> implements AfterViewInit, OnDestroy {
  /**
   * Every item on the plane. May be very large — only items intersecting the
   * viewport plus {@link overscan} are ever instantiated in the DOM, so the
   * element count is bounded by viewport area, not by this array's length.
   */
  readonly items = input<readonly T[]>([]);
  /**
   * Screen-pixel margin of extra items mounted beyond the viewport edge. It
   * doubles as the culling hysteresis window, so a larger value re-queries the
   * spatial index less often at the cost of more mounted elements.
   */
  readonly overscan = input(DEFAULT_OVERSCAN);
  /**
   * Edges between items, drawn on a single canvas beneath the item layer.
   * Endpoints are resolved from the items' centres.
   */
  readonly edges = input<readonly CanvasEdge[]>([]);
  /** Extra classes for the canvas root. Give it a height here — the host is `display: contents`. */
  readonly class = input('');
  /** Smallest allowed zoom. The default fits a very large graph on screen. */
  readonly minZoom = input(DEFAULT_MIN_ZOOM);
  /** Largest allowed zoom. */
  readonly maxZoom = input(DEFAULT_MAX_ZOOM);
  /** Initial zoom. Later changes are applied as a zoom about the viewport centre. */
  readonly zoom = input(1);
  /** Initial pan, in screen pixels. */
  readonly pan = input<CanvasPoint>({ x: 0, y: 0 });
  /** Whether to paint the reference dot grid. */
  readonly showGrid = input(true);
  /** World-space spacing of the dot grid. */
  readonly gridSize = input(24);
  /** Accessible name for the canvas region. */
  readonly ariaLabel = input('Canvas');
  /** Screen-pixel gap left around the content by {@link fitView}. */
  readonly fitPadding = input(DEFAULT_FIT_PADDING);

  /**
   * Emitted when panning/zooming **settles**, not on every frame — the hot path
   * deliberately never touches Angular. Read {@link viewport} for the live value.
   */
  readonly viewportChange = output<CanvasViewport>();

  private readonly rootRef = viewChild.required<ElementRef<HTMLElement>>('root');
  private readonly viewportRef = viewChild.required<ElementRef<HTMLElement>>('viewport');
  private readonly itemAnchor = viewChild.required('itemAnchor', { read: ViewContainerRef });
  private readonly edgeCanvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('edgeCanvas');

  @ContentChild(InfiniteCanvasItemDirective, { read: TemplateRef })
  itemTemplateRef?: TemplateRef<CanvasItemContext<T>>;

  /** True while a pointer interaction is in flight; drives `will-change` and the cursor. */
  readonly interacting = signal(false);
  /** True while the space modifier is held. */
  readonly spacePressed = signal(false);

  readonly rootClasses = computed(() =>
    cn(
      'canvas-root relative h-full w-full overflow-hidden bg-background select-none',
      'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      this.class(),
    ),
  );

  private readonly machine = new CanvasPointerMachine({
    minZoom: this.minZoom(),
    maxZoom: this.maxZoom(),
  });

  private readonly size: CanvasSize = { width: 0, height: 0 };
  private layer?: CanvasItemLayer<T>;
  private pool?: CanvasItemViewPool<CanvasItemContext<T>>;
  private edgeRenderer?: CanvasEdgeRenderer;
  private resizeObserver?: ResizeObserver;
  private frameHandle = 0;
  private settleHandle?: ReturnType<typeof setTimeout>;
  private mounted = false;

  constructor() {
    effect(() => {
      this.machine.setLimits({ minZoom: this.minZoom(), maxZoom: this.maxZoom() });
      this.requestFrame();
    });

    effect(() => {
      const pan = this.pan();
      const zoom = this.zoom();
      this.machine.setViewport({ x: pan.x, y: pan.y, zoom });
      this.requestFrame();
    });

    effect(() => {
      this.showGrid();
      this.gridSize();
      this.requestFrame();
    });

    effect(() => {
      const items = this.items();
      this.rebuildLayer(items);
      this.rebuildEdges(items, this.edges());
      this.requestFrame();
    });

    effect(() => {
      this.rebuildEdges(this.items(), this.edges());
      this.requestFrame();
    });
  }

  // ---------------------------------------------------------------- lifecycle

  ngAfterViewInit(): void {
    const root = this.rootRef().nativeElement;
    this.mounted = true;
    this.measure();

    this.resizeObserver = new ResizeObserver(() => {
      this.measure();
      this.resizeEdgeCanvas();
      this.layer?.invalidate();
      this.requestFrame();
    });
    this.resizeObserver.observe(root);
    this.edgeRenderer = new CanvasEdgeRenderer(this.edgeCanvasRef().nativeElement);
    this.resizeEdgeCanvas();
    this.rebuildLayer(this.items());
    this.rebuildEdges(this.items(), this.edges());
    this.paint();
  }

  ngOnDestroy(): void {
    this.mounted = false;
    this.edgeRenderer?.clear();
    this.pool?.clear();
    this.layer = undefined;
    this.resizeObserver?.disconnect();
    if (this.frameHandle) cancelAnimationFrame(this.frameHandle);
    if (this.settleHandle) clearTimeout(this.settleHandle);
  }

  // ----------------------------------------------------------- imperative API

  /** The live viewport. Mutated in place every frame — copy it before storing. */
  get viewport(): Readonly<CanvasViewport> {
    return this.machine.viewport;
  }

  /** Current interaction state of the pointer machine. */
  get mode(): CanvasInteractionMode {
    return this.machine.mode;
  }

  /** Converts a point in client/screen pixels to world coordinates. */
  screenToWorld(point: CanvasPoint): CanvasPoint {
    return screenToWorld(this.toLocal(point), this.machine.viewport);
  }

  /** Converts a world point to client/screen pixels. */
  worldToScreen(point: CanvasPoint): CanvasPoint {
    const local = worldToScreen(point, this.machine.viewport);
    const origin = this.originOffset();
    return { x: local.x + origin.x, y: local.y + origin.y };
  }

  /** Zooms to an absolute level about the centre of the viewport. */
  zoomTo(zoom: number): void {
    this.machine.setViewport(zoomToLevel(this.machine.viewport, zoom, this.size, this.limits()));
    this.commit();
  }

  /** Multiplies the current zoom, optionally about a screen-space anchor. */
  zoomBy(factor: number, anchor?: CanvasPoint): void {
    const point = anchor
      ? this.toLocal(anchor)
      : { x: this.size.width / 2, y: this.size.height / 2 };
    this.machine.setViewport(zoomAbout(this.machine.viewport, factor, point, this.limits()));
    this.commit();
  }

  /** Centres the given world point in the viewport. */
  panTo(worldPoint: CanvasPoint): void {
    this.machine.setViewport(panTo(this.machine.viewport, worldPoint, this.size));
    this.commit();
  }

  /**
   * Scales and centres the content so it all fits, leaving {@link fitPadding}
   * around it. Falls back to the identity viewport when there is no content.
   *
   * The fitted scale is clamped to {@link minZoom} / {@link maxZoom}, so content
   * whose extent needs a scale below `minZoom` is centred but **not** fully
   * visible. Lower `minZoom` if a single view of a very large graph matters
   * more than a floor on how small items may render.
   */
  fitView(): void {
    this.machine.setViewport(
      fitView(this.contentBounds(), this.size, { padding: this.fitPadding(), ...this.limits() }),
    );
    this.commit();
  }

  /** Returns to pan (0, 0) at zoom 1. */
  resetView(): void {
    this.machine.setViewport({ x: 0, y: 0, zoom: 1 });
    this.commit();
  }

  /** The world-space rectangle currently on screen. */
  visibleWorldRect(): CanvasRect {
    return visibleWorldRect(this.machine.viewport, this.size);
  }

  /**
   * The item or edge under a **screen** point, or `null`.
   *
   * There are two hit-test paths — DOM for items, canvas for edges — and they
   * must never disagree, so this is the single entry point and the z-order is
   * defined: **items win over edges**, matching what the user sees, since the
   * item layer is painted above the edge canvas.
   */
  hitTest(point: CanvasPoint): CanvasHit | null {
    const world = this.screenToWorld(point);

    const item = this.layer?.hitTest(world.x, world.y);
    if (item) return { kind: 'item', id: item.id };

    const edge = this.edgeRenderer?.hitTest(world.x, world.y, this.machine.viewport);
    return edge ? { kind: 'edge', id: edge.id } : null;
  }

  /** Serializes the viewport and content. Round-trips through {@link fromJSON}. */
  toJSON(): CanvasSnapshot {
    const { x, y, zoom } = this.machine.viewport;
    return {
      version: 1,
      viewport: { x, y, zoom },
      items: this.items().map(item => ({ ...item })),
      edges: this.edges().map(edge => ({ ...edge })),
    };
  }

  /**
   * Restores a viewport from a snapshot.
   *
   * Items and edges are **inputs**, so they stay owned by the consumer —
   * `fromJSON` deliberately does not write them back. Read them off the
   * snapshot and bind them; that keeps the data flow one-directional.
   */
  fromJSON(snapshot: CanvasSnapshot): void {
    this.machine.setViewport(snapshot.viewport);
    this.layer?.invalidate();
    this.commit();
  }

  /** Moves keyboard focus to the canvas. */
  focus(): void {
    this.rootRef().nativeElement.focus();
  }

  // -------------------------------------------------------------- event entry

  onPointerDown(event: PointerEvent): void {
    const started = this.machine.pointerDown(
      { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, button: event.button },
      this.isEmptySpace(event),
    );
    if (!started) return;

    event.preventDefault();
    this.captureQuietly(event.pointerId);
    this.beginInteraction();
  }

  onPointerMove(event: PointerEvent): void {
    if (this.machine.mode === 'idle') return;
    if (this.machine.pointerMove({ pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY })) {
      this.requestFrame();
    }
  }

  onPointerUp(event: PointerEvent): void {
    /*
     * A lifted pointer is always forgotten, even one the engine was not
     * acting on.
     *
     * This used to return early while idle, which was fine when an idle
     * engine tracked nothing. It now tracks every pointer so a second finger
     * can pinch regardless of what the first is resting on — and with the
     * early return those pointers were never released. The next press found a
     * stale partner and began a phantom pinch, which stole the capture and
     * broke dropping a connection.
     */
    const wasInteracting = this.machine.mode !== 'idle';
    this.machine.pointerUp(event.pointerId);
    this.releaseCapture(event.pointerId);
    if (wasInteracting) this.endInteractionIfIdle();
  }

  /**
   * Split out so the mode check gets fresh control-flow analysis — reading the
   * getter again inside `onPointerUp` sees the type narrowed by its own guard.
   */
  private endInteractionIfIdle(): void {
    if (this.machine.mode === 'idle') this.endInteraction();
  }

  /** Losing focus mid-drag must not leave the machine stuck in `panning`. */
  onBlur(): void {
    this.machine.setSpacePressed(false);
    this.spacePressed.set(false);
    if (this.machine.mode === 'idle') return;
    this.machine.cancel();
    this.endInteraction();
  }

  onWheel(event: WheelEvent): void {
    const changed = this.machine.wheel({
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      deltaMode: event.deltaMode,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      ...this.toLocalClient(event),
    });
    if (!changed) return;

    event.preventDefault();
    this.requestFrame();
    this.scheduleSettle();
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === ' ') {
      this.setSpace(true);
      event.preventDefault();
      return;
    }
    if (this.applyKeyboardCommand(event)) event.preventDefault();
  }

  onKeyUp(event: KeyboardEvent): void {
    if (event.key === ' ') this.setSpace(false);
  }

  // ------------------------------------------------------------------ helpers

  /** Whether a press landed on the plane rather than on a mounted item. */
  private isEmptySpace(event: PointerEvent): boolean {
    const target = event.target as Element | null;
    return !target?.closest('[data-slot="canvas-item"]');
  }

  /** World bounds of every item, or `null` when there are none. */
  private contentBounds(): CanvasRect | null {
    return this.layer?.bounds() ?? boundsOf([]);
  }

  /**
   * Culls to the current viewport. Runs at the end of every frame but exits
   * immediately while the viewport is still inside the overscan window, so the
   * spatial index is queried on viewport *crossings*, not per frame.
   */
  private cull(): void {
    this.layer?.update(visibleWorldRect(this.machine.viewport, this.size), this.overscanWorld());
  }

  /** The overscan margin expressed in world units at the current zoom. */
  private overscanWorld(): number {
    return this.overscan() / this.machine.viewport.zoom;
  }

  private rebuildLayer(items: readonly T[]): void {
    if (!this.mounted) return;

    const template = this.itemTemplateRef;
    if (!template) {
      this.pool?.clear();
      this.layer = undefined;
      return;
    }

    this.pool ??= new CanvasItemViewPool<CanvasItemContext<T>>(
      this.itemAnchor(),
      template,
      this.viewportRef().nativeElement,
      emptyItemContext<T>,
    );
    this.layer ??= new CanvasItemLayer<T>(this.pool);
    this.layer.setItems(items);
  }

  private limits(): { minZoom: number; maxZoom: number } {
    return { minZoom: this.minZoom(), maxZoom: this.maxZoom() };
  }

  private measure(): void {
    const rect = this.rootRef().nativeElement.getBoundingClientRect();
    this.size.width = rect.width;
    this.size.height = rect.height;
  }

  private originOffset(): CanvasPoint {
    const rect = this.rootRef().nativeElement.getBoundingClientRect();
    return { x: rect.left, y: rect.top };
  }

  /** Client coordinates → coordinates relative to the canvas root. */
  private toLocal(point: CanvasPoint): CanvasPoint {
    const origin = this.originOffset();
    return { x: point.x - origin.x, y: point.y - origin.y };
  }

  private toLocalClient(event: { clientX: number; clientY: number }): { clientX: number; clientY: number } {
    const local = this.toLocal({ x: event.clientX, y: event.clientY });
    return { clientX: local.x, clientY: local.y };
  }

  private setSpace(down: boolean): void {
    if (this.machine.spacePressed === down) return;
    this.machine.setSpacePressed(down);
    this.spacePressed.set(down);
  }

  /** Returns true when the key was handled. */
  private applyKeyboardCommand(event: KeyboardEvent): boolean {
    const pan = this.keyboardPan(event.key);
    if (pan) {
      const step = event.shiftKey ? KEYBOARD_PAN_STEP * KEYBOARD_PAN_MULTIPLIER : KEYBOARD_PAN_STEP;
      this.machine.setViewport({
        x: this.machine.viewport.x + pan.x * step,
        y: this.machine.viewport.y + pan.y * step,
        zoom: this.machine.viewport.zoom,
      });
      this.commit();
      return true;
    }

    const factor = this.keyboardZoom(event.key);
    if (factor) {
      this.zoomBy(factor);
      return true;
    }

    if (event.key === '0') {
      this.resetView();
      return true;
    }
    return false;
  }

  private keyboardPan(key: string): CanvasPoint | null {
    switch (key) {
      case 'ArrowLeft':
        return { x: 1, y: 0 };
      case 'ArrowRight':
        return { x: -1, y: 0 };
      case 'ArrowUp':
        return { x: 0, y: 1 };
      case 'ArrowDown':
        return { x: 0, y: -1 };
      default:
        return null;
    }
  }

  private keyboardZoom(key: string): number | null {
    if (key === '+' || key === '=') return KEYBOARD_ZOOM_FACTOR;
    if (key === '-' || key === '_') return 1 / KEYBOARD_ZOOM_FACTOR;
    return null;
  }

  /**
   * Take the pointer, or carry on without it.
   *
   * `setPointerCapture` throws for a pointer the browser does not consider
   * active — a synthetic event, or one already released — and a throw inside
   * a listener abandons everything after it, which here means the interaction
   * never officially begins and `will-change` is never set. Capture is an
   * optimisation for keeping events flowing to one element; losing it is
   * survivable, losing the rest of the handler is not.
   */
  private captureQuietly(pointerId: number): void {
    try {
      this.rootRef().nativeElement.setPointerCapture(pointerId);
    } catch {
      // No active pointer with that id. Events still arrive by bubbling.
    }
  }

  private releaseCapture(pointerId: number): void {
    const root = this.rootRef().nativeElement;
    if (root.hasPointerCapture(pointerId)) root.releasePointerCapture(pointerId);
  }

  private beginInteraction(): void {
    this.interacting.set(true);
    this.viewportRef().nativeElement.style.willChange = 'transform';
    if (this.settleHandle) clearTimeout(this.settleHandle);
  }

  private endInteraction(): void {
    this.interacting.set(false);
    this.viewportRef().nativeElement.style.willChange = 'auto';
    this.scheduleSettle();
  }

  /** Applies an imperative viewport change: repaint now, notify once settled. */
  private commit(): void {
    this.requestFrame();
    this.scheduleSettle();
  }

  private scheduleSettle(): void {
    if (this.settleHandle) clearTimeout(this.settleHandle);
    this.settleHandle = setTimeout(() => {
      this.settleHandle = undefined;
      const { x, y, zoom } = this.machine.viewport;
      this.viewportChange.emit({ x, y, zoom });
    }, VIEWPORT_SETTLE_MS);
  }

  private requestFrame(): void {
    if (this.frameHandle || !this.mounted) return;
    this.frameHandle = requestAnimationFrame(this.renderFrame);
  }

  private readonly renderFrame = (): void => {
    this.frameHandle = 0;
    this.paint();
  };

  /**
   * The entire hot path: two style writes on the wrapper and two on the root's
   * grid background. No signals, no change detection, no layout reads.
   */
  private paint(): void {
    if (!this.mounted) return;
    const viewport = this.machine.viewport;

    this.viewportRef().nativeElement.style.transform = transformCss(viewport);
    this.paintGrid(viewport);
    this.edgeRenderer?.draw(viewport, visibleWorldRect(viewport, this.size));
    this.cull();
  }

  private resizeEdgeCanvas(): void {
    this.edgeRenderer?.resize(this.size.width, this.size.height, globalThis.devicePixelRatio || 1);
  }

  private rebuildEdges(items: readonly T[], edges: readonly CanvasEdge[]): void {
    if (!this.edgeRenderer) return;
    this.edgeRenderer.setEdges(edges, new Map(items.map(item => [item.id, item])));
  }

  private paintGrid(viewport: CanvasViewport): void {
    const root = this.rootRef().nativeElement;
    const spacing = this.gridSize() * viewport.zoom;

    if (!this.showGrid() || spacing < MIN_GRID_SPACING_PX) {
      root.style.backgroundImage = 'none';
      return;
    }

    root.style.backgroundImage = '';
    root.style.backgroundSize = `${spacing}px ${spacing}px`;
    root.style.backgroundPosition = `${viewport.x}px ${viewport.y}px`;
  }
}
