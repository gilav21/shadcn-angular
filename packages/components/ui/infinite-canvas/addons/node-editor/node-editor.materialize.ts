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
import type { EditorNode, NodeId, NodePort } from './node-editor.types';

/**
 * Nodes with everything their type supplies.
 *
 * Returns the SAME array when nothing changed — a fresh array on every change
 * detection pass would invalidate the canvas's `items` input continuously, and
 * the whole point of the engine is that it does not re-mount what has not
 * moved.
 */
/**
 * What each authored node last materialised to, per definition table.
 *
 * An authored node never carries `ports`, so materialising one always
 * allocates — every node, on every change-detection pass, forever. During a
 * drag that is the whole list rebuilt sixty times a second to relocate one
 * card.
 *
 * The result depends only on the node object and the definition it names, and
 * an untouched node keeps its object identity across a drag, so the answer can
 * simply be remembered. Both maps are weak: an entry lives exactly as long as
 * the node object it describes, so a deleted node's materialisation is
 * collected with it and this cannot become the leak it exists to avoid.
 *
 * Types with `portsFor` are NOT cached: their ports are a function of node
 * state, which changes without the node object changing.
 */
const MATERIALISED = new WeakMap<
  ReadonlyMap<string, NodeTypeDefinition>,
  WeakMap<EditorNode, EditorNode>
>();

function cacheFor(
  definitions: ReadonlyMap<string, NodeTypeDefinition>,
): WeakMap<EditorNode, EditorNode> {
  const existing = MATERIALISED.get(definitions);
  if (existing) return existing;
  const created = new WeakMap<EditorNode, EditorNode>();
  MATERIALISED.set(definitions, created);
  return created;
}

export function withMaterializedTypes(
  nodes: readonly EditorNode[],
  definitions: ReadonlyMap<string, NodeTypeDefinition>,
  stateOf?: (id: NodeId) => unknown,
): readonly EditorNode[] {
  if (definitions.size === 0) return nodes;

  const cache = cacheFor(definitions);
  let changed = false;
  const next = nodes.map(node => {
    const remembered = cache.get(node);
    if (remembered) {
      if (remembered !== node) changed = true;
      return remembered;
    }

    const materialized = materializeNode(node, definitions, stateOf);
    if (materialized !== node) changed = true;
    if (!isStateDependent(node, definitions)) cache.set(node, materialized);
    return materialized;
  });
  return changed ? next : nodes;
}

/** Whether this node's ports are a function of its state rather than its type. */
function isStateDependent(
  node: EditorNode,
  definitions: ReadonlyMap<string, NodeTypeDefinition>,
): boolean {
  if (node.type === undefined) return false;
  return definitions.get(node.type)?.portsFor !== undefined;
}

function materializeNode(
  node: EditorNode,
  definitions: ReadonlyMap<string, NodeTypeDefinition>,
  stateOf?: (id: NodeId) => unknown,
): EditorNode {
  if (node.type === undefined) return node;
  const definition = definitions.get(node.type);
  if (!definition) return node;

  // Widened deliberately: a NodePortDefinition IS a NodePort with extra
  // runtime fields, and the identity check below needs both sides to be the
  // same declared type or it is statically always-false.
  //
  // `stateOf` is read ONLY for a type that declares `portsFor`. It reaches a
  // signal, so reading it for every node would make the rendered list depend
  // on every node's state — a keystroke in a text node would recompute the
  // lot. Confining the read to the types that need it keeps that cost where
  // it was asked for.
  const ports = definition.portsFor
    ? (definition.portsFor(stateOf?.(node.id)) as readonly NodePort[])
    : (definition.ports as readonly NodePort[]);
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
