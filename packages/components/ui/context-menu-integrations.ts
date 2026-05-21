export type { ContextMenuEvent } from './context-menu-attach.directive';
export { ContextMenuAttachDirective } from './context-menu-attach.directive';
export type { TreeContextMenuEvent } from './tree-context-menu.directive';
export { TreeContextMenuDirective } from './tree-context-menu.directive';
export type { TableRowContextMenuEvent, TableCellContextMenuEvent } from './table-context-menu.directive';
export { TableContextMenuDirective } from './table-context-menu.directive';
export type { DataTableHeaderContextMenuEvent } from './data-table-context-menu.directive';
export { DataTableContextMenuDirective } from './data-table-context-menu.directive';

import { ContextMenuAttachDirective } from './context-menu-attach.directive';
import { TreeContextMenuDirective } from './tree-context-menu.directive';
import { TableContextMenuDirective } from './table-context-menu.directive';
import { DataTableContextMenuDirective } from './data-table-context-menu.directive';

export const ContextMenuIntegrations = [
  ContextMenuAttachDirective,
  TreeContextMenuDirective,
  TableContextMenuDirective,
  DataTableContextMenuDirective,
];
