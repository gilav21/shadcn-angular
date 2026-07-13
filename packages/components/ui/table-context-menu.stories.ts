import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { ContextMenuComponent, ContextMenuItem } from './context-menu';
import {
  TableBodyComponent,
  TableCaptionComponent,
  TableCellComponent,
  TableComponent,
  TableHeadComponent,
  TableHeaderComponent,
  TableRowComponent,
} from './table';
import {
  TableCellContextMenuEvent,
  TableContextMenuDirective,
  TableRowContextMenuEvent,
} from './table-context-menu.directive';

interface StoryInvoice {
  id: string;
  customer: string;
  status: string;
  amount: string;
}

interface LastEvent {
  row: string;
  index: string;
  column: string;
}

const TABLE_IMPORTS = [
  TableComponent,
  TableCaptionComponent,
  TableHeaderComponent,
  TableBodyComponent,
  TableRowComponent,
  TableHeadComponent,
  TableCellComponent,
  ContextMenuComponent,
  TableContextMenuDirective,
];

const ROW_MENU_ITEMS: ContextMenuItem[] = [
  { type: 'label', label: 'Row actions' },
  { label: 'Edit', shortcut: '⌘E' },
  { label: 'Duplicate', shortcut: '⌘D' },
  { type: 'separator' },
  { label: 'Copy cell value' },
  { label: 'Delete', shortcut: '⌫' },
];

/**
 * The table body markup shared by every story. Rows carry the JSON payload the
 * directive reads back (`data-row`), their index (`data-row-index`) and each
 * cell carries its column key (`data-column`).
 */
const TABLE_ROWS = `
  <ui-table-row data-row-index="0" data-row='{"id":"INV001","customer":"Ada Lovelace","status":"Paid","amount":"$250.00"}'>
    <ui-table-cell data-column="invoice" class="font-medium">INV001</ui-table-cell>
    <ui-table-cell data-column="customer">Ada Lovelace</ui-table-cell>
    <ui-table-cell data-column="status">Paid</ui-table-cell>
    <ui-table-cell data-column="amount" class="text-right">$250.00</ui-table-cell>
  </ui-table-row>
  <ui-table-row data-row-index="1" data-row='{"id":"INV002","customer":"Grace Hopper","status":"Pending","amount":"$150.00"}'>
    <ui-table-cell data-column="invoice" class="font-medium">INV002</ui-table-cell>
    <ui-table-cell data-column="customer">Grace Hopper</ui-table-cell>
    <ui-table-cell data-column="status">Pending</ui-table-cell>
    <ui-table-cell data-column="amount" class="text-right">$150.00</ui-table-cell>
  </ui-table-row>
  <ui-table-row data-row-index="2" data-row='{"id":"INV003","customer":"Alan Turing","status":"Unpaid","amount":"$350.00"}'>
    <ui-table-cell data-column="invoice" class="font-medium">INV003</ui-table-cell>
    <ui-table-cell data-column="customer">Alan Turing</ui-table-cell>
    <ui-table-cell data-column="status">Unpaid</ui-table-cell>
    <ui-table-cell data-column="amount" class="text-right">$350.00</ui-table-cell>
  </ui-table-row>
`;

const TABLE_HEAD = `
  <ui-table-header>
    <ui-table-row>
      <ui-table-head>Invoice</ui-table-head>
      <ui-table-head>Customer</ui-table-head>
      <ui-table-head>Status</ui-table-head>
      <ui-table-head class="text-right">Amount</ui-table-head>
    </ui-table-row>
  </ui-table-header>
`;

// `TableContextMenuDirective` is a directive, so the story has no `component`
// target — every input is still exposed through argTypes so the Controls panel
// drives it live.
const meta: Meta = {
  title: 'UI/Table Context Menu',
  tags: ['autodocs'],
  decorators: [moduleMetadata({ imports: TABLE_IMPORTS })],
  parameters: {
    docs: {
      description: {
        component: [
          '`TableContextMenuDirective` (`selector: table[uiTableContextMenu], [uiTable]`) attaches a',
          '`<ui-context-menu>` to a plain table. Right-clicking a **body cell** opens the menu at the',
          'pointer and emits `cellContextMenu` (row payload + column key) followed by `rowContextMenu`',
          '(row payload + row index).',
          '',
          '**Markup contract** — the directive reads the row payload back out of the DOM:',
          '',
          '- `data-row` on the row element: JSON of the row object (attribute name configurable via `rowDataAttribute`).',
          '- `data-row-index` (or `data-index`) on the row element: the numeric index.',
          '- `data-column` on each cell: the column key reported by `cellContextMenu`. For `<ui-table-cell>`',
          '  this attribute is **required** — the native `cellIndex` fallback only exists on real `<td>` elements.',
          '',
          '**Header cells are not covered.** The directive only reacts to `td` / `[data-slot="table-cell"]`,',
          'so right-clicking a `<ui-table-head>` falls through to the browser menu. Header menus are the',
          'job of `DataTableContextMenuDirective`.',
          '',
          '**Touch:** the directive listens to `contextmenu` only — it has no long-press fallback, so on',
          'touch-only devices you must expose the same actions through a visible trigger (e.g. a per-row',
          '"⋯" button that calls `contextMenu.show(x, y, row)`). See the demo page for that pattern.',
        ].join('\n'),
      },
    },
  },
  argTypes: {
    uiTableContextMenu: {
      control: false,
      description:
        'The `ContextMenuComponent` instance to open on right-click. Pass a template reference, e.g. `[uiTableContextMenu]="rowMenu"`. When `null`, the directive does nothing.',
      table: { type: { summary: 'ContextMenuComponent | null' }, defaultValue: { summary: 'null' } },
    },
    contextMenuDisabled: {
      control: 'boolean',
      description: 'Disables the context menu entirely — the native browser menu is shown instead.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' } },
    },
    rowDataAttribute: {
      control: 'text',
      description:
        'Attribute on the row element holding the JSON row payload. Falls back to `{ value: <raw attribute> }` when the value is not valid JSON, and to `{}` when the attribute is absent.',
      table: { type: { summary: 'string' }, defaultValue: { summary: "'data-row'" } },
    },
    rowContextMenu: {
      action: 'rowContextMenu',
      description: 'Emits `TableRowContextMenuEvent<T>` — `{ row, index, event }` — for the right-clicked row.',
      table: { type: { summary: 'TableRowContextMenuEvent<T>' } },
    },
    cellContextMenu: {
      action: 'cellContextMenu',
      description:
        'Emits `TableCellContextMenuEvent<T>` — `{ row, index, column, event }` — for the right-clicked body cell. Emitted before `rowContextMenu`.',
      table: { type: { summary: 'TableCellContextMenuEvent<T>' } },
    },
  },
  args: {
    contextMenuDisabled: false,
    rowDataAttribute: 'data-row',
  },
};

export default meta;
type Story = StoryObj;

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = {
  render: (args) => ({
    props: { ...args, items: ROW_MENU_ITEMS },
    template: `
      <div class="p-6 space-y-3">
        <p class="text-sm text-muted-foreground">Right-click any body cell to open the menu.</p>
        <ui-context-menu #rowMenu [items]="items" />
        <div class="w-full overflow-x-auto">
          <ui-table
            uiTable
            class="min-w-[520px]"
            [uiTableContextMenu]="rowMenu"
            [contextMenuDisabled]="contextMenuDisabled"
            [rowDataAttribute]="rowDataAttribute"
            (rowContextMenu)="rowContextMenu($event)"
            (cellContextMenu)="cellContextMenu($event)"
          >
            <ui-table-caption>Right-click a row for actions.</ui-table-caption>
            ${TABLE_HEAD}
            <ui-table-body>${TABLE_ROWS}</ui-table-body>
          </ui-table>
        </div>
      </div>
    `,
  }),
};

/** The basic row menu: one menu instance shared by every row. */
export const RowMenu: Story = {
  render: () => ({
    props: { items: ROW_MENU_ITEMS },
    template: `
      <div class="p-6">
        <ui-context-menu #rowMenu [items]="items" />
        <div class="w-full overflow-x-auto">
          <ui-table uiTable class="min-w-[520px]" [uiTableContextMenu]="rowMenu">
            ${TABLE_HEAD}
            <ui-table-body>${TABLE_ROWS}</ui-table-body>
          </ui-table>
        </div>
      </div>
    `,
  }),
};

/**
 * The emitted payloads. `cellContextMenu` reports which column was hit
 * (`data-column`); `rowContextMenu` reports the parsed `data-row` object and
 * the row index.
 */
export const EventPayloads: Story = {
  render: () => ({
    props: {
      items: ROW_MENU_ITEMS,
      last: { row: '—', index: '—', column: '—' } as LastEvent,
      onRow(this: { last: LastEvent }, event: TableRowContextMenuEvent<StoryInvoice>) {
        this.last = { ...this.last, row: JSON.stringify(event.row), index: String(event.index) };
      },
      onCell(this: { last: LastEvent }, event: TableCellContextMenuEvent<StoryInvoice>) {
        this.last = { ...this.last, column: event.column };
      },
    },
    template: `
      <div class="p-6 space-y-4">
        <ui-context-menu #rowMenu [items]="items" />
        <div class="w-full overflow-x-auto">
          <ui-table
            uiTable
            class="min-w-[520px]"
            [uiTableContextMenu]="rowMenu"
            (rowContextMenu)="onRow($event)"
            (cellContextMenu)="onCell($event)"
          >
            ${TABLE_HEAD}
            <ui-table-body>${TABLE_ROWS}</ui-table-body>
          </ui-table>
        </div>
        <dl class="rounded-lg border bg-muted/40 p-4 text-sm space-y-1">
          <div class="flex flex-wrap gap-2">
            <dt class="font-medium">cellContextMenu.column:</dt>
            <dd class="font-mono text-muted-foreground">{{ last.column }}</dd>
          </div>
          <div class="flex flex-wrap gap-2">
            <dt class="font-medium">rowContextMenu.index:</dt>
            <dd class="font-mono text-muted-foreground">{{ last.index }}</dd>
          </div>
          <div class="flex flex-wrap gap-2">
            <dt class="font-medium">rowContextMenu.row:</dt>
            <dd class="font-mono break-all text-muted-foreground">{{ last.row }}</dd>
          </div>
        </dl>
      </div>
    `,
  }),
};

/**
 * Header cells are **not** handled: right-clicking `<ui-table-head>` opens the
 * browser's native menu because the directive matches body cells only
 * (`td, [data-slot="table-cell"]`).
 */
export const HeaderCellsNotHandled: Story = {
  render: () => ({
    props: { items: ROW_MENU_ITEMS },
    template: `
      <div class="p-6 space-y-3">
        <p class="text-sm text-muted-foreground">
          Right-click a <strong>header</strong> cell → native browser menu.
          Right-click a <strong>body</strong> cell → component menu.
        </p>
        <ui-context-menu #rowMenu [items]="items" />
        <div class="w-full overflow-x-auto">
          <ui-table uiTable class="min-w-[520px]" [uiTableContextMenu]="rowMenu">
            ${TABLE_HEAD}
            <ui-table-body>${TABLE_ROWS}</ui-table-body>
          </ui-table>
        </div>
      </div>
    `,
  }),
};

/** A custom `rowDataAttribute` — the payload lives on `data-invoice`. */
export const CustomRowDataAttribute: Story = {
  render: () => ({
    props: {
      items: ROW_MENU_ITEMS,
      payload: '—',
      onRow(this: { payload: string }, event: TableRowContextMenuEvent<StoryInvoice>) {
        this.payload = JSON.stringify(event.row);
      },
    },
    template: `
      <div class="p-6 space-y-4">
        <ui-context-menu #rowMenu [items]="items" />
        <div class="w-full overflow-x-auto">
          <ui-table
            uiTable
            class="min-w-[420px]"
            rowDataAttribute="data-invoice"
            [uiTableContextMenu]="rowMenu"
            (rowContextMenu)="onRow($event)"
          >
            <ui-table-header>
              <ui-table-row>
                <ui-table-head>Invoice</ui-table-head>
                <ui-table-head>Customer</ui-table-head>
              </ui-table-row>
            </ui-table-header>
            <ui-table-body>
              <ui-table-row data-row-index="0" data-invoice='{"id":"INV001","customer":"Ada Lovelace"}'>
                <ui-table-cell data-column="invoice" class="font-medium">INV001</ui-table-cell>
                <ui-table-cell data-column="customer">Ada Lovelace</ui-table-cell>
              </ui-table-row>
              <ui-table-row data-row-index="1" data-invoice='{"id":"INV002","customer":"Grace Hopper"}'>
                <ui-table-cell data-column="invoice" class="font-medium">INV002</ui-table-cell>
                <ui-table-cell data-column="customer">Grace Hopper</ui-table-cell>
              </ui-table-row>
            </ui-table-body>
          </ui-table>
        </div>
        <p class="text-sm">
          <span class="font-medium">rowContextMenu.row:</span>
          <span class="font-mono text-muted-foreground">{{ payload }}</span>
        </p>
      </div>
    `,
  }),
};

/** `contextMenuDisabled` — the native browser menu takes over again. */
export const Disabled: Story = {
  args: { contextMenuDisabled: true },
  render: (args) => ({
    props: { ...args, items: ROW_MENU_ITEMS },
    template: `
      <div class="p-6 space-y-3">
        <p class="text-sm text-muted-foreground">Context menu disabled — right-click shows the browser menu.</p>
        <ui-context-menu #rowMenu [items]="items" />
        <div class="w-full overflow-x-auto">
          <ui-table
            uiTable
            class="min-w-[520px]"
            [uiTableContextMenu]="rowMenu"
            [contextMenuDisabled]="contextMenuDisabled"
          >
            ${TABLE_HEAD}
            <ui-table-body>${TABLE_ROWS}</ui-table-body>
          </ui-table>
        </div>
      </div>
    `,
  }),
};
