/**
 * Treemap types
 * Chart-local public types. They deliberately do NOT live in
 * `lib/chart.types.ts` — only a second consumer would justify promoting them.
 */

/**
 * One node of the hierarchy. A node with `children` is a group: its area is the
 * **sum of its children**, so its own `value` is ignored. A node without
 * children is a leaf and uses `value` (missing or negative counts as 0).
 */
export interface TreemapNode {
    /** Text drawn inside the rectangle, when it fits. */
    label: string;
    /** Leaf magnitude. Ignored when `children` is present. */
    value?: number;
    /** Overrides the palette colour picked from the top-level index. Inherited by descendants that set none. */
    color?: string;
    /** Nested nodes. Present means "group": the area is their total. */
    children?: TreemapNode[];
}

/** An axis-aligned rectangle in SVG user space. */
export interface TreemapRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** A node placed by the layout, with its own placed children. */
export interface TreemapLayoutNode {
    /** Stable identity for `@for` tracking: the node's index path, e.g. `0/2/1`. */
    path: string;
    node: TreemapNode;
    /** The magnitude the rectangle's area is proportional to. */
    value: number;
    /** 0 for a top-level node, incremented per nesting level. */
    depth: number;
    rect: TreemapRect;
    children: TreemapLayoutNode[];
}
