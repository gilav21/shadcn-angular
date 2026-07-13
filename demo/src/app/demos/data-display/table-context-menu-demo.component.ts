import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  BadgeComponent,
  ButtonComponent,
  ContextMenuComponent,
  ContextMenuItem,
  TableBodyComponent,
  TableCaptionComponent,
  TableCellComponent,
  TableComponent,
  TableContextMenuDirective,
  TableHeadComponent,
  TableHeaderComponent,
  TableRowComponent,
  type TableCellContextMenuEvent,
  type TableRowContextMenuEvent,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { TABLE_CONTEXT_MENU_DEMO_LOCALES } from './table-context-menu-demo.locales';

type InvoiceStatus = 'paid' | 'pending' | 'unpaid';

interface Invoice {
  id: string;
  customer: string;
  status: InvoiceStatus;
  amount: string;
}

type ActionKey = 'actionEdited' | 'actionDuplicated' | 'actionViewed' | 'actionCopied' | 'actionDeleted';

const INITIAL_INVOICES: readonly Invoice[] = [
  { id: 'INV001', customer: 'Ada Lovelace', status: 'paid', amount: '$250.00' },
  { id: 'INV002', customer: 'Grace Hopper', status: 'pending', amount: '$150.00' },
  { id: 'INV003', customer: 'Alan Turing', status: 'unpaid', amount: '$350.00' },
  { id: 'INV004', customer: 'Katherine Johnson', status: 'paid', amount: '$450.00' },
];

type StatusKey = 'statusPaid' | 'statusPending' | 'statusUnpaid';

const STATUS_KEYS: Record<InvoiceStatus, StatusKey> = {
  paid: 'statusPaid',
  pending: 'statusPending',
  unpaid: 'statusUnpaid',
};

const STATUS_VARIANTS: Record<InvoiceStatus, 'default' | 'secondary' | 'destructive'> = {
  paid: 'default',
  pending: 'secondary',
  unpaid: 'destructive',
};

@Component({
  selector: 'app-table-context-menu-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TableComponent,
    TableCaptionComponent,
    TableHeaderComponent,
    TableBodyComponent,
    TableRowComponent,
    TableHeadComponent,
    TableCellComponent,
    TableContextMenuDirective,
    ContextMenuComponent,
    ButtonComponent,
    BadgeComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="table-context-menu" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="rounded-lg border bg-muted/40 p-4 space-y-2 text-sm">
        <p>{{ t().rightClickHint }}</p>
        <p class="text-muted-foreground">{{ t().touchHint }}</p>
        <p class="text-muted-foreground">{{ t().headerNote }}</p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <ui-button variant="outline" size="sm" (click)="toggleDisabled()">
          {{ menuDisabled() ? t().enableMenu : t().disableMenu }}
        </ui-button>
        <ui-button variant="ghost" size="sm" (click)="reset()">{{ t().resetData }}</ui-button>
        @if (menuDisabled()) {
          <ui-badge variant="secondary">{{ t().menuDisabledBadge }}</ui-badge>
        }
      </div>

      <ui-context-menu #rowMenu [items]="menuItems()" />

      <div class="w-full overflow-x-auto">
        <ui-table
          uiTable
          class="min-w-[560px]"
          [uiTableContextMenu]="rowMenu"
          [contextMenuDisabled]="menuDisabled()"
          (rowContextMenu)="onRowContextMenu($event)"
          (cellContextMenu)="onCellContextMenu($event)"
        >
          <ui-table-caption>{{ t().caption }}</ui-table-caption>
          <ui-table-header>
            <ui-table-row>
              <ui-table-head class="w-[110px] flex-none">{{ t().colInvoice }}</ui-table-head>
              <ui-table-head>{{ t().colCustomer }}</ui-table-head>
              <ui-table-head>{{ t().colStatus }}</ui-table-head>
              <ui-table-head class="text-right w-[110px] flex-none">{{ t().colAmount }}</ui-table-head>
              <ui-table-head class="w-[64px] flex-none"><span class="sr-only">{{ t().rowActionsAria }}</span></ui-table-head>
            </ui-table-row>
          </ui-table-header>
          <ui-table-body>
            @for (invoice of invoices(); track invoice.id; let i = $index) {
              <ui-table-row [attr.data-row]="rowPayload(invoice)" [attr.data-row-index]="i">
                <ui-table-cell data-column="invoice" class="font-medium w-[110px] flex-none">{{ invoice.id }}</ui-table-cell>
                <ui-table-cell data-column="customer">{{ invoice.customer }}</ui-table-cell>
                <ui-table-cell data-column="status">
                  <ui-badge [variant]="statusVariant(invoice)">{{ statusLabel(invoice) }}</ui-badge>
                </ui-table-cell>
                <ui-table-cell data-column="amount" class="text-right w-[110px] flex-none">{{ invoice.amount }}</ui-table-cell>
                <ui-table-cell data-column="actions" class="w-[64px] flex-none text-right">
                  <ui-button
                    variant="ghost"
                    size="icon"
                    [attr.aria-label]="t().rowActionsAria"
                    (click)="openRowMenu($event, i, rowMenu)"
                  >
                    ⋯
                  </ui-button>
                </ui-table-cell>
              </ui-table-row>
            }
          </ui-table-body>
        </ui-table>
      </div>

      <div class="rounded-lg border p-4 space-y-1 text-sm">
        <h3 class="font-semibold">{{ t().eventsHeading }}</h3>
        <p>
          <span class="font-medium">{{ t().lastRowLabel }}:</span>
          <span class="font-mono text-muted-foreground ms-2">{{ lastRow() ?? t().none }}</span>
        </p>
        <p>
          <span class="font-medium">{{ t().lastCellLabel }}:</span>
          <span class="font-mono text-muted-foreground ms-2">{{ lastCell() ?? t().none }}</span>
        </p>
        <p>
          <span class="font-medium">{{ t().lastActionLabel }}:</span>
          <span class="text-muted-foreground ms-2">{{ actionLabel() }}</span>
        </p>
      </div>
    </section>
  `,
})
export class TableContextMenuDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  readonly t = computed(
    () => TABLE_CONTEXT_MENU_DEMO_LOCALES[this.localeId()] ?? TABLE_CONTEXT_MENU_DEMO_LOCALES['en'],
  );

  readonly invoices = signal<Invoice[]>([...INITIAL_INVOICES]);
  readonly menuDisabled = signal(false);
  readonly lastRow = signal<string | null>(null);
  readonly lastCell = signal<string | null>(null);
  private readonly lastAction = signal<ActionKey | null>(null);
  private readonly targetIndex = signal(0);

  readonly actionLabel = computed(() => {
    const key = this.lastAction();
    return key ? this.t()[key] : this.t().none;
  });

  readonly menuItems = computed<ContextMenuItem[]>(() => {
    const t = this.t();
    return [
      { type: 'label', label: t.menuRowLabel },
      { label: t.menuEdit, shortcut: '⌘E', click: () => this.lastAction.set('actionEdited') },
      { label: t.menuDuplicate, shortcut: '⌘D', click: () => this.duplicateRow() },
      { label: t.menuViewDetails, click: () => this.lastAction.set('actionViewed') },
      { type: 'separator' },
      { label: t.menuCopyCell, click: () => this.lastAction.set('actionCopied') },
      { label: t.menuDelete, shortcut: '⌫', click: () => this.deleteRow() },
    ];
  });

  rowPayload(invoice: Invoice): string {
    return JSON.stringify(invoice);
  }

  statusLabel(invoice: Invoice): string {
    return this.t()[STATUS_KEYS[invoice.status]];
  }

  statusVariant(invoice: Invoice): 'default' | 'secondary' | 'destructive' {
    return STATUS_VARIANTS[invoice.status];
  }

  toggleDisabled(): void {
    this.menuDisabled.update((disabled) => !disabled);
  }

  reset(): void {
    this.invoices.set([...INITIAL_INVOICES]);
    this.lastRow.set(null);
    this.lastCell.set(null);
    this.lastAction.set(null);
  }

  onRowContextMenu(event: TableRowContextMenuEvent): void {
    this.targetIndex.set(event.index);
    const invoice = this.asInvoice(event.row);
    this.lastRow.set(`#${event.index} · ${invoice?.id ?? '?'}`);
  }

  onCellContextMenu(event: TableCellContextMenuEvent): void {
    this.lastCell.set(event.column);
  }

  /** Touch fallback: the directive has no long-press, so a visible trigger opens the same menu. */
  openRowMenu(event: MouseEvent, index: number, menu: ContextMenuComponent): void {
    this.targetIndex.set(index);
    const invoice = this.invoices()[index];
    this.lastRow.set(`#${index} · ${invoice.id}`);
    this.lastCell.set('actions');
    menu.show(event.clientX, event.clientY, invoice);
  }

  private duplicateRow(): void {
    const index = this.targetIndex();
    this.invoices.update((list) => {
      const source = list[index];
      if (!source) {
        return list;
      }
      const copy: Invoice = { ...source, id: `${source.id}-COPY-${list.length + 1}` };
      return [...list.slice(0, index + 1), copy, ...list.slice(index + 1)];
    });
    this.lastAction.set('actionDuplicated');
  }

  private deleteRow(): void {
    const index = this.targetIndex();
    this.invoices.update((list) => list.filter((_, i) => i !== index));
    this.lastAction.set('actionDeleted');
  }

  private asInvoice(row: unknown): Invoice | null {
    if (!row || typeof row !== 'object') {
      return null;
    }
    const candidate = row as Partial<Invoice>;
    return typeof candidate.id === 'string' ? (candidate as Invoice) : null;
  }
}
