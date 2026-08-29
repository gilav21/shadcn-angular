import {
  viewChild,
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

/**
 * How long a whole evaluation should take, in milliseconds.
 *
 * Spread across however many nodes there are, rather than a fixed cost per
 * node. A fixed cost cannot be watched at either end: the four types used to
 * be identity passthroughs at a few microseconds, so a thousand nodes finished
 * before the first paint; and at fifty microseconds each a hundred thousand
 * nodes take ten seconds while a thousand still finish in a tenth of one.
 * Pinning the RUN rather than the node keeps the wave at a speed a person can
 * follow at every size the page offers.
 */
const RUN_MS = 4_000;

/** Per-node budget, set when a graph is built. See {@link RUN_MS}. */
let computeMs = 0.05;

/**
 * Busy work that cannot be optimised away, and returns something usable.
 *
 * A spin rather than a sleep, because the point is to occupy the thread the
 * way a real `compute` would — an `await` would hand the time back and measure
 * nothing.
 */
function think(seed: number): number {
  const until = performance.now() + computeMs;
  let value = seed;
  while (performance.now() < until) {
    value = (value * 31 + 7) % 100_000;
  }
  return value;
}

const CONNECTION: NodeTypeDefinition = {
  id: 'connection',
  label: 'Database',
  accent: '#0e7c86',
  ports: [{ id: 'schema', direction: 'out', label: 'Schema' }],
  initialState: () => 1,
  compute: (_inputs, ctx) => ({ schema: think(Number(ctx.state) || 1) }),
};

const TABLE: NodeTypeDefinition = {
  id: 'table',
  label: 'Table',
  ports: [
    { id: 'schema', direction: 'in', label: 'Schema' },
    { id: 'table', direction: 'out', label: 'Table' },
  ],
  compute: inputs => ({ table: think(Number(inputs['schema']) || 1) }),
};

const DESCRIBE: NodeTypeDefinition = {
  id: 'describe',
  label: 'Describe',
  ports: [
    { id: 'table', direction: 'in', label: 'Table' },
    { id: 'columns', direction: 'out', label: 'Columns' },
  ],
  compute: inputs => ({ columns: think(Number(inputs['table']) || 1) }),
};

const QUERY: NodeTypeDefinition = {
  id: 'query',
  label: 'Query',
  accent: '#c2610a',
  ports: [
    { id: 'columns', direction: 'in', label: 'Columns' },
    { id: 'rows', direction: 'out', label: 'Rows' },
  ],
  compute: inputs => ({ rows: think(Number(inputs['columns']) || 1) }),
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

  /** The editor, for Run and Stop. */
  protected readonly editorRef = viewChild<NodeEditorComponent>('editor');

  protected readonly evaluating = signal(false);
  protected readonly settled = signal(0);
  /**
   * Slice and gap, in milliseconds.
   *
   * The two numbers that say WHICH limit is being hit. `slice` is how long the
   * drain held the thread; `gap` is everything else the frame did — change
   * detection, layout, paint. If the gap dwarfs the slice then the budget is
   * not the lever and no value of `sliceMs` will help, which is a thing worth
   * knowing before tuning a constant.
   */
  protected readonly sliceMs = signal<number | null>(null);
  protected readonly gapMs = signal<number | null>(null);

  /**
   * Counted in a plain field and published once per gap.
   *
   * A signal write per settled node would schedule change detection a hundred
   * thousand times inside the very frames this is meant to keep clear.
   */
  private settledSinceGap = 0;
  private sliceStarted = 0;
  private gapStarted = 0;

  protected readonly cardsInDom = signal(0);
  protected readonly measuring = signal(false);
  protected readonly worst = signal<number | null>(null);
  protected readonly overBudget = signal<number | null>(null);
  protected readonly sampled = signal(0);

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
    // Switching mid-run would delete nodes underneath an evaluation; the
    // runtime survives that, but the graph the user gets is not the one they
    // asked for. Stop first.
    if (scale === this.scale() || this.evaluating()) return;
    this.load(scale);
  }

  /**
   * Evaluates the graph, and watches what each frame is actually spent on.
   *
   * The editor's own yield is wrapped rather than replaced, so the measurement
   * observes the real mechanism instead of a copy of it.
   */
  protected async run(): Promise<void> {
    const editor = this.editorRef();
    if (!editor || this.evaluating()) return;

    const runtime = editor.runtime;
    const yieldTo = runtime.yieldTo;
    if (!yieldTo) return;

    this.evaluating.set(true);
    this.settled.set(0);
    this.settledSinceGap = 0;
    this.sliceStarted = performance.now();

    /*
     * CHAINED, not replaced.
     *
     * The editor sets this handler itself, and it is what lights a node that
     * just ran — assigning over it silently turned the whole flow effect off,
     * which is exactly how the first version of this page evaluated a hundred
     * thousand nodes with nothing whatsoever to watch.
     */
    const editorsOwn = runtime.onNodeSettled;
    runtime.onNodeSettled = (event): void => {
      editorsOwn?.(event);
      this.settledSinceGap++;
    };

    runtime.yieldTo = async (): Promise<void> => {
      this.gapStarted = performance.now();
      this.sliceMs.set(this.gapStarted - this.sliceStarted);

      await yieldTo();

      const resumed = performance.now();
      this.gapMs.set(resumed - this.gapStarted);
      this.sliceStarted = resumed;
      this.settled.update(count => count + this.settledSinceGap);
      this.settledSinceGap = 0;
    };

    try {
      await runtime.run();
    } finally {
      runtime.yieldTo = yieldTo;
      runtime.onNodeSettled = editorsOwn;
      this.settled.update(count => count + this.settledSinceGap);
      this.evaluating.set(false);
      this.countCards();
    }
  }

  protected stop(): void {
    this.editorRef()?.cancel();
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
    this.worst.set(null);
    this.overBudget.set(null);
    this.sampled.set(0);

    clearTimeout(this.buildHandle);
    this.buildHandle = setTimeout(() => {
      const built = buildWorkload(scale);

      // Spread one run's worth of work over however many nodes there are, so
      // the wave moves at the same speed at every size. See `RUN_MS`.
      computeMs = RUN_MS / Math.max(1, built.nodes.length);

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

    /*
     * The MEDIAN of animation-frame deltas is not a measurement, and reporting
     * it was actively misleading: a browser that drops frames simply calls back
     * less often, so the gap between callbacks stays around 16.7ms whether it
     * is keeping up or crawling. This page showed a confident "60fps" on a
     * phone that had already stopped responding.
     *
     * The slowest frame, and how many frames missed the budget, are the two
     * numbers that cannot lie that way.
     */
    const sorted = [...samples].sort((a, b) => a - b);
    this.worst.set(sorted[sorted.length - 1]);
    this.overBudget.set(samples.filter(sample => sample > BUDGET_MS * 1.5).length);
    this.sampled.set(samples.length);
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
    const value = this.worst();
    return value !== null && value <= BUDGET_MS * 1.5;
  }

  /** "3 of 180", or the locale's "not measured yet". */
  protected overBudgetLabel(): string {
    const over = this.overBudget();
    if (over === null) return this.t().notMeasured;
    return `${over} / ${this.sampled()}`;
  }

  protected format(value: number): string {
    return value.toLocaleString(this.localeId());
  }
}
