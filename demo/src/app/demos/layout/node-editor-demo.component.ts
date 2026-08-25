import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  ButtonComponent,
  ContextMenuComponent,
  ContextMenuContentComponent,
  ContextMenuItemComponent,
  ContextMenuLabelComponent,
  ContextMenuSeparatorComponent,
  NodeEditorComponent,
  SwitchComponent,
  type ConnectionRejectedEvent,
  type EditorNode,
  type EditorSelection,
  type CanvasPoint,
  type CanvasRect,
  serializeGraph,
  type NodeConnection,
  type NodeId,
  type ReplayFrame,
  type RunFinishedEvent,
  type RunStartedEvent,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import {
  NodeEditorHistoryComponent,
  RunHistoryStore,
  replayFrame,
  type RunExportEvent,
  type RunRecord,
} from '../../../../../packages/components/ui/node-editor/addons/history';
import {
  NodeEditorGroupsComponent,
  fitAround,
  membership,
  movedGroup,
  type GroupMoveEvent,
  type NodeComment,
  type NodeGroup,
} from '../../../../../packages/components/ui/node-editor/addons/groups';
import {
  NodeEditorContextMenuDirective,
  type NodeEditorContextTarget,
} from '../../../../../packages/components/ui/node-editor/addons/context-menu';
import { layoutGraph } from '../../../../../packages/components/ui/node-editor/addons/layout';
import {
  NodeEditorSubgraphBreadcrumbComponent,
  SUBGRAPH_BOUNDARY_TYPES,
  SUBGRAPH_INPUT_TYPE,
  SUBGRAPH_OUTPUT_TYPE,
  SubgraphNavigator,
  subgraphNodeType,
  type SubgraphGraph,
} from '../../../../../packages/components/ui/node-editor/addons/subgraph';
import { NodeEditorMinimapComponent } from '../../../../../packages/components/ui/node-editor/addons/minimap';
import {
  NodeEditorPaletteComponent,
  type NodeTypePicked,
} from '../../../../../packages/components/ui/node-editor/addons/palette';
import { NodeEditorProblemsComponent } from '../../../../../packages/components/ui/node-editor/addons/problems';
import { NODE_EDITOR_DEMO_LOCALES } from './node-editor-demo.locales';
import { BROWSER_NODE } from './node-editor-demo/nodes/browser-node.component';
import {
  DELAY_NODE,
  DISPLAY_NODE,
  LENGTH_NODE,
  UPPERCASE_NODE,
} from './node-editor-demo/nodes/display-node.component';
import { TEXT_INPUT_NODE } from './node-editor-demo/nodes/text-input-node.component';

/**
 * The node types this demo offers.
 *
 * Five definitions and three small components — that is the entire cost of
 * making the editor run something. A pure transform with no view and no state
 * is four lines.
 */
/**
 * A nested graph: shout it, then measure it.
 *
 * A boundary node's **id is the port id** — the `text` input node below is why
 * the outer node has an input port called `text`.
 */
const SHOUT_AND_SIZE: SubgraphGraph = {
  nodes: [
    { id: 'text', type: SUBGRAPH_INPUT_TYPE, x: 0, y: 60, width: 170, height: 0, title: 'Text' },
    { id: 'loud', type: 'uppercase', x: 240, y: 0, width: 180, height: 0 },
    { id: 'chars', type: 'length', x: 240, y: 150, width: 180, height: 0 },
    { id: 'shouted', type: SUBGRAPH_OUTPUT_TYPE, x: 480, y: 0, width: 170, height: 0, title: 'Shouted' },
    { id: 'size', type: SUBGRAPH_OUTPUT_TYPE, x: 480, y: 150, width: 170, height: 0, title: 'Size' },
  ],
  connections: [
    { id: 's1', source: 'text', sourcePort: 'value', target: 'loud', targetPort: 'in' },
    { id: 's2', source: 'text', sourcePort: 'value', target: 'chars', targetPort: 'in' },
    { id: 's3', source: 'loud', sourcePort: 'out', target: 'shouted', targetPort: 'value' },
    { id: 's4', source: 'chars', sourcePort: 'out', target: 'size', targetPort: 'value' },
  ],
};

/**
 * A node whose work is the graph above.
 *
 * The whole addon is this factory plus a navigator — it needs nothing from the
 * base, which is the point of it (`specs/node-editor-runtime-design.md` §14.9).
 */
const SHOUT_SUBGRAPH = subgraphNodeType({
  id: 'shout-and-size',
  label: 'Shout and size',
  category: 'Composite',
  accent: '#a855f7',
  graph: SHOUT_AND_SIZE,
  definitions: [UPPERCASE_NODE, LENGTH_NODE],
});

/** Rendered size of the zone panel, for keeping it inside the canvas. */
const ZONE_PANEL = { x: 256, y: 190 };
/** Rendered size of the rename field, same reason. */
const RENAME_FIELD = { x: 192, y: 34 };

const DEMO_NODE_TYPES = [
  TEXT_INPUT_NODE,
  UPPERCASE_NODE,
  LENGTH_NODE,
  DELAY_NODE,
  BROWSER_NODE,
  DISPLAY_NODE,
  SHOUT_SUBGRAPH,
  // Registered so the boundary nodes render when the editor is showing the
  // INSIDE of a subgraph — the same editor, a different graph.
  ...SUBGRAPH_BOUNDARY_TYPES,
];

/**
 * The live graph: type a web address and the browser node follows it.
 *
 * Also branches, so one output feeds two different subtrees — which is where
 * the memoisation and the scoped re-evaluation become visible.
 */
function liveNodes(): EditorNode[] {
  return [
    // Offset down the plane so the group frames fitted around these — which
    // reach a title bar's height above the topmost node — start on screen
    // rather than above the initial viewport.
    { id: 'url', type: 'text-input', x: 0, y: 170, width: 190, height: 0 },
    { id: 'upper', type: 'uppercase', x: 260, y: 90, width: 180, height: 0 },
    { id: 'shout', type: 'display', x: 500, y: 90, width: 190, height: 0 },
    { id: 'count', type: 'length', x: 260, y: 220, width: 180, height: 0 },
    { id: 'size', type: 'display', x: 500, y: 220, width: 190, height: 0 },
    { id: 'preview', type: 'browser', x: 260, y: 360, width: 300, height: 0 },
    // A node whose work is another graph. Select it and press "Open subgraph".
    { id: 'composite', type: 'shout-and-size', x: 760, y: 300, width: 200, height: 0 },
    { id: 'inner-out', type: 'display', x: 1020, y: 300, width: 190, height: 0 },
  ];
}

function liveConnections(): NodeConnection[] {
  return [
    { id: 'l1', source: 'url', sourcePort: 'text', target: 'upper', targetPort: 'in' },
    { id: 'l2', source: 'upper', sourcePort: 'out', target: 'shout', targetPort: 'value' },
    { id: 'l3', source: 'url', sourcePort: 'text', target: 'count', targetPort: 'in' },
    { id: 'l4', source: 'count', sourcePort: 'out', target: 'size', targetPort: 'value' },
    { id: 'l5', source: 'url', sourcePort: 'text', target: 'preview', targetPort: 'url' },
    { id: 'l6', source: 'url', sourcePort: 'text', target: 'composite', targetPort: 'text' },
    { id: 'l7', source: 'composite', sourcePort: 'shouted', target: 'inner-out', targetPort: 'value' },
  ];
}

/** The starting graph: an ETL pipeline, which is what node editors are for. */
function initialNodes(): EditorNode[] {
  return [
    {
      id: 'read',
      x: 0,
      y: 40,
      width: 190,
      height: 0,
      title: 'Read CSV',
      subtitle: 'source',
      accent: '#22c55e',
      ports: [{ id: 'rows', direction: 'out', label: 'Rows', type: 'table' }],
    },
    {
      id: 'filter',
      x: 290,
      y: 0,
      width: 190,
      height: 0,
      title: 'Filter',
      ports: [
        { id: 'in', direction: 'in', label: 'Rows', type: 'table' },
        { id: 'kept', direction: 'out', label: 'Kept', type: 'table' },
        { id: 'dropped', direction: 'out', label: 'Dropped', type: 'table' },
      ],
    },
    {
      id: 'lookup',
      x: 290,
      y: 220,
      width: 190,
      height: 0,
      title: 'Lookup',
      ports: [
        { id: 'in', direction: 'in', label: 'Rows', type: 'table' },
        { id: 'key', direction: 'in', label: 'Key', type: 'text' },
        { id: 'out', direction: 'out', label: 'Joined', type: 'table' },
      ],
    },
    {
      id: 'write',
      x: 600,
      y: 90,
      width: 190,
      height: 0,
      title: 'Write table',
      subtitle: 'sink',
      accent: '#3b82f6',
      ports: [{ id: 'in', direction: 'in', label: 'Rows', type: 'table', multiple: true }],
    },
    {
      id: 'audit',
      x: 600,
      y: 300,
      width: 190,
      height: 0,
      title: 'Audit log',
      subtitle: 'locked',
      locked: true,
      ports: [{ id: 'in', direction: 'in', label: 'Anything' }],
    },
  ];
}

function initialConnections(): NodeConnection[] {
  return [
    { id: '1', source: 'read', sourcePort: 'rows', target: 'filter', targetPort: 'in' },
    { id: '2', source: 'filter', sourcePort: 'kept', target: 'write', targetPort: 'in' },
    { id: '3', source: 'filter', sourcePort: 'dropped', target: 'audit', targetPort: 'in' },
  ];
}

@Component({
  selector: 'app-node-editor-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ContextMenuComponent,
    ContextMenuContentComponent,
    ContextMenuItemComponent,
    ContextMenuLabelComponent,
    ContextMenuSeparatorComponent,
    NodeEditorComponent,
    NodeEditorContextMenuDirective,
    NodeEditorGroupsComponent,
    NodeEditorSubgraphBreadcrumbComponent,
    NodeEditorHistoryComponent,
    NodeEditorMinimapComponent,
    NodeEditorPaletteComponent,
    NodeEditorProblemsComponent,
    ButtonComponent,
    SwitchComponent,
  ],
  templateUrl: './node-editor-demo.component.html',
})
export class NodeEditorDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => NODE_EDITOR_DEMO_LOCALES[this.localeId()] ?? NODE_EDITOR_DEMO_LOCALES['en'],
  );

  readonly definitions = DEMO_NODE_TYPES;

  readonly nodes = signal<readonly EditorNode[]>(liveNodes());
  readonly connections = signal<readonly NodeConnection[]>(liveConnections());
  readonly selection = signal<EditorSelection>({ nodes: [], connections: [] });
  readonly live = signal(true);

  readonly acyclic = signal(false);
  readonly snap = signal(false);
  readonly readonlyGraph = signal(false);

  /**
   * The reason the last attempt was refused.
   *
   * Surfaced rather than swallowed: a wire that simply refuses to attach, with
   * no stated reason, is the single most confusing thing a node editor can do.
   */
  readonly rejection = signal<string | null>(null);

  protected readonly gridSnap = computed(() => (this.snap() ? 24 : 0));

  protected readonly selectedCount = computed(
    () => this.selection().nodes.length + this.selection().connections.length,
  );

  private readonly editorRef = viewChild(NodeEditorComponent);

  /** Graph-level problems the runtime found — missing inputs, cycles, bad types. */
  protected readonly problems = computed(() => this.editorRef()?.problems() ?? []);

  /**
   * The run history, one store per editor.
   *
   * A `providedIn: 'root'` service would give the whole application one
   * history, and two editors on a page would interleave their runs into a
   * single unreadable list — the same no-singleton rule the runtime keeps.
   */
  protected readonly history = new RunHistoryStore({ limit: 25 });
  protected readonly replay = signal<ReplayFrame | null>(null);

  protected onRunStarted(event: RunStartedEvent): void {
    this.history.begin(event, serializeGraph(this.nodes(), this.connections()));
  }

  protected onRunFinished(event: RunFinishedEvent): void {
    this.history.finish(event);
  }

  /** The panel picks a run; the editor renders it through its own node views. */
  protected showRun(run: RunRecord | null): void {
    this.replay.set(replayFrame(run));
  }

  /**
   * Downloading is the APPLICATION's decision, which is why the addon hands
   * over a string and stops. A permission prompt in one host and a file dialog
   * in another is not something a list component should be choosing.
   */
  protected downloadRun(event: RunExportEvent): void {
    const url = URL.createObjectURL(new Blob([event.json], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `run-${event.run.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Groups and comments — the addon's own data, never the graph's.
   *
   * Nothing here reaches the runtime: a frame does not change what the graph
   * computes or what may connect to what.
   */
  /*
   * Fitted around where the demo's nodes actually are — `GROUP_PADDING` out
   * on each side and `GROUP_HEADER` extra at the top for the title bar. Rects
   * guessed by eye contained nothing at all, and a group holding zero nodes
   * looks identical to one holding six until you read the count.
   */
  protected readonly groups = signal<readonly NodeGroup[]>([
    { id: 'input', title: 'Input', x: -28, y: 110, width: 246, height: 214, colour: '#22c55e' },
    { id: 'derived', title: 'Derived', x: 232, y: 30, width: 486, height: 344, colour: '#6366f1' },
  ]);

  protected readonly comments = signal<readonly NodeComment[]>([
    {
      id: 'why',
      text: 'Type in the input node — every keystroke streams through the graph.',
      x: 760,
      y: 110,
      width: 240,
      height: 70,
    },
  ]);

  private readonly groupsRef = viewChild(NodeEditorGroupsComponent);

  /**
   * A group drag, as ONE undo entry.
   *
   * The frame is the addon's data and the nodes are the editor's. Applying the
   * nodes through `placeNodes` would push a second command, and a single
   * Ctrl+Z would then put the nodes back while leaving the frame where it was
   * — stranding the members outside the group that owns them. `pushEdit`
   * exists for exactly this: the base runs both halves and never learns what a
   * group is.
   */
  protected onGroupMoved(event: GroupMoveEvent): void {
    const groupsRef = this.groupsRef();
    const editor = this.editorRef();
    if (!groupsRef || !editor) return;

    const before = new Map(
      [...event.members.keys()].map(id => {
        const node = this.nodes().find(n => n.id === id);
        return [id, { x: node?.x ?? 0, y: node?.y ?? 0 }] as const;
      }),
    );
    const frameBefore = movedGroup(event.group, { x: -event.delta.x, y: -event.delta.y });

    this.placeMembers(event.members);
    editor.pushEdit(
      () => {
        this.placeMembers(event.members);
        groupsRef.restoreGroup(event.group);
      },
      () => {
        this.placeMembers(before);
        groupsRef.restoreGroup(frameBefore);
      },
    );
  }

  private placeMembers(positions: ReadonlyMap<string | number, CanvasPoint>): void {
    this.nodes.update(nodes =>
      nodes.map(node => {
        const at = positions.get(node.id);
        return at ? { ...node, x: at.x, y: at.y } : node;
      }),
    );
  }

  /**
   * Which graph the editor is showing.
   *
   * Descending into a subgraph does not open a second editor — it swaps what
   * this one is looking at. Undo, the palette, the minimap and the groups
   * addon all keep working at every depth, because there is only ever one
   * editor.
   */
  protected readonly navigator = new SubgraphNavigator(
    { nodes: liveNodes(), connections: liveConnections() },
    'Main',
  );

  protected readonly insideSubgraph = computed(() => this.navigator.depth() > 0);

  /**
   * Inner graphs, kept here rather than only in the runtime.
   *
   * Leaving a subgraph swaps the editor back to the outer graph, and the
   * editor's effect calls `setGraph` AFTER this handler returns. A node that
   * was not in the runtime a moment ago is added fresh, with `initialState()`
   * — so a `setState` written before that lands and is immediately thrown
   * away. Every edit made inside a subgraph silently vanished on re-entry;
   * the unit tests passed, because the navigator does carry the edits. It is
   * the hand-off to the runtime that dropped them.
   *
   * So the demo keeps the authoritative copy and re-applies it whenever the
   * outer graph is on screen.
   */
  private readonly innerGraphs = new Map<NodeId, SubgraphGraph>();

  /** Open the selected subgraph node, if one is selected. */
  protected openSubgraph(): void {
    const editor = this.editorRef();
    // Length, not `[0] === undefined`: index access is typed non-optional
    // here, so the undefined check reads as dead code while still being the
    // thing that stops an empty selection.
    const selected = this.selection().nodes;
    if (!editor || selected.length === 0) return;

    const node = this.nodes().find(n => n.id === selected[0]);
    const definition = DEMO_NODE_TYPES.find(d => d.id === node?.type);
    if (!node || definition?.id !== SHOUT_SUBGRAPH.id) return;

    // The node's STATE is its graph — that is what makes a nested graph
    // serialise with the document for free.
    const graph =
      this.innerGraphs.get(node.id) ??
      (editor.runtime.state(node.id)() as SubgraphGraph | undefined) ??
      SHOUT_AND_SIZE;

    this.navigator.update({ nodes: this.nodes(), connections: this.connections() });
    this.navigator.enter(node.id, node.title ?? definition.label, graph);

    // The outer graph's scenery stays with the outer graph.
    this.groupStack.push({ groups: this.groups(), comments: this.comments() });
    this.groups.set([]);
    this.comments.set([]);
    this.showCurrentGraph();
  }

  /** Go back up one level, carrying the edits made inside. */
  protected leaveSubgraph(): void {
    this.navigator.update({ nodes: this.nodes(), connections: this.connections() });
    const left = this.navigator.leave();
    if (!left) return;

    // Remembered here first; the effect below writes it into the runtime once
    // the outer graph is actually mounted.
    if (left.nodeId !== null) this.innerGraphs.set(left.nodeId, left.graph);

    const scenery = this.groupStack.pop();
    this.groups.set(scenery?.groups ?? []);
    this.comments.set(scenery?.comments ?? []);
    this.showCurrentGraph();
  }

  protected goToLevel(index: number): void {
    this.navigator.update({ nodes: this.nodes(), connections: this.connections() });
    while (this.navigator.depth() > index) this.leaveSubgraph();
  }

  private showCurrentGraph(): void {
    const frame = this.navigator.current();
    this.selection.set({ nodes: [], connections: [] });
    this.connections.set(frame.graph.connections);
    this.nodes.set(frame.graph.nodes);
  }

  constructor() {
    /*
     * Focus the rename field when it appears.
     *
     * `autofocus` would have done it in one attribute, and is banned for good
     * reason: it moves focus on page load too, which drops a screen-reader
     * user into the middle of a document they have not been introduced to.
     * Here the field appears because someone asked for it, so focusing it is
     * the courtesy — the attribute is just the wrong tool.
     */
    effect(() => {
      if (this.renaming()) this.renameFieldRef()?.nativeElement.select();
    });

    /*
     * Re-apply remembered inner graphs whenever the mounted nodes change.
     *
     * Declarative rather than a `setTimeout` after the swap: the editor's own
     * effect decides when `setGraph` runs, and racing it with a guessed delay
     * is how the edits went missing in the first place.
     */
    effect(() => {
      const editor = this.editorRef();
      const mounted = new Set(this.nodes().map(node => node.id));
      if (!editor) return;

      for (const [nodeId, graph] of this.innerGraphs) {
        if (mounted.has(nodeId)) editor.runtime.setState(nodeId, graph);
      }
    });
  }

  // ------------------------------------------------------------ context menu

  /** The node being renamed, and where to float the field over it. */
  protected readonly renaming = signal<{
    readonly id: NodeId;
    readonly title: string;
    readonly left: number;
    readonly top: number;
  } | null>(null);

  private readonly surfaceRef = viewChild<ElementRef<HTMLElement>>('surface');
  private readonly renameFieldRef = viewChild<ElementRef<HTMLInputElement>>('renameField');

  /**
   * Zones belong to the graph they were drawn on.
   *
   * They were not: descending into a subgraph kept showing the outer graph's
   * frames, which "has nothing to do with it". Nodes and connections are
   * swapped when the editor changes level, and zones have to travel with
   * them — they are scenery for one particular graph.
   */
  private readonly groupStack: { groups: readonly NodeGroup[]; comments: readonly NodeComment[] }[] = [];

  /** The zone being named and coloured, floated over the canvas. */
  protected readonly editingZone = signal<{
    readonly id: string;
    readonly title: string;
    readonly colour: string;
    readonly left: number;
    readonly top: number;
  } | null>(null);

  /** Add a zone where the menu was opened, then let it be named. */
  protected addZone(target: NodeEditorContextTarget): void {
    if (target.kind !== 'canvas') return;
    const id = `zone-${this.groups().length + 1}-${Math.round(target.at.x)}`;
    const zone: NodeGroup = {
      id,
      title: 'New zone',
      x: target.at.x,
      y: target.at.y,
      width: 320,
      height: 240,
      colour: '#6366f1',
    };

    const before = this.groups();
    const after = [...before, zone];
    this.groups.set(after);
    this.editorRef()?.pushEdit(
      () => this.groups.set(after),
      () => this.groups.set(before),
    );
    this.openZoneEditor(zone, target.screen);
  }

  /** Clicking a zone's title bar opens the same editor. */
  protected onGroupActivated(group: NodeGroup): void {
    const box = this.surfaceRef()?.nativeElement.getBoundingClientRect();
    const editor = this.editorRef();
    if (!editor || !box) return;
    // The frame's own top-left, so the panel opens on the zone it edits.
    const rect = editor.visibleRect();
    const scale = box.width / Math.max(1, rect.width);
    this.openZoneEditor(group, {
      x: box.left + (group.x - rect.x) * scale,
      y: box.top + (group.y - rect.y) * scale,
    });
  }

  private openZoneEditor(group: NodeGroup, screen: CanvasPoint): void {
    const at = this.clampToSurface(screen, ZONE_PANEL);
    this.editingZone.set({
      id: group.id,
      title: group.title,
      colour: group.colour ?? '#6366f1',
      left: at.x,
      top: at.y,
    });
  }

  /**
   * Where a floating panel can sit without falling off the canvas.
   *
   * Opening one at the pointer is right until the pointer is near an edge,
   * and then the panel is clipped by the canvas's own `overflow: hidden` and
   * half its controls are unreachable. Reported for the zone editor; the
   * rename field had it too.
   */
  private clampToSurface(screen: CanvasPoint, size: CanvasPoint): CanvasPoint {
    const box = this.surfaceRef()?.nativeElement.getBoundingClientRect();
    if (!box) return { x: screen.x, y: screen.y };

    const local = { x: screen.x - box.left, y: screen.y - box.top };
    const margin = 8;
    return {
      x: Math.max(margin, Math.min(local.x, box.width - size.x - margin)),
      y: Math.max(margin, Math.min(local.y, box.height - size.y - margin)),
    };
  }

  protected applyZone(title: string, colour: string): void {
    const active = this.editingZone();
    if (!active) return;
    const before = this.groups();
    const after = before.map(group =>
      group.id === active.id ? { ...group, title: title.trim() || group.title, colour } : group,
    );
    this.groups.set(after);
    this.editorRef()?.pushEdit(
      () => this.groups.set(after),
      () => this.groups.set(before),
    );
  }

  protected closeZoneEditor(): void {
    this.editingZone.set(null);
  }

  protected deleteZone(): void {
    const active = this.editingZone();
    this.editingZone.set(null);
    if (!active) return;
    const before = this.groups();
    const after = before.filter(group => group.id !== active.id);
    this.groups.set(after);
    this.editorRef()?.pushEdit(
      () => this.groups.set(after),
      () => this.groups.set(before),
    );
  }

  /**
   * Narrows the menu's untyped `data()` for the template.
   *
   * `ContextMenuComponent.data()` is `unknown` by design — it carries whatever
   * the opener passed. This is the one place that knows what that is.
   */
  protected asTarget(data: unknown): NodeEditorContextTarget | null {
    return (data ?? null) as NodeEditorContextTarget | null;
  }

  protected connectionIds(connections: readonly NodeConnection[]): readonly string[] {
    return connections.map(connection => connection.id);
  }

  /** Whether this node is one whose work is a nested graph. */
  protected isSubgraph(node: EditorNode): boolean {
    return node.type === SHOUT_SUBGRAPH.id;
  }

  protected beginRename(target: NodeEditorContextTarget): void {
    if (target.kind !== 'node') return;
    const at = this.clampToSurface(target.screen, RENAME_FIELD);
    this.renaming.set({
      id: target.nodeId,
      title: target.node.title ?? '',
      left: at.x,
      top: at.y,
    });
  }

  protected commitRename(title: string): void {
    const active = this.renaming();
    this.renaming.set(null);
    if (active && title.trim().length > 0) this.editorRef()?.renameNode(active.id, title.trim());
  }

  protected cancelRename(): void {
    this.renaming.set(null);
  }

  /** Duplicate: a fresh node of the same type, offset so it is visible. */
  protected duplicateNode(node: EditorNode): void {
    if (node.type === undefined) return;
    this.editorRef()?.addNode(node.type, { x: node.x + 40, y: node.y + 40 });
  }

  protected deleteNode(nodeId: NodeId): void {
    const editor = this.editorRef();
    if (!editor) return;
    editor.selection.set({ nodes: [nodeId], connections: [] });
    editor.deleteSelection();
  }

  protected deleteConnections(ids: readonly string[]): void {
    const editor = this.editorRef();
    if (!editor) return;
    editor.selection.set({ nodes: [], connections: [...ids] });
    editor.deleteSelection();
  }

  /** Open a subgraph node straight from its own menu. */
  protected openSubgraphNode(node: EditorNode): void {
    this.openSubgraphById(node.id);
  }

  /** Double-click on a node that contains a graph — the editor's own gesture. */
  protected openSubgraphById(nodeId: NodeId): void {
    this.selection.set({ nodes: [nodeId], connections: [] });
    this.openSubgraph();
  }

  protected onRejected(event: ConnectionRejectedEvent): void {
    this.rejection.set(event.reason);
  }

  private readonly paletteRef = viewChild(NodeEditorPaletteComponent);

  /**
   * The viewport the minimap draws, refreshed when a pan or zoom settles.
   *
   * Settle-only is the engine's design — its hot path never touches Angular —
   * so the minimap follows a pan rather than tracking it frame by frame.
   */
  protected readonly viewportRect = signal<CanvasRect | null>(null);

  /**
   * The minimap starts folded on a small screen.
   *
   * A 200x140 overview on a phone covers a serious fraction of the canvas it
   * exists to help navigate, so it opens as a single control there and the
   * reader unfolds it if they want it.
   */
  protected readonly narrowScreen = signal(
    typeof globalThis.matchMedia === 'function'
      ? globalThis.matchMedia('(max-width: 640px)').matches
      : false,
  );
  protected readonly minimapCollapsed = signal(this.narrowScreen());
  protected readonly minimapWidth = computed(() => (this.narrowScreen() ? 132 : 200));
  protected readonly minimapHeight = computed(() => (this.narrowScreen() ? 92 : 140));

  /** What the minimap draws: real sizes, not the authored zero heights. */
  protected readonly renderedNodes = computed(() => this.editorRef()?.renderedNodes() ?? []);

  protected onViewportChange(): void {
    this.viewportRect.set(this.editorRef()?.visibleRect() ?? null);
  }

  /**
   * Tidy the graph.
   *
   * The addon is a pure function — nodes and edges in, positions out — and the
   * editor applies them as ONE undoable command, so a layout someone did not
   * want is a single Ctrl+Z rather than a node-by-node repair.
   */
  protected autoLayout(): void {
    const editor = this.editorRef();
    if (!editor) return;

    const rendered = editor.renderedNodes();
    /*
     * Who belongs to what, captured BEFORE anything moves.
     *
     * Membership is containment, so the instant the nodes are relaid out the
     * old frames contain whatever they happen to be sitting over — which is
     * nothing. Reported as "the tidy does change things, but it's not tidy":
     * the nodes were in fact tidy, and the zones had been left behind over the
     * empty space where the graph used to be.
     */
    const held = membership(this.groups(), rendered);
    const nodesBefore = this.nodes();
    const framesBefore = this.groups();

    // renderedNodes, not nodes: the authored array carries height 0, and a
    // layout computed from that stacks nodes on top of each other.
    /*
     * Which frame each node belongs to, so the layout keeps a zone's members
     * adjacent instead of scattering them and leaving the re-fitted frame big
     * enough to swallow whatever landed in between.
     */
    const clusterByNode = new Map<NodeId, string>();
    for (const [groupId, ids] of held) {
      for (const id of ids) clusterByNode.set(id, groupId);
    }

    const positions = layoutGraph(rendered, this.connections(), {
      direction: 'LR',
      origin: { x: 0, y: 240 },
      clusterOf: nodeId => clusterByNode.get(nodeId) ?? null,
    });

    const moved = <T extends EditorNode>(node: T): T => {
      const at = positions.get(node.id);
      return at ? { ...node, x: at.x, y: at.y } : node;
    };

    const nodesAfter = nodesBefore.map(moved);
    // Fitted from the RENDERED nodes moved to their new spots: heights are
    // derived and an authored zero would fit every frame to a sliver.
    const placed = new Map(rendered.map(moved).map(node => [node.id, node]));
    const framesAfter = framesBefore.map(group => {
      const members = (held.get(group.id) ?? [])
        .map(id => placed.get(id))
        .filter(node => node !== undefined);
      const fitted = fitAround(members);
      return fitted ? { ...group, ...fitted } : group;
    });

    /*
     * ONE undo entry for the whole tidy.
     *
     * `placeNodes` would have pushed a command of its own, and the frames a
     * second — so a single Ctrl+Z put the frames back while leaving the nodes
     * tidied, and the zones ended up around nothing. Exactly the failure
     * `pushEdit` exists to prevent, walked into anyway the first time these
     * two were combined.
     */
    const apply = (nodes: readonly EditorNode[], frames: readonly NodeGroup[]): void => {
      this.nodes.set(nodes);
      this.groups.set(frames);
    };

    apply(nodesAfter, framesAfter);
    editor.pushEdit(
      () => apply(nodesAfter, framesAfter),
      () => apply(nodesBefore, framesBefore),
    );
    this.onViewportChange();
  }

  /** The minimap reports where to go; the editor does the moving. */
  protected navigateTo(point: CanvasPoint): void {
    this.editorRef()?.panTo(point);
    this.onViewportChange();
  }

  /** The editor emits the intent; the palette addon supplies the picker. */
  protected openPalette(at: CanvasPoint): void {
    this.paletteRef()?.openAt(at);
  }

  /** The palette reports a choice; the editor performs the insertion. */
  protected insertPicked(picked: NodeTypePicked): void {
    this.editorRef()?.addNode(picked.typeId, picked.at ?? { x: 40, y: 40 });
  }

  /** Reveal the node a problem belongs to — the addon only reports it. */
  protected revealProblem(nodeId: string | number): void {
    this.editorRef()?.focusNode(nodeId);
  }

  protected async runGraph(): Promise<void> {
    await this.editorRef()?.run();
  }

  /** One ready node at a time — the maintainer's "single step at a time". */
  protected async stepGraph(): Promise<void> {
    await this.editorRef()?.step();
  }

  protected addNode(): void {
    const index = this.nodes().length;
    // Where you are looking, not a fixed spot off the side of the plane.
    const at = this.editorRef()?.viewCentre() ?? { x: 40, y: 420 };
    this.nodes.set([
      ...this.nodes(),
      {
        id: `node-${index}-${this.nodes().reduce((max, n) => Math.max(max, n.y), 0)}`,
        x: at.x - 95,
        y: at.y - 40,
        width: 190,
        height: 0,
        title: `Step ${index + 1}`,
        ports: [
          { id: 'in', direction: 'in', label: 'In' },
          { id: 'out', direction: 'out', label: 'Out' },
        ],
      },
    ]);
  }

  protected reset(): void {
    this.nodes.set(liveNodes());
    this.connections.set(liveConnections());
    this.selection.set({ nodes: [], connections: [] });
    this.rejection.set(null);
  }

  /** The structural pipeline — no runtime, just shape. */
  protected useStructural(): void {
    this.nodes.set(initialNodes());
    this.connections.set(initialConnections());
    this.selection.set({ nodes: [], connections: [] });
    this.rejection.set(null);
  }
}
