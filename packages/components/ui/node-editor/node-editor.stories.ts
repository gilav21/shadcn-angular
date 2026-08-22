import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { NodeEditorComponent } from './node-editor.component';
import { NodeEditorNodeDirective } from './node-editor-node.directive';
import type { EditorNode, NodeConnection } from './node-editor.types';

function node(
  id: string,
  x: number,
  y: number,
  title: string,
  ports: EditorNode['ports'],
  extra: Partial<EditorNode> = {},
): EditorNode {
  return { id, x, y, width: 190, height: 0, title, ports, ...extra };
}

/** A small ETL-shaped graph — the canonical thing node editors are used for. */
const PIPELINE: EditorNode[] = [
  node('read', 0, 40, 'Read CSV', [{ id: 'rows', direction: 'out', label: 'Rows', type: 'table' }], {
    subtitle: 'source',
    accent: '#22c55e',
  }),
  node('filter', 280, 0, 'Filter', [
    { id: 'in', direction: 'in', label: 'Rows', type: 'table' },
    { id: 'kept', direction: 'out', label: 'Kept', type: 'table' },
    { id: 'dropped', direction: 'out', label: 'Dropped', type: 'table' },
  ]),
  node('enrich', 280, 200, 'Lookup', [
    { id: 'in', direction: 'in', label: 'Rows', type: 'table' },
    { id: 'key', direction: 'in', label: 'Key', type: 'text' },
    { id: 'out', direction: 'out', label: 'Joined', type: 'table' },
  ]),
  node('write', 570, 90, 'Write table', [{ id: 'in', direction: 'in', label: 'Rows', type: 'table', multiple: true }], {
    subtitle: 'sink',
    accent: '#3b82f6',
  }),
  node('audit', 570, 280, 'Audit log', [{ id: 'in', direction: 'in', label: 'Anything' }], {
    locked: true,
    subtitle: 'locked',
  }),
];

const PIPELINE_EDGES: NodeConnection[] = [
  { id: '1', source: 'read', sourcePort: 'rows', target: 'filter', targetPort: 'in' },
  { id: '2', source: 'filter', sourcePort: 'kept', target: 'write', targetPort: 'in' },
  { id: '3', source: 'filter', sourcePort: 'dropped', target: 'audit', targetPort: 'in' },
];

/** A grid big enough that virtualisation is doing real work. */
function buildLarge(count: number, columns = 20): EditorNode[] {
  return Array.from({ length: count }, (_, i) =>
    node(`n${i}`, (i % columns) * 260, Math.floor(i / columns) * 200, `Step ${i + 1}`, [
      { id: 'in', direction: 'in', label: 'In' },
      { id: 'out', direction: 'out', label: 'Out' },
    ]),
  );
}

const LARGE = buildLarge(600);
const LARGE_EDGES: NodeConnection[] = LARGE.slice(0, -1).map((source, i) => ({
  id: `e${i}`,
  source: source.id,
  sourcePort: 'out',
  target: LARGE[i + 1].id,
  targetPort: 'in',
}));

const meta: Meta<NodeEditorComponent> = {
  title: 'UI/NodeEditor',
  component: NodeEditorComponent,
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({ imports: [NodeEditorComponent, NodeEditorNodeDirective] }),
  ],
  argTypes: {
    nodes: {
      control: 'object',
      description: 'Every node. Heights are DERIVED from the port count and written back, because a height that disagrees with the card puts every port anchor in the wrong place.',
    },
    connections: { control: 'object', description: 'Edges between ports. Anchored at the ports, drawn as beziers on the engine’s canvas layer.' },
    selection: { control: 'object', description: 'Selected node and connection ids.' },
    allowCycles: { control: 'boolean', description: 'When false, a connection that would close a directed cycle is refused with reason "cycle".' },
    gridSnap: { control: 'number', description: 'Snap dragged nodes to a world-unit grid. 0 disables snapping.' },
    readonlyGraph: { control: 'boolean', description: 'Nodes may be selected but not moved, connected or deleted.' },
    a11yTreeLimit: { control: 'number', description: 'Above this node count the parallel accessible tree is summarised instead of listed — it is O(nodes) DOM and the one part of the design that cannot virtualise.' },
    showGrid: { control: 'boolean', description: 'Paints the engine’s reference dot grid.' },
    ariaLabel: { control: 'text', description: 'Accessible name for the editor.' },
  },
  args: {
    nodes: PIPELINE,
    connections: PIPELINE_EDGES,
    selection: { nodes: [], connections: [] },
    allowCycles: true,
    gridSnap: 0,
    readonlyGraph: false,
    a11yTreeLimit: 500,
    showGrid: true,
    ariaLabel: 'Pipeline editor',
  },
};

export default meta;
type Story = StoryObj<NodeEditorComponent>;

const EDITOR = (extra = '', body = ''): string => `
  <div class="w-full overflow-hidden rounded-lg border">
    <ui-node-editor
      class="h-[350px] w-full sm:h-[450px] md:h-[560px]"
      [nodes]="nodes"
      [connections]="connections"
      [selection]="selection"
      [allowCycles]="allowCycles"
      [gridSnap]="gridSnap"
      [readonlyGraph]="readonlyGraph"
      [a11yTreeLimit]="a11yTreeLimit"
      [showGrid]="showGrid"
      [ariaLabel]="ariaLabel"
      ${extra}
    >${body}</ui-node-editor>
  </div>
`;

/**
 * Drag a port to another port to connect. Grab the input end of a wire to
 * unplug it; drop it in space to delete it, or on another input to re-route it.
 * Drag a card to move it, shift-click to add to the selection, Delete to remove.
 *
 * All of it works from the keyboard: Tab into the canvas, arrow keys move
 * between nodes *spatially*, Tab cycles that node's ports, Enter starts and
 * completes a connection, shift+arrows nudge, Escape cancels.
 */
export const Default: Story = {
  render: args => ({ props: args, template: EDITOR() }),
};

/**
 * `allowCycles: false` makes the graph a DAG. Try connecting **Write table**
 * back to **Read CSV** — the wire turns red before you release, and the
 * rejection is announced rather than silently dropped.
 */
export const AcyclicOnly: Story = {
  args: { allowCycles: false },
  render: args => ({ props: args, template: EDITOR() }),
};

/**
 * Ports carry a `type`. A connection is allowed between equal types, or when
 * either side omits one — so **Lookup**'s `Key` (text) refuses a `table`.
 */
export const TypedPorts: Story = {
  render: args => ({ props: args, template: EDITOR() }),
};

/** Dragged nodes snap to a 24-unit grid; shift+arrow nudges by one cell. */
export const GridSnapping: Story = {
  args: { gridSnap: 24 },
  render: args => ({ props: args, template: EDITOR() }),
};

/** Selectable, pannable, zoomable — but nothing can be moved or rewired. */
export const ReadOnly: Story = {
  args: { readonlyGraph: true },
  render: args => ({ props: args, template: EDITOR() }),
};

/** Starting with a selection: selected cards are ringed, selected wires thicken. */
export const WithSelection: Story = {
  args: { selection: { nodes: ['filter'], connections: ['2'] } },
  render: args => ({ props: args, template: EDITOR() }),
};

/** No nodes at all. The accessible tree still renders, and reports nothing. */
export const Empty: Story = {
  args: { nodes: [], connections: [] },
  render: args => ({ props: args, template: EDITOR() }),
};

/** Without the dot grid, for a cleaner embed. */
export const NoGrid: Story = {
  args: { showGrid: false },
  render: args => ({ props: args, template: EDITOR() }),
};

/**
 * 600 nodes and 599 connections. Only the cards intersecting the viewport exist
 * in the DOM — pan around and the element count stays flat.
 *
 * `a11yTreeLimit` is lowered here so the accessible tree summarises instead of
 * emitting 600 list items, which is the trade-off that limit exists for.
 */
export const LargeGraph: Story = {
  args: { nodes: LARGE, connections: LARGE_EDGES, a11yTreeLimit: 200 },
  render: args => ({ props: args, template: EDITOR() }),
};

/**
 * A projected `*uiNodeEditorNode` template replaces the card **body**. The
 * ports keep being rendered and wired by the editor: a template that drew its
 * own would have to re-derive the layout maths that keeps a dot and its wire
 * together, and would get it wrong.
 */
export const CustomNodeTemplate: Story = {
  render: args => ({
    props: args,
    template: EDITOR(
      '',
      `
      <ng-template uiNodeEditorNode let-node>
        <div class="flex h-full w-full flex-col justify-center gap-1 px-3">
          <span class="text-xs uppercase tracking-wide text-muted-foreground">custom</span>
          <span class="truncate text-sm font-semibold">{{ node.title }}</span>
          <span class="truncate text-[11px] text-muted-foreground">
            {{ (node.ports ?? []).length }} ports
          </span>
        </div>
      </ng-template>
    `,
    ),
  }),
};
