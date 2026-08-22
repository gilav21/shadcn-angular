import {
  ChangeDetectionStrategy,
  Component,
  ContentChild,
  DestroyRef,
  ElementRef,
  TemplateRef,
  computed,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { acquireAriaLive } from '../../lib/sortable-aria-live';
import { cn } from '../../lib/utils';
import {
  InfiniteCanvasComponent,
  InfiniteCanvasItemDirective,
  type CanvasPoint,
} from '../infinite-canvas';
import {
  NodeEditorNodeDirective,
  type NodeEditorNodeContext,
} from './node-editor-node.directive';
import {
  addConnection,
  connectionInto,
  removeConnections,
  removeNodes,
  samePort,
  toCanvasEdges,
} from './node-editor.graph';
import { defaultMetrics, portAnchor, portsOf, withDerivedHeights } from './node-editor.layout';
import { NodeEditorNodeComponent } from './sub/node-editor-node.component';
import type {
  ConnectRejection,
  NodeId,
  EditorNode,
  EditorSelection,
  NodeConnection,
  PendingConnection,
  PortRef,
} from './node-editor.types';
import { canConnect, type GraphView } from './node-editor.validate';

/** Why a connection attempt failed, and which ports were involved. */
export interface ConnectionRejectedEvent {
  readonly reason: ConnectRejection;
  readonly from: PortRef;
  readonly to: PortRef;
}

/** Human-readable text for each rejection, used in announcements. */
const REJECTION_TEXT: Record<ConnectRejection, string> = {
  'unknown-node': 'that node no longer exists',
  'unknown-port': 'that port no longer exists',
  'same-node': 'a node cannot connect to itself',
  'same-direction': 'connect an output to an input',
  'port-disabled': 'that port is disabled',
  'type-mismatch': 'those port types are incompatible',
  duplicate: 'those ports are already connected',
  occupied: 'that input already has a connection',
  cycle: 'that would create a cycle',
};

const EMPTY_SELECTION: EditorSelection = { nodes: [], connections: [] };

/** Pointer movement, in screen pixels, before a press counts as a drag. */
const DRAG_THRESHOLD_PX = 3;

interface DragState {
  readonly pointerId: number;
  readonly origin: CanvasPoint;
  /** World positions at the moment the drag began, keyed by node id. */
  readonly start: ReadonlyMap<NodeId, CanvasPoint>;
  /**
   * Set when the press landed on a node that was ALREADY part of a multiple
   * selection. Collapsing the selection there and then would make a
   * multi-selection impossible to drag, so the collapse waits until the
   * pointer is released without having moved — i.e. until it is a click.
   */
  readonly collapseTo: NodeId | null;
  moved: boolean;
}

/**
 * A graph of nodes with named ports, connected by edges between those ports.
 *
 * Built on `ui-infinite-canvas`, which supplies pan, zoom, virtualisation and
 * the batched edge layer. This adds ports, port-anchored edges, connect and
 * disconnect, node dragging, selection — and the keyboard and screen-reader
 * model that makes all of it usable without a mouse, which is the part every
 * other node-graph library omits. See `specs/node-editor-spec.md`.
 *
 * ### Why events are delegated rather than bound
 *
 * Node cards are created and recycled by the canvas's view pool as the
 * viewport moves, so there is no stable binding scope to attach handlers to.
 * The editor listens once at its root and resolves the target from
 * `data-node` / `data-port`.
 */
@Component({
  selector: 'ui-node-editor',
  exportAs: 'uiNodeEditor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InfiniteCanvasComponent, InfiniteCanvasItemDirective, NodeEditorNodeComponent],
  templateUrl: './node-editor.component.html',
  styleUrl: './node-editor.component.css',
  /*
   * Delegation lives on the HOST, not on a wrapper div in the template.
   *
   * A div carrying pointer and key handlers is not focusable, which is both an
   * `interactive-supports-focus` lint error and a real defect — it reads as a
   * control to a linter and to nobody else. Giving it `tabindex` would invent a
   * tab stop that does nothing. These handlers are not an element's behaviour;
   * they are the component catching events that bubbled up from the node cards
   * the canvas pool creates and recycles. The host is where that belongs.
   *
   * `keydown` is NOT here — see the capture-phase listener in the constructor.
   */
  host: {
    class: 'contents',
    '(pointerdown)': 'onPointerDown($event)',
    '(pointermove)': 'onPointerMove($event)',
    '(pointerup)': 'onPointerUp($event)',
    '(pointercancel)': 'onPointerCancel()',
    '(focusin)': 'onNodeFocus($event)',
  },
})
export class NodeEditorComponent {
  /** Every node in the graph. Heights are derived and written back. */
  readonly nodes = model<readonly EditorNode[]>([]);
  /** Every connection in the graph. */
  readonly connections = model<readonly NodeConnection[]>([]);
  /** What is currently selected. */
  readonly selection = model<EditorSelection>(EMPTY_SELECTION);

  /** When `false`, a connection that would close a directed cycle is refused. */
  readonly allowCycles = input(true);
  /** Snap dragged nodes to a world-unit grid. `0` disables snapping. */
  readonly gridSnap = input(0);
  /** Whether nodes may be moved, connected or deleted. */
  readonly readonlyGraph = input(false);
  /**
   * Above this node count the parallel accessible tree is summarised rather
   * than rendered in full — it is the one part of the design that does not
   * virtualise, being O(nodes) DOM by definition.
   */
  readonly a11yTreeLimit = input(500);
  /** Extra classes for the editor root. Give it a height here. */
  readonly class = input('');
  readonly ariaLabel = input('Node editor');
  readonly showGrid = input(true);

  readonly connectionRejected = output<ConnectionRejectedEvent>();

  @ContentChild(NodeEditorNodeDirective, { read: TemplateRef })
  nodeTemplateRef?: TemplateRef<NodeEditorNodeContext>;

  /**
   * The editor root. Measured instead of the host element: the host is
   * `display: contents`, so its own `getBoundingClientRect()` is all zeros and
   * every screen-space conversion built on it would be silently wrong.
   */
  private readonly document = inject(DOCUMENT);
  private readonly rootRef = viewChild.required<ElementRef<HTMLElement>>('root');
  private readonly canvas = viewChild.required(InfiniteCanvasComponent);

  /**
   * Resolved once, not per call: it reads `matchMedia`, and every port anchor
   * on every frame would otherwise re-ask the same question.
   */
  protected readonly metrics = defaultMetrics();

  /**
   * Shared empty set for nodes with no connected ports.
   *
   * A fresh `new Set()` in the template would be a new reference every change
   * detection pass, so every node card would see its input change and re-render
   * on every frame.
   */
  protected readonly emptyPorts: ReadonlySet<string> = new Set<string>();

  private readonly live = acquireAriaLive();
  private drag: DragState | null = null;

  protected readonly pending = signal<PendingConnection | null>(null);
  /** The node holding the roving tab stop. */
  protected readonly focusedNode = signal<NodeId | null>(null);
  /** The port the keyboard is on within the focused node. */
  protected readonly activePort = signal<string | null>(null);

  constructor() {
    /*
     * Keys are captured, not bubbled.
     *
     * The engine's own keydown handler is on its <section>, which is a
     * DESCENDANT of this host. On the bubble path the engine therefore acts
     * first: pressing shift+Right nudged the node AND panned the viewport, so
     * the node moved 8 units right in the world and the camera moved further
     * than that, leaving it visibly further LEFT. Calling stopPropagation from
     * a bubble listener is too late — the pan already happened.
     *
     * Capturing on the host runs before any descendant, so once a node has
     * focus the arrow keys belong to the graph and the engine never sees them.
     * Found by the e2e suite; the unit test missed it because a viewport pan
     * does not change a node's world coordinates, only where it is drawn.
     */
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const onKeyDownCapture = (event: Event): void => this.onKeyDown(event as KeyboardEvent);
    element.addEventListener('keydown', onKeyDownCapture, true);

    inject(DestroyRef).onDestroy(() => {
      element.removeEventListener('keydown', onKeyDownCapture, true);
      this.live.release();
    });
  }

  /** Nodes with their derived heights applied — what the canvas actually renders. */
  protected readonly sizedNodes = computed(() =>
    withDerivedHeights(this.nodes(), this.metrics),
  );

  private readonly selectedNodeIds = computed(() => new Set(this.selection().nodes));
  private readonly selectedConnectionIds = computed(() => new Set(this.selection().connections));

  protected readonly canvasEdges = computed(() =>
    toCanvasEdges(this.sizedNodes(), this.connections(), {
      selected: this.selectedConnectionIds(),
      metrics: this.metrics,
      defaultColor: 'var(--color-muted-foreground)',
      selectedColor: 'var(--color-primary)',
    }),
  );

  /** Which ports already carry a connection, so their dots render filled. */
  protected readonly connectedPorts = computed(() => {
    const index = new Map<NodeId, Set<string>>();
    const mark = (nodeId: NodeId, portId: string): void => {
      const ports = index.get(nodeId);
      if (ports) ports.add(portId);
      else index.set(nodeId, new Set([portId]));
    };
    for (const connection of this.connections()) {
      mark(connection.source, connection.sourcePort);
      mark(connection.target, connection.targetPort);
    }
    return index;
  });

  protected readonly rootClasses = computed(() =>
    cn('relative h-full w-full', this.class()),
  );

  /**
   * The graph rendered as text: every node, its ports, and what each port
   * connects to.
   *
   * Virtualisation keeps off-screen nodes out of the DOM, which breaks
   * screen-reader traversal of the spatial view by construction. This is not a
   * summary of the graph — it *is* the graph, and it is the only complete view
   * of it in the accessibility tree.
   */
  protected readonly a11yTree = computed(() => {
    const nodes = this.sizedNodes();
    if (nodes.length > this.a11yTreeLimit()) return null;

    const connections = this.connections();
    const titleOf = new Map(nodes.map(node => [node.id, node.title]));

    return nodes.map(node => ({
      id: node.id,
      title: node.title,
      ports: portsOf(node).map(port => {
        const links = connections
          .filter(connection =>
            port.direction === 'out'
              ? connection.source === node.id && connection.sourcePort === port.id
              : connection.target === node.id && connection.targetPort === port.id,
          )
          .map(connection =>
            port.direction === 'out'
              ? `${titleOf.get(connection.target) ?? connection.target}, ${connection.targetPort}`
              : `${titleOf.get(connection.source) ?? connection.source}, ${connection.sourcePort}`,
          );
        return { id: port.id, label: port.label, direction: port.direction, links };
      }),
    }));
  });

  /** Stated when the graph is too large to mirror in full. */
  protected readonly a11ySummary = computed(
    () =>
      `${this.sizedNodes().length} nodes and ${this.connections().length} connections. ` +
      'The graph is too large to list; use the canvas to explore it.',
  );

  /** The pending connection in screen coordinates, for the overlay path. */
  protected readonly pendingPath = computed(() => {
    const state = this.pending();
    if (!state) return null;

    const from = this.worldAnchor(state.from);
    if (!from) return null;

    const a = this.toLocal(this.canvas().worldToScreen(from));
    const b = this.toLocal(this.canvas().worldToScreen(state.to));
    const reach = Math.max(Math.abs(b.x - a.x) * 0.5, 30);
    return `M ${a.x} ${a.y} C ${a.x + reach} ${a.y}, ${b.x - reach} ${b.y}, ${b.x} ${b.y}`;
  });

  // ------------------------------------------------------------------ pointer

  protected onPointerDown(event: PointerEvent): void {
    const port = this.portFromEvent(event);
    if (port) {
      this.beginConnect(port, event);
      return;
    }

    const nodeId = this.nodeIdFromEvent(event);
    if (nodeId === null) {
      this.clearSelection();
      return;
    }

    const collapseTo = this.selectNode(nodeId, event.shiftKey);
    this.focusedNode.set(nodeId);
    this.beginDrag(nodeId, event, collapseTo);
  }

  protected onPointerMove(event: PointerEvent): void {
    if (this.pending()) {
      this.updatePending(event);
      return;
    }
    this.updateDrag(event);
  }

  protected onPointerUp(event: PointerEvent): void {
    const state = this.pending();
    if (state) {
      // Resolve the drop from where the pointer actually IS. `pointerup` is
      // retargeted by implicit capture on touch exactly as the moves were, so
      // trusting the last known `over` would depend on a move having landed.
      this.commitPending({ ...state, over: this.portAtPointer(event) });
      return;
    }
    const drag = this.drag;
    if (drag?.pointerId !== event.pointerId) return;
    this.drag = null;

    // A press on an already-selected node that never became a drag is a click,
    // and a click selects just that node.
    if (!drag.moved && drag.collapseTo !== null) {
      this.selection.set({ nodes: [drag.collapseTo], connections: [] });
    }
  }

  /**
   * A cancelled gesture is not a drop. The OS taking the pointer away — a
   * system gesture, a second finger — must abandon the connection rather than
   * commit it wherever the finger happened to be.
   */
  protected onPointerCancel(): void {
    if (this.pending()) {
      this.pending.set(null);
      this.announce('Connection cancelled.');
    }
    this.drag = null;
  }

  private beginConnect(port: PortRef, event: PointerEvent): void {
    if (this.readonlyGraph()) return;

    // Grabbing an occupied input detaches its existing connection rather than
    // refusing: it is the only gesture that reads as "unplug this".
    const existing = connectionInto(this.connections(), port);
    const anchor = existing
      ? { node: existing.source, port: existing.sourcePort }
      : port;

    if (existing) {
      this.connections.set(removeConnections(this.connections(), [existing.id]));
    }

    const world = this.canvas().screenToWorld({ x: event.clientX, y: event.clientY });
    this.pending.set({ from: anchor, to: world, over: null, valid: false, detached: existing });
    event.preventDefault();
  }

  private updatePending(event: PointerEvent): void {
    const state = this.pending();
    if (!state) return;

    const world = this.canvas().screenToWorld({ x: event.clientX, y: event.clientY });
    const over = this.portAtPointer(event);
    const valid = over !== null && this.evaluate(state.from, over).ok;

    if (samePort(over, state.over) && state.valid === valid) {
      this.pending.set({ ...state, to: world });
      return;
    }
    this.pending.set({ ...state, to: world, over, valid });
  }

  private commitPending(state: PendingConnection): void {
    this.pending.set(null);
    if (!state.over) {
      // Dropped in empty space. A detached connection stays deleted — that is
      // what unplugging and letting go means.
      if (state.detached) this.announce('Connection removed.');
      return;
    }
    this.connect(state.from, state.over);
  }

  private beginDrag(
    nodeId: NodeId,
    event: PointerEvent,
    collapseTo: NodeId | null,
  ): void {
    const node = this.sizedNodes().find(candidate => candidate.id === nodeId);
    if (this.readonlyGraph() || !node || node.locked) return;

    const moving = this.selectedNodeIds().has(nodeId)
      ? this.sizedNodes().filter(candidate => this.selectedNodeIds().has(candidate.id))
      : [node];

    this.drag = {
      pointerId: event.pointerId,
      origin: this.canvas().screenToWorld({ x: event.clientX, y: event.clientY }),
      start: new Map(
        moving.filter(candidate => !candidate.locked).map(candidate => [
          candidate.id,
          { x: candidate.x, y: candidate.y },
        ]),
      ),
      collapseTo,
      moved: false,
    };
  }

  private updateDrag(event: PointerEvent): void {
    const drag = this.drag;
    if (drag?.pointerId !== event.pointerId) return;

    const world = this.canvas().screenToWorld({ x: event.clientX, y: event.clientY });
    const dx = world.x - drag.origin.x;
    const dy = world.y - drag.origin.y;

    if (!drag.moved && Math.hypot(dx, dy) * this.zoom() < DRAG_THRESHOLD_PX) return;
    drag.moved = true;

    this.nodes.set(
      this.nodes().map(node => {
        const start = drag.start.get(node.id);
        if (!start) return node;
        return { ...node, ...this.snap({ x: start.x + dx, y: start.y + dy }) };
      }),
    );
  }

  // ----------------------------------------------------------------- keyboard

  protected onKeyDown(event: KeyboardEvent): void {
    if (this.handleGlobalKey(event) || this.handlePortKey(event) || this.handleNodeKey(event)) {
      event.preventDefault();
      // The engine pans on arrows and resets on `0`. Once a node has focus
      // those keys belong to the graph, so it must not also see them.
      event.stopPropagation();
    }
  }

  private handleGlobalKey(event: KeyboardEvent): boolean {
    if (event.key === 'Escape') {
      if (this.pending()) {
        this.pending.set(null);
        this.announce('Connection cancelled.');
      } else {
        this.clearSelection();
      }
      return true;
    }
    if (event.key === 'a' && (event.ctrlKey || event.metaKey)) {
      this.selection.set({
        nodes: this.sizedNodes().map(node => node.id),
        connections: this.connections().map(connection => connection.id),
      });
      this.announce(`${this.selection().nodes.length} nodes selected.`);
      return true;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      this.deleteSelection();
      return true;
    }
    return false;
  }

  /** `Tab` cycles ports within the focused node; `Enter` connects them. */
  private handlePortKey(event: KeyboardEvent): boolean {
    const node = this.focusedEditorNode();
    if (!node) return false;

    if (event.key === 'Tab' && portsOf(node).length > 0) {
      this.cyclePort(node, event.shiftKey ? -1 : 1);
      return true;
    }
    if (event.key !== 'Enter') return false;

    const port = this.activePort();
    if (!port) return false;
    return this.toggleKeyboardConnect({ node: node.id, port });
  }

  private handleNodeKey(event: KeyboardEvent): boolean {
    const direction = arrowDirection(event.key);
    if (!direction) return false;

    const node = this.focusedEditorNode();
    if (!node) return false;

    // Shift turns the arrows into a nudge. Not Space, which the engine already
    // claims as its pan modifier — overloading it would make holding Space and
    // pressing Right mean two different things depending on what has focus.
    if (event.shiftKey) {
      this.nudge(node, direction);
      return true;
    }
    const next = nearestInDirection(this.sizedNodes(), node, direction);
    if (!next) return true;

    this.focusNode(next.id);
    return true;
  }

  private cyclePort(node: EditorNode, step: number): void {
    const ids = portsOf(node).map(port => port.id);
    const current = this.activePort();
    const index = current ? ids.indexOf(current) : -1;
    const next = ids[(index + step + ids.length) % ids.length];
    this.activePort.set(next);

    const port = portsOf(node).find(candidate => candidate.id === next);
    if (port) this.announce(`${port.label}, ${port.direction === 'out' ? 'output' : 'input'}.`);
  }

  /** `Enter` starts a keyboard connection, or completes one in flight. */
  private toggleKeyboardConnect(ref: PortRef): boolean {
    const state = this.pending();
    if (!state) {
      if (this.readonlyGraph()) return true;
      const world = this.worldAnchor(ref);
      if (!world) return true;
      this.pending.set({ from: ref, to: world, over: null, valid: false, detached: null });
      this.announce('Connecting. Move to another port and press Enter, or Escape to cancel.');
      return true;
    }

    this.pending.set(null);
    this.connect(state.from, ref);
    return true;
  }

  private nudge(node: EditorNode, direction: CanvasPoint): void {
    if (this.readonlyGraph() || node.locked) return;

    const step = this.gridSnap() || 8;
    const moved = this.snap({
      x: node.x + direction.x * step,
      y: node.y + direction.y * step,
    });
    this.nodes.set(
      this.nodes().map(candidate =>
        candidate.id === node.id ? { ...candidate, ...moved } : candidate,
      ),
    );
    this.announce(`${node.title} moved to ${Math.round(moved.x)}, ${Math.round(moved.y)}.`);
  }

  protected onNodeFocus(event: FocusEvent): void {
    const nodeId = this.nodeIdFromEvent(event);
    if (nodeId !== null) this.focusedNode.set(nodeId);
  }

  // ------------------------------------------------------------------ actions

  /**
   * Attempt a connection. The single funnel both the pointer and the keyboard
   * run through, so the two cannot disagree about what is allowed.
   */
  private connect(from: PortRef, to: PortRef): void {
    const result = this.evaluate(from, to);
    if (!result.ok) {
      this.connectionRejected.emit({ reason: result.reason, from, to });
      this.announce(`Cannot connect: ${REJECTION_TEXT[result.reason]}.`);
      return;
    }

    this.connections.set(addConnection(this.connections(), result.source, result.target));
    this.announce(`Connected ${result.source.port} to ${result.target.port}.`);
  }

  private evaluate(from: PortRef, to: PortRef): ReturnType<typeof canConnect> {
    const graph: GraphView = {
      nodes: this.sizedNodes(),
      connections: this.connections(),
      allowCycles: this.allowCycles(),
    };
    return canConnect(graph, from, to);
  }

  private deleteSelection(): void {
    if (this.readonlyGraph()) return;

    const selection = this.selection();
    const afterEdges = removeConnections(this.connections(), selection.connections);
    const result = removeNodes(this.sizedNodes(), afterEdges, selection.nodes);

    const removedNodes = this.sizedNodes().length - result.nodes.length;
    const removedEdges = this.connections().length - result.connections.length;
    if (removedNodes === 0 && removedEdges === 0) return;

    this.nodes.set(result.nodes);
    this.connections.set(result.connections);
    this.selection.set(EMPTY_SELECTION);
    this.announce(`Removed ${removedNodes} nodes and ${removedEdges} connections.`);
  }

  /**
   * Apply a press to the selection, and report whether the collapse to a
   * single node has been deferred to pointer-up.
   */
  private selectNode(nodeId: NodeId, additive: boolean): NodeId | null {
    const current = this.selection();

    if (additive) {
      const already = current.nodes.includes(nodeId);
      this.selection.set({
        ...current,
        nodes: already
          ? current.nodes.filter(id => id !== nodeId)
          : [...current.nodes, nodeId],
      });
      return null;
    }

    if (!current.nodes.includes(nodeId)) {
      this.selection.set({ nodes: [nodeId], connections: [] });
      return null;
    }

    // Already selected. Leave the selection intact so a drag moves all of it,
    // and defer the collapse in case this turns out to be a click.
    return current.nodes.length > 1 || current.connections.length > 0 ? nodeId : null;
  }

  private clearSelection(): void {
    if (this.selection().nodes.length === 0 && this.selection().connections.length === 0) return;
    this.selection.set(EMPTY_SELECTION);
  }

  /** Focus a node, panning it into view when virtualisation has culled it. */
  focusNode(nodeId: NodeId): void {
    const node = this.sizedNodes().find(candidate => candidate.id === nodeId);
    if (!node) return;

    this.focusedNode.set(nodeId);
    this.activePort.set(null);

    const visible = this.canvas().visibleWorldRect();
    const centre = { x: node.x + node.width / 2, y: node.y + node.height / 2 };
    const offscreen =
      centre.x < visible.x ||
      centre.y < visible.y ||
      centre.x > visible.x + visible.width ||
      centre.y > visible.y + visible.height;
    if (offscreen) this.canvas().panTo(centre);

    this.announce(node.title);
    // The element only exists once the layer has mounted it, which for a
    // culled node happens after the pan above.
    queueMicrotask(() => this.nodeElement(nodeId)?.focus());
  }

  // ------------------------------------------------------------------ helpers

  private focusedEditorNode(): EditorNode | null {
    const id = this.focusedNode();
    if (id === null) return null;
    return this.sizedNodes().find(node => node.id === id) ?? null;
  }

  private nodeElement(nodeId: NodeId): HTMLElement | null {
    return this.rootRef().nativeElement.querySelector<HTMLElement>(
      `[data-slot="node-editor-node"][data-node="${CSS.escape(String(nodeId))}"]`,
    );
  }

  private zoom(): number {
    return this.canvas().viewport.zoom;
  }

  private snap(point: CanvasPoint): CanvasPoint {
    const grid = this.gridSnap();
    if (grid <= 0) return point;
    return { x: Math.round(point.x / grid) * grid, y: Math.round(point.y / grid) * grid };
  }

  /** A port's absolute world position, for the pending edge's fixed end. */
  private worldAnchor(ref: PortRef): CanvasPoint | null {
    const node = this.sizedNodes().find(candidate => candidate.id === ref.node);
    if (!node) return null;
    const offset = portAnchor(node, ref.port, this.metrics);
    if (!offset) return null;
    return { x: node.x + offset.x, y: node.y + offset.y };
  }

  private toLocal(clientPoint: CanvasPoint): CanvasPoint {
    const rect = this.rootRef().nativeElement.getBoundingClientRect();
    return { x: clientPoint.x - rect.left, y: clientPoint.y - rect.top };
  }

  /**
   * The port a press landed on. Safe to read from `event.target`, because
   * `pointerdown` is not retargeted on any input type.
   */
  private portFromEvent(event: Event): PortRef | null {
    return this.portFromElement(event.target as Element | null);
  }

  /**
   * The port currently UNDER the pointer, resolved by hit-testing the position
   * rather than reading `event.target`.
   *
   * This distinction is the whole reason connecting worked with a mouse and was
   * impossible with a finger. Touch pointers have **implicit capture**: after
   * `pointerdown`, every `pointermove` and `pointerup` for that pointer is
   * retargeted to the element the finger started on. So `event.target` during a
   * touch drag is always the SOURCE port — the drop target could never be
   * anything else, and every connection was refused as `same-node`.
   *
   * Hit-testing the coordinates is correct for both, so there is one path.
   */
  private portAtPointer(event: PointerEvent): PortRef | null {
    const element = this.document.elementFromPoint(event.clientX, event.clientY);
    return this.portFromElement(element);
  }

  private portFromElement(target: Element | null): PortRef | null {
    const element = target?.closest<HTMLElement>('[data-slot="node-editor-port"]');
    const nodeId = element?.dataset['node'];
    const portId = element?.dataset['port'];
    if (nodeId === undefined || portId === undefined) return null;
    return { node: this.resolveNodeId(nodeId), port: portId };
  }

  private nodeIdFromEvent(event: Event): NodeId | null {
    const element = (event.target as Element | null)?.closest<HTMLElement>(
      '[data-slot="node-editor-node"]',
    );
    const raw = element?.dataset['node'];
    return raw === undefined ? null : this.resolveNodeId(raw);
  }

  /**
   * Recover the original id from its `data-` string form.
   *
   * Node ids may be numbers, and `dataset` only ever hands back strings —
   * comparing the string to a numeric id would silently match nothing.
   */
  private resolveNodeId(raw: string): NodeId {
    return this.sizedNodes().find(node => String(node.id) === raw)?.id ?? raw;
  }

  private announce(message: string): void {
    this.live.announce(message);
  }
}

/** The unit vector an arrow key means, or `null` for any other key. */
function arrowDirection(key: string): CanvasPoint | null {
  switch (key) {
    case 'ArrowLeft':
      return { x: -1, y: 0 };
    case 'ArrowRight':
      return { x: 1, y: 0 };
    case 'ArrowUp':
      return { x: 0, y: -1 };
    case 'ArrowDown':
      return { x: 0, y: 1 };
    default:
      return null;
  }
}

/**
 * The nearest node in a direction on the plane.
 *
 * Spatial, not DOM order: nodes sit at arbitrary coordinates, so document
 * order carries no meaning a user could predict. Candidates are restricted to
 * a 90° cone so that pressing Right never selects something above, and scored
 * by distance with the off-axis component weighted, which keeps a node
 * directly to the right ahead of a nearer one far off to the side.
 */
function nearestInDirection(
  nodes: readonly EditorNode[],
  from: EditorNode,
  direction: CanvasPoint,
): EditorNode | null {
  const origin = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  let best: EditorNode | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const node of nodes) {
    if (node.id === from.id) continue;

    const dx = node.x + node.width / 2 - origin.x;
    const dy = node.y + node.height / 2 - origin.y;
    const along = dx * direction.x + dy * direction.y;
    if (along <= 0) continue;

    const across = Math.abs(dx * direction.y - dy * direction.x);
    if (across > along) continue;

    const score = along + across * 2;
    if (score < bestScore) {
      bestScore = score;
      best = node;
    }
  }
  return best;
}
