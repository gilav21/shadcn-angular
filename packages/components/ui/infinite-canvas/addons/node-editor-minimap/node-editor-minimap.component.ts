import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { UI_LOCALE_ID } from '../../../../lib/i18n';
import { isSecondaryTouch } from '../../../../lib/touch';
import { cn } from '../../../../lib/utils';
import { NODE_EDITOR_MINIMAP_LOCALES } from './node-editor-minimap.locales';
import type { CanvasPoint, CanvasRect, EditorNode, NodeConnection, NodeId } from '../node-editor';
import {
  coverage,
  fitTransform,
  grabbableRect,
  rectToMinimap,
  toMinimap,
  toWorld,
  type MinimapTransform,
} from './node-editor-minimap.utils';

/**
 * Most node boxes and edges drawn into the minimap, however many exist.
 *
 * The picture is a couple of hundred pixels across, so past this the marks
 * land on top of one another and add nothing a reader can see. Sampling with a
 * regular stride keeps the board's shape, which is what a minimap is for.
 */
const MAX_DRAWN_NODES = 2_000;
const MAX_DRAWN_EDGES = 2_000;

/**
 * An overview of the whole graph, and a way to navigate it.
 *
 * ### Why a canvas rather than DOM
 *
 * The base's edge layer already proves the pattern: at thousands of nodes, one
 * `<canvas>` with batched fills is the only version that holds a frame budget.
 * A minimap of DOM boxes would double the element count of a large graph for
 * something the size of a postage stamp.
 *
 * ### Why it takes data rather than the editor
 *
 * Nodes in, navigation out. It never touches the editor, so it can be rendered
 * and tested on its own — the same shape as the other addons.
 */
@Component({
  selector: 'ui-node-editor-minimap',
  exportAs: 'uiNodeEditorMinimap',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './node-editor-minimap.component.html',
  host: { class: 'contents' },
})
export class NodeEditorMinimapComponent {
  /** Nodes to plot on the overview. */
  readonly nodes = input<readonly EditorNode[]>([]);
  /** Edges to plot on the overview. */
  readonly connections = input<readonly NodeConnection[]>([]);
  /** The editor's visible world rect. */
  readonly viewport = input<CanvasRect | null>(null);

  /** Overview width in CSS pixels. */
  readonly width = input(200);
  /** Overview height in CSS pixels. */
  readonly height = input(140);
  /** Extra classes merged onto the overview. */
  readonly class = input('');
  /** Accessible name for the overview. */
  readonly ariaLabel = input('Graph overview');

  /**
   * Folded down to a single control.
   *
   * A `model`, so a consumer can start it collapsed on a narrow screen and
   * still let the reader open it: on a phone a 200x140 overview covers a
   * serious fraction of the canvas it exists to help navigate.
   */
  readonly collapsed = model(false);
  /** Whether the reader may fold it away. */
  readonly collapsible = input(true);

  /** The user asked to centre this world point. */
  readonly navigate = output<CanvasPoint>();

  private readonly localeId = inject(UI_LOCALE_ID);
  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('surface');
  private readonly dragging = signal(false);

  /**
   * The area the minimap shows: the graph AND the viewport.
   *
   * Pan away from every node and a content-only minimap would show the graph
   * filling the box while the viewport sat off the edge — losing the map at
   * exactly the moment it is most needed.
   */
  private readonly area = computed(() => coverage(this.nodes(), this.viewport()));

  private readonly transform = computed<MinimapTransform>(() =>
    fitTransform(this.area(), this.width(), this.height()),
  );

  protected readonly rootClasses = computed(() =>
    cn(
      'relative overflow-hidden rounded-md border bg-background/80 shadow-sm',
      this.dragging() ? 'cursor-grabbing' : 'cursor-pointer',
      this.collapsible() ? '' : this.class(),
    ),
  );

  /** Wraps the map and its collapse control, and carries the caller's class. */
  protected readonly shellClasses = computed(() => cn('relative', this.class()));

  protected readonly toggleClasses = computed(() =>
    cn(
      'flex size-10 items-center justify-center rounded-md border bg-background/80 text-sm',
      // WCAG 2.5.8 wants 44; 40 is the comfortable size with a mouse.
      'pointer-coarse:size-11',
      'text-muted-foreground shadow-sm hover:text-foreground',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      this.class(),
    ),
  );

  protected readonly t = computed(
    () => NODE_EDITOR_MINIMAP_LOCALES[this.localeId()] ?? NODE_EDITOR_MINIMAP_LOCALES['en'],
  );

  /** A short description of what the map shows, for a screen reader. */
  protected readonly summary = computed(
    () => `${this.nodes().length} nodes, ${this.connections().length} connections`,
  );

  constructor() {
    // Repaints after render whenever the inputs change. A canvas is not part
    // of the template's data binding, so something has to drive it.
    // Collapsed, there is no canvas to paint on.
    afterRenderEffect(() => {
      if (!this.collapsed()) this.paint();
    });

    /*
     * Released anywhere ends the drag, not just released over the map.
     *
     * A pointer that goes up outside the minimap — which is exactly what
     * happens when someone drags the viewport past the edge — would otherwise
     * leave it stuck in a dragging state, following the cursor forever.
     */
    const stop = (): void => this.dragging.set(false);
    globalThis.addEventListener('pointerup', stop);
    inject(DestroyRef).onDestroy(() => globalThis.removeEventListener('pointerup', stop));
  }

  protected onPointerDown(event: PointerEvent): void {
    // A second finger belongs to a pinch, not to navigating. Without this the
    // viewport lurches about while the other hand is only trying to zoom.
    if (isSecondaryTouch(event)) {
      this.dragging.set(false);
      return;
    }
    this.dragging.set(true);
    this.navigateTo(event);
  }

  protected onPointerMove(event: PointerEvent): void {
    if (isSecondaryTouch(event)) {
      this.dragging.set(false);
      return;
    }
    if (this.dragging()) this.navigateTo(event);
  }

  protected onPointerUp(): void {
    this.dragging.set(false);
  }

  /**
   * Keyboard navigation: arrows nudge the viewport across the map.
   *
   * A minimap that only responds to a pointer is a navigation control keyboard
   * users cannot use — and the base went to some length to make everything
   * else reachable.
   */
  protected onKeyDown(event: KeyboardEvent): void {
    const viewport = this.viewport();
    if (!viewport) return;

    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[
      event.key
    ];
    if (!step) return;

    event.preventDefault();
    const distance = event.shiftKey ? 1 : 0.25;
    this.navigate.emit({
      x: viewport.x + viewport.width / 2 + step[0] * viewport.width * distance,
      y: viewport.y + viewport.height / 2 + step[1] * viewport.height * distance,
    });
  }

  private navigateTo(event: PointerEvent): void {
    const surface = this.canvasRef()?.nativeElement;
    if (!surface) return;
    const rect = surface.getBoundingClientRect();
    this.navigate.emit(
      toWorld(
        { x: event.clientX - rect.left, y: event.clientY - rect.top },
        this.transform(),
      ),
    );
  }

  /**
   * The node index, cached against the array it was built from.
   *
   * A repaint happens on every viewport change - roughly eight times a second
   * while panning - and rebuilding this each time meant a hundred-thousand
   * entry Map eight times a second for a picture 200 pixels wide. Panning does
   * not change the node list, so the same array comes back and the same index
   * with it.
   */
  private static readonly indexes = new WeakMap<
    readonly EditorNode[],
    ReadonlyMap<NodeId, EditorNode>
  >();

  private nodeIndex(nodes: readonly EditorNode[]): ReadonlyMap<NodeId, EditorNode> {
    const cached = NodeEditorMinimapComponent.indexes.get(nodes);
    if (cached) return cached;

    const built = new Map(nodes.map(node => [node.id, node] as const));
    NodeEditorMinimapComponent.indexes.set(nodes, built);
    return built;
  }

  /**
   * Sizes the backing store, and only when it actually changed.
   *
   * Assigning `canvas.width` reallocates the whole backing store and resets
   * every context property, even when the value is identical. Doing it on each
   * repaint threw away and reallocated a quarter of a megabyte several times a
   * second for a picture whose size almost never changes.
   */
  private resizeSurface(canvas: HTMLCanvasElement, width: number, height: number): void {
    const dpr = globalThis.devicePixelRatio > 0 ? globalThis.devicePixelRatio : 1;
    const deviceWidth = Math.max(1, Math.round(width * dpr));
    const deviceHeight = Math.max(1, Math.round(height * dpr));

    if (canvas.width !== deviceWidth) canvas.width = deviceWidth;
    if (canvas.height !== deviceHeight) canvas.height = deviceHeight;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }

  /** One pass: edges, then node boxes, then the viewport rectangle. */
  private paint(): void {
    const canvas = this.canvasRef()?.nativeElement;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    const width = this.width();
    const height = this.height();
    this.resizeSurface(canvas, width, height);

    const dpr = globalThis.devicePixelRatio > 0 ? globalThis.devicePixelRatio : 1;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);

    const transform = this.transform();
    const nodes = this.nodes();
    const connections = this.connections();

    /*
     * Draw a sample, not the graph.
     *
     * This picture is a couple of hundred pixels across. A hundred thousand
     * node boxes do not fit in it in any sense - they land on top of one
     * another and the result is a grey rectangle - so drawing all of them
     * bought nothing and cost a blocking repaint several times a second while
     * panning. A regular stride keeps the SHAPE of the board, which is the
     * only thing a minimap is read for.
     */
    const nodeStride = Math.ceil(nodes.length / MAX_DRAWN_NODES);
    const edgeStride = Math.ceil(connections.length / MAX_DRAWN_EDGES);

    if (connections.length > 0) {
      const byId = this.nodeIndex(nodes);

      // Edges first, in ONE path — the same batching the base's edge renderer
      // uses, for the same reason: stroke calls are the cost, not paths.
      context.strokeStyle = 'rgba(120,120,120,0.45)';
      context.lineWidth = 1;
      context.beginPath();
      for (let i = 0; i < connections.length; i += edgeStride) {
        const connection = connections[i];
        const from = byId.get(connection.source);
        const to = byId.get(connection.target);
        if (!from || !to) continue;
        const a = toMinimap({ x: from.x + from.width, y: from.y + from.height / 2 }, transform);
        const b = toMinimap({ x: to.x, y: to.y + to.height / 2 }, transform);
        context.moveTo(a.x, a.y);
        context.lineTo(b.x, b.y);
      }
      context.stroke();
    }

    for (let i = 0; i < nodes.length; i += nodeStride) {
      const node = nodes[i];
      const box = rectToMinimap(
        { x: node.x, y: node.y, width: node.width, height: node.height },
        transform,
      );
      context.fillStyle = node.accent ?? 'rgba(120,120,120,0.85)';
      context.fillRect(box.x, box.y, Math.max(2, box.width), Math.max(2, box.height));
    }

    const viewport = this.viewport();
    if (!viewport) return;
    const box = grabbableRect(rectToMinimap(viewport, transform));
    context.strokeStyle = 'currentColor';
    context.lineWidth = 1.5;
    context.strokeRect(box.x, box.y, box.width, box.height);
  }
}
