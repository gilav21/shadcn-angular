import { ChangeDetectionStrategy, Component, computed, inject, input, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { delay, of } from 'rxjs';
import {
  BadgeComponent,
  ButtonComponent,
  CheckboxComponent,
  ColumnDef,
  ColumnResizeEvent,
  ContextMenuComponent,
  ContextMenuContentComponent,
  ContextMenuItemComponent,
  ContextMenuLabelComponent,
  ContextMenuSeparatorComponent,
  ContextMenuShortcutComponent,
  ContextMenuIntegrations,
  ContextMenuItem,
  DataTableComponent,
  DataTableColumnState,
  DataTableDateFilterComponent,
  DataTableDateRangeFilterComponent,
  DataTableLoadingVisibility,
  DataTableMultiselectFilterComponent,
  DateRange,
  PaginationState,
  RowActionContext,
  SortState,
  SpinnerComponent,
  SubRowFilterMode,
  SubRowSelectionMode,
  ToastService,
  dateFilterFn,
  dateRangeFilterFn,
  multiselectFilterFn,
} from '../../../../../packages/components/ui';
import { Payment, OrgNode, OpsTicket, OpsTicketTimelineEvent } from '../shared/types';
import { StatusCellComponent } from '../../cells/status-cell.component';
import { AmountCellComponent } from '../../cells/amount-cell.component';
import { ActionsCellComponent } from '../../cells/actions-cell.component';
import { TextFilterComponent } from '../../filters/text-filter.component';

@Component({
  selector: 'app-ops-table-loader',
  imports: [CommonModule, BadgeComponent],
  template: `
    <div class="flex min-w-[260px] flex-col gap-2 rounded-md border bg-background p-4 shadow-sm">
      <div class="flex items-center justify-between">
        <p class="text-sm font-medium">Syncing incident feed</p>
        <ui-badge variant="outline">{{ trigger() }}</ui-badge>
      </div>
      <div class="h-2 overflow-hidden rounded bg-muted">
        <div class="h-full w-1/3 animate-pulse bg-primary/60"></div>
      </div>
      <p class="text-xs text-muted-foreground">Working set: {{ total() }} records</p>
    </div>
  `,
})
class OpsTableLoaderComponent {
  readonly trigger = input<string>('initial');
  readonly total = input(0);
}

@Component({
  selector: 'app-ops-ticket-detail',
  imports: [CommonModule, BadgeComponent],
  template: `
    @if (ticket()) {
      <div class="space-y-4 p-3">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-sm font-semibold">{{ ticket()!.id }} &middot; {{ ticket()!.account }}</p>
            <p class="text-xs text-muted-foreground">{{ ticket()!.summary }}</p>
          </div>
          <div class="flex items-center gap-2">
            <ui-badge variant="outline">{{ ticket()!.priority }}</ui-badge>
            <ui-badge variant="secondary">{{ ticket()!.status }}</ui-badge>
          </div>
        </div>

        <div class="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
          <p>Service: {{ ticket()!.service }}</p>
          <p>Owner: {{ ticket()!.owner }}</p>
          <p>SLA Remaining: {{ ticket()!.slaMinutes }} min</p>
        </div>

        <div class="space-y-2">
          <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Timeline</p>
          @for (event of ticket()!.timeline; track event.at + event.actor) {
            <div class="rounded-md border p-2">
              <div class="flex items-center justify-between gap-2">
                <p class="text-xs font-medium">{{ event.actor }}</p>
                <p class="text-[11px] text-muted-foreground">{{ event.at }}</p>
              </div>
              <p class="text-xs text-muted-foreground">{{ event.note }}</p>
            </div>
          }
        </div>
      </div>
    }
  `,
})
class OpsTicketDetailComponent {
  readonly ticket = input<OpsTicket | undefined>(undefined);
}

@Component({
  selector: 'app-data-table-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ButtonComponent,
    CheckboxComponent,
    SpinnerComponent,
    DataTableComponent,
    ContextMenuComponent,
    ContextMenuContentComponent,
    ContextMenuItemComponent,
    ContextMenuLabelComponent,
    ContextMenuSeparatorComponent,
    ContextMenuShortcutComponent,
    ...ContextMenuIntegrations,
  ],
  templateUrl: './data-table-demo.component.html',
})
export class DataTableDemoComponent {
  private readonly toastService = inject(ToastService);

  readonly payments = signal<Payment[]>([]);
  readonly selection = signal<Record<string, boolean>>({});
  readonly selectionCount = computed(() => Object.keys(this.selection()).filter(k => this.selection()[k]).length);

  readonly paymentColumns: ColumnDef<Payment>[] = [
    { accessorKey: 'id', header: 'ID', enableSorting: true, sticky: true, width: '100px' },
    { accessorKey: 'email', header: 'Email', enableSorting: true, width: 'auto' },
    { accessorKey: 'amount', header: 'Amount', enableSorting: true, width: '150px' },
    {
      accessorKey: 'status',
      header: 'Status',
      enableSorting: true,
      enableFiltering: true,
      filterComponent: DataTableMultiselectFilterComponent,
      filterComponentInputs: {
        options: ['pending', 'processing', 'success', 'failed'],
        placeholder: 'Filter status...',
        title: 'Status',
      },
      filterFn: (row: Payment, filterValue: unknown) =>
        multiselectFilterFn(row, filterValue as string[] | null, (r: Payment) => r.status),
      width: '150px',
    },
    { accessorKey: 'clientName', header: 'Client Name', width: 'auto' },
    { accessorKey: 'role', header: 'Role', width: '150px' },
  ];

  readonly hebrewRtlData = signal([
    { id: 'INV-001', customer: '\u05D0\u05DC\u05D5\u05DF \u05DB\u05D4\u05DF', amount: 1250, status: '\u05D4\u05D5\u05E9\u05DC\u05DD', date: '2024-06-15' },
    { id: 'INV-002', customer: '\u05DE\u05D9\u05DB\u05DC \u05DC\u05D5\u05D9', amount: 890, status: '\u05DE\u05DE\u05EA\u05D9\u05DF', date: '2024-06-14' },
    { id: 'INV-003', customer: '\u05D9\u05D5\u05E1\u05D9 \u05D0\u05D1\u05E8\u05D4\u05DD', amount: 2340, status: '\u05D4\u05D5\u05E9\u05DC\u05DD', date: '2024-06-10' },
    { id: 'INV-004', customer: '\u05E8\u05D5\u05E0\u05D9\u05EA \u05D3\u05D5\u05D3', amount: 560, status: '\u05D1\u05D5\u05D8\u05DC', date: '2024-05-28' },
    { id: 'INV-005', customer: '\u05E0\u05D5\u05E2\u05DD \u05E9\u05E8\u05D5\u05DF', amount: 3100, status: '\u05DE\u05DE\u05EA\u05D9\u05DF', date: '2024-06-01' },
    { id: 'INV-006', customer: '\u05E2\u05D3\u05D9 \u05D1\u05DF-\u05D0\u05E8\u05D9', amount: 1780, status: '\u05D4\u05D5\u05E9\u05DC\u05DD', date: '2024-05-20' },
    { id: 'INV-007', customer: '\u05D2\u05DC\u05D9\u05EA \u05E4\u05E8\u05D9\u05D3\u05DE\u05DF', amount: 420, status: '\u05DE\u05DE\u05EA\u05D9\u05DF', date: '2024-06-12' },
    { id: 'INV-008', customer: '\u05D0\u05D5\u05E8\u05D9 \u05DE\u05D6\u05E8\u05D7\u05D9', amount: 5200, status: '\u05D4\u05D5\u05E9\u05DC\u05DD', date: '2024-06-08' },
  ]);

  readonly hebrewRtlColumns: ColumnDef<{ id: string; customer: string; amount: number; status: string; date: string }>[] = [
    { accessorKey: 'id', header: '\u05DE\u05E1\u05E4\u05E8 \u05D7\u05E9\u05D1\u05D5\u05E0\u05D9\u05EA', width: '140px', enableSorting: true },
    { accessorKey: 'customer', header: '\u05DC\u05E7\u05D5\u05D7', width: 'auto', enableSorting: true },
    {
      accessorKey: 'amount',
      header: '\u05E1\u05DB\u05D5\u05DD',
      width: '120px',
      enableSorting: true,
      cell: (row) => `\u20AA${row.amount.toLocaleString('he-IL')}`,
    },
    {
      accessorKey: 'status',
      header: '\u05E1\u05D8\u05D8\u05D5\u05E1',
      width: '130px',
      enableSorting: true,
      enableFiltering: true,
      filterComponent: DataTableMultiselectFilterComponent,
      filterComponentInputs: {
        options: ['\u05D4\u05D5\u05E9\u05DC\u05DD', '\u05DE\u05DE\u05EA\u05D9\u05DF', '\u05D1\u05D5\u05D8\u05DC'],
        placeholder: '\u05E1\u05E0\u05DF \u05E1\u05D8\u05D8\u05D5\u05E1...',
        title: '\u05E1\u05D8\u05D8\u05D5\u05E1',
      },
      filterFn: (row: { status: string }, filterValue: unknown) =>
        multiselectFilterFn(row, filterValue as string[] | null, (r: { status: string }) => r.status),
    },
    {
      accessorKey: 'date',
      header: '\u05EA\u05D0\u05E8\u05D9\u05DA',
      width: '160px',
      enableSorting: true,
      enableFiltering: true,
      filterComponent: DataTableDateFilterComponent,
      filterComponentInputs: { locale: 'he' },
      filterFn: (row: { date: string }, filterValue: unknown) =>
        dateFilterFn(row, filterValue as Date | null, (r: { date: string }) => r.date),
      sortFn: (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    },
  ];

  readonly resizableColumns: ColumnDef<Payment>[] = [
    { accessorKey: 'id', header: 'ID', enableSorting: true, width: '80px', minWidth: '60px' },
    { accessorKey: 'email', header: 'Email', enableSorting: true, width: '250px', minWidth: '100px' },
    { accessorKey: 'amount', header: 'Amount', enableSorting: true, width: '120px', minWidth: '80px' },
    { accessorKey: 'status', header: 'Status', enableSorting: true, width: '130px', minWidth: '80px' },
    { accessorKey: 'clientName', header: 'Client Name', width: '200px', minWidth: '100px' },
    { accessorKey: 'role', header: 'Role', width: '120px', minWidth: '80px' },
  ];

  onColumnResize(_event: ColumnResizeEvent): void {
    // Column resize handled by data table internally
  }

  readonly paymentRowActions = (ctx: RowActionContext<Payment>): ContextMenuItem[] => [
    {
      label: `View ${ctx.row.email}`,
      icon: 'eye',
      shortcut: '\u2318V',
      click: () => this.toastService.toast({ title: 'View', description: `Viewing payment ${ctx.row.id}` }),
    },
    {
      label: 'Edit Payment',
      icon: 'pencil',
      shortcut: '\u2318E',
      click: () => this.toastService.toast({ title: 'Edit', description: `Editing payment ${ctx.row.id}` }),
    },
    { type: 'separator' },
    {
      label: 'Delete',
      icon: 'trash',
      shortcut: '\u2318\u232b',
      click: () => this.toastService.toast({ title: 'Delete', description: `Deleted payment ${ctx.row.id}`, variant: 'destructive' }),
    },
  ];

  readonly customCellsColumns: ColumnDef<Payment>[] = [
    { accessorKey: 'id', header: 'ID', enableSorting: true, width: '100px' },
    {
      accessorKey: 'email',
      header: 'Email',
      enableSorting: true,
      width: 'auto',
      enableFiltering: true,
      filterComponent: TextFilterComponent,
    },
    {
      accessorKey: 'amount',
      header: 'Amount',
      enableSorting: true,
      width: '150px',
      component: AmountCellComponent,
      componentInputs: (row) => ({ amount: row.amount }),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      enableSorting: true,
      width: '150px',
      component: StatusCellComponent,
      componentInputs: (row) => ({ status: row.status }),
      sortFn: (a, b) => {
        const statusOrder: Record<string, number> = { success: 0, processing: 1, pending: 2, failed: 3 };
        return statusOrder[a.status] - statusOrder[b.status];
      },
    },
    {
      accessorKey: 'actions',
      header: 'Actions',
      width: '200px',
      enableSorting: false,
      component: ActionsCellComponent,
      componentInputs: (row) => ({
        id: row.id,
        email: row.email,
      }),
      componentOutputs: (row) => ({
        view: () => this.handlePaymentAction('View', row),
        edit: () => this.handlePaymentAction('Edit', row),
      }),
    },
  ];

  handlePaymentAction(action: string, payment: Payment): void {
    this.toastService.toast({
      title: `${action} Payment`,
      description: `${action} payment ${payment.id} for ${payment.email}`,
      variant: 'default',
    });
  }

  // Sub-Rows / Tree Data
  readonly treeSelectionMode = signal<SubRowSelectionMode>('descendants');
  readonly treeFilterMode = signal<SubRowFilterMode>('includeParentOnChildMatch');

  readonly orgTreeData: OrgNode[] = [
    {
      id: 'eng', name: 'Engineering', role: 'Department', headcount: 42, budget: 2800000,
      children: [
        {
          id: 'eng-fe', name: 'Frontend', role: 'Team', headcount: 14, budget: 900000,
          children: [
            { id: 'eng-fe-web', name: 'Web Platform', role: 'Squad', headcount: 6, budget: 400000, children: [
              { id: 'p-alice', name: 'Alice Chen', role: 'Tech Lead', headcount: 1, budget: 180000 },
              { id: 'p-bob', name: 'Bob Park', role: 'Senior Engineer', headcount: 1, budget: 160000 },
              { id: 'p-carol', name: 'Carol Wu', role: 'Engineer', headcount: 1, budget: 130000 },
            ]},
            { id: 'eng-fe-mobile', name: 'Mobile', role: 'Squad', headcount: 5, budget: 350000, children: [
              { id: 'p-dave', name: 'Dave Kim', role: 'Tech Lead', headcount: 1, budget: 175000 },
              { id: 'p-eve', name: 'Eve Singh', role: 'Engineer', headcount: 1, budget: 130000 },
            ]},
            { id: 'eng-fe-design', name: 'Design Systems', role: 'Squad', headcount: 3, budget: 250000 },
          ],
        },
        {
          id: 'eng-be', name: 'Backend', role: 'Team', headcount: 18, budget: 1200000,
          children: [
            { id: 'eng-be-api', name: 'API Platform', role: 'Squad', headcount: 8, budget: 550000, children: [
              { id: 'p-frank', name: 'Frank Li', role: 'Principal Engineer', headcount: 1, budget: 200000 },
              { id: 'p-grace', name: 'Grace Obi', role: 'Senior Engineer', headcount: 1, budget: 165000 },
            ]},
            { id: 'eng-be-data', name: 'Data Pipeline', role: 'Squad', headcount: 6, budget: 420000 },
            { id: 'eng-be-infra', name: 'Infrastructure', role: 'Squad', headcount: 4, budget: 330000 },
          ],
        },
        {
          id: 'eng-qa', name: 'QA', role: 'Team', headcount: 10, budget: 700000,
          children: [
            { id: 'eng-qa-auto', name: 'Automation', role: 'Squad', headcount: 6, budget: 420000 },
            { id: 'eng-qa-manual', name: 'Manual Testing', role: 'Squad', headcount: 4, budget: 280000 },
          ],
        },
      ],
    },
    {
      id: 'product', name: 'Product', role: 'Department', headcount: 15, budget: 1500000,
      children: [
        { id: 'prod-core', name: 'Core Product', role: 'Team', headcount: 8, budget: 850000, children: [
          { id: 'p-hannah', name: 'Hannah Lee', role: 'Product Manager', headcount: 1, budget: 170000 },
          { id: 'p-ivan', name: 'Ivan Petrov', role: 'Product Designer', headcount: 1, budget: 145000 },
        ]},
        { id: 'prod-growth', name: 'Growth', role: 'Team', headcount: 7, budget: 650000 },
      ],
    },
    {
      id: 'marketing', name: 'Marketing', role: 'Department', headcount: 12, budget: 1100000,
      children: [
        { id: 'mkt-content', name: 'Content', role: 'Team', headcount: 5, budget: 450000 },
        { id: 'mkt-perf', name: 'Performance', role: 'Team', headcount: 4, budget: 380000 },
        { id: 'mkt-brand', name: 'Brand', role: 'Team', headcount: 3, budget: 270000 },
      ],
    },
    { id: 'finance', name: 'Finance', role: 'Department', headcount: 8, budget: 750000 },
    { id: 'hr', name: 'Human Resources', role: 'Department', headcount: 6, budget: 520000 },
  ];

  readonly orgTreeColumns: ColumnDef<OrgNode>[] = [
    { accessorKey: 'name', header: 'Name', enableSorting: true, width: 'auto', minWidth: '250px' },
    { accessorKey: 'role', header: 'Role', enableSorting: true, width: '180px' },
    { accessorKey: 'headcount', header: 'Headcount', enableSorting: true, width: '120px',
      cell: (row) => String(row.headcount) },
    { accessorKey: 'budget', header: 'Budget', enableSorting: true, width: '150px',
      cell: (row) => '$' + row.budget.toLocaleString() },
  ];

  onTreeTableContextMenu(_event: unknown): void {
    // Context menu handled by data table internally
  }

  onTreeTableAction(action: string, ctx: { row?: OrgNode; depth: number; isLeaf: boolean; childCount?: number }): void {
    this.toastService.toast({
      title: `${action} \u2014 ${ctx.row?.name}`,
      description: `Depth: ${ctx.depth}, Leaf: ${ctx.isLeaf}, Children: ${ctx.childCount ?? 0}`,
      variant: 'default',
    });
  }

  // Server-Side
  readonly serverData = signal<Payment[]>([]);
  readonly serverTotal = signal(0);
  readonly serverLoading = signal(true);
  readonly serverSort = signal<SortState>({ column: 'email', direction: 'asc' });
  readonly serverPagination = signal<PaginationState>({ pageIndex: 0, pageSize: 10 });
  readonly serverFilter = signal('');
  readonly serverColumnFilters = signal<Record<string, unknown>>({});

  onServerSort(sort: SortState): void {
    this.serverSort.set(sort);
    this.loadServerData();
  }

  onServerPage(page: PaginationState): void {
    this.serverPagination.set(page);
    this.loadServerData();
  }

  onServerFilter(filter: string): void {
    this.serverFilter.set(filter);
    this.serverPagination.update(p => ({ ...p, pageIndex: 0 }));
    this.loadServerData();
  }

  onServerColumnFilters(filters: Record<string, unknown>): void {
    this.serverColumnFilters.set(filters);
    this.serverPagination.update(p => ({ ...p, pageIndex: 0 }));
    this.loadServerData();
  }

  // Ops grid
  private readonly opsGridRef = viewChild<DataTableComponent<OpsTicket>>('opsGrid');
  readonly opsSource = signal<OpsTicket[]>([]);
  readonly opsData = signal<OpsTicket[]>([]);
  readonly opsTotal = signal(0);
  readonly opsLoading = signal(false);
  readonly opsFilter = signal('');
  readonly opsColumnFilters = signal<Record<string, unknown>>({});
  readonly opsPagination = signal<PaginationState>({ pageIndex: 0, pageSize: 10 });
  readonly opsSort = signal<SortState>({ column: '', direction: null });
  readonly opsMultiSort = signal<SortState[]>([]);
  readonly opsColumnOrder = signal<string[]>([]);
  readonly opsColumnVisibility = signal<Record<string, boolean>>({ createdAt: false });
  readonly opsExpandedRows = signal<Record<string, boolean>>({});
  readonly opsSavedLayout = signal<DataTableColumnState[] | null>(null);
  readonly opsLoadingVisibility = signal<DataTableLoadingVisibility>({
    initial: true,
    pagination: true,
    sorting: true,
    filtering: true,
  });

  readonly opsLoaderComponent = OpsTableLoaderComponent;
  readonly opsDetailComponent = OpsTicketDetailComponent;
  readonly opsDetailInputs = (ticket: OpsTicket) => ({ ticket });

  readonly opsColumns: ColumnDef<OpsTicket>[] = [
    {
      accessorKey: 'id',
      header: 'Ticket',
      pin: 'left',
      width: '130px',
      enableSorting: true,
      enableHiding: false,
      enableReordering: false,
    },
    { accessorKey: 'account', header: 'Account', width: '180px', enableSorting: true },
    { accessorKey: 'service', header: 'Service', width: '160px', enableSorting: true },
    { accessorKey: 'region', header: 'Region', width: '110px', enableSorting: true },
    {
      accessorKey: 'priority',
      header: 'Priority',
      width: '95px',
      enableSorting: true,
      sortFn: (a, b) => ({ P1: 0, P2: 1, P3: 2, P4: 3 } as Record<string, number>)[a.priority] - ({ P1: 0, P2: 1, P3: 2, P4: 3 } as Record<string, number>)[b.priority],
    },
    {
      accessorKey: 'status',
      header: 'Status',
      width: '140px',
      enableSorting: true,
      sortFn: (a, b) => ({ Open: 0, Investigating: 1, Mitigated: 2, Resolved: 3 } as Record<string, number>)[a.status] - ({ Open: 0, Investigating: 1, Mitigated: 2, Resolved: 3 } as Record<string, number>)[b.status],
    },
    { accessorKey: 'owner', header: 'Owner', width: '140px', enableSorting: true },
    {
      accessorKey: 'mrr',
      header: 'MRR',
      width: '120px',
      enableSorting: true,
      cell: (row) => `$${row.mrr.toLocaleString()}`,
      enableGlobalFilter: false,
    },
    { accessorKey: 'slaMinutes', header: 'SLA (min)', width: '100px', enableSorting: true },
    {
      accessorKey: 'updatedAt',
      header: 'Updated',
      width: '160px',
      enableSorting: true,
      enableFiltering: true,
      filterComponent: DataTableDateRangeFilterComponent,
      filterFn: (row: OpsTicket, filterValue: unknown): boolean =>
        dateRangeFilterFn(row, filterValue as DateRange | null, r => r.updatedAt),
      sortFn: (a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      width: '160px',
      enableSorting: true,
      enableFiltering: true,
      filterComponent: DataTableDateFilterComponent,
      filterFn: (row: OpsTicket, filterValue: unknown): boolean =>
        dateFilterFn(row, filterValue as Date | null, r => r.createdAt),
      sortFn: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    },
    { accessorKey: 'summary', header: 'Summary', width: 'auto', enableSorting: false, enableGlobalFilter: false },
  ];

  onOpsFilter(filter: string): void {
    this.opsFilter.set(filter);
    this.opsPagination.update((state) => ({ ...state, pageIndex: 0 }));
    this.loadOpsData();
  }

  onOpsPage(page: PaginationState): void {
    this.opsPagination.set(page);
    this.loadOpsData();
  }

  onOpsSort(sort: SortState): void {
    this.opsSort.set(sort);
  }

  onOpsMultiSort(sorts: SortState[]): void {
    this.opsMultiSort.set(sorts);
    this.loadOpsData();
  }

  onOpsColumnFilters(filters: Record<string, unknown>): void {
    this.opsColumnFilters.set(filters);
    this.opsPagination.update(p => ({ ...p, pageIndex: 0 }));
    this.loadOpsData();
  }

  toggleOpsLoaderTrigger(trigger: keyof DataTableLoadingVisibility, enabled: boolean): void {
    this.opsLoadingVisibility.update((state) => ({ ...state, [trigger]: enabled }));
  }

  refreshOpsData(): void {
    this.opsGridRef()?.setLoadingTrigger('initial');
    this.loadOpsData();
  }

  saveOpsLayout(): void {
    const table = this.opsGridRef();
    if (!table) return;
    this.opsSavedLayout.set(table.getColumnState());
    this.toastService.success('Layout Saved', 'Column layout state saved for this session.');
  }

  restoreOpsLayout(): void {
    const table = this.opsGridRef();
    const layout = this.opsSavedLayout();
    if (!table || !layout) return;

    table.applyColumnState(layout);
    this.opsColumnOrder.set(table.columnOrder());
    this.opsColumnVisibility.set(table.columnVisibility());
    this.toastService.toast({ title: 'Layout Restored', description: 'Saved layout re-applied.' });
  }

  applyOpsCompactPreset(): void {
    const table = this.opsGridRef();
    if (!table) return;

    table.applyColumnState([
      { columnKey: 'id', order: 0, visible: true, width: '120px' },
      { columnKey: 'priority', order: 1, visible: true, width: '90px' },
      { columnKey: 'status', order: 2, visible: true, width: '120px' },
      { columnKey: 'owner', order: 3, visible: true, width: '130px' },
      { columnKey: 'updatedAt', order: 4, visible: true, width: '160px' },
      { columnKey: 'summary', order: 5, visible: true },
      { columnKey: 'account', visible: false },
      { columnKey: 'service', visible: false },
      { columnKey: 'region', visible: false },
      { columnKey: 'mrr', visible: false },
      { columnKey: 'createdAt', visible: false },
      { columnKey: 'slaMinutes', visible: false },
    ]);

    this.opsColumnOrder.set(table.columnOrder());
    this.opsColumnVisibility.set(table.columnVisibility());
  }

  moveOpsPriorityToFront(): void {
    const table = this.opsGridRef();
    if (!table) return;
    table.moveColumn('priority', 1);
    this.opsColumnOrder.set(table.columnOrder());
  }

  readonly opsExportProvider = async (): Promise<OpsTicket[]> => {
    await new Promise(resolve => setTimeout(resolve, 400));
    return this.getFilteredSortedOpsData();
  };

  constructor() {
    const clientNames = ['Acme Corp', 'TechStart Inc', 'Global Solutions', 'Innovation Labs', 'Digital Ventures'];
    const roles = ['Admin', 'User', 'Manager', 'Developer', 'Designer'];

    const data: Payment[] = Array.from({ length: 100 }, (_, i) => ({
      id: `PAY-${i + 1}`,
      amount: Math.floor(Math.random() * 500) + 50,
      status: (['pending', 'processing', 'success', 'failed'] as const)[Math.floor(Math.random() * 4)],
      email: `user${i + 1}@example.com`,
      clientName: clientNames[Math.floor(Math.random() * clientNames.length)],
      role: roles[Math.floor(Math.random() * roles.length)],
    }));
    this.payments.set(data);

    this.loadServerData();
    this.createOpsDataset();
    this.loadOpsData();
  }

  private loadServerData(): void {
    this.serverLoading.set(true);

    const allData = this.payments();
    const { pageIndex, pageSize } = this.serverPagination();
    const sort = this.serverSort();
    const filter = this.serverFilter().toLowerCase();

    of(null).pipe(delay(1000)).subscribe(() => {
      let filtered = allData;

      if (filter) {
        filtered = filtered.filter(row =>
          Object.values(row).some(val => String(val).toLowerCase().includes(filter))
        );
      }

      const colFilters = this.serverColumnFilters();
      for (const key of Object.keys(colFilters)) {
        const val = colFilters[key];
        if (val === null || val === undefined || val === '') continue;
        const col = this.paymentColumns.find(c => c.accessorKey === key);
        if (col?.filterFn) {
          filtered = filtered.filter(row => col.filterFn!(row, val));
        }
      }

      if (sort.column && sort.direction) {
        filtered = [...filtered].sort((a, b) => {
          const aVal = (a as unknown as Record<string, unknown>)[sort.column];
          const bVal = (b as unknown as Record<string, unknown>)[sort.column];
          if (aVal! < bVal!) return sort.direction === 'asc' ? -1 : 1;
          if (aVal! > bVal!) return sort.direction === 'asc' ? 1 : -1;
          return 0;
        });
      }

      const start = pageIndex * pageSize;
      const sliced = filtered.slice(start, start + pageSize);

      this.serverData.set(sliced);
      this.serverTotal.set(filtered.length);
      this.serverLoading.set(false);
    });
  }

  private createOpsDataset(): void {
    const accounts = ['Acme Retail', 'Nova Bank', 'Helios Health', 'Orbit Logistics', 'Sierra Energy'];
    const services = ['Checkout API', 'Ledger Sync', 'Claims Gateway', 'Route Optimizer', 'Billing Engine'];
    const owners = ['Elena', 'Marcus', 'Priya', 'Noah', 'Fatima', 'Jin'];
    const regions: OpsTicket['region'][] = ['NA', 'EU', 'APAC', 'LATAM'];
    const priorities: OpsTicket['priority'][] = ['P1', 'P2', 'P3', 'P4'];
    const statuses: OpsTicket['status'][] = ['Open', 'Investigating', 'Mitigated', 'Resolved'];

    const data: OpsTicket[] = Array.from({ length: 240 }, (_, i) => {
      const created = new Date(Date.now() - (i + 1) * 1000 * 60 * 60 * 6);
      const updated = new Date(created.getTime() + (Math.floor(Math.random() * 18) + 1) * 1000 * 60 * 30);
      const priority = priorities[Math.floor(Math.random() * priorities.length)];
      const account = accounts[Math.floor(Math.random() * accounts.length)];
      const service = services[Math.floor(Math.random() * services.length)];
      const owner = owners[Math.floor(Math.random() * owners.length)];
      const region = regions[Math.floor(Math.random() * regions.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];

      return {
        id: `INC-${(1000 + i).toString()}`,
        account,
        service,
        region,
        priority,
        status,
        owner,
        mrr: 12000 + Math.floor(Math.random() * 185000),
        slaMinutes: 45 + Math.floor(Math.random() * 720),
        createdAt: created.toISOString(),
        updatedAt: updated.toISOString(),
        summary: `${service} latency spike detected for ${account} (${region})`,
        tags: [priority, service.split(' ')[0], region],
        timeline: [
          { at: created.toLocaleString(), actor: owner, note: 'Ticket opened and triage started.' },
          { at: new Date(created.getTime() + 1000 * 60 * 45).toLocaleString(), actor: 'AutoMonitor', note: 'Threshold alert correlated with error budget burn.' },
          { at: updated.toLocaleString(), actor: owner, note: 'Latest remediation update posted.' },
        ],
      };
    });

    this.opsSource.set(data);
  }

  private loadOpsData(): void {
    this.opsLoading.set(true);

    const { pageIndex, pageSize } = this.opsPagination();

    of(null).pipe(delay(650)).subscribe(() => {
      const rows = this.getFilteredSortedOpsData();
      const total = rows.length;
      const start = pageIndex * pageSize;
      const paged = rows.slice(start, start + pageSize);

      this.opsData.set(paged);
      this.opsTotal.set(total);
      this.opsLoading.set(false);
    });
  }

  private getFilteredSortedOpsData(): OpsTicket[] {
    const source = this.opsSource();
    const filter = this.opsFilter().toLowerCase();
    const sorts = this.resolveOpsSorts();
    const colFilters = this.opsColumnFilters();

    let rows = source;

    if (filter) {
      rows = rows.filter(row =>
        [row.id, row.account, row.service, row.owner, row.status, row.summary, row.tags.join(' ')]
          .join(' ')
          .toLowerCase()
          .includes(filter)
      );
    }

    for (const key of Object.keys(colFilters)) {
      const filterValue = colFilters[key];
      if (filterValue === null || filterValue === undefined || filterValue === '') continue;
      const col = this.opsColumns.find(c => c.accessorKey === key);
      if (col?.filterFn) {
        rows = rows.filter(row => col.filterFn!(row, filterValue));
      }
    }

    if (sorts.length > 0) {
      rows = [...rows].sort((a, b) => {
        for (const sort of sorts) {
          const key = sort.column as keyof OpsTicket;
          const direction = sort.direction === 'desc' ? -1 : 1;
          const aVal = a[key];
          const bVal = b[key];
          if (aVal === bVal) continue;
          return this.compareOpsSortValues(aVal, bVal) * direction;
        }
        return 0;
      });
    }

    return rows;
  }

  private resolveOpsSorts(): SortState[] {
    const multiSort = this.opsMultiSort();
    if (multiSort.length > 0) {
      return multiSort;
    }
    const singleSort = this.opsSort();
    return singleSort.direction ? [singleSort] : [];
  }

  private compareOpsSortValues(aVal: OpsTicket[keyof OpsTicket], bVal: OpsTicket[keyof OpsTicket]): number {
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return aVal > bVal ? 1 : -1;
    }
    if (aVal instanceof Date && bVal instanceof Date) {
      return aVal.getTime() > bVal.getTime() ? 1 : -1;
    }
    const aText = this.normalizeOpsSortValue(aVal);
    const bText = this.normalizeOpsSortValue(bVal);
    return aText.localeCompare(bText);
  }

  private normalizeOpsSortValue(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') return `${value}`;
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map(item => this.normalizeOpsSortValue(item)).join('|');
    if (value && typeof value === 'object') return JSON.stringify(value);
    return '';
  }
}
