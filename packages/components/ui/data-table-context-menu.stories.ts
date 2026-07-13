import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { ContextMenuComponent, ContextMenuItem } from './context-menu';
import { ColumnDef, DataTableComponent } from './data-table';
import { DataTableContextMenuDirective, DataTableHeaderContextMenuEvent } from './data-table-context-menu.directive';
import { TableRowContextMenuEvent } from './table-context-menu.directive';

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

const TABLE_SHELL = (table: string) => `
  <div class="p-4 sm:p-6 space-y-3">
    <p class="text-sm text-muted-foreground">
      Right-click (or long-press on touch — see the Touch note in the docs) inside the table.
    </p>
    <div class="w-full overflow-x-auto rounded-md border">
      ${table}
    </div>
  </div>
`;

/**
 * `DataTableContextMenuDirective` has no `component` metadata target because it is a
 * directive — every input is exposed through `argTypes` so the Controls panel drives
 * it live. It attaches to `<ui-data-table>` (selector `ui-data-table[uiDataTableContextMenu]`),
 * opens the `ui-context-menu` you hand it on right-click, and emits the row / header payload.
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
    uiDataTableContextMenu: {
      control: false,
      description:
        'Required. The `ContextMenuComponent` instance to open on right-click — pass a template reference (`#menu`) to the `<ui-context-menu>` you render next to the table. The directive calls `menu.show(x, y, data)` with the row data (or the tree-row context) for rows, and the `{ id, name, element }` column descriptor for headers.',
      table: { type: { summary: 'ContextMenuComponent' } },
    },
    contextMenuDisabled: {
      control: 'boolean',
      description: 'When true the directive ignores `contextmenu` entirely — the native browser menu is shown and no output fires.',
      table: { defaultValue: { summary: 'false' } },
    },
    contextMenuRowsOnly: {
      control: 'boolean',
      description:
        'When true (default) only rows open the menu; headers keep the native browser menu. Set to false to also open the menu on column headers and emit `headerContextMenu`.',
      table: { defaultValue: { summary: 'true' } },
    },
    rowContextMenu: {
      action: 'rowContextMenu',
      description:
        'Emits `TableRowContextMenuEvent<T>`: `{ row, index, event, depth?, isLeaf?, parentRow? }` — the tree fields are populated when the table renders sub-rows.',
      table: { category: 'outputs' },
    },
    headerContextMenu: {
      action: 'headerContextMenu',
      description:
        'Emits `DataTableHeaderContextMenuEvent`: `{ column: { id, name, element }, event }` — `id` is the column `accessorKey`. Only fires when `contextMenuRowsOnly` is false.',
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

/** Interactive playground — every input is wired to the Controls panel. */
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
        [uiDataTableContextMenu]="menu"
        [contextMenuDisabled]="contextMenuDisabled"
        [contextMenuRowsOnly]="contextMenuRowsOnly"
        (rowContextMenu)="rowContextMenu($event)"
        (headerContextMenu)="headerContextMenu($event)"
      />
      <ui-context-menu #menu [items]="items" />
    `),
  }),
};

/** Row menu (the default): right-click any row to open the menu — headers keep the native menu. */
export const RowMenu: Story = {
  render: () => ({
    props: { data: [...INVOICES], columns: COLUMNS, items: ROW_ITEMS },
    template: TABLE_SHELL(`
      <ui-data-table
        [data]="data"
        [columns]="columns"
        [showToolbar]="false"
        [showPagination]="false"
        [uiDataTableContextMenu]="menu"
        [contextMenuRowsOnly]="true"
      />
      <ui-context-menu #menu [items]="items" />
    `),
  }),
};

/** Column-header menu: set `contextMenuRowsOnly` to false so right-clicking a `<th>` opens the menu too. */
export const ColumnHeaderMenu: Story = {
  render: () => ({
    props: { data: [...INVOICES], columns: COLUMNS, items: HEADER_ITEMS },
    template: TABLE_SHELL(`
      <ui-data-table
        [data]="data"
        [columns]="columns"
        [showToolbar]="false"
        [showPagination]="false"
        [uiDataTableContextMenu]="menu"
        [contextMenuRowsOnly]="false"
      />
      <ui-context-menu #menu [items]="items" />
    `),
  }),
};

/**
 * Event payloads — the panel prints exactly what the two outputs emit: which row (data + index)
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
      onRow: (event: TableRowContextMenuEvent<Invoice>) => void;
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
              [uiDataTableContextMenu]="menu"
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
        [uiDataTableContextMenu]="menu"
        [contextMenuDisabled]="contextMenuDisabled"
      />
      <ui-context-menu #menu [items]="items" />
    `),
  }),
};
