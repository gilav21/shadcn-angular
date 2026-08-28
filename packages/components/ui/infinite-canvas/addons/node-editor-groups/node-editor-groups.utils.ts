/**
 * Group geometry: membership, fitting, and moving members with their frame.
 *
 * Pure functions — rects in, rects out. No DOM, no Angular, no editor, so the
 * rules that decide what belongs to a group are testable on their own rather
 * than only through a drag.
 */
import { isTouchDevice } from '../../../../lib/touch';
import { SpatialHash } from '../..';
import type { CanvasPoint, CanvasRect, EditorNode, NodeId } from '../node-editor';
import type { GroupMembership, NodeGroup } from './node-editor-groups.types';

/** Space left between a group's edge and the nodes it was fitted around. */
export const GROUP_PADDING = 28;

/**
 * Room at the top of a group for its title bar, in world units.
 *
 * Fitting adds this above the topmost node so the title never lands on top of
 * a card.
 */
export const GROUP_HEADER = 32;

/** 44 world units on touch: WCAG 2.5.8, the same rule the ports follow. */
export const GROUP_HEADER_TOUCH = 44;

/**
 * The title bar height for this device.
 *
 * The bar is the only way to grab a zone, and 32 units is a comfortable
 * mouse target and a poor thumb one. It is measured in WORLD units, so it
 * also shrinks with the zoom — which is exactly why it needs the larger
 * baseline rather than a CSS minimum that world space would ignore.
 */
export function groupHeader(): number {
  return isTouchDevice() ? GROUP_HEADER_TOUCH : GROUP_HEADER;
}

/** Smallest a group may be dragged or fitted to. */
export const MIN_GROUP_SIZE = 80;

function right(rect: CanvasRect): number {
  return rect.x + rect.width;
}

function bottom(rect: CanvasRect): number {
  return rect.y + rect.height;
}

/**
 * Whether a node belongs to a group.
 *
 * Fully contained, not merely overlapping. Overlap would make a node touching
 * the corner of two groups a member of both, and dragging either one would
 * then drag a node the user never put in it — the kind of rule that is only
 * wrong when someone is in a hurry.
 */
export function contains(group: CanvasRect, node: CanvasRect): boolean {
  return (
    node.x >= group.x &&
    node.y >= group.y &&
    right(node) <= right(group) &&
    bottom(node) <= bottom(group)
  );
}

/**
 * A cell size for an index of groups, from their mean longest side.
 *
 * The hash below indexes GROUPS and is queried by node-sized rects, so the
 * cell wants to suit the things stored, not the things asked about. The floor
 * keeps a degenerate set — one zero-sized group, or none — from producing a
 * cell size the hash rejects.
 */
function groupCellSize(groups: readonly NodeGroup[]): number {
  let total = 0;
  for (const group of groups) total += Math.max(group.width, group.height);
  return Math.max(64, total / groups.length);
}

/**
 * The spatial index for a set of groups, built once per set.
 *
 * Dragging a NODE does not move a group, and the groups array keeps its
 * identity across those frames — so rebuilding this index on every frame was
 * indexing the same 4,000 unchanged rectangles sixty times a second. Weak on
 * the array, so an index is collected as soon as the group list it describes
 * is replaced.
 */
const GROUP_INDEX = new WeakMap<readonly NodeGroup[], SpatialHash<NodeGroup>>();

function indexOf(groups: readonly NodeGroup[]): SpatialHash<NodeGroup> {
  const existing = GROUP_INDEX.get(groups);
  if (existing) return existing;

  const created = new SpatialHash<NodeGroup>(groupCellSize(groups));
  created.rebuild(groups);
  GROUP_INDEX.set(groups, created);
  return created;
}

/**
 * Which nodes each group contains.
 *
 * A node inside two nested groups belongs to BOTH — the inner one because it
 * is in it, the outer one because the inner one is. Dragging the outer frame
 * has to move everything drawn inside it, and a node that opted out of that
 * because a tighter group also claimed it would be left behind.
 *
 * Broad phase, then narrow phase. Asking every group whether it holds every
 * node is O(groups x nodes), and on a board of 4,000 groups and 100,000 nodes
 * that is 400 million containment tests — measured at 2.2 SECONDS, charged on
 * every frame of a drag, to render a count. So the groups go into a spatial
 * hash and each node asks only the ones near it. The hash answers with
 * overlap and `contains` demands enclosure, which makes the query a superset
 * of the answer: the narrow phase can only ever remove candidates, never miss
 * one. Nodes are visited in order, so each group's members stay in node order.
 */
export function membership(
  groups: readonly NodeGroup[],
  nodes: readonly EditorNode[],
): GroupMembership {
  const result = new Map<string, NodeId[]>();
  for (const group of groups) result.set(group.id, []);
  if (groups.length === 0 || nodes.length === 0) return result;

  const index = indexOf(groups);

  // Two buffers for the whole walk, not two per node. See `queryInto`.
  const near: NodeGroup[] = [];
  const seen = new Set<NodeGroup>();

  for (const node of nodes) {
    for (const group of index.queryInto(node, near, seen)) {
      if (contains(group, node)) result.get(group.id)?.push(node.id);
    }
  }
  return result;
}

/**
 * A rectangle fitted around some nodes, with room for the title.
 *
 * `null` for no nodes rather than a zero-sized rectangle at the origin, which
 * is a group nobody can see and nobody can grab.
 */
export function fitAround(nodes: readonly EditorNode[]): CanvasRect | null {
  if (nodes.length === 0) return null;

  /*
   * Folded, not spread.
   *
   * `Math.min(...array)` passes one ARGUMENT per element, and an argument list
   * that long overflows the stack — somewhere around 65,000 on JavaScriptCore
   * and 125,000 on V8. This engine documents itself at a hundred thousand
   * nodes, so "select all, group the selection" was a RangeError out of a pure
   * function rather than a group. Four passes become one, which also stops
   * allocating four arrays the size of the selection.
   */
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let far = Number.NEGATIVE_INFINITY;
  let low = Number.NEGATIVE_INFINITY;

  for (const node of nodes) {
    if (node.x < left) left = node.x;
    if (node.y < top) top = node.y;
    const nodeRight = right(node);
    const nodeBottom = bottom(node);
    if (nodeRight > far) far = nodeRight;
    if (nodeBottom > low) low = nodeBottom;
  }

  const header = groupHeader();
  return {
    x: left - GROUP_PADDING,
    y: top - GROUP_PADDING - header,
    width: Math.max(MIN_GROUP_SIZE, far - left + GROUP_PADDING * 2),
    height: Math.max(MIN_GROUP_SIZE, low - top + GROUP_PADDING * 2 + header),
  };
}

/**
 * Where every member lands when a group is dragged by `delta`.
 *
 * Returns positions rather than moving anything: the editor owns node
 * positions and routes them through the undo funnel, so the addon computes and
 * the base applies. Handing back a mutated array would put an untracked edit
 * into the graph.
 */
export function movedMembers(
  group: NodeGroup,
  nodes: readonly EditorNode[],
  delta: CanvasPoint,
): ReadonlyMap<NodeId, CanvasPoint> {
  const moved = new Map<NodeId, CanvasPoint>();
  for (const node of nodes) {
    if (!contains(group, node)) continue;
    moved.set(node.id, { x: node.x + delta.x, y: node.y + delta.y });
  }
  return moved;
}

/** A group moved by `delta`, with nothing else changed. */
export function movedGroup(group: NodeGroup, delta: CanvasPoint): NodeGroup {
  return { ...group, x: group.x + delta.x, y: group.y + delta.y };
}

/**
 * A group resized by dragging its bottom-right corner.
 *
 * Clamped so a group cannot be collapsed to nothing and then be impossible to
 * grab again.
 */
export function resizedGroup(group: NodeGroup, delta: CanvasPoint): NodeGroup {
  return {
    ...group,
    width: Math.max(MIN_GROUP_SIZE, group.width + delta.x),
    height: Math.max(MIN_GROUP_SIZE, group.height + delta.y),
  };
}

/**
 * Groups ordered so the largest draws first.
 *
 * A small group nested inside a big one has to paint on top of it, or it is
 * invisible and unclickable. Area rather than nesting: it needs no containment
 * test, it is stable, and two groups of equal area keep their authored order.
 */
export function byPaintOrder(groups: readonly NodeGroup[]): readonly NodeGroup[] {
  return [...groups].sort((a, b) => b.width * b.height - a.width * a.height);
}

/** The world rect a group's title bar occupies — the part you drag it by. */
export function titleBarOf(group: NodeGroup): CanvasRect {
  return {
    x: group.x,
    y: group.y,
    width: group.width,
    height: Math.min(groupHeader(), group.height),
  };
}
