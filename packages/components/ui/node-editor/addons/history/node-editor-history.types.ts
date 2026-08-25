/**
 * What a run history is made of.
 *
 * Everything here is plain JSON. That is the constraint the whole addon is
 * built around: a record that cannot be written to disk is not a history, it
 * is a debug print that disappears when the tab closes.
 */
import type { NodeId, NodeStatus, PortValues, SerializedGraph } from '../..';

/** One node's work on one run. */
export interface RunNodeRecord {
  readonly nodeId: NodeId;
  /** The node's title at the time, so an old run still reads as words. */
  readonly title: string;
  readonly status: NodeStatus;
  readonly inputs: PortValues;
  readonly outputs: PortValues;
  /**
   * The error MESSAGE, not the error.
   *
   * `JSON.stringify(new Error('boom'))` is `'{}'` — the message is on the
   * prototype and does not survive. Storing the object would give a history
   * that looks right in the console and exports as an empty pair of braces.
   */
  readonly error?: string;
  readonly durationMs: number;
}

/** One evaluation pass, as it is kept. */
export interface RunRecord {
  readonly id: number;
  /** Wall clock, milliseconds since the epoch. */
  readonly startedAt: number;
  readonly durationMs: number;
  readonly status: 'done' | 'error';
  /** In the order the work actually completed. */
  readonly nodes: readonly RunNodeRecord[];
  /**
   * The graph as it was when the run began.
   *
   * Kept per run rather than once, because the interesting question is almost
   * always *"what was the graph doing when this went wrong"* — and by the time
   * anyone asks, the graph has usually been edited.
   */
  readonly graph: SerializedGraph | null;
}

/**
 * Where runs go to be kept.
 *
 * Deliberately one method, and deliberately not implemented here. Storage is
 * the consumer's: IndexedDB, a POST to a backend, an in-memory array in a
 * test. Choosing IndexedDB on everyone's behalf would put a storage engine and
 * a schema migration into a component whose job is to show a list.
 */
export interface RunSink {
  append(record: RunRecord): void | Promise<void>;
}
