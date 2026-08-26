import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import {
  ButtonComponent,
  InfiniteCanvasComponent,
  InfiniteCanvasItemDirective,
  type CanvasEdge,
  type CanvasItem,
  type CanvasViewport,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { CANVAS_BASICS_DEMO_LOCALES } from './canvas-basics-demo.locales';

/** A demo node: the engine only needs the box, the rest is the consumer's. */
export interface DemoCanvasNode extends CanvasItem {
  label: string;
  accent: boolean;
}

const SMALL_COUNT = 24;
const LARGE_COUNT = 10_000;

@Component({
  selector: 'app-canvas-basics-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InfiniteCanvasComponent, InfiniteCanvasItemDirective, ButtonComponent],
  templateUrl: './canvas-basics-demo.component.html',
})
export class CanvasBasicsDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => CANVAS_BASICS_DEMO_LOCALES[this.localeId()] ?? CANVAS_BASICS_DEMO_LOCALES['en'],
  );

  readonly canvasRef = viewChild<InfiniteCanvasComponent<DemoCanvasNode>>('canvasRef');

  readonly items = signal<DemoCanvasNode[]>(buildNodes(SMALL_COUNT, 6));
  readonly edges = signal<CanvasEdge[]>(buildEdges(SMALL_COUNT, 6));
  readonly showGrid = signal(true);
  readonly large = signal(false);
  readonly zoomLabel = signal('100%');
  readonly domCount = signal(0);

  /** Live element count — the whole point of the engine, so the demo shows it. */
  protected refreshStats(viewport: CanvasViewport): void {
    this.zoomLabel.set(`${Math.round(viewport.zoom * 100)}%`);
    this.domCount.set(document.querySelectorAll('[data-slot="canvas-item"]').length);
  }

  protected useSmallGraph(): void {
    this.large.set(false);
    this.items.set(buildNodes(SMALL_COUNT, 6));
    this.edges.set(buildEdges(SMALL_COUNT, 6));
    this.canvasRef()?.resetView();
  }

  protected useLargeGraph(): void {
    this.large.set(true);
    this.items.set(buildNodes(LARGE_COUNT, 100));
    this.edges.set(buildEdges(LARGE_COUNT, 100));
    this.canvasRef()?.resetView();
  }

  protected toggleGrid(): void {
    this.showGrid.update(value => !value);
  }

  protected fitView(): void {
    this.canvasRef()?.fitView();
  }

  protected zoomIn(): void {
    this.canvasRef()?.zoomBy(1.25);
  }

  protected zoomOut(): void {
    this.canvasRef()?.zoomBy(0.8);
  }

  protected goToOrigin(): void {
    this.canvasRef()?.panTo({ x: 0, y: 0 });
  }

  protected reset(): void {
    this.canvasRef()?.resetView();
  }
}

function buildNodes(count: number, columns: number): DemoCanvasNode[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: (i % columns) * 260,
    y: Math.floor(i / columns) * 170,
    width: 180,
    height: 96,
    label: `${i + 1}`,
    accent: i % 5 === 0,
  }));
}

function buildEdges(count: number, columns: number): CanvasEdge[] {
  const edges: CanvasEdge[] = [];
  for (let i = 0; i < count; i++) {
    if ((i + 1) % columns !== 0 && i + 1 < count) edges.push({ id: `h-${i}`, source: i, target: i + 1 });
    if (i + columns < count) edges.push({ id: `v-${i}`, source: i, target: i + columns, dash: [6, 6] });
  }
  return edges;
}
