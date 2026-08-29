/**
 * Turning a kept run back into something a person — or a bug report — can use.
 *
 * Pure functions, no DOM and no Angular, so every one of them is testable on
 * its own and the component that uses them stays a template.
 */
import type { ReplayFrame, ReplayNodeValues } from '../node-editor';
import type { RunRecord } from './node-editor-history.types';

/**
 * A run's values, in the shape the editor's `replay` input takes.
 *
 * This is the whole of "replay": the base already renders node views from
 * whatever `NODE_CONTEXT` reports, so handing it recorded values shows the
 * past run in the live editor with no second renderer to keep in step.
 */
export function replayFrame(run: RunRecord | null): ReplayFrame | null {
  if (!run) return null;
  const frame: Record<string, ReplayNodeValues> = {};
  for (const node of run.nodes) {
    frame[node.nodeId] = {
      status: node.status,
      inputs: node.inputs,
      outputs: node.outputs,
    };
  }
  return frame;
}

/**
 * A duration, at a precision worth reading.
 *
 * Sub-millisecond work reports `<1 ms` rather than `0.03 ms`: the digits are
 * real but meaningless, and a column of them buries the one node that took
 * two seconds.
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1) return '<1 ms';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)} s`;
  const minutes = Math.floor(ms / 60_000);
  return `${minutes} min ${Math.round((ms % 60_000) / 1000)} s`;
}

/** The clock time a run started, in the viewer's locale. */
export function formatStartedAt(startedAt: number, localeId: string): string {
  return new Date(startedAt).toLocaleTimeString(localeId, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * The slowest node in a run, which is the one worth naming.
 *
 * `null` for an empty run rather than a fabricated zero-duration entry.
 */
export function slowestNode(run: RunRecord): RunRecord['nodes'][number] | null {
  /*
   * From the run, not from the retained list.
   *
   * `nodes` is a capped prefix, and on a large run the genuinely slowest node
   * is as likely as not to have settled past the cap — so reducing over what
   * was kept would confidently name the wrong node. The runtime tracks the
   * maximum as it goes, which costs one comparison per settle.
   */
  return run.slowest;
}

/** How much of the run each node accounted for, 0–1. */
export function shareOfRun(run: RunRecord, durationMs: number): number {
  // The whole run's total, for the same reason: summing the retained prefix
  // would inflate every share, and they would no longer add up to the run.
  return run.durationTotalMs > 0 ? durationMs / run.durationTotalMs : 0;
}

/**
 * A run as a JSON document.
 *
 * Pretty-printed, because the destination is a bug report or a diff and both
 * are read by people. Values that JSON cannot express are replaced rather than
 * dropped — an export that silently loses a node's output is worse than one
 * that says the output was a function.
 */
export function exportRun(run: RunRecord): string {
  return JSON.stringify(run, jsonSafe, 2);
}

function jsonSafe(_key: string, value: unknown): unknown {
  if (typeof value === 'function') return '[function]';
  if (typeof value === 'bigint') return `${value}n`;
  if (typeof value === 'symbol') return value.toString();
  if (value instanceof Map) return Object.fromEntries(value);
  if (value instanceof Set) return [...value];
  if (value instanceof Error) return value.message;
  if (typeof value === 'number' && !Number.isFinite(value)) return String(value);
  return value;
}

/** A one-line description of a value, for a table cell. */
export function describeValue(value: unknown): string {
  if (value === undefined) return '—';
  if (value === null) return 'null';
  if (typeof value === 'string') return value.length > 60 ? `${value.slice(0, 57)}…` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'bigint') return `${value}n`;
  if (typeof value === 'symbol') return value.toString();
  if (typeof value === 'function') return '[function]';
  if (Array.isArray(value)) return `[${value.length}]`;
  // Every remaining case is an object. There is deliberately no `String()`
  // fallback: on an object it yields '[object Object]', which fills a column
  // with a word that describes nothing.
  return `{${Object.keys(value).length}}`;
}
