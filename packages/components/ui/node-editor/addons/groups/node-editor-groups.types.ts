/**
 * Groups and comments: the two things on the plane that are purely visual.
 *
 * Neither ever enters the runtime. A group does not change what a graph
 * computes, what may connect to what, or the order anything runs in — it is a
 * titled rectangle drawn behind some nodes. That is exactly why this is an
 * addon and not a change to the graph model: the moment a group meant
 * something to evaluation, every consumer of the base would have to know about
 * groups whether they installed this or not.
 */
import type { CanvasRect, NodeId } from '../..';

/** A titled, coloured rectangle drawn behind a set of nodes. */
export interface NodeGroup extends CanvasRect {
  readonly id: string;
  readonly title: string;
  /**
   * Any CSS colour. Used at low opacity for the fill and full strength for the
   * border, so one value styles the whole frame.
   */
  readonly colour?: string;
  /** Members are recomputed from containment unless this is `true`. */
  readonly pinned?: boolean;
}

/**
 * A note on the plane, with no membership.
 *
 * The same primitive as a group minus the one thing that makes a group a
 * group. Kept as its own type rather than a `NodeGroup` with a flag: a comment
 * has no members, and a type that says so cannot be asked for them.
 */
export interface NodeComment extends CanvasRect {
  readonly id: string;
  readonly text: string;
  readonly colour?: string;
}

/** Which nodes each group currently contains. */
export type GroupMembership = ReadonlyMap<string, readonly NodeId[]>;
