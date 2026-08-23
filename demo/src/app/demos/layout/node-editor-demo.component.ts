import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  ButtonComponent,
  NodeEditorComponent,
  SwitchComponent,
  type ConnectionRejectedEvent,
  type EditorNode,
  type EditorSelection,
  type CanvasPoint,
  type CanvasRect,
  serializeGraph,
  type NodeConnection,
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
import { layoutGraph } from '../../../../../packages/components/ui/node-editor/addons/layout';
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
const DEMO_NODE_TYPES = [
  TEXT_INPUT_NODE,
  UPPERCASE_NODE,
  LENGTH_NODE,
  DELAY_NODE,
  BROWSER_NODE,
  DISPLAY_NODE,
];

/**
 * The live graph: type a web address and the browser node follows it.
 *
 * Also branches, so one output feeds two different subtrees — which is where
 * the memoisation and the scoped re-evaluation become visible.
 */
function liveNodes(): EditorNode[] {
  return [
    { id: 'url', type: 'text-input', x: 0, y: 80, width: 190, height: 0 },
    { id: 'upper', type: 'uppercase', x: 260, y: 0, width: 180, height: 0 },
    { id: 'shout', type: 'display', x: 500, y: 0, width: 190, height: 0 },
    { id: 'count', type: 'length', x: 260, y: 130, width: 180, height: 0 },
    { id: 'size', type: 'display', x: 500, y: 130, width: 190, height: 0 },
    { id: 'preview', type: 'browser', x: 260, y: 270, width: 300, height: 0 },
  ];
}

function liveConnections(): NodeConnection[] {
  return [
    { id: 'l1', source: 'url', sourcePort: 'text', target: 'upper', targetPort: 'in' },
    { id: 'l2', source: 'upper', sourcePort: 'out', target: 'shout', targetPort: 'value' },
    { id: 'l3', source: 'url', sourcePort: 'text', target: 'count', targetPort: 'in' },
    { id: 'l4', source: 'count', sourcePort: 'out', target: 'size', targetPort: 'value' },
    { id: 'l5', source: 'url', sourcePort: 'text', target: 'preview', targetPort: 'url' },
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
    NodeEditorComponent,
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
    // renderedNodes, not nodes: the authored array carries height 0, and a
    // layout computed from that stacks nodes on top of each other.
    editor.placeNodes(
      layoutGraph(editor.renderedNodes(), this.connections(), {
        direction: 'LR',
        origin: { x: 0, y: 240 },
      }),
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
    this.nodes.set([
      ...this.nodes(),
      {
        id: `node-${index}-${this.nodes().reduce((max, n) => Math.max(max, n.y), 0)}`,
        x: 40,
        y: 420,
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
