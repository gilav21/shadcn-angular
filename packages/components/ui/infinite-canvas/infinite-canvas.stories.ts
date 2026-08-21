import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { InfiniteCanvasComponent } from './infinite-canvas.component';
import { InfiniteCanvasItemDirective } from './infinite-canvas-item.directive';
import type { CanvasEdge, CanvasItem } from './infinite-canvas.types';

interface DemoNode extends CanvasItem {
  label: string;
  tone: 'default' | 'accent';
}

function buildNodes(count: number, columns = 6, spacing = 260): DemoNode[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: (i % columns) * spacing,
    y: Math.floor(i / columns) * 170,
    width: 180,
    height: 96,
    label: `Node ${i + 1}`,
    tone: i % 4 === 0 ? 'accent' : 'default',
  }));
}

function buildEdges(nodes: readonly DemoNode[], columns = 6): CanvasEdge[] {
  const edges: CanvasEdge[] = [];
  for (let i = 0; i < nodes.length; i++) {
    if ((i + 1) % columns !== 0 && i + 1 < nodes.length) {
      edges.push({ id: `h-${i}`, source: i, target: i + 1 });
    }
    if (i + columns < nodes.length) {
      edges.push({ id: `v-${i}`, source: i, target: i + columns, dash: [6, 6] });
    }
  }
  return edges;
}

const SMALL = buildNodes(24);
const HUGE = buildNodes(10_000, 100);

const meta: Meta<InfiniteCanvasComponent<DemoNode>> = {
  title: 'UI/InfiniteCanvas',
  component: InfiniteCanvasComponent,
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({
      imports: [InfiniteCanvasComponent, InfiniteCanvasItemDirective],
    }),
  ],
  argTypes: {
    items: { control: 'object', description: 'Every item on the plane. Only those intersecting the viewport plus the overscan margin exist in the DOM.' },
    edges: { control: 'object', description: 'Edges between items, drawn on one canvas beneath the item layer. Endpoints resolve to item centres.' },
    minZoom: { control: { type: 'number', step: 0.01 }, description: 'Smallest allowed zoom. fitView clamps to it, so content needing a smaller scale is centred but not fully visible.' },
    maxZoom: { control: { type: 'number', step: 0.5 }, description: 'Largest allowed zoom.' },
    zoom: { control: { type: 'number', step: 0.1 }, description: 'Initial zoom level.' },
    overscan: { control: 'number', description: 'Screen-pixel margin of extra items mounted beyond the viewport edge. Doubles as the culling hysteresis window.' },
    showGrid: { control: 'boolean', description: 'Paints the reference dot grid, which tracks pan and zoom.' },
    gridSize: { control: 'number', description: 'World-space spacing of the grid dots.' },
    ariaLabel: { control: 'text', description: 'Accessible name for the canvas region.' },
    fitPadding: { control: 'number', description: 'Screen-pixel gap left around the content by fitView().' },
  },
  args: {
    items: SMALL,
    edges: buildEdges(SMALL),
    minZoom: 0.05,
    maxZoom: 8,
    zoom: 1,
    overscan: 240,
    showGrid: true,
    gridSize: 24,
    ariaLabel: 'Diagram canvas',
    fitPadding: 48,
  },
};

export default meta;
type Story = StoryObj<InfiniteCanvasComponent<DemoNode>>;

const NODE_TEMPLATE = `
  <ng-template uiInfiniteCanvasItem let-item let-i="index">
    <div
      class="flex h-full w-full flex-col justify-center gap-1 rounded-lg border bg-card p-3 shadow-sm"
      [class.border-primary]="item.tone === 'accent'"
    >
      <span class="truncate text-sm font-medium">{{ item.label }}</span>
      <span class="truncate text-xs text-muted-foreground">index {{ i }}</span>
    </div>
  </ng-template>
`;

const CANVAS = (extra = '') => `
  <div class="w-full rounded-lg border overflow-hidden">
    <ui-infinite-canvas
      class="h-[350px] sm:h-[450px] md:h-[560px] w-full"
      [items]="items"
      [edges]="edges"
      [minZoom]="minZoom"
      [maxZoom]="maxZoom"
      [zoom]="zoom"
      [overscan]="overscan"
      [showGrid]="showGrid"
      [gridSize]="gridSize"
      [ariaLabel]="ariaLabel"
      [fitPadding]="fitPadding"
      ${extra}
    >
      ${NODE_TEMPLATE}
    </ui-infinite-canvas>
  </div>
`;

/**
 * Drag empty space to pan, ctrl/cmd+wheel (or trackpad pinch) to zoom about the
 * cursor, plain wheel to pan vertically, shift+wheel horizontally, space+drag to
 * pan from anywhere. Tab to the canvas and use the arrow keys, `+`/`-`, and `0`.
 */
export const Default: Story = {
  render: args => ({ props: args, template: CANVAS() }),
};

/** No edges — the engine knows nothing about connections, they are just a layer. */
export const ItemsOnly: Story = {
  args: { edges: [] },
  render: args => ({ props: args, template: CANVAS() }),
};

/** The grid is decoration and can be turned off entirely. */
export const NoGrid: Story = {
  args: { showGrid: false },
  render: args => ({ props: args, template: CANVAS() }),
};

/** Starts zoomed out; the grid hides itself once the dots would be unreadable. */
export const ZoomedOut: Story = {
  args: { zoom: 0.35 },
  render: args => ({ props: args, template: CANVAS() }),
};

/** Zoom is clamped to a narrow band, so wheel and pinch stop at the limits. */
export const ClampedZoom: Story = {
  args: { minZoom: 0.75, maxZoom: 1.5 },
  render: args => ({ props: args, template: CANVAS() }),
};

/**
 * 10,000 items and ~20,000 edges. Pan and zoom stay smooth because only the
 * items intersecting the viewport are ever in the DOM — inspect the element
 * count and you will find a few dozen, not ten thousand.
 */
export const TenThousandItems: Story = {
  args: {
    items: HUGE,
    edges: buildEdges(HUGE, 100).slice(0, 20_000),
    zoom: 0.6,
  },
  render: args => ({ props: args, template: CANVAS() }),
};

/** Nothing to show: the engine renders an empty, still-pannable plane. */
export const Empty: Story = {
  args: { items: [], edges: [] },
  render: args => ({ props: args, template: CANVAS() }),
};

/** The imperative API, reachable through `exportAs`. */
export const ImperativeApi: Story = {
  render: args => ({
    props: args,
    template: `
      <div class="flex flex-col gap-3">
        <div class="flex flex-wrap items-center gap-2">
          <button class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" (click)="c.fitView()">Fit view</button>
          <button class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" (click)="c.zoomBy(1.25)">Zoom in</button>
          <button class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" (click)="c.zoomBy(0.8)">Zoom out</button>
          <button class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" (click)="c.panTo({ x: 0, y: 0 })">Go to origin</button>
          <button class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" (click)="c.resetView()">Reset</button>
        </div>
        <div class="w-full rounded-lg border overflow-hidden">
          <ui-infinite-canvas
            #c="uiInfiniteCanvas"
            class="h-[350px] sm:h-[450px] w-full"
            [items]="items"
            [edges]="edges"
            [ariaLabel]="ariaLabel"
          >
            ${NODE_TEMPLATE}
          </ui-infinite-canvas>
        </div>
      </div>
    `,
  }),
};

/** Renders inside an RTL container; the plane itself is direction-neutral. */
export const RightToLeft: Story = {
  render: args => ({
    props: args,
    template: `<div dir="rtl">${CANVAS()}</div>`,
  }),
};
