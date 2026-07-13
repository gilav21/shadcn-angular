import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import {
  ButtonComponent,
  ColumnDef,
  ContextMenuComponent,
  ContextMenuItem,
  DataTableComponent,
} from '../../../../../packages/components/ui';
import { DataTableContextMenuDirective, DataTableHeaderContextMenuEvent } from '../../../../../packages/components/ui/data-table-context-menu.directive';
import { TableRowContextMenuEvent } from '../../../../../packages/components/ui/table-context-menu.directive';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { DATA_TABLE_CONTEXT_MENU_DEMO_LOCALES, DataTableContextMenuDemoLocale } from './data-table-context-menu-demo.locales';

type PaymentStatus = 'pending' | 'success' | 'failed';
type ColumnKey = 'customer' | 'email' | 'status' | 'amount';
type SortDir = 'asc' | 'desc';
type Pin = 'left' | 'right';

interface PaymentRow {
  id: string;
  customer: string;
  email: string;
  status: PaymentStatus;
  amount: number;
}

const INITIAL_ROWS: PaymentRow[] = [
  { id: 'p-1', customer: 'Ada Lovelace', email: 'ada@example.com', status: 'success', amount: 1250 },
  { id: 'p-2', customer: 'Alan Turing', email: 'alan@example.com', status: 'pending', amount: 480 },
  { id: 'p-3', customer: 'Grace Hopper', email: 'grace@example.com', status: 'failed', amount: 2100 },
  { id: 'p-4', customer: 'Katherine Johnson', email: 'katherine@example.com', status: 'success', amount: 760 },
  { id: 'p-5', customer: 'Edsger Dijkstra', email: 'edsger@example.com', status: 'pending', amount: 95 },
];

const COLUMN_KEYS: readonly ColumnKey[] = ['customer', 'email', 'status', 'amount'];

/** Touch fallback trigger: the directive itself is right-click only. */
@Component({
  selector: 'app-dtcm-actions-cell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent],
  template: `
    <ui-button variant="ghost" size="sm" [attr.aria-label]="label()" (click)="openMenu.emit($event)">⋮</ui-button>
  `,
})
export class DtcmActionsCellComponent {
  readonly label = input('Row actions');
  readonly openMenu = output<MouseEvent>();
}

@Component({
  selector: 'app-data-table-context-menu-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTableComponent, ContextMenuComponent, DataTableContextMenuDirective, ButtonComponent],
  template: `
    <div class="space-y-10">
      <section class="space-y-4">
        <h2 id="data-table-context-menu" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
        <p class="text-muted-foreground">{{ t().description }}</p>

        <div class="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <p class="font-medium">{{ t().touchTitle }}</p>
          <p class="text-muted-foreground mt-1">{{ t().touchHint }}</p>
        </div>
      </section>

      <section class="space-y-4">
        <h3 class="text-lg font-semibold">{{ t().tableHeading }}</h3>
        <p class="text-sm text-muted-foreground">{{ t().tableDesc }}</p>

        <div class="flex flex-wrap items-center gap-2">
          <ui-button variant="outline" size="sm" (click)="resetLayout()">{{ t().resetLayout }}</ui-button>
          <span class="text-sm text-muted-foreground">{{ t().lastActionLabel }} {{ lastAction() || t().noneLabel }}</span>
        </div>

        <div class="w-full overflow-x-auto rounded-md border">
          <ui-data-table
            [data]="sortedRows()"
            [columns]="columns()"
            [showToolbar]="false"
            [showPagination]="false"
            [uiDataTableContextMenu]="menu"
            [contextMenuRowsOnly]="false"
            (rowContextMenu)="onRowContextMenu($event)"
            (headerContextMenu)="onHeaderContextMenu($event)"
          />
        </div>
        <ui-context-menu #menu [items]="menuItems()" />
      </section>

      <section class="space-y-3">
        <h3 class="text-lg font-semibold">{{ t().stateHeading }}</h3>
        <dl class="grid gap-2 text-sm sm:grid-cols-3">
          <div class="rounded-md border p-3">
            <dt class="font-medium">{{ t().sortLabel }}</dt>
            <dd class="text-muted-foreground">{{ sortText() }}</dd>
          </div>
          <div class="rounded-md border p-3">
            <dt class="font-medium">{{ t().pinsLabel }}</dt>
            <dd class="text-muted-foreground">{{ pinsText() }}</dd>
          </div>
          <div class="rounded-md border p-3">
            <dt class="font-medium">{{ t().hiddenLabel }}</dt>
            <dd class="text-muted-foreground">{{ hiddenText() }}</dd>
          </div>
        </dl>
      </section>

      <section class="space-y-3">
        <h3 class="text-lg font-semibold">{{ t().eventsHeading }}</h3>
        <p class="text-sm text-muted-foreground">{{ t().eventsDesc }}</p>
        <dl class="rounded-md border bg-muted/40 p-3 sm:p-4 text-xs font-mono space-y-1 break-all">
          <div>
            <dt class="inline font-semibold">{{ t().rowEventLabel }}</dt>
            <dd class="inline"> {{ rowEventText() || t().noneLabel }}</dd>
          </div>
          <div>
            <dt class="inline font-semibold">{{ t().headerEventLabel }}</dt>
            <dd class="inline"> {{ headerEventText() || t().noneLabel }}</dd>
          </div>
        </dl>
      </section>
    </div>
  `,
})
export class DataTableContextMenuDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed<DataTableContextMenuDemoLocale>(
    () => DATA_TABLE_CONTEXT_MENU_DEMO_LOCALES[this.localeId()] ?? DATA_TABLE_CONTEXT_MENU_DEMO_LOCALES['en'],
  );

  private readonly menuRef = viewChild.required(ContextMenuComponent);

  private readonly rows = signal<PaymentRow[]>(structuredClone(INITIAL_ROWS));
  private readonly sort = signal<{ key: ColumnKey; dir: SortDir } | null>(null);
  private readonly pins = signal<Partial<Record<ColumnKey, Pin>>>({});
  private readonly hidden = signal<ColumnKey[]>([]);

  protected readonly menuItems = signal<ContextMenuItem[]>([]);
  protected readonly lastAction = signal('');
  protected readonly rowEventText = signal('');
  protected readonly headerEventText = signal('');

  protected readonly columns = computed<ColumnDef<PaymentRow>[]>(() => {
    const t = this.t();
    const pins = this.pins();
    const hidden = this.hidden();
    const defs: ColumnDef<PaymentRow>[] = COLUMN_KEYS.filter((key) => !hidden.includes(key)).map((key) => ({
      ...this.columnDef(key, t),
      pin: pins[key],
      enableSorting: false,
    }));
    defs.push(this.actionsColumn(t));
    return defs;
  });

  protected readonly sortedRows = computed<PaymentRow[]>(() => {
    const sort = this.sort();
    const rows = [...this.rows()];
    if (!sort) {
      return rows;
    }
    const factor = sort.dir === 'asc' ? 1 : -1;
    return rows.sort((a, b) => factor * compareValues(a[sort.key], b[sort.key]));
  });

  protected readonly sortText = computed(() => {
    const sort = this.sort();
    const t = this.t();
    if (!sort) {
      return t.noneLabel;
    }
    return `${this.headerFor(sort.key, t)} · ${sort.dir === 'asc' ? t.ascLabel : t.descLabel}`;
  });

  protected readonly pinsText = computed(() => {
    const t = this.t();
    const pins = this.pins();
    const entries = COLUMN_KEYS.filter((key) => pins[key]).map(
      (key) => `${this.headerFor(key, t)} → ${pins[key] === 'left' ? t.menuPinLeft : t.menuPinRight}`,
    );
    return entries.length > 0 ? entries.join(', ') : t.noneLabel;
  });

  protected readonly hiddenText = computed(() => {
    const t = this.t();
    const hidden = this.hidden();
    return hidden.length > 0 ? hidden.map((key) => this.headerFor(key, t)).join(', ') : t.noneLabel;
  });

  protected onRowContextMenu(event: TableRowContextMenuEvent): void {
    const row = event.row as PaymentRow;
    this.rowEventText.set(`{ index: ${event.index}, row: ${JSON.stringify(row)} }`);
    this.menuItems.set(this.buildRowItems(row));
  }

  protected onHeaderContextMenu(event: DataTableHeaderContextMenuEvent): void {
    const key = event.column.id as ColumnKey | null;
    this.headerEventText.set(`{ column: { id: ${event.column.id}, name: "${event.column.name}" } }`);
    this.menuItems.set(key && COLUMN_KEYS.includes(key) ? this.buildColumnItems(key) : []);
  }

  protected resetLayout(): void {
    this.rows.set(structuredClone(INITIAL_ROWS));
    this.sort.set(null);
    this.pins.set({});
    this.hidden.set([]);
    this.lastAction.set('');
    this.rowEventText.set('');
    this.headerEventText.set('');
  }

  private openRowMenuFromButton(row: PaymentRow, event: MouseEvent): void {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    this.menuItems.set(this.buildRowItems(row));
    this.menuRef().show(rect.right, rect.bottom, row);
  }

  private buildRowItems(row: PaymentRow): ContextMenuItem[] {
    const t = this.t();
    return [
      { type: 'label', label: `${t.rowMenuLabel} · ${row.customer}` },
      { label: t.menuEdit, icon: 'pencil', click: () => this.editRow(row) },
      { label: t.menuDuplicate, icon: 'copy', click: () => this.duplicateRow(row) },
      { type: 'separator' },
      { label: t.menuDelete, icon: 'trash', click: () => this.deleteRow(row) },
    ];
  }

  private buildColumnItems(key: ColumnKey): ContextMenuItem[] {
    const t = this.t();
    const sort = this.sort();
    const pin = this.pins()[key];
    const items: ContextMenuItem[] = [
      { type: 'label', label: `${t.columnMenuLabel} · ${this.headerFor(key, t)}` },
      { label: t.menuSortAsc, icon: 'arrow-up', disabled: sort?.key === key && sort.dir === 'asc', click: () => this.applySort(key, 'asc') },
      { label: t.menuSortDesc, icon: 'arrow-down', disabled: sort?.key === key && sort.dir === 'desc', click: () => this.applySort(key, 'desc') },
      { label: t.menuClearSort, icon: 'x', disabled: sort?.key !== key, click: () => this.clearSort() },
      { type: 'separator' },
      { label: t.menuPinLeft, icon: 'pin', disabled: pin === 'left', click: () => this.applyPin(key, 'left') },
      { label: t.menuPinRight, icon: 'pin', disabled: pin === 'right', click: () => this.applyPin(key, 'right') },
      { label: t.menuUnpin, icon: 'pin-off', disabled: !pin, click: () => this.applyPin(key, undefined) },
      { type: 'separator' },
      { label: t.menuHideColumn, icon: 'eye-off', click: () => this.hideColumn(key) },
      { label: t.menuShowAll, icon: 'eye', disabled: this.hidden().length === 0, click: () => this.showAllColumns() },
    ];
    return items;
  }

  private columnDef(key: ColumnKey, t: DataTableContextMenuDemoLocale): ColumnDef<PaymentRow> {
    if (key === 'status') {
      return { accessorKey: 'status', header: t.colStatus, cell: (row) => this.statusLabel(row.status, t) };
    }
    if (key === 'amount') {
      return { accessorKey: 'amount', header: t.colAmount, cell: (row) => this.formatAmount(row.amount) };
    }
    if (key === 'email') {
      return { accessorKey: 'email', header: t.colEmail };
    }
    return { accessorKey: 'customer', header: t.colCustomer };
  }

  private actionsColumn(t: DataTableContextMenuDemoLocale): ColumnDef<PaymentRow> {
    return {
      accessorKey: '_actions',
      header: t.colActions,
      enableSorting: false,
      enableHiding: false,
      width: '80px',
      component: DtcmActionsCellComponent,
      componentInputs: () => ({ label: t.rowActionsAria }),
      componentOutputs: (row) => ({
        openMenu: (event: unknown) => this.openRowMenuFromButton(row, event as MouseEvent),
      }),
    };
  }

  private headerFor(key: ColumnKey, t: DataTableContextMenuDemoLocale): string {
    return String(this.columnDef(key, t).header);
  }

  private statusLabel(status: PaymentStatus, t: DataTableContextMenuDemoLocale): string {
    if (status === 'success') {
      return t.statusSuccess;
    }
    return status === 'failed' ? t.statusFailed : t.statusPending;
  }

  private formatAmount(amount: number): string {
    return new Intl.NumberFormat(this.localeId(), { style: 'currency', currency: 'USD' }).format(amount);
  }

  private editRow(row: PaymentRow): void {
    const t = this.t();
    this.rows.update((rows) =>
      rows.map((item) => (item.id === row.id ? { ...item, customer: `${stripSuffix(item.customer, t.editedSuffix)} ${t.editedSuffix}` } : item)),
    );
    this.lastAction.set(`${t.menuEdit} → ${row.customer}`);
  }

  private duplicateRow(row: PaymentRow): void {
    const t = this.t();
    this.rows.update((rows) => {
      const index = rows.findIndex((item) => item.id === row.id);
      const copy: PaymentRow = { ...row, id: `${row.id}-copy-${rows.length}`, customer: `${row.customer} ${t.copySuffix}` };
      return [...rows.slice(0, index + 1), copy, ...rows.slice(index + 1)];
    });
    this.lastAction.set(`${t.menuDuplicate} → ${row.customer}`);
  }

  private deleteRow(row: PaymentRow): void {
    const t = this.t();
    this.rows.update((rows) => rows.filter((item) => item.id !== row.id));
    this.lastAction.set(`${t.menuDelete} → ${row.customer}`);
  }

  private applySort(key: ColumnKey, dir: SortDir): void {
    const t = this.t();
    this.sort.set({ key, dir });
    this.lastAction.set(`${dir === 'asc' ? t.menuSortAsc : t.menuSortDesc} → ${this.headerFor(key, t)}`);
  }

  private clearSort(): void {
    const t = this.t();
    this.sort.set(null);
    this.lastAction.set(t.menuClearSort);
  }

  private applyPin(key: ColumnKey, pin: Pin | undefined): void {
    const t = this.t();
    this.pins.update((pins) => {
      const next = { ...pins };
      if (pin) {
        next[key] = pin;
      } else {
        delete next[key];
      }
      return next;
    });
    const label = this.pinActionLabel(pin, t);
    this.lastAction.set(`${label} → ${this.headerFor(key, t)}`);
  }

  private pinActionLabel(pin: Pin | undefined, t: DataTableContextMenuDemoLocale): string {
    if (pin === 'left') {
      return t.menuPinLeft;
    }
    return pin === 'right' ? t.menuPinRight : t.menuUnpin;
  }

  private hideColumn(key: ColumnKey): void {
    const t = this.t();
    this.hidden.update((hidden) => (hidden.includes(key) ? hidden : [...hidden, key]));
    this.lastAction.set(`${t.menuHideColumn} → ${this.headerFor(key, t)}`);
  }

  private showAllColumns(): void {
    const t = this.t();
    this.hidden.set([]);
    this.lastAction.set(t.menuShowAll);
  }
}

function compareValues(a: string | number, b: string | number): number {
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  return String(a).localeCompare(String(b));
}

function stripSuffix(value: string, suffix: string): string {
  return value.endsWith(suffix) ? value.slice(0, -suffix.length).trimEnd() : value;
}
