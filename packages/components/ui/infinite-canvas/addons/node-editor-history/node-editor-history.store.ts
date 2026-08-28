/**
 * Collects run records from the editor's lifecycle events.
 *
 * ### Why a plain class and not a service
 *
 * `providedIn: 'root'` would make one history for the whole application, and
 * the moment a page shows two editors — or a subgraph node owns a nested one —
 * their runs would interleave into a single unreadable list. The same
 * no-singleton rule the runtime is built on, for the same reason.
 *
 * ### Why it is bounded
 *
 * A graph with a streaming node produces a run per emission. Left unbounded,
 * an editor open overnight is a memory leak that reports itself as a very long
 * list. `limit` drops the oldest, and a consumer that wants everything gives
 * a `sink` — which is where "keep it forever" belongs.
 */
import { computed, signal, type Signal } from '@angular/core';
import type {
  NodeId,
  NodeSettledEvent,
  RunFinishedEvent,
  RunStartedEvent,
  SerializedGraph,
} from '../node-editor';
import type { RunNodeRecord, RunRecord, RunSink } from './node-editor-history.types';

export interface RunHistoryOptions {
  /** How many runs to keep in memory. The oldest are dropped. */
  readonly limit?: number;
  /** Where runs are kept beyond memory. */
  readonly sink?: RunSink | null;
}

const DEFAULT_LIMIT = 50;

export class RunHistoryStore {
  private readonly limit: number;
  private readonly sink: RunSink | null;
  private readonly records = signal<readonly RunRecord[]>([]);

  /** Newest first, which is the order anyone reads a log in. */
  readonly runs: Signal<readonly RunRecord[]> = this.records.asReadonly();

  /**
   * Runs that have begun and not finished, each holding a whole-graph snapshot.
   *
   * Exposed so a test can prove one is not left behind — the same reason
   * `SpatialHash.cellCount` exists. A begin with no matching finish retains a
   * deep copy of every node and connection, which on a large board is the most
   * expensive thing this store can hold, and nothing else can see it.
   */
  get openCount(): number {
    return this.openGraphs.size;
  }
  readonly latest: Signal<RunRecord | null> = computed(() => this.records()[0] ?? null);

  /** The graph as it was when the pass in flight began, keyed by run id. */
  private readonly openGraphs = new Map<number, SerializedGraph | null>();

  constructor(options: RunHistoryOptions = {}) {
    this.limit = Math.max(1, options.limit ?? DEFAULT_LIMIT);
    this.sink = options.sink ?? null;
  }

  /**
   * A pass began. The graph is captured NOW, not when it finishes.
   *
   * By the time anyone asks what a run did, the graph has usually been edited
   * — so a snapshot taken at the end would be a picture of a different graph.
   */
  begin(event: RunStartedEvent, graph: SerializedGraph | null): void {
    this.openGraphs.set(event.runId, graph);
    // A pass that never finishes — the editor was destroyed mid-run — must not
    // hold its snapshot forever.
    if (this.openGraphs.size > this.limit) {
      const oldest = this.openGraphs.keys().next();
      if (oldest.done !== true) this.openGraphs.delete(oldest.value);
    }
  }

  /** A pass finished. Returns the record it kept. */
  finish(event: RunFinishedEvent): RunRecord {
    const graph = this.openGraphs.get(event.runId) ?? null;
    this.openGraphs.delete(event.runId);

    const record: RunRecord = {
      id: event.runId,
      startedAt: event.startedAt,
      durationMs: event.durationMs,
      status: event.status,
      nodes: recordsFor(event.nodes, graph),
      graph,
    };

    this.records.update(existing => [record, ...existing].slice(0, this.limit));
    void this.sink?.append(record);
    return record;
  }

  clear(): void {
    this.records.set([]);
    this.openGraphs.clear();
  }
}

/**
 * One record per settled node, resolving each title through an index.
 *
 * `toNodeRecord` used to scan the snapshot for its node, so a run in which N
 * nodes settle over an N-node graph was O(N x N) - ten billion comparisons on
 * a graph of a hundred thousand, run synchronously inside the `runFinished`
 * handler. That is not a slow history panel, it is a frozen tab.
 */
function recordsFor(
  events: readonly NodeSettledEvent[],
  graph: SerializedGraph | null,
): RunNodeRecord[] {
  const titles = new Map<NodeId, string | undefined>();
  for (const node of graph?.nodes ?? []) titles.set(node.id, node.title);
  return events.map(event => toNodeRecord(event, titles));
}

function toNodeRecord(
  event: NodeSettledEvent,
  titles: ReadonlyMap<NodeId, string | undefined>,
): RunNodeRecord {
  const title = titles.get(event.nodeId);
  return {
    nodeId: event.nodeId,
    title: title ?? String(event.nodeId),
    status: event.status,
    inputs: event.inputs,
    outputs: event.outputs,
    error: messageOf(event.error),
    durationMs: event.durationMs,
  };
}

/**
 * An error as a string that survives JSON.
 *
 * `undefined` rather than an empty string when there was no error, so the key
 * is simply absent from the exported document.
 */
function messageOf(error: unknown): string | undefined {
  if (error === undefined || error === null) return undefined;
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'number' || typeof error === 'boolean') return String(error);
  if (typeof error === 'bigint') return `${error}n`;
  if (typeof error === 'symbol') return error.toString();
  if (typeof error === 'function') return '[function]';

  /*
   * Everything left is an object — what an HTTP layer usually rejects with.
   * There is deliberately no `String()` fallback: on an object it yields
   * '[object Object]', which is the exact information loss this function
   * exists to prevent. Each case above is named instead.
   */
  return describeThrownObject(error);
}

function describeThrownObject(error: object): string {
  try {
    return JSON.stringify(error) ?? 'Unserialisable error';
  } catch {
    // Circular, or a getter that throws. The run still failed, and saying so
    // beats losing the record of it.
    return 'Unserialisable error';
  }
}
