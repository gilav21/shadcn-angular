/**
 * Nested graphs: a node whose work is another graph.
 *
 * Everything here is plain data, and deliberately the same shape a graph is
 * already serialised in — a subgraph is a graph, not a special kind of one.
 */
import type { EditorNode, NodeConnection, NodeId, NodeTypeDefinition } from '../..';

/** The id of the boundary type that feeds a value INTO an inner graph. */
export const SUBGRAPH_INPUT_TYPE = 'subgraph-input';
/** The id of the boundary type that carries a value back OUT. */
export const SUBGRAPH_OUTPUT_TYPE = 'subgraph-output';

/**
 * A graph, nested inside a node.
 *
 * `states` is keyed by inner node id, so a nested graph round-trips through
 * JSON with the values its nodes were holding — without it, reopening a saved
 * subgraph would show the right shape and the wrong numbers.
 */
export interface SubgraphGraph {
  readonly nodes: readonly EditorNode[];
  readonly connections: readonly NodeConnection[];
  readonly states?: Readonly<Record<string, unknown>>;
}

export interface SubgraphTypeOptions {
  /** Type id, referenced by `EditorNode.type`. */
  readonly id: string;
  readonly label: string;
  readonly category?: string;
  readonly accent?: string;
  /** The graph a new node of this type starts with. */
  readonly graph: SubgraphGraph;
  /**
   * Node types the INNER graph may contain.
   *
   * The boundary types are added automatically. Passing the outer type's own
   * definition here is what makes a subgraph inside a subgraph work.
   */
  readonly definitions: readonly NodeTypeDefinition[];
}

/** One level of the path from the root graph to the one being shown. */
export interface SubgraphFrame {
  /** The node that was entered to get here; `null` at the root. */
  readonly nodeId: NodeId | null;
  readonly label: string;
  readonly graph: SubgraphGraph;
}
