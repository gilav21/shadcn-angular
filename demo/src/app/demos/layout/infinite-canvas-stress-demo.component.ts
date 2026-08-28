import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  ButtonComponent,
  NodeEditorComponent,
  type EditorNode,
  type NodeConnection,
  type NodeTypeDefinition,
} from '../../../../../packages/components/ui';
import {
  NodeEditorGroupsComponent,
  type NodeGroup,
} from '../../../../../packages/components/ui/infinite-canvas/addons/node-editor-groups';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { INFINITE_CANVAS_STRESS_DEMO_LOCALES } from './infinite-canvas-stress-demo.locales';

/**
 * The node editor under a load nobody would build by hand.
 *
 * The shape is the one the engine was asked for and the one the benchmark
 * measures: a connection node per database, a table node per table, and a
 * describe/query pair hanging off each table. Wide, shallow and heavily
 * connected — the profile that punishes anything O(all nodes) per interaction.
 *
 * The number worth watching is not the frame time on its own but the frame
 * time NEXT TO the card count: a hundred thousand nodes with forty elements in
 * the document is the whole design in one line.
 */

const TABLES_PER_DB = 8;
const NODE_W = 180;
const NODE_H = 80;

/** Sizes offered, in nodes. 100k is well past anything a person would author. */
const SCALES = [1_000, 10_000, 50_000, 100_000] as const;
type Scale = (typeof SCALES)[number];

const CONNECTION: NodeTypeDefinition = {
  id: 'connection',
  label: 'Database',
  accent: '#0e7c86',
  ports: [{ id: 'schema', direction: 'out', label: 'Schema' }],
  initialState: () => 1,
  compute: (_inputs, ctx) => ({ schema: ctx.state }),
};

const TABLE: NodeTypeDefinition = {
  id: 'table',
  label: 'Table',
  ports: [
    { id: 'schema', direction: 'in', label: 'Schema' },
    { id: 'table', direction: 'out', label: 'Table' },
  ],
  compute: inputs => ({ table: inputs['schema'] }),
};

const DESCRIBE: NodeTypeDefinition = {
  id: 'describe',
  label: 'Describe',
  ports: [
    { id: 'table', direction: 'in', label: 'Table' },
    { id: 'columns', direction: 'out', label: 'Columns' },
  ],
  compute: inputs => ({ columns: inputs['table'] }),
};

const QUERY: NodeTypeDefinition = {
  id: 'query',
  label: 'Query',
  accent: '#c2610a',
  ports: [
    { id: 'columns', direction: 'in', label: 'Columns' },
    { id: 'rows', direction: 'out', label: 'Rows' },
  ],
  compute: inputs => ({ rows: inputs['columns'] }),
};

interface Workload {
  readonly nodes: EditorNode[];
  readonly connections: NodeConnection[];
  readonly groups: NodeGroup[];
}

/**
 * A grid-laid explorer of roughly `target` nodes.
 *
 * Laid out on a real pitch rather than piled at the origin, because the
 * spatial index is only exercised by items that are actually spread out — a
 * heap at one point lands in one bucket and measures nothing.
 */
function buildWorkload(target: number): Workload {
  const perDb = 1 + TABLES_PER_DB * 3;
  const dbCount = Math.max(1, Math.round(target / perDb));

  const nodes: EditorNode[] = [];
  const connections: NodeConnection[] = [];
  const groups: NodeGroup[] = [];
  const columns = Math.ceil(Math.sqrt(dbCount));

  for (let db = 0; db < dbCount; db++) {
    const originX = (db % columns) * 1400;
    const originY = Math.floor(db / columns) * 900;
    const dbId = `db${db}`;

    nodes.push({
      id: dbId,
      type: 'connection',
      title: `db_${db}`,
      x: originX,
      y: originY,
      width: NODE_W,
      height: NODE_H,
    });

    for (let t = 0; t < TABLES_PER_DB; t++) {
      const tableId = `${dbId}_t${t}`;
      const describeId = `${tableId}_d`;
      const queryId = `${tableId}_q`;
      const rowY = originY + t * 100;

      nodes.push({ id: tableId, type: 'table', title: `table_${t}`, x: originX + 300, y: rowY, width: NODE_W, height: NODE_H });
      nodes.push({ id: describeId, type: 'describe', x: originX + 600, y: rowY, width: NODE_W, height: NODE_H });
      nodes.push({ id: queryId, type: 'query', x: originX + 900, y: rowY, width: NODE_W, height: NODE_H });

      connections.push({ id: `${tableId}_c0`, source: dbId, sourcePort: 'schema', target: tableId, targetPort: 'schema' });
      connections.push({ id: `${tableId}_c1`, source: tableId, sourcePort: 'table', target: describeId, targetPort: 'table' });
      connections.push({ id: `${tableId}_c2`, source: describeId, sourcePort: 'columns', target: queryId, targetPort: 'columns' });
    }

    groups.push({
      id: `g${db}`,
      title: `db_${db}`,
      x: originX - 40,
      y: originY - 60,
      width: 1200,
      height: TABLES_PER_DB * 100 + 80,
    });
  }

  return { nodes, connections, groups };
}

/** How long a measurement runs, in milliseconds. */
const SAMPLE_MS = 3_000;
/** Frames slower than this missed the 60fps budget. */
const BUDGET_MS = 16.7;

@Component({
  selector: 'app-infinite-canvas-stress-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NodeEditorComponent, NodeEditorGroupsComponent, ButtonComponent],
  templateUrl: './infinite-canvas-stress-demo.component.html',
})
export class InfiniteCanvasStressDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () =>
      INFINITE_CANVAS_STRESS_DEMO_LOCALES[this.localeId()] ??
      INFINITE_CANVAS_STRESS_DEMO_LOCALES['en'],
  );

  protected readonly scales = SCALES;
  protected readonly budgetMs = BUDGET_MS;
  protected readonly definitions = [CONNECTION, TABLE, DESCRIBE, QUERY];

  protected readonly scale = signal<Scale>(1_000);
  protected readonly building = signal(false);
  protected readonly showGroups = signal(true);

  readonly nodes = signal<readonly EditorNode[]>([]);
  readonly connections = signal<readonly NodeConnection[]>([]);
  readonly groups = signal<readonly NodeGroup[]>([]);

  protected readonly cardsInDom = signal(0);
  protected readonly measuring = signal(false);
  protected readonly median = signal<number | null>(null);
  protected readonly worst = signal<number | null>(null);
  protected readonly fps = signal<number | null>(null);

  /**
   * The sampler is armed only while measuring.
   *
   * A permanent animation-frame loop would be its own load, and would make the
   * demo measure itself. It is started by the button and stops on its own.
   */
  private frameHandle = 0;
  private buildHandle?: ReturnType<typeof setTimeout>;
  private watchdogHandle?: ReturnType<typeof setTimeout>;
  private countHandle?: ReturnType<typeof setTimeout>;

  constructor() {
    this.load(1_000);
    inject(DestroyRef).onDestroy(() => this.stopSampling());
  }

  protected select(scale: Scale): void {
    if (scale === this.scale()) return;
    this.load(scale);
  }

  protected toggleGroups(): void {
    this.showGroups.update(on => !on);
  }

  /**
   * Builds a graph and hands it to the editor.
   *
   * Deferred so the "building" state paints first — at a hundred thousand
   * nodes the construction takes long enough to see, and a UI that freezes
   * without saying why looks like the thing under test failing.
   *
   * A TIMER rather than an animation frame, and that is not a detail: a hidden
   * tab does not run animation frames at all. Deferring the build to one meant
   * that switching away mid-build left `building` true forever — every control
   * disabled, the graph never arriving, and nothing in the console to say why.
   * A timer still fires in a background tab, so the work completes and the
   * page is correct whenever the viewer comes back to it.
   */
  private load(scale: Scale): void {
    this.scale.set(scale);
    this.building.set(true);
    this.median.set(null);
    this.worst.set(null);
    this.fps.set(null);

    clearTimeout(this.buildHandle);
    this.buildHandle = setTimeout(() => {
      const built = buildWorkload(scale);
      this.nodes.set(built.nodes);
      this.connections.set(built.connections);
      this.groups.set(built.groups);
      this.building.set(false);
      // Once change detection has mounted what is visible; counting sooner
      // counts nothing.
      this.countHandle = setTimeout(() => this.countCards(), 0);
    }, 0);
  }

  /** How many node cards the virtualizer currently has mounted. */
  protected countCards(): void {
    this.cardsInDom.set(document.querySelectorAll('[data-slot="node-editor-node"]').length);
  }

  protected measure(): void {
    if (this.measuring()) return;

    const samples: number[] = [];
    let previous = performance.now();
    const started = previous;
    this.measuring.set(true);

    const step = (now: number): void => {
      samples.push(now - previous);
      previous = now;
      this.countCards();

      if (now - started < SAMPLE_MS) {
        this.frameHandle = requestAnimationFrame(step);
        return;
      }
      this.stopSampling();
      this.report(samples);
    };
    this.frameHandle = requestAnimationFrame(step);

    /*
     * A hidden tab does not run animation frames.
     *
     * Without this the button would sit on "measuring" for as long as the page
     * stayed in the background — indefinitely, with no error and no way back.
     * The watchdog reports whatever arrived, which for a hidden tab is nothing,
     * and a measurement of nothing is honestly reported as not measured.
     */
    this.watchdogHandle = setTimeout(() => {
      if (!this.measuring()) return;
      this.stopSampling();
      this.report(samples);
    }, SAMPLE_MS * 2);
  }

  private report(samples: number[]): void {
    this.measuring.set(false);
    this.countCards();
    // Fewer than two frames is not a sample, it is a tab that was not drawing.
    if (samples.length < 2) return;

    const sorted = [...samples].sort((a, b) => a - b);
    const mid = sorted[Math.floor(sorted.length / 2)];
    this.median.set(mid);
    this.worst.set(sorted[sorted.length - 1]);
    this.fps.set(mid > 0 ? 1000 / mid : 0);
  }

  private stopSampling(): void {
    if (this.frameHandle) cancelAnimationFrame(this.frameHandle);
    this.frameHandle = 0;
    clearTimeout(this.buildHandle);
    clearTimeout(this.countHandle);
    clearTimeout(this.watchdogHandle);
  }

  /** A measured millisecond count, or the locale's "not measured yet". */
  protected ms(value: number | null): string {
    return value === null ? this.t().notMeasured : `${value.toFixed(1)}ms`;
  }

  protected rounded(value: number | null): string {
    return value === null ? this.t().notMeasured : String(Math.round(value));
  }

  protected withinBudget(): boolean {
    const value = this.median();
    return value !== null && value <= BUDGET_MS;
  }

  protected format(value: number): string {
    return value.toLocaleString(this.localeId());
  }
}
