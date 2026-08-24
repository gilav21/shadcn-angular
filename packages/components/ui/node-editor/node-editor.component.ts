import {
  ChangeDetectionStrategy,
  Component,
  ContentChild,
  DestroyRef,
  ElementRef,
  TemplateRef,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
  Injector,
  type Signal,
  type Type,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { acquireAriaLive } from '../../lib/sortable-aria-live';
import { isSecondaryTouch, onDoubleTap } from '../../lib/touch';
import { cn } from '../../lib/utils';
import {
  InfiniteCanvasComponent,
  InfiniteCanvasItemDirective,
  type CanvasPoint,
  type CanvasRect,
  type CanvasViewport,
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
import {
  NODE_DEFAULT_WIDTH,
  defaultMetrics,
  portAnchor,
  portsOf,
  withDerivedHeights,
} from './node-editor.layout';
import { indexDefinitions, withMaterializedTypes } from './node-editor.materialize';
import {
  GraphHistory,
  apply as applyGraphCommand,
  type GraphCommand,
} from './node-editor.history';
import { NodeGraphRuntime } from './node-editor.runtime';
import {
  NODE_CONTEXT,
  type GraphProblem,
  type NodeContext,
  type NodeSettledEvent,
  type NodeStatus,
  type NodeTypeDefinition,
  type RemoteExecutor,
  type RemoteRequest,
  type ReplayFrame,
  type RunFinishedEvent,
  type RunStartedEvent,
} from './node-editor.runtime.types';
import { NodeEditorNodeComponent } from './sub/node-editor-node.component';
import type {
  ConnectRejection,
  NodeId,
  NodePort,
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

/**
 * Whether a key event landed somewhere the user is typing.
 *
 * `isContentEditable` covers rich text; the tag check covers the rest. A
 * `select` counts too — its own keys pick options.
 */
function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element || typeof element.tagName !== 'string') return false;
  if (element.isContentEditable) return true;

  const tag = element.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select';
}

/** Pointer movement, in screen pixels, before a press counts as a drag. */
const DRAG_THRESHOLD_PX = 3;

/**
 * How long a node stays highlighted after it finishes work.
 *
 * Long enough to catch out of the corner of an eye while stepping, short
 * enough that live typing does not leave the whole graph permanently lit.
 */
const RECENTLY_RAN_MS = 900;

/**
 * Window in which a second double-activation is treated as an echo.
 *
 * A touch platform may deliver both a real double-tap and a synthesised
 * `dblclick` for one gesture.
 */
const DOUBLE_ACTIVATE_MS = 500;

/**
 * Things inside a node that own their own pointer behaviour.
 *
 * A node's view may contain the consumer's real controls — a text field, a
 * select, a button. Starting a node drag from one of those makes it impossible
 * to use: you cannot place a caret in an input if the press is being read as
 * the start of a drag. So a press landing on one of these is left alone.
 *
 * The same selector convention is already used by the collapsible trigger.
 */
const INTERACTIVE_IN_NODE =
  'input, textarea, select, button, a[href], [contenteditable], [role="button"], [data-node-interactive]';

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
    '(dblclick)': 'onDoubleClick($event)',
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
  /** Accessible name for the canvas. */
  readonly ariaLabel = input('Node editor');
  /** Draw the background grid behind the graph. */
  readonly showGrid = input(true);

  /**
   * The node types this graph may contain.
   *
   * Supplying them turns the editor from a drawing of a graph into a running
   * one: a node with a matching `type` inherits its ports, renders that type's
   * view, and has its `compute` evaluated by the runtime.
   */
  readonly definitions = input<readonly NodeTypeDefinition[]>([]);

  /**
   * Hands every ready `remote: true` node to a backend, in ONE call per tick.
   *
   * Returning the promise is resolution; throwing is failure; the AbortSignal
   * arrives already wired.
   */
  readonly executeRemote = input<RemoteExecutor | null>(null);

  /**
   * Whether a change re-evaluates the graph immediately.
   *
   * `true` gives live dataflow — type in one node and downstream updates as
   * you go. `false` waits for `run()`, which is what a graph full of
   * side-effecting steps wants. Individual node types opt out either way via
   * their own `reactive` flag.
   */
  readonly live = input(true);

  /**
   * Show a past run's values instead of the live ones.
   *
   * Bind a frame and every node view renders what it held then — the same
   * views, the same layout, different values. Evaluation is suspended for as
   * long as a frame is bound, because a graph cannot be showing the past and
   * computing the present at the same time; that is not a silent override of
   * `live` but the meaning of replay.
   *
   * The base owns this rather than an addon because node views read their
   * values through `NODE_CONTEXT`, which only the editor supplies — an addon
   * could not substitute them without forking the template.
   */
  readonly replay = input<ReplayFrame | null>(null);

  /** Emits when a drag would have made an invalid connection, with the reason it was refused. */
  readonly connectionRejected = output<ConnectionRejectedEvent>();

  /**
   * Fires alongside `executeRemote`, for observing or logging.
   *
   * Explicitly NOT authoritative: `executeRemote` does the work. Two ways to
   * answer the same request would leave nobody sure which one won.
   */
  readonly nodeExecute = output<readonly RemoteRequest[]>();

  /**
   * The user asked for a node here — double-click on empty plane.
   *
   * The base owns the intent and the insertion; the picker UI is an addon
   * (R15). Carries the WORLD point, so whatever opens can drop the node
   * exactly where the user asked rather than guessing.
   */
  readonly addNodeRequested = output<CanvasPoint>();

  /**
   * The viewport, when a pan or zoom SETTLES.
   *
   * Re-exposed from the engine so an addon talks to `ui-node-editor` rather
   * than reaching past it to the canvas underneath. Settle-only by the
   * engine's design — the hot path deliberately never touches Angular — which
   * is why a minimap updates after a pan rather than during one.
   */
  readonly viewportChange = output<CanvasViewport>();

  /**
   * Run lifecycle, for the run-history addon.
   *
   * Three separate outputs rather than one union, so a consumer that only
   * wants finished runs writes one handler and never sees the rest. A pass
   * with nothing to do emits nothing at all.
   */
  /**
   * A node the user asked to open — double-click on a node whose type
   * declares `openable`.
   *
   * The editor owns the gesture; what opening means is the consumer's. For a
   * subgraph node that is descending into its graph.
   */
  readonly nodeOpened = output<NodeId>();

  /** Emits when a run begins, before any node is evaluated. */
  readonly runStarted = output<RunStartedEvent>();
  /** Emits as each node reaches its final state during a run. */
  readonly nodeSettled = output<NodeSettledEvent>();
  /** Emits once a run has ended, whether it completed or failed. */
  readonly runFinished = output<RunFinishedEvent>();

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

  private readonly liveRegion = acquireAriaLive();
  private drag: DragState | null = null;
  private lastDoubleActivate = 0;
  private insertCounter = 0;

  /**
   * One runtime per editor instance, never a shared one — that is what keeps
   * nested graphs (a node owning a child runtime) buildable later.
   */
  readonly runtime = new NodeGraphRuntime();

  /** Undo/redo. Every mutation routes through here, which is the point of it. */
  readonly history = new GraphHistory();

  /** Problems the runtime found: missing required inputs, cycles, bad types. */
  readonly problems: Signal<readonly GraphProblem[]> = this.runtime.problems;

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

    /*
     * Double-tap is the touch half of double-click: opening a node that
     * contains a graph, and asking for a new node on empty plane. Without it
     * both depend on a synthesised `dblclick` that not every platform sends.
     */
    const stopDoubleTap = onDoubleTap(element, event => {
      const touch = event.changedTouches[0] ?? event.touches[0];
      if (touch) {
        this.handleDoubleActivate(touch.target, { x: touch.clientX, y: touch.clientY });
      }
    });

    this.runtime.onRunStarted = event => this.runStarted.emit(event);
    this.runtime.onNodeSettled = event => {
      this.markRecentlyRan(event.nodeId);
      this.nodeSettled.emit(event);
    };
    this.runtime.onRunFinished = event => this.runFinished.emit(event);

    /*
     * The runtime mirrors the graph.
     *
     * `setGraph` DIFFS rather than rebuilding, so an edit does not drop every
     * cached output and re-run everything — which is the whole point of the
     * incremental scheduler.
     */
    effect(() => {
      this.runtime.setDefinitions(this.definitions());
    });

    effect(() => {
      this.runtime.executeRemote = this.wrapExecutor(this.executeRemote());
      this.runtime.setGraph(this.sizedNodes(), this.connections());
      if (this.evaluating()) void this.runtime.run();
    });

    inject(DestroyRef).onDestroy(() => {
      element.removeEventListener('keydown', onKeyDownCapture, true);
      stopDoubleTap();
      for (const timer of this.recentTimers.values()) clearTimeout(timer);
      this.recentTimers.clear();
      this.runtime.dispose();
      this.liveRegion.release();
    });
  }

  /**
   * Nodes that finished work in the last moment, for a brief highlight.
   *
   * Stepping through a graph one node at a time was unreadable without it:
   * "I had to really look at what changed, and worked out that the 'stale'
   * text had disappeared." A run that recomputes a node to the same value
   * changes nothing on screen at all, so the only evidence anything happened
   * was a word vanishing somewhere.
   */
  private readonly recentlyRanIds = signal<ReadonlySet<NodeId>>(new Set());
  private readonly recentTimers = new Map<NodeId, ReturnType<typeof setTimeout>>();

  protected recentlyRan(nodeId: NodeId): boolean {
    return this.recentlyRanIds().has(nodeId);
  }

  private markRecentlyRan(nodeId: NodeId): void {
    this.recentlyRanIds.update(existing => new Set(existing).add(nodeId));

    // Restarted rather than stacked, so a node that runs twice in quick
    // succession stays lit for the full window after the SECOND run.
    clearTimeout(this.recentTimers.get(nodeId));
    this.recentTimers.set(
      nodeId,
      setTimeout(() => {
        this.recentTimers.delete(nodeId);
        this.recentlyRanIds.update(existing => {
          const next = new Set(existing);
          next.delete(nodeId);
          return next;
        });
      }, RECENTLY_RAN_MS),
    );
  }

  /** Definitions keyed by id — the lookup everything else uses. */
  protected readonly definitionIndex = computed(() => indexDefinitions(this.definitions()));

  /**
   * What the canvas renders: typed nodes filled in from their definition, then
   * given their derived height.
   *
   * Materialising first matters — the height is derived from the port count,
   * and a typed node has no ports until its definition supplies them.
   */
  protected readonly sizedNodes = computed(() =>
    withDerivedHeights(
      withMaterializedTypes(this.nodes(), this.definitionIndex()),
      this.metrics,
      node =>
        node.type === undefined
          ? 0
          : (this.definitionIndex().get(node.type)?.bodyHeight ?? 0),
    ),
  );

  /**
   * The nodes as RENDERED: types materialised, heights derived.
   *
   * Public because an addon that positions or draws nodes needs their real
   * size, and the authored `nodes()` carry `height: 0` — the editor derives it
   * from the port count. Handing an addon the authored array made auto-layout
   * stack overlapping nodes and the minimap draw hairlines, which is exactly
   * the kind of gap the boundary rule says belongs in the base.
   */
  readonly renderedNodes: Signal<readonly EditorNode[]> = this.sizedNodes;

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

  // ------------------------------------------------------------ public API

  /**
   * Insert a node of a registered type at a world point.
   *
   * Public because the palette addon needs it, and routed through the command
   * funnel so the insertion is undoable like any other edit — an addon should
   * not have to know how history works to participate in it.
   */
  addNode(typeId: string, at: CanvasPoint, id?: NodeId): NodeId | null {
    const definition = this.definitionIndex().get(typeId);
    if (!definition || this.readonlyGraph()) return null;

    const nodeId = id ?? `${typeId}-${++this.insertCounter}`;
    const node: EditorNode = {
      id: nodeId,
      type: typeId,
      x: at.x,
      y: at.y,
      width: NODE_DEFAULT_WIDTH,
      height: 0,
    };

    this.history.push({ kind: 'add-nodes', nodes: [node] });
    this.nodes.set([...this.nodes(), node]);
    this.selection.set({ nodes: [nodeId], connections: [] });
    this.announce(`${definition.label} added.`);
    return nodeId;
  }

  /** Move nodes by a delta, as one undoable command. */
  moveNodes(deltas: ReadonlyMap<NodeId, CanvasPoint>): void {
    if (this.readonlyGraph() || deltas.size === 0) return;
    this.history.push({ kind: 'move-nodes', deltas });
    this.nodes.set(
      this.nodes().map(node => {
        const delta = deltas.get(node.id);
        return delta ? { ...node, x: node.x + delta.x, y: node.y + delta.y } : node;
      }),
    );
  }

  /** Place nodes at absolute positions, as one undoable command — auto-layout. */
  placeNodes(positions: ReadonlyMap<NodeId, CanvasPoint>): void {
    const deltas = new Map<NodeId, CanvasPoint>();
    for (const node of this.nodes()) {
      const target = positions.get(node.id);
      if (target) deltas.set(node.id, { x: target.x - node.x, y: target.y - node.y });
    }
    this.moveNodes(deltas);
  }

  /** Undo the last edit. */
  undo(): void {
    const command = this.history.undo();
    if (command) this.applyCommand(command);
  }

  /** Redo the last undone edit. */
  redo(): void {
    const command = this.history.redo();
    if (command) this.applyCommand(command);
  }

  readonly canUndo = (): boolean => this.history.canUndo;
  readonly canRedo = (): boolean => this.history.canRedo;

  /**
   * Put an addon's own edit on this editor's undo stack.
   *
   * The seam an addon needs when its data and the graph move together.
   * Dragging a group frame moves the frame — the groups addon's data — and the
   * nodes inside it, which are the base's. As two entries, one Ctrl+Z would
   * put the nodes back and leave the frame behind, so the members end up
   * outside the group that owns them.
   *
   * The edit must already have been performed when this is called, exactly
   * like every other command. The base runs the closures and never inspects
   * them, so it learns nothing about groups — or about whatever the next addon
   * turns out to need.
   */
  pushEdit(run: () => void, reverse: () => void): void {
    if (this.readonlyGraph()) return;
    this.history.push({ kind: 'custom', run, reverse });
  }

  private applyCommand(command: GraphCommand): void {
    // The base does not know what this edit is; the addon that pushed it does.
    if (command.kind === 'custom') {
      command.run();
      return;
    }

    const next = applyGraphCommand(
      { nodes: this.nodes(), connections: this.connections() },
      command,
    );
    // No special case for edges: `add-nodes` carries the connections to
    // restore, so every inverse is self-contained.
    this.nodes.set(next.nodes);
    this.connections.set(next.connections);
    if (command.kind === 'set-state') this.runtime.setState(command.nodeId, command.after);
    if (this.evaluating()) void this.runtime.run();
  }

  /** Where the viewport currently is, for a minimap. */
  visibleRect(): CanvasRect {
    return this.canvas().visibleWorldRect();
  }

  /** Centre a world point — how a minimap navigates. */
  panTo(worldPoint: CanvasPoint): void {
    this.canvas().panTo(worldPoint);
  }

  /** Screen coordinates to world, so an addon can drop something under a pointer. */
  toWorld(clientPoint: CanvasPoint): CanvasPoint {
    return this.canvas().screenToWorld(clientPoint);
  }

  // ------------------------------------------------- connect legibility (RT-13)

  /**
   * The source port of a connection in flight, or `null`.
   *
   * Split out from `pending()` with a custom equality so it changes only when
   * the SOURCE changes — `pending` itself changes on every pointer move, and
   * {@link connectablePorts} below is O(nodes x ports). Without this the
   * compatibility sweep would run on every frame of every drag.
   */
  private readonly pendingFrom = computed(() => this.pending()?.from ?? null, {
    equal: (a, b) => (a === null && b === null) || samePort(a, b),
  });

  /**
   * Every port that would accept the connection in flight, as `node:port`.
   *
   * The point is that a valid target is obvious BEFORE the attempt: ports that
   * cannot take it dim, rather than the user discovering it on release. Uses
   * the same `canConnect` the drop does, so what looks connectable is exactly
   * what is.
   */
  protected readonly connectablePorts = computed<ReadonlySet<string> | null>(() => {
    const from = this.pendingFrom();
    if (!from) return null;

    const keys = new Set<string>();
    for (const node of this.sizedNodes()) {
      for (const port of portsOf(node)) {
        if (this.evaluate(from, { node: node.id, port: port.id }).ok) {
          keys.add(`${node.id}:${port.id}`);
        }
      }
    }
    return keys;
  });

  /**
   * Why the port under the pointer will not accept this connection, in words.
   *
   * `type-mismatch` names both types, because "those port types are
   * incompatible" tells you no more than the red wire already did. This is the
   * whole answer to "why can some connect and some not".
   */
  protected readonly rejectionText = computed(() => {
    const state = this.pending();
    if (!state?.over || state.valid) return null;

    const result = this.evaluate(state.from, state.over);
    if (result.ok) return null;
    if (result.reason !== 'type-mismatch') return REJECTION_TEXT[result.reason];

    const from = this.findPort(state.from);
    const to = this.findPort(state.over);
    if (!from || !to) return REJECTION_TEXT['type-mismatch'];
    return `${from.label} is ${from.type}, ${to.label} expects ${to.type}`;
  });

  /** Where to put that explanation: at the free end of the pending wire. */
  protected readonly rejectionAt = computed(() => {
    const state = this.pending();
    if (!state) return null;
    return this.toLocal(this.canvas().worldToScreen(state.to));
  });

  private findPort(ref: PortRef): NodePort | undefined {
    const node = this.sizedNodes().find(candidate => candidate.id === ref.node);
    return node ? portsOf(node).find(port => port.id === ref.port) : undefined;
  }

  // ------------------------------------------------------- node views (RT-11)

  /**
   * Per-node injectors, cached.
   *
   * A view is created by `NgComponentOutlet`, which takes an `Injector`. A new
   * injector on every change detection pass would tear the view down and
   * rebuild it continuously — losing focus, caret position and any local state
   * the moment anything upstream changed.
   */
  private readonly nodeInjectors = new Map<NodeId, Injector>();
  private readonly parentInjector = inject(Injector);

  /** The component a node type renders inside its card, if it has one. */
  protected viewFor(node: EditorNode): Type<unknown> | null {
    if (node.type === undefined) return null;
    return this.definitionIndex().get(node.type)?.view ?? null;
  }

  protected injectorFor(node: EditorNode): Injector {
    const existing = this.nodeInjectors.get(node.id);
    if (existing) return existing;

    const created = Injector.create({
      parent: this.parentInjector,
      providers: [{ provide: NODE_CONTEXT, useValue: this.createNodeContext(node.id) }],
    });
    this.nodeInjectors.set(node.id, created);
    return created;
  }

  /**
   * Everything a node's view can see and do.
   *
   * Deliberately small: read your inputs, read or set your state, read your
   * status. A view that needs more than this is reaching into the graph, which
   * is the editor's job rather than a node's.
   */
  private createNodeContext(nodeId: NodeId): NodeContext {
    const runtime = this.runtime;
    // Replay substitutes the values here, at the one place every view reads
    // them — so a node written months ago replays without knowing it can.
    const recorded = computed(() => this.replay()?.[nodeId] ?? null);
    return {
      nodeId,
      state: runtime.state(nodeId),
      setState: (next: unknown) => this.setNodeState(nodeId, next),
      input: <T,>(portId: string) =>
        computed(
          () => (recorded()?.inputs ?? runtime.inputs(nodeId)())[portId] as T | undefined,
        ),
      output: <T,>(portId: string) =>
        computed(
          () => (recorded()?.outputs ?? runtime.outputs(nodeId)())[portId] as T | undefined,
        ),
      status: computed(() => recorded()?.status ?? runtime.status(nodeId)()),
      error: runtime.error(nodeId),
    };
  }

  /**
   * The status a node's card shows.
   *
   * A node absent from a replay frame reports `idle` rather than its live
   * status: it did not run in that pass, and showing the value it happens to
   * hold now would put a present-tense answer inside a picture of the past.
   */
  protected statusOf(nodeId: NodeId): NodeStatus {
    const frame = this.replay();
    if (!frame) return this.runtime.status(nodeId)();
    return frame[nodeId]?.status ?? 'idle';
  }

  /** Live dataflow, unless a replay frame is holding the graph in the past. */
  private evaluating(): boolean {
    return this.live() && this.replay() === null;
  }

  /** A view editing its own state. Routed through history, like every edit. */
  private setNodeState(nodeId: NodeId, next: unknown): void {
    const before = this.runtime.state(nodeId)();
    this.history.push({
      kind: 'set-state',
      nodeId,
      before,
      after: next,
      at: this.now(),
    });
    this.runtime.setState(nodeId, next);
    if (this.evaluating()) void this.runtime.run();
  }

  /** Overridable in tests, which must not depend on the wall clock. */
  protected now(): number {
    return Date.now();
  }

  // ------------------------------------------------------------------ runtime

  /**
   * Wraps the consumer's executor so the observation event fires too.
   *
   * The event is deliberately not given a way to answer: `executeRemote` is
   * authoritative, and two ways to resolve one request would leave nobody sure
   * which won.
   */
  private wrapExecutor(executor: RemoteExecutor | null): RemoteExecutor | null {
    if (!executor) return null;
    return (batch, signal) => {
      this.nodeExecute.emit(batch);
      return executor(batch, signal);
    };
  }

  /** Evaluate the whole graph. */
  async run(): Promise<void> {
    await this.runtime.run();
  }

  /** Evaluate exactly one ready node — the single-step mode. */
  async step(): Promise<void> {
    await this.runtime.step();
  }

  /** Node ids `step()` would pick from next. */
  readonly readyNodes: Signal<readonly NodeId[]> = this.runtime.ready;

  // ------------------------------------------------------------------ pointer

  protected onPointerDown(event: PointerEvent): void {
    /*
     * A second finger means pan and zoom, never editing.
     *
     * Reported from a phone: pinching while one finger rested on a node
     * dragged the node instead of zooming. Two fingers are a viewport gesture
     * everywhere, so anything the first finger had started is abandoned here
     * and the nodes go back where they were — a pinch that quietly moves part
     * of the graph is worse than one that does not zoom.
     *
     * `isPrimary` rather than a set of live pointer ids: the browser already
     * knows which finger is the first of a gesture, and a set of ids has to be
     * cleaned up on every exit path. The first version tracked them by hand
     * and one missed `pointerup` would have wedged the editor for good.
     *
     * See `isSecondaryTouch` for why it is narrowed to touch.
     */
    if (isSecondaryTouch(event)) {
      this.abandonGesture();
      return;
    }

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

    // A press on the consumer's own control inside a node view selects the
    // node but must NOT start a drag — otherwise the control cannot be used.
    if (this.landedOnInteractive(event)) return;
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
  /**
   * A double-click on empty plane asks for a node here.
   *
   * The base resolves the world point and emits; what opens is the consumer's
   * or an addon's business (R15). Doing nothing when no one is listening is
   * correct — it is an intent, not a command.
   */
  protected onDoubleClick(event: MouseEvent): void {
    this.handleDoubleActivate(event.target, { x: event.clientX, y: event.clientY });
  }

  /**
   * Double-click and double-tap, arriving at the same place.
   *
   * Touch platforms disagree about whether a double-tap also produces a
   * synthesised `dblclick`: some send both, some send neither once
   * `touch-action: none` is set. Handling each separately meant adding two
   * nodes on one platform and none on the other, so both routes funnel here
   * and a repeat inside {@link DOUBLE_ACTIVATE_MS} is ignored.
   */
  private handleDoubleActivate(target: EventTarget | null, screen: CanvasPoint): void {
    const now = this.now();
    if (now - this.lastDoubleActivate < DOUBLE_ACTIVATE_MS) return;
    this.lastDoubleActivate = now;

    const card = (target as Element | null)?.closest<HTMLElement>(
      '[data-slot="node-editor-node"]',
    );
    if (card) {
      // Opening belongs on the canvas, next to the thing being opened —
      // reaching for a button outside it to get inside a node is backwards.
      const nodeId = this.nodeIdFrom(card.dataset['node']);
      if (nodeId !== null && this.isOpenable(nodeId)) this.nodeOpened.emit(nodeId);
      return;
    }
    this.requestAddAtPoint(target, screen);
  }

  /** Whether this node's type says it contains something worth opening. */
  protected isOpenable(nodeId: NodeId): boolean {
    const node = this.sizedNodes().find(candidate => candidate.id === nodeId);
    const type = node?.type;
    return type !== undefined && this.definitionIndex().get(type)?.openable === true;
  }

  private nodeIdFrom(raw: string | undefined): NodeId | null {
    if (raw === undefined) return null;
    return this.sizedNodes().find(node => String(node.id) === raw)?.id ?? null;
  }

  /**
   * Right-click on empty plane asks for a node too.
   *
   * Double-click was the only way in, and it is not what a hand reaches for:
   * "my instinct led me to try and open a context menu to add a node." Both
   * gestures now emit the same intent at the same world point, so whichever
   * one a person tries first is the one that works.
   *
   * The browser menu is suppressed only when the intent is actually emitted —
   * right-clicking a node still gets the native menu, because nothing here has
   * anything better to offer there yet.
   */
  /** Emits `addNodeRequested` if this landed on empty plane. */
  private requestAddAtPoint(target: EventTarget | null, screen: CanvasPoint): boolean {
    if (this.readonlyGraph()) return false;
    const element = target as Element | null;
    if (element?.closest('[data-slot="node-editor-node"]')) return false;
    if (element?.closest('[data-slot="node-editor-port"]')) return false;

    this.addNodeRequested.emit(this.toWorld(screen));
    return true;
  }

  /**
   * What sits under a screen point: a node, a connection, or nothing.
   *
   * Node cards and ports are real elements, so a `closest()` answers for them.
   * Connections are not — they are painted into one shared canvas for speed,
   * which means nothing in the DOM knows a wire is under the pointer. Any
   * addon that has to answer "what did I just right-click" needs this, and
   * only the editor can reach the engine that knows.
   */
  hitTest(screenPoint: CanvasPoint): { kind: 'node' | 'connection'; id: NodeId } | null {
    const hit = this.canvas().hitTest(screenPoint);
    if (!hit) return null;
    return { kind: hit.kind === 'edge' ? 'connection' : 'node', id: hit.id };
  }

  /**
   * Rename a node, undoably.
   *
   * The first thing anyone tries on something called a node *editor*, and it
   * was not there: "you don't really have a way to edit a node, not the title,
   * not the type, nothing."
   */
  renameNode(nodeId: NodeId, title: string): void {
    if (this.readonlyGraph()) return;
    const before = this.nodes().find(node => node.id === nodeId)?.title;
    if (before === title) return;

    const apply = (next: string | undefined): void => {
      this.nodes.update(nodes =>
        nodes.map(node => (node.id === nodeId ? { ...node, title: next } : node)),
      );
    };

    apply(title);
    this.history.push({
      kind: 'custom',
      run: () => apply(title),
      reverse: () => apply(before),
    });
  }

  /**
   * The middle of what is on screen, in world units.
   *
   * What "add a node" means without a pointer to hang it on. Reported: the
   * button "always adds to the same place, and it has nothing to do with where
   * I'm currently looking" — a node dropped at fixed coordinates is invisible
   * the moment you have panned anywhere.
   */
  viewCentre(): CanvasPoint {
    const rect = this.visibleRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  }

  protected onPointerCancel(): void {
    if (this.pending()) {
      this.pending.set(null);
      this.announce('Connection cancelled.');
    }
    this.drag = null;
  }

  /**
   * Abandon whatever the pointer had started, leaving the graph as it was.
   *
   * Node positions are restored rather than left where the drag had got to:
   * the gesture turned out to be a pinch, so the movement was never meant.
   */
  /**
   * Give up any pointer gesture in progress.
   *
   * Public because a long-press has to. Opening a menu over a node that is
   * still following the finger underneath it leaves the graph moving behind
   * the thing you opened to act on it.
   */
  cancelGesture(): void {
    this.abandonGesture();
  }

  private abandonGesture(): void {
    const drag = this.drag;
    this.drag = null;
    if (this.pending()) this.pending.set(null);
    if (!drag || !drag.moved) return;

    this.nodes.update(nodes =>
      nodes.map(node => {
        const start = drag.start.get(node.id);
        return start ? { ...node, x: start.x, y: start.y } : node;
      }),
    );
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
    /*
     * A person typing owns every key they press.
     *
     * These handlers listen in the CAPTURE phase on the host, so without this
     * they run before the field the caret is in ever sees the event —
     * `Delete` deleted the selected NODES instead of a character, `Ctrl+A`
     * selected the graph instead of the text, `Ctrl+Z` undid a graph edit
     * instead of the typing, and the arrow keys moved the node out from under
     * the caret.
     *
     * Reported from real use: "I accidentally hit delete when typing and it
     * deleted all my nodes." Losing work to a keystroke that should have
     * inserted nothing is the worst failure in this component, and it was
     * missed because every test drove the keyboard at the graph, never at a
     * field inside a node.
     */
    if (isTypingTarget(event.target)) return;

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
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      // Shift+Ctrl+Z redoes, which is the convention everywhere except a few
      // editors that also accept Ctrl+Y — handled below.
      if (event.shiftKey) this.redo();
      else this.undo();
      return true;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
      this.redo();
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

  /**
   * Delete whatever is selected, undoably.
   *
   * Public because Delete is not the only way anyone asks for it — a context
   * menu offers the same thing with a pointer, and had no way to say so.
   */
  deleteSelection(): void {
    if (this.readonlyGraph()) return;

    const selection = this.selection();
    const afterEdges = removeConnections(this.connections(), selection.connections);
    const result = removeNodes(this.sizedNodes(), afterEdges, selection.nodes);

    const removedNodes = this.sizedNodes().filter(
      node => !result.nodes.some(kept => kept.id === node.id),
    );
    const removedEdges = this.connections().filter(
      edge => !result.connections.some(kept => kept.id === edge.id),
    );
    if (removedNodes.length === 0 && removedEdges.length === 0) return;

    /*
     * Recorded as a command, or delete is the one edit that cannot be undone.
     *
     * The removed CONNECTIONS have to travel with the command: taking a node
     * out takes its edges with it, and restoring only the node would silently
     * lose the wiring. That is the single case an inverse cannot express on
     * its own, which is why `restoredConnections` exists.
     */
    this.history.push({
      kind: 'remove-nodes',
      nodes: removedNodes,
      connections: removedEdges,
    });

    this.nodes.set(result.nodes);
    this.connections.set(result.connections);
    this.selection.set(EMPTY_SELECTION);
    this.announce(
      `Removed ${removedNodes.length} nodes and ${removedEdges.length} connections.`,
    );
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

    this.announce(node.title ?? String(node.id));
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
   * Whether the press landed on something owning its own pointer behaviour.
   *
   * The header is checked first: with arbitrary controls in a card, dragging
   * from anywhere is ambiguous, so the header stays a drag handle even when
   * the body is full of the consumer's widgets.
   */
  private landedOnInteractive(event: PointerEvent): boolean {
    const target = event.target as Element | null;
    if (!target) return false;

    // The header is always a drag handle, even when the body is full of the
    // consumer's widgets — dragging from anywhere would otherwise be ambiguous.
    if (target.closest('[data-slot="node-editor-node-header"]')) return false;

    const interactive = target.closest(INTERACTIVE_IN_NODE);
    if (!interactive) return false;

    // The default card is ITSELF a <button>, so it matches the selector. It is
    // the thing being dragged, not content inside it. Missing this disabled
    // dragging entirely, which is what the drag tests caught.
    return !interactive.matches('[data-slot="node-editor-node"]');
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
    this.liveRegion.announce(message);
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
