/**
 * What the context-menu addon emits when a menu bound with `[contextMenu]` is opened
 * on a row. The same fields as the table-context-menu directive's row event; they are
 * declared here so this addon imports nothing from another directive, and a handler
 * typed with either shape accepts the other.
 */
export interface DataTableRowContextMenuEvent<T = unknown> {
  /** The row that was hit. */
  row: T;
  /** Its index among the rendered rows (after filtering, sorting and paging). */
  index: number;
  /** The `contextmenu` event of a right-click or the keyboard key, or the `touchstart` that began a long-press. */
  event: MouseEvent | TouchEvent;
  /** Depth in the hierarchy, when the table renders sub-rows. */
  depth?: number;
  /** Whether the row has no children, when the table renders sub-rows. */
  isLeaf?: boolean;
  /** The parent row, or null for a root, when the table renders sub-rows. */
  parentRow?: T | null;
}

/** What the addon emits when a menu bound with `[contextMenu]` is opened on a column header. */
export interface DataTableHeaderContextMenuEvent {
  /** The header: its `data-column-id` (null when absent), its trimmed text, and the element. */
  column: { id: string | null; name: string; element: HTMLElement };
  /** The `contextmenu` event of a right-click or the keyboard key, or the `touchstart` that began a long-press. */
  event: MouseEvent | TouchEvent;
}
