/**
 * Filling in what a node type already knows.
 *
 * An author of a typed node writes `{ id, type, x, y }` and nothing else. The
 * ports, the title and the accent all live on the {@link NodeTypeDefinition},
 * and this copies them onto the node so that every consumer downstream — the
 * layout maths, the templates, the a11y tree, the validator — can keep reading
 * `node.ports` without knowing whether the graph is typed or structural.
 *
 * The definition stays the single source of truth: nothing here lets a node
 * disagree with its type. A node that already carries a field keeps it, so a
 * one-off title override is still possible without forking a type.
 */
import type { NodeTypeDefinition } from './node-editor.runtime.types';
import type { EditorNode, NodePort } from './node-editor.types';

/**
 * Nodes with everything their type supplies.
 *
 * Returns the SAME array when nothing changed — a fresh array on every change
 * detection pass would invalidate the canvas's `items` input continuously, and
 * the whole point of the engine is that it does not re-mount what has not
 * moved.
 */
export function withMaterializedTypes(
  nodes: readonly EditorNode[],
  definitions: ReadonlyMap<string, NodeTypeDefinition>,
): readonly EditorNode[] {
  if (definitions.size === 0) return nodes;

  let changed = false;
  const next = nodes.map(node => {
    const materialized = materializeNode(node, definitions);
    if (materialized !== node) changed = true;
    return materialized;
  });
  return changed ? next : nodes;
}

function materializeNode(
  node: EditorNode,
  definitions: ReadonlyMap<string, NodeTypeDefinition>,
): EditorNode {
  if (node.type === undefined) return node;
  const definition = definitions.get(node.type);
  if (!definition) return node;

  // Widened deliberately: a NodePortDefinition IS a NodePort with extra
  // runtime fields, and the identity check below needs both sides to be the
  // same declared type or it is statically always-false.
  const ports = definition.ports as readonly NodePort[];
  const title = node.title === undefined || node.title === '' ? definition.label : node.title;
  const accent = node.accent ?? definition.accent;

  // Referential equality is load-bearing, so only allocate on a real change.
  if (node.ports === ports && node.title === title && node.accent === accent) return node;
  return { ...node, ports, title, accent };
}

/** Definitions keyed by id, which is how everything else looks them up. */
export function indexDefinitions(
  definitions: readonly NodeTypeDefinition[],
): ReadonlyMap<string, NodeTypeDefinition> {
  return new Map(definitions.map(definition => [definition.id, definition]));
}
