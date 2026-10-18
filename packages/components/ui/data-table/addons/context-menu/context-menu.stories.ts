import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { ContextMenuComponent, ContextMenuItem } from '../../../context-menu';
import { ColumnDef, DataTableComponent, RowActionContext } from '../..';
import { DataTableContextMenuDirective } from './context-menu.directive';
import type { DataTableHeaderContextMenuEvent, DataTableRowContextMenuEvent } from './context-menu.types';

interface Invoice {
  id: string;
  customer: string;
  status: 'pending' | 'paid' | 'failed';
  amount: number;
}

const INVOICES: Invoice[] = [
  { id: 'INV-001', customer: 'Ada Lovelace', status: 'paid', amount: 1250 },
  { id: 'INV-002', customer: 'Alan Turing', status: 'pending', amount: 480 },
  { id: 'INV-003', customer: 'Grace Hopper', status: 'failed', amount: 2100 },
  { id: 'INV-004', customer: 'Katherine Johnson', status: 'paid', amount: 760 },
];

const COLUMNS: ColumnDef<Invoice>[] = [
  { accessorKey: 'id', header: 'Invoice' },
  { accessorKey: 'customer', header: 'Customer' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'amount', header: 'Amount', cell: (row) => `$${row.amount.toLocaleString('en-US')}` },
];

const ROW_ITEMS: ContextMenuItem[] = [
  { label: 'Edit', icon: 'pencil', shortcut: '⌘E' },
  { label: 'Duplicate', icon: 'copy', shortcut: '⌘D' },
  { type: 'separator' },
  { label: 'Delete', icon: 'trash', shortcut: '⌫' },
];

const HEADER_ITEMS: ContextMenuItem[] = [
  { label: 'Sort ascending', icon: 'arrow-up' },
  { label: 'Sort descending', icon: 'arrow-down' },
  { type: 'separator' },
  { label: 'Pin left', icon: 'pin' },
  { label: 'Pin right', icon: 'pin' },
  { type: 'separator' },
  { label: 'Hide column', icon: 'eye-off' },
];

const rowActions = (context: RowActionContext<Invoice>): ContextMenuItem[] => [
  { label: `Edit ${context.row.id}`, icon: 'pencil' },
  { label: 'Duplicate', icon: 'copy' },
  { type: 'separator' },
  { label: 'Delete', icon: 'trash' },
];

const TABLE_SHELL = (table: string) => `
  <div class="p-4 sm:p-6 space-y-3">
    <p class="text-sm text-muted-foreground">
      Right-click (or long-press on touch) inside the table.
    </p>
    <div class="w-full overflow-x-auto rounded-md border">
      ${table}
    </div>
  </div>
`;

/**
 * `uiDtContextMenu` is the data-table's context-menu addon. It is a directive, so every input is exposed
 * through `argTypes` and the Controls panel drives it live. It works in two modes, chosen by what you bind:
 *
 * - **Simple:** `[rowActions]` (and `[enableColumnMenu]`). The addon builds the menus and adds the ⋮ buttons.
 * - **Custom:** `[contextMenu]`. A right-click, the context-menu key or a long-press opens *your*
 *   `<ui-context-menu>`, with the row (or the header) as its data.
 */
const meta: Meta = {
  title: 'UI/Data Table Context Menu',
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({
      imports: [DataTableComponent, ContextMenuComponent, DataTableContextMenuDirective],
    }),
  ],
  argTypes: {
    contextMenu: {
      control: false,
      description:
        'Custom mode. The `ContextMenuComponent` to open on right-click — pass a template reference (`#menu`) to the `<ui-context-menu>` you render next to the table. The addon calls `menu.show(x, y, data)` with the row data (or the flattened tree row with `row` merged in) for rows, and the `{ id, name, element }` column descriptor for headers.',
      table: { type: { summary: 'ContextMenuComponent | undefined' } },
    },
    contextMenuDisabled: {
      control: 'boolean',
      description:
        'When true every context gesture on the table falls through to the browser: the native menu is shown and no output fires. The ⋮ buttons are unaffected.',
      table: { defaultValue: { summary: 'false' } },
    },
    contextMenuRowsOnly: {
      control: 'boolean',
      description:
        'Custom mode. When true (default) only rows open the menu; headers keep the native browser menu. Set to false to also open it on column headers and emit `headerContextMenu`.',
      table: { defaultValue: { summary: 'true' } },
    },
    rowContextMenu: {
      action: 'rowContextMenu',
      description:
        'Custom mode. Emits `DataTableRowContextMenuEvent<T>`: `{ row, index, event, depth?, isLeaf?, parentRow? }` — the tree fields are populated when the table renders sub-rows.',
      table: { category: 'outputs' },
    },
    headerContextMenu: {
      action: 'headerContextMenu',
      description:
        'Custom mode. Emits `DataTableHeaderContextMenuEvent`: `{ column: { id, name, element }, event }` — `id` is the column `accessorKey`. Only fires when `contextMenuRowsOnly` is false.',
      table: { category: 'outputs' },
    },
  },
  args: {
    contextMenuDisabled: false,
    contextMenuRowsOnly: true,
  },
};

export default meta;
type Story = StoryObj;

/** Custom mode, interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = {
  render: (args) => ({
    props: {
      ...args,
      data: [...INVOICES],
      columns: COLUMNS,
      items: [...ROW_ITEMS, { type: 'separator' }, ...HEADER_ITEMS] as ContextMenuItem[],
    },
    template: TABLE_SHELL(`
      <ui-data-table
        [data]="data"
        [columns]="columns"
        [showToolbar]="false"
        [showPagination]="false"
        uiDtContextMenu
        [contextMenu]="menu"
        [contextMenuDisabled]="contextMenuDisabled"
        [contextMenuRowsOnly]="contextMenuRowsOnly"
        (rowContextMenu)="rowContextMenu($event)"
        (headerContextMenu)="headerContextMenu($event)"
      />
      <ui-context-menu #menu [items]="items" />
    `),
  }),
};

/** Custom mode, row menu (the default): right-click any row to open your menu — headers keep the native menu. */
export const RowMenu: Story = {
  render: () => ({
    props: { data: [...INVOICES], columns: COLUMNS, items: ROW_ITEMS },
    template: TABLE_SHELL(`
      <ui-data-table
        [data]="data"
        [columns]="columns"
        [showToolbar]="false"
        [showPagination]="false"
        uiDtContextMenu
        [contextMenu]="menu"
      />
      <ui-context-menu #menu [items]="items" />
    `),
  }),
};

/** Custom mode, column-header menu: set `contextMenuRowsOnly` to false so right-clicking a header opens the menu too. */
export const ColumnHeaderMenu: Story = {
  render: () => ({
    props: { data: [...INVOICES], columns: COLUMNS, items: HEADER_ITEMS },
    template: TABLE_SHELL(`
      <ui-data-table
        [data]="data"
        [columns]="columns"
        [showToolbar]="false"
        [showPagination]="false"
        uiDtContextMenu
        [contextMenu]="menu"
        [contextMenuRowsOnly]="false"
      />
      <ui-context-menu #menu [items]="items" />
    `),
  }),
};

/**
 * Custom mode, event payloads — the panel prints exactly what the two outputs emit: which row (data + index)
 * and which column (`accessorKey` + rendered header text). Swap `[items]` on the shared menu in
 * the handlers to show a row menu or a header menu from one `<ui-context-menu>`.
 */
export const EventPayloads: Story = {
  render: () => {
    const state: {
      data: Invoice[];
      columns: ColumnDef<Invoice>[];
      items: ContextMenuItem[];
      rowLog: string;
      headerLog: string;
      onRow: (event: DataTableRowContextMenuEvent<Invoice>) => void;
      onHeader: (event: DataTableHeaderContextMenuEvent) => void;
    } = {
      data: [...INVOICES],
      columns: COLUMNS,
      items: ROW_ITEMS,
      rowLog: '—',
      headerLog: '—',
      onRow: (event) => {
        state.items = ROW_ITEMS;
        state.rowLog = `index: ${event.index} · row: ${JSON.stringify(event.row)}`;
      },
      onHeader: (event) => {
        state.items = HEADER_ITEMS;
        state.headerLog = `id: ${event.column.id} · name: ${event.column.name}`;
      },
    };

    return {
      props: state,
      template: `
        <div class="p-4 sm:p-6 space-y-3">
          <p class="text-sm text-muted-foreground">Right-click a row and a column header — the payloads land below.</p>
          <div class="w-full overflow-x-auto rounded-md border">
            <ui-data-table
              [data]="data"
              [columns]="columns"
              [showToolbar]="false"
              [showPagination]="false"
              uiDtContextMenu
              [contextMenu]="menu"
              [contextMenuRowsOnly]="false"
              (rowContextMenu)="onRow($event)"
              (headerContextMenu)="onHeader($event)"
            />
            <ui-context-menu #menu [items]="items" />
          </div>
          <dl class="rounded-md border bg-muted/40 p-3 text-xs space-y-1 font-mono break-all">
            <div><dt class="inline font-semibold">rowContextMenu:</dt> <dd class="inline">{{ rowLog }}</dd></div>
            <div><dt class="inline font-semibold">headerContextMenu:</dt> <dd class="inline">{{ headerLog }}</dd></div>
          </dl>
        </div>
      `,
    };
  },
};

/** Simple mode: bind `rowActions` and the addon builds the row menu itself and adds the ⋮ button to every row. */
export const RowActions: Story = {
  render: () => ({
    props: { data: [...INVOICES], columns: COLUMNS, rowActions },
    template: TABLE_SHELL(`
      <ui-data-table
        [data]="data"
        [columns]="columns"
        [showToolbar]="false"
        [showPagination]="false"
        uiDtContextMenu
        [rowActions]="rowActions"
      />
    `),
  }),
};

/** Simple mode with the column menu: `enableColumnMenu` adds a ⋮ button to every header (sort, pin, hide). */
export const ColumnMenu: Story = {
  render: () => ({
    props: { data: [...INVOICES], columns: COLUMNS, rowActions },
    template: TABLE_SHELL(`
      <ui-data-table
        [data]="data"
        [columns]="columns"
        [showToolbar]="false"
        [showPagination]="false"
        uiDtContextMenu
        [rowActions]="rowActions"
        [enableColumnMenu]="true"
      />
    `),
  }),
};

/** Disabled: `contextMenuDisabled` restores the browser's native context menu and suppresses both outputs. */
export const Disabled: Story = {
  args: { contextMenuDisabled: true },
  render: (args) => ({
    props: { ...args, data: [...INVOICES], columns: COLUMNS, items: ROW_ITEMS },
    template: TABLE_SHELL(`
      <ui-data-table
        [data]="data"
        [columns]="columns"
        [showToolbar]="false"
        [showPagination]="false"
        uiDtContextMenu
        [contextMenu]="menu"
        [contextMenuDisabled]="contextMenuDisabled"
      />
      <ui-context-menu #menu [items]="items" />
    `),
  }),
};
