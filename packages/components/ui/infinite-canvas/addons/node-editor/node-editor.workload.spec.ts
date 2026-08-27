/**
 * A heavy, realistic workload: the database explorer.
 *
 * `node-editor.perf.spec.ts` proves *asymptotics* on a synthetic fan-out graph
 * — that a change costs only what depends on it. This file asks a different
 * question: what does one frame of a real editing session actually cost, at a
 * size a real application would reach?
 *
 * The shape is the one this engine was asked for: a connection node per
 * database, a table node per table, and a describe/query pair hanging off each
 * table. That gives a graph that is wide, shallow, and heavily connected — the
 * profile that punishes anything O(all nodes) per interaction, and the profile
 * a synthetic chain hides.
 *
 * **Timings are logged, never asserted.** A millisecond on a loaded Windows box
 * is not a fact; the counts beside them are. The numbers exist to be read
 * before and after a change, which is the only honest way to claim one helped.
 */
import { describe, it, expect } from 'vitest';
import { NodeGraphRuntime } from './node-editor.runtime';
import { withMaterializedTypes, indexDefinitions } from './node-editor.materialize';
import { adjacency, touchedBy, indexNodes, toCanvasEdges } from './node-editor.graph';
import { SpatialHash } from '../../infinite-canvas.spatial-hash';
import { CanvasItemLayer } from '../../infinite-canvas.item-layer';
import { CanvasEdgeRenderer } from '../../infinite-canvas.edge-renderer';
import { membership } from '../node-editor-groups';
import type { NodeGroup } from '../node-editor-groups';
import type { NodeTypeDefinition } from './node-editor.runtime.types';
import type { EditorNode, NodeConnection } from './node-editor.types';

/* ------------------------------------------------------------------- types */

const CONNECTION: NodeTypeDefinition = {
  id: 'connection',
  label: 'Database',
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
  ports: [
    { id: 'columns', direction: 'in', label: 'Columns' },
    { id: 'rows', direction: 'out', label: 'Rows' },
  ],
  compute: inputs => ({ rows: inputs['columns'] }),
};

const DEFS = [CONNECTION, TABLE, DESCRIBE, QUERY];

/* ---------------------------------------------------------------- workload */

const NODE_W = 180;
const NODE_H = 80;

/** Tables per database. Four nodes per table keeps the graph wide, not deep. */
const TABLES_PER_DB = 8;

interface Workload {
  /** As authored: a type and a box, no ports. What the editor stores. */
  readonly nodes: EditorNode[];
  /**
   * The same nodes with their ports materialised from the definitions.
   *
   * This is what the editor's `sizedNodes` hands downstream, and edges cannot
   * be anchored without it — `toCanvasEdges` skips any connection whose port
   * it cannot find, so measuring it against unmaterialised nodes measures an
   * early return rather than the work.
   */
  readonly sized: readonly EditorNode[];
  readonly connections: NodeConnection[];
  readonly groups: NodeGroup[];
  readonly databases: string[];
}

/**
 * A grid-laid explorer of roughly `target` nodes.
 *
 * Position matters to this benchmark and is not decoration. Every node stacked
 * at the origin would land in one hash bucket, which makes the index look
 * either free or useless depending on which way you squint. Spreading them on a
 * realistic pitch is what makes the cell-occupancy numbers below mean anything.
 */
function buildWorkload(target: number): Workload {
  const perDb = 1 + TABLES_PER_DB * 3;
  const dbCount = Math.max(1, Math.round(target / perDb));

  const nodes: EditorNode[] = [];
  const connections: NodeConnection[] = [];
  const groups: NodeGroup[] = [];
  const databases: string[] = [];

  const columns = Math.ceil(Math.sqrt(dbCount));

  for (let db = 0; db < dbCount; db++) {
    const originX = (db % columns) * 1400;
    const originY = Math.floor(db / columns) * 900;

    const dbId = `db${db}`;
    databases.push(dbId);
    nodes.push({
      id: dbId,
      type: 'connection',
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

      nodes.push({
        id: tableId,
        type: 'table',
        x: originX + 300,
        y: rowY,
        width: NODE_W,
        height: NODE_H,
      });
      nodes.push({
        id: describeId,
        type: 'describe',
        x: originX + 600,
        y: rowY,
        width: NODE_W,
        height: NODE_H,
      });
      nodes.push({
        id: queryId,
        type: 'query',
        x: originX + 900,
        y: rowY,
        width: NODE_W,
        height: NODE_H,
      });

      connections.push({
        id: `${tableId}_c0`,
        source: dbId,
        sourcePort: 'schema',
        target: tableId,
        targetPort: 'schema',
      });
      connections.push({
        id: `${tableId}_c1`,
        source: tableId,
        sourcePort: 'table',
        target: describeId,
        targetPort: 'table',
      });
      connections.push({
        id: `${tableId}_c2`,
        source: describeId,
        sourcePort: 'columns',
        target: queryId,
        targetPort: 'columns',
      });
    }

    groups.push({
      id: `g${db}`,
      title: dbId,
      x: originX - 40,
      y: originY - 60,
      width: 1200,
      height: TABLES_PER_DB * 100 + 80,
    });
  }

  const sized = withMaterializedTypes(nodes, indexDefinitions(DEFS), () => undefined);
  return { nodes, sized, connections, groups, databases };
}

/* ------------------------------------------------------------- measurement */

/** Logged, never asserted on. */
function report(label: string, ms: number): void {
  // eslint-disable-next-line no-console -- the whole point of this file
  console.log(`[workload] ${label.padEnd(46)} ${ms.toFixed(2)}ms`);
}

/** Logged, never asserted on. */
function note(line: string): void {
  // eslint-disable-next-line no-console -- the whole point of this file
  console.log(`[workload] ${line}`);
}

/**
 * The editor keeps a second index keyed on the id as text, because the DOM
 * only ever carries an id as a string. Measured alongside the first.
 */
function byRawId(nodes: readonly EditorNode[]): ReadonlyMap<string, EditorNode> {
  return new Map(nodes.map(node => [String(node.id), node] as const));
}

/** Keeps a measured result reachable, so nothing is optimised away as dead. */
let sink = 0;

/** Median of `runs` timed calls, to blunt one unlucky GC pause. */
function bench(runs: number, fn: () => void): number {
  const samples: number[] = [];
  for (let i = 0; i < runs; i++) {
    const started = performance.now();
    fn();
    samples.push(performance.now() - started);
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)];
}

const FRAME_SIZES = [1_000, 10_000, 100_000];
const RUNTIME_SIZES = [1_000, 10_000];
const TIMEOUT_MS = 300_000;

/* ========================================================= THE MEASUREMENT */

describe('WORKLOAD — one drag frame in a database explorer', () => {
  for (const size of FRAME_SIZES) {
    it(
      `measures the per-frame cost at ~${size} nodes`,
      () => {
        const { nodes, sized, connections, groups } = buildWorkload(size);
        const definitions = indexDefinitions(DEFS);
        const moved = sized[Math.floor(sized.length / 2)];
        const raw = nodes[Math.floor(nodes.length / 2)];

        note(
          `===== ${nodes.length} nodes, ${connections.length} connections, ` +
            `${groups.length} groups =====`,
        );

        // Everything below runs today on EVERY pointermove of a node drag.
        /*
         * Real drag frames, not the same array three times.
         *
         * Anything that remembers a result per node object would look free if
         * handed an identical array repeatedly — so each iteration gets a
         * fresh array in which exactly one node is a new object, which is what
         * a pointermove actually produces.
         */
        const dragFrames = [1, 2, 3].map(step =>
          nodes.map(n => (n === raw ? { ...n, x: n.x + step, y: n.y + step } : n)),
        );
        let tick = 0;
        const nextFrame = (): readonly EditorNode[] => dragFrames[tick++ % dragFrames.length];

        report(
          'withMaterializedTypes (one node dragged)',
          bench(3, () => {
            sink = withMaterializedTypes(nextFrame(), definitions, () => undefined).length;
          }),
        );

        report(
          'indexNodes x2 (nodesById + byRawId)',
          bench(3, () => {
            const frame = nextFrame();
            sink = indexNodes(frame).size + byRawId(frame).size;
          }),
        );

        const sizedFrames = dragFrames.map(f =>
          withMaterializedTypes(f, definitions, () => undefined),
        );
        // Given the index, because the component now shares the one its card
        // lookups already build rather than making a second one per frame.
        const sizedIndexes = sizedFrames.map(f => indexNodes(f));
        let etick = 0;
        report(
          'toCanvasEdges (one node dragged, index shared)',
          bench(3, () => {
            const i = etick++ % sizedFrames.length;
            sink = toCanvasEdges(sizedFrames[i], connections, {}, sizedIndexes[i]).length;
          }),
        );

        report(
          'membership (groups x nodes)',
          bench(3, () => {
            membership(groups, nodes);
          }),
        );

        const hash = new SpatialHash<EditorNode>(360);
        report(
          'SpatialHash.rebuild (what runs today)',
          bench(3, () => {
            hash.rebuild(nodes);
          }),
        );

        // ...and what should run instead: one moved node, one index update.
        hash.rebuild(nodes);
        report(
          'SpatialHash.move (one node) x1000',
          bench(3, () => {
            for (let i = 0; i < 1000; i++) {
              hash.move({ ...moved, x: moved.x + (i % 7), y: moved.y + (i % 5) });
            }
          }),
        );

        const index = adjacency(connections);
        report(
          'adjacency (built once, not per frame)',
          bench(3, () => {
            adjacency(connections);
          }),
        );
        report(
          'touchedBy (edges of the moved node) x1000',
          bench(3, () => {
            for (let i = 0; i < 1000; i++) touchedBy(index, [moved.id]);
          }),
        );

        // The O(N log N) sort the old setItems ran on every frame, to retune a
        // cell size that a drag cannot change.
        report(
          'cellSizeFor (sorts every item)',
          bench(3, () => {
            sink = CanvasItemLayer.cellSizeFor(nodes);
          }),
        );

        /*
         * The edge renderer driven exactly as a drag drives it: a fresh edge
         * list from `toCanvasEdges` in which only the moved node's edges carry
         * different numbers. Three distinct positions so no call is a no-op.
         */
        const renderer = new CanvasEdgeRenderer(document.createElement('canvas'));
        const frames = [1, 2, 3].map(step => {
          const shifted = sized.map(n =>
            n === moved ? { ...n, x: n.x + step, y: n.y + step } : n,
          );
          return { edges: toCanvasEdges(shifted, connections), byId: indexNodes(shifted) };
        });
        renderer.setEdges(toCanvasEdges(sized, connections), indexNodes(sized));

        let frame = 0;
        report(
          'renderer.setEdges (one node dragged)',
          bench(3, () => {
            const next = frames[frame++ % frames.length];
            renderer.setEdges(next.edges, next.byId);
          }),
        );
        expect(renderer.edgeCount).toBe(connections.length);

        const incident = touchedBy(index, [moved.id]);
        const share = ((incident.length / connections.length) * 100).toFixed(4);
        note(`edges re-anchored: ${incident.length} of ${connections.length} (${share}%)`);
        note(`hash buckets: ${hash.cellCount} for ${hash.size} items`);

        // The invariant the timings exist to serve: a drag touches a constant
        // number of edges however large the graph gets.
        expect(incident.length).toBeLessThanOrEqual(TABLES_PER_DB * 3);
        expect(hash.size).toBe(nodes.length);
        expect(sink).toBeGreaterThan(0);
      },
      TIMEOUT_MS,
    );
  }
});

describe('WORKLOAD — a schema change fanning out', () => {
  for (const size of RUNTIME_SIZES) {
    it(
      `re-evaluates every dependant of one database at ~${size} nodes`,
      async () => {
        const { nodes, connections, databases } = buildWorkload(size);
        const runtime = new NodeGraphRuntime();
        runtime.setDefinitions(DEFS);
        runtime.setGraph(nodes, connections);

        const cold = performance.now();
        await runtime.run();
        report(`cold run (${nodes.length} nodes)`, performance.now() - cold);

        // One database reconnects: its tables, describes and queries follow.
        runtime.resetMetrics();
        const one = performance.now();
        runtime.setState(databases[0], 2);
        await runtime.run();
        report('one database reconnects', performance.now() - one);
        const single = runtime.metrics.computed.length;
        note(`recomputed for one database: ${single}`);

        // ...and the case that actually hurts: everything refreshes at once.
        runtime.resetMetrics();
        const all = performance.now();
        for (const db of databases) runtime.setState(db, 3);
        await runtime.run();
        report(`ALL ${databases.length} databases refresh together`, performance.now() - all);
        note(`recomputed for all: ${runtime.metrics.computed.length}`);

        // One database is one connection node plus three nodes per table.
        expect(single).toBe(1 + TABLES_PER_DB * 3);
        runtime.dispose();
      },
      TIMEOUT_MS,
    );
  }
});
