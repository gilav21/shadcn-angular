/**
 * Undo/redo, as a command funnel.
 *
 * In the base from day one, and not because undo is urgent — because every
 * edit path has to route through one place for it to work at all, and adding
 * that later means rewriting all of them. The same funnel is what a
 * collaboration or audit addon would hook into later.
 *
 * Pure: commands describe changes to a `{ nodes, connections }` snapshot, and
 * nothing here touches Angular or the runtime.
 */
import type { CanvasPoint } from '../..';
import type { EditorNode, NodeConnection, NodeId } from './node-editor.types';

/** The graph as a value, which is what a command transforms. */
export interface GraphSnapshot {
  readonly nodes: readonly EditorNode[];
  readonly connections: readonly NodeConnection[];
}

export type GraphCommand =
  | {
      readonly kind: 'add-nodes';
      readonly nodes: readonly EditorNode[];
      /**
       * Edges to restore alongside them.
       *
       * Present so that the inverse of `remove-nodes` is SELF-CONTAINED.
       * Removing a node takes its edges with it, and an inverse that restored
       * only the node would silently lose the wiring — the caller would have
       * to know to put it back, which is exactly the kind of knowledge a
       * command funnel exists to remove.
       */
      readonly connections?: readonly NodeConnection[];
    }
  | {
      readonly kind: 'remove-nodes';
      readonly nodes: readonly EditorNode[];
      /** Edges touching those nodes, so the inverse can restore them. */
      readonly connections: readonly NodeConnection[];
    }
  | { readonly kind: 'move-nodes'; readonly deltas: ReadonlyMap<NodeId, CanvasPoint> }
  | { readonly kind: 'connect'; readonly connections: readonly NodeConnection[] }
  | { readonly kind: 'disconnect'; readonly connections: readonly NodeConnection[] }
  | {
      /**
       * An edit the base does not understand, on the base's undo stack.
       *
       * The escape hatch an addon needs when its own data and the graph move
       * together. Dragging a group frame moves the frame — which is the
       * groups addon's data — AND the nodes inside it, which are the base's.
       * Pushed as two commands, one Ctrl+Z would put the nodes back and leave
       * the frame where it was, so the members end up outside the group that
       * owns them. They have to be one entry.
       *
       * The base runs these closures and never inspects them, so it stays
       * ignorant of what a group is. `apply` leaves the graph untouched: the
       * effect belongs in the editor, where side effects already live, rather
       * than inside a pure function.
       */
      readonly kind: 'custom';
      /** Performs the edit. Called again on redo. */
      readonly run: () => void;
      /** Puts it back. */
      readonly reverse: () => void;
    }
  | {
      readonly kind: 'set-state';
      readonly nodeId: NodeId;
      readonly before: unknown;
      readonly after: unknown;
      /** When it happened, for coalescing. */
      readonly at: number;
    };

/** Consecutive edits to one node within this window become one history entry. */
export const COALESCE_MS = 400;
/** Bounded, so a long session cannot grow history without limit. */
export const DEFAULT_HISTORY_LIMIT = 100;

/** The command that undoes `command`. */
export function invert(command: GraphCommand): GraphCommand {
  switch (command.kind) {
    case 'add-nodes':
      return {
        kind: 'remove-nodes',
        nodes: command.nodes,
        connections: command.connections ?? [],
      };
    case 'remove-nodes':
      // The edges travel with it: restoring the nodes alone would lose the
      // wiring, and nothing downstream should have to know that.
      return { kind: 'add-nodes', nodes: command.nodes, connections: command.connections };
    case 'move-nodes':
      return { kind: 'move-nodes', deltas: negate(command.deltas) };
    case 'connect':
      return { kind: 'disconnect', connections: command.connections };
    case 'disconnect':
      return { kind: 'connect', connections: command.connections };
    case 'custom':
      // Swapped, not negated: the addon supplied both directions, because
      // only it knows how to reverse its own data.
      return { kind: 'custom', run: command.reverse, reverse: command.run };
    case 'set-state':
      return { ...command, before: command.after, after: command.before };
  }
}

function negate(deltas: ReadonlyMap<NodeId, CanvasPoint>): ReadonlyMap<NodeId, CanvasPoint> {
  return new Map([...deltas].map(([id, d]) => [id, { x: -d.x, y: -d.y }]));
}

/**
 * `remove-nodes` is the one command whose inverse is not self-contained: the
 * connections must come back as well. Handled by applying both halves.
 */
export function apply(graph: GraphSnapshot, command: GraphCommand): GraphSnapshot {
  switch (command.kind) {
    case 'add-nodes': {
      const existing = new Set(graph.connections.map(c => c.id));
      return {
        nodes: [...graph.nodes, ...command.nodes],
        connections: [
          ...graph.connections,
          ...(command.connections ?? []).filter(c => !existing.has(c.id)),
        ],
      };
    }

    case 'remove-nodes': {
      const removing = new Set(command.nodes.map(n => n.id));
      return {
        nodes: graph.nodes.filter(n => !removing.has(n.id)),
        connections: graph.connections.filter(
          c => !removing.has(c.source) && !removing.has(c.target),
        ),
      };
    }

    case 'move-nodes':
      return {
        ...graph,
        nodes: graph.nodes.map(node => {
          const delta = command.deltas.get(node.id);
          return delta ? { ...node, x: node.x + delta.x, y: node.y + delta.y } : node;
        }),
      };

    case 'connect': {
      const existing = new Set(graph.connections.map(c => c.id));
      return {
        ...graph,
        connections: [
          ...graph.connections,
          ...command.connections.filter(c => !existing.has(c.id)),
        ],
      };
    }

    case 'disconnect': {
      const removing = new Set(command.connections.map(c => c.id));
      return { ...graph, connections: graph.connections.filter(c => !removing.has(c.id)) };
    }

    case 'custom':
      // The closure is the effect, and it runs in the editor. Keeping it out
      // of here is what keeps `apply` a pure function of the graph.
      return graph;
    case 'set-state':
      // State lives in the runtime, not the snapshot; the editor applies this
      // half. Returning the graph unchanged keeps `apply` total.
      return graph;
  }
}

export class GraphHistory {
  private readonly done: GraphCommand[] = [];
  private readonly undone: GraphCommand[] = [];

  constructor(private readonly limit: number = DEFAULT_HISTORY_LIMIT) {}

  get canUndo(): boolean {
    return this.done.length > 0;
  }

  get canRedo(): boolean {
    return this.undone.length > 0;
  }

  /** Entries, oldest first. Exposed for tests and for a history addon. */
  get entries(): readonly GraphCommand[] {
    return this.done;
  }

  /**
   * Record a command.
   *
   * Two coalescing rules, both load-bearing:
   *
   * - A drag arrives as ONE `move-nodes` on pointer-up with the net delta, not
   *   one per frame — otherwise a single drag fills the history. That is the
   *   caller's responsibility, and the editor does it.
   * - Consecutive `set-state` on the same node within {@link COALESCE_MS}
   *   merge here, keeping the EARLIEST `before` and the LATEST `after`.
   *   Without it, undo is per-keystroke and useless.
   */
  push(command: GraphCommand): void {
    // Any new edit invalidates the redo branch.
    this.undone.length = 0;

    const previous = this.done.at(-1);
    if (command.kind === 'set-state' && canCoalesce(previous, command)) {
      this.done[this.done.length - 1] = {
        ...previous,
        after: command.after,
        at: command.at,
      };
      return;
    }

    this.done.push(command);
    if (this.done.length > this.limit) this.done.shift();
  }

  /** The command to apply to undo, or `null`. */
  undo(): GraphCommand | null {
    const command = this.done.pop();
    if (!command) return null;
    this.undone.push(command);
    return invert(command);
  }

  /** The command to apply to redo, or `null`. */
  redo(): GraphCommand | null {
    const command = this.undone.pop();
    if (!command) return null;
    this.done.push(command);
    return command;
  }

  clear(): void {
    this.done.length = 0;
    this.undone.length = 0;
  }
}

type SetStateCommand = Extract<GraphCommand, { kind: 'set-state' }>;

function canCoalesce(
  previous: GraphCommand | undefined,
  next: SetStateCommand,
): previous is SetStateCommand {
  return (
    previous?.kind === 'set-state' &&
    previous.nodeId === next.nodeId &&
    next.at - previous.at < COALESCE_MS
  );
}
