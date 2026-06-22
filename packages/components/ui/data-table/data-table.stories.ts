import { Meta, StoryObj, moduleMetadata, applicationConfig } from '@storybook/angular';
import { DataTableComponent } from './data-table.component';
import { ColumnDef, PaginationState, SortState, DataTableLoadingVisibility, RowActionContext, CellIcon } from './data-table.types';
import { Component, ChangeDetectionStrategy, output, input, signal } from '@angular/core';
import { InputComponent } from '../input';
import { ContextMenuComponent, ContextMenuTriggerDirective, ContextMenuContentComponent, ContextMenuItemComponent, ContextMenuShortcutComponent, ContextMenuSeparatorComponent, ContextMenuItem } from '../context-menu';
import { ContextMenuIntegrations } from '../context-menu-integrations';
import { DataTableDateFilterComponent, dateFilterFn } from './sub/data-table-date-filter.component';
import { DataTableDateRangeFilterComponent, dateRangeFilterFn } from './sub/data-table-date-range-filter.component';
import { DateRange } from '../calendar';

// Filter component for stories
@Component({
    selector: 'app-text-filter',
    standalone: true,
    template: `
        <ui-input
            type="text"
            placeholder="Filter..."
            class="h-8 w-full"
            (input)="onInputChange($event)"
        />
    `,
    imports: [InputComponent],
    changeDetection: ChangeDetectionStrategy.OnPush
})
class TextFilterComponent {
    filterChange = output<string>();

    onInputChange(event: Event) {
        const value = (event.target as HTMLInputElement).value;
        this.filterChange.emit(value);
    }
}

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
}

interface OpsTicket {
    id: string;
    account: string;
    service: string;
    priority: 'P1' | 'P2' | 'P3' | 'P4';
    status: 'Open' | 'Investigating' | 'Mitigated' | 'Resolved';
    owner: string;
    mrr: number;
    updatedAt: string;
    summary: string;
}

@Component({
    selector: 'app-ops-loader-story',
    standalone: true,
    template: `
      <div class="rounded-md border bg-background px-3 py-2 text-xs shadow-sm">
        <p class="font-medium">Loading operations feed...</p>
        <p class="text-muted-foreground">trigger={{ trigger() }}, rows={{ total() }}</p>
      </div>
    `,
})
class OpsLoaderStoryComponent {
    trigger = input<string>('initial');
    total = input<number>(0);
}

@Component({
    selector: 'app-ops-detail-story',
    standalone: true,
    template: `
      @if (ticket()) {
        <div class="space-y-1 p-2 text-xs">
          <p><strong>{{ ticket()!.id }}</strong> · {{ ticket()!.account }} · {{ ticket()!.service }}</p>
          <p class="text-muted-foreground">{{ ticket()!.summary }}</p>
          <p class="text-muted-foreground">Owner: {{ ticket()!.owner }} · Updated: {{ ticket()!.updatedAt }}</p>
        </div>
      }
    `,
})
class OpsDetailStoryComponent {
    ticket = input<OpsTicket | undefined>(undefined);
}

@Component({
    selector: 'app-enterprise-ops-table-story',
    standalone: true,
    imports: [DataTableComponent],
    template: `
      <div class="h-[680px] w-full p-4">
        <ui-data-table
          [data]="rows()"
          [columns]="columns"
          [total]="total()"
          [loading]="loading()"
          [loadingVisibility]="loadingVisibility"
          [loaderComponent]="loaderComponent"
          [loaderComponentInputs]="{ total: total() }"
          [enableColumnResize]="true"
          [enableRowExpansion]="true"
          [rowDetailComponent]="detailComponent"
          [rowDetailComponentInputs]="detailInputs"
          [enableMultiSort]="true"
          [localSorting]="false"
          [localPagination]="false"
          [localFiltering]="false"
          (sortChange)="onSort($event)"
          (multiSortChange)="onMultiSort($event)"
          (pageChange)="onPage($event)"
          (filterChange)="onFilter($event)"
        />
      </div>
    `,
})
class EnterpriseOpsTableStoryComponent {
    rows = signal<OpsTicket[]>([]);
    total = signal(0);
    loading = signal(true);
    filter = signal('');
    sort = signal<SortState>({ column: '', direction: null });
    sorts = signal<SortState[]>([]);
    page = signal<PaginationState>({ pageIndex: 0, pageSize: 10 });

    loaderComponent = OpsLoaderStoryComponent;
    detailComponent = OpsDetailStoryComponent;
    detailInputs = (row: OpsTicket) => ({ ticket: row });

    loadingVisibility: DataTableLoadingVisibility = {
        initial: true,
        pagination: true,
        sorting: true,
        filtering: true,
    };

    columns: ColumnDef<OpsTicket>[] = [
        { accessorKey: 'id', header: 'Ticket', pin: 'left', width: '120px', enableSorting: true, enableHiding: false },
        { accessorKey: 'account', header: 'Account', width: '180px', enableSorting: true },
        { accessorKey: 'service', header: 'Service', width: '160px', enableSorting: true },
        { accessorKey: 'priority', header: 'Priority', width: '90px', enableSorting: true },
        { accessorKey: 'status', header: 'Status', width: '140px', enableSorting: true },
        { accessorKey: 'owner', header: 'Owner', width: '130px', enableSorting: true },
        { accessorKey: 'mrr', header: 'MRR', width: '120px', enableSorting: true, cell: (r) => `$${r.mrr.toLocaleString()}` },
        { accessorKey: 'updatedAt', header: 'Updated', width: '160px', enableSorting: true, pin: 'right' },
        { accessorKey: 'summary', header: 'Summary', width: 'auto', enableSorting: false, enableGlobalFilter: false },
    ];

    private readonly source: OpsTicket[] = Array.from({ length: 120 }, (_, i) => ({
        id: `INC-${(1000 + i).toString()}`,
        account: ['Acme Retail', 'Helios Health', 'Nova Bank', 'Orbit Logistics'][i % 4],
        service: ['Checkout API', 'Billing Engine', 'Ledger Sync', 'Route Optimizer'][i % 4],
        priority: ['P1', 'P2', 'P3', 'P4'][i % 4] as OpsTicket['priority'],
        status: ['Open', 'Investigating', 'Mitigated', 'Resolved'][i % 4] as OpsTicket['status'],
        owner: ['Elena', 'Marcus', 'Priya', 'Noah'][i % 4],
        mrr: 10000 + i * 1250,
        updatedAt: new Date(Date.now() - i * 1000 * 60 * 45).toISOString(),
        summary: 'Latency and error budget alerts correlated in current deployment wave.',
    }));

    constructor() {
        this.load();
    }

    onSort(sort: SortState) {
        this.sort.set(sort);
    }

    onMultiSort(sorts: SortState[]) {
        this.sorts.set(sorts);
        this.load();
    }

    onPage(page: PaginationState) {
        this.page.set(page);
        this.load();
    }

    onFilter(filter: string) {
        this.filter.set(filter);
        this.page.update((state) => ({ ...state, pageIndex: 0 }));
        this.load();
    }

    private load() {
        this.loading.set(true);
        const query = this.filter().toLowerCase();
        const activeSorts = this.sort().direction ? [this.sort()] : [];
        const sorts = this.sorts().length > 0 ? this.sorts() : activeSorts;
        const { pageIndex, pageSize } = this.page();

        setTimeout(() => {
            let data = this.source;

            if (query) {
                data = data.filter(row =>
                    [row.id, row.account, row.service, row.owner, row.status, row.summary].join(' ').toLowerCase().includes(query)
                );
            }

            if (sorts.length > 0) {
                data = [...data].sort((a, b) => {
                    for (const sort of sorts) {
                        const key = sort.column as keyof OpsTicket;
                        const direction = sort.direction === 'desc' ? -1 : 1;
                        const aVal = a[key];
                        const bVal = b[key];
                        if (aVal === bVal) continue;
                        return (aVal > bVal ? 1 : -1) * direction;
                    }
                    return 0;
                });
            }

            this.total.set(data.length);
            this.rows.set(data.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize));
            this.loading.set(false);
        }, 500);
    }
}

const meta: Meta<DataTableComponent<User>> = {
    title: 'Data Table/DataTable',
    component: DataTableComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [DataTableComponent],
        }),
        applicationConfig({
            providers: [],
        }),
    ],
    parameters: {
        layout: 'padded',
    },
};

export default meta;
type Story = StoryObj<DataTableComponent<User>>;

const sampleData: User[] = [
    { id: '1', name: 'John Doe', email: 'john@example.com', role: 'Admin' },
    { id: '2', name: 'Jane Smith', email: 'jane@example.com', role: 'User' },
    { id: '3', name: 'Bob Johnson', email: 'bob@example.com', role: 'User' },
    { id: '4', name: 'Alice Williams', email: 'alice@example.com', role: 'Manager' },
    { id: '5', name: 'Charlie Brown', email: 'charlie@example.com', role: 'User' },
    { id: '6', name: 'Diana Prince', email: 'diana@example.com', role: 'Admin' },
    { id: '7', name: 'Eve Davis', email: 'eve@example.com', role: 'User' },
    { id: '8', name: 'Frank Miller', email: 'frank@example.com', role: 'Manager' },
    { id: '9', name: 'Grace Lee', email: 'grace@example.com', role: 'User' },
    { id: '10', name: 'Henry Wilson', email: 'henry@example.com', role: 'User' },
    { id: '11', name: 'Ivy Chen', email: 'ivy@example.com', role: 'Admin' },
    { id: '12', name: 'Jack Ryan', email: 'jack@example.com', role: 'User' },
];

const columns: ColumnDef<User>[] = [
    { accessorKey: 'id', header: 'ID', sticky: true, width: '60px' },
    { accessorKey: 'name', header: 'Name', enableSorting: true },
    { accessorKey: 'email', header: 'Email', enableSorting: true },
    { accessorKey: 'role', header: 'Role', enableSorting: true },
];

export const Default: Story = {
    render: (args) => ({
        props: args,
        template: `
            <div class="h-[600px] w-full p-4">
                <ui-data-table
                    [data]="data"
                    [columns]="columns"
                    [showToolbar]="showToolbar"
                    [showPagination]="showPagination"
                    [showRowBorders]="showRowBorders"
                    [showColumnBorders]="showColumnBorders"
                    [enableRowSelection]="enableRowSelection"
                />
            </div>
        `,
    }),
    args: {
        data: sampleData,
        columns: columns,
        showToolbar: true,
        showPagination: true,
        showRowBorders: true,
        showColumnBorders: true,
        enableRowSelection: true,
    },
};

export const WithoutToolbar: Story = {
    render: (args) => ({
        props: args,
        template: `
            <div class="h-[600px] w-full p-4">
                <ui-data-table
                    [data]="data"
                    [columns]="columns"
                    [showToolbar]="showToolbar"
                    [showPagination]="showPagination"
                    [enableRowSelection]="enableRowSelection"
                />
            </div>
        `,
    }),
    args: {
        ...Default.args,
        showToolbar: false,
    },
};

export const WithoutPagination: Story = {
    render: (args) => ({
        props: args,
        template: `
            <div class="h-[600px] w-full p-4">
                <ui-data-table
                    [data]="data"
                    [columns]="columns"
                    [showToolbar]="showToolbar"
                    [showPagination]="showPagination"
                    [enableRowSelection]="enableRowSelection"
                />
            </div>
        `,
    }),
    args: {
        ...Default.args,
        showPagination: false,
    },
};

export const ManyColumns: Story = {
    render: (args) => ({
        props: args,
        template: `
            <div class="h-[600px] max-w-[800px] p-4">
                <ui-data-table
                    [data]="data"
                    [columns]="columns"
                    [showToolbar]="showToolbar"
                    [showPagination]="showPagination"
                    [enableRowSelection]="enableRowSelection"
                />
            </div>
        `,
    }),
    args: {
        data: sampleData,
        columns: [
            ...columns,
            { accessorKey: 'role', header: 'Department' },
            { accessorKey: 'email', header: 'Contact' },
            { accessorKey: 'name', header: 'Full Name' },
            { accessorKey: 'id', header: 'Employee ID' },
            { accessorKey: 'role', header: 'Position' },
            { accessorKey: 'email', header: 'Email Address' },
            { accessorKey: 'name', header: 'Display Name' },
            { accessorKey: 'id', header: 'User ID' },
            { accessorKey: 'role', header: 'Team' },
            { accessorKey: 'email', header: 'Secondary Email' },
            { accessorKey: 'name', header: 'Nickname' },
            { accessorKey: 'id', header: 'Badge Number' },
        ],
        showToolbar: true,
        showPagination: true,
        enableRowSelection: true,
    },
};

export const LargeDataset: Story = {
    render: (args) => ({
        props: args,
        template: `
            <div class="h-[600px] w-full p-4">
                <ui-data-table
                    [data]="data"
                    [columns]="columns"
                    [showToolbar]="showToolbar"
                    [showPagination]="showPagination"
                    [enableRowSelection]="enableRowSelection"
                />
            </div>
        `,
    }),
    args: {
        data: Array.from({ length: 100 }, (_, i) => ({
            id: `${i + 1}`,
            name: `User ${i + 1}`,
            email: `user${i + 1}@example.com`,
            role: ['Admin', 'User', 'Manager'][i % 3],
        })),
        columns: columns,
        showToolbar: true,
        showPagination: true,
        enableRowSelection: true,
    },
};


export const WithColumnFilters: Story = {
    render: (args) => ({
        props: args,
        template: `
            <div class="h-[600px] w-full p-4">
                <ui-data-table
                    [data]="data"
                    [columns]="columns"
                    [showToolbar]="showToolbar"
                    [showPagination]="showPagination"
                />
            </div>
        `,
    }),
    args: {
        data: sampleData,
        columns: [
            {
                accessorKey: 'id',
                header: 'ID',
                sticky: true,
                width: '60px'
            },
            {
                accessorKey: 'name',
                header: 'Name',
                enableSorting: true,
                enableFiltering: true,
                filterComponent: TextFilterComponent
            },
            {
                accessorKey: 'email',
                header: 'Email',
                enableSorting: true,
                enableFiltering: true,
                filterComponent: TextFilterComponent
            },
            {
                accessorKey: 'role',
                header: 'Role',
                enableSorting: true
            },
        ],
        showToolbar: true,
        showPagination: true,
    },
};

export const CustomFilterFunction: Story = {
    render: (args) => ({
        props: args,
        template: `
            <div class="h-[600px] w-full p-4">
                <ui-data-table
                    [data]="data"
                    [columns]="columns"
                    [showToolbar]="showToolbar"
                    [showPagination]="showPagination"
                />
            </div>
        `,
    }),
    args: {
        data: sampleData,
        columns: [
            {
                accessorKey: 'id',
                header: 'ID',
                width: '60px'
            },
            {
                accessorKey: 'name',
                header: 'Name',
                enableSorting: true
            },
            {
                accessorKey: 'email',
                header: 'Email',
                enableSorting: true,
                enableFiltering: true,
                filterComponent: TextFilterComponent,
                // Custom filter: exact match on domain
                filterFn: (row: User, filterValue: unknown) => {
                    if (!filterValue || typeof filterValue !== 'string') return true;
                    const domain = row.email.split('@')[1];
                    return domain.toLowerCase().includes(filterValue.toLowerCase());
                }
            },
            {
                accessorKey: 'role',
                header: 'Role',
                enableSorting: true,
                enableFiltering: true,
                filterComponent: TextFilterComponent,
                // Custom filter: starts with
                filterFn: (row: User, filterValue: unknown) => {
                    if (!filterValue || typeof filterValue !== 'string') return true;
                    return row.role.toLowerCase().startsWith(filterValue.toLowerCase());
                }
            },
        ],
        showToolbar: true,
        showPagination: true,
    },
};

@Component({
    selector: 'app-custom-empty-state',
    standalone: true,
    template: `
        <div class="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <div class="mb-4 rounded-full bg-muted/50 p-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-8 w-8">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
            </div>
            <h3 class="text-lg font-semibold">No Data Found</h3>
            <p class="mb-4 text-sm text-balance">We couldn't find any results matching your filters.</p>
            <button class="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90">
                Clear Filters
            </button>
        </div>
    `,
})
class CustomEmptyStateComponent { }

export const WithCustomEmptyState: Story = {
    render: (args) => ({
        props: {
            ...args,
            emptyStateComponent: CustomEmptyStateComponent,
        },
        template: `
            <div class="h-[600px] w-full p-4">
                <ui-data-table
                    [data]="[]"
                    [columns]="columns"
                    [showToolbar]="showToolbar"
                    [showPagination]="showPagination"
                    [emptyStateComponent]="emptyStateComponent"
                />
            </div>
        `,
    }),
    args: {
        data: [],
        columns: columns,
        showToolbar: true,
        showPagination: true,
    },
};

export const AutoSizing: Story = {
    render: (args) => ({
        props: args,
        template: `
            <div class="h-[600px] w-full p-4">
                <ui-data-table
                    [data]="data"
                    [columns]="columns"
                    [showToolbar]="showToolbar"
                    [showPagination]="showPagination"
                    [enableRowSelection]="enableRowSelection"
                />
            </div>
        `,
    }),
    args: {
        data: sampleData,
        columns: [
            { accessorKey: 'id', header: 'ID', width: '80px' },
            { accessorKey: 'name', header: 'Name', width: 'auto' }, // Should fill
            { accessorKey: 'email', header: 'Email', width: 'auto' }, // Should fill
            { accessorKey: 'role', header: 'Role', width: '150px' },
        ],
        showToolbar: true,
        showPagination: true,
        enableRowSelection: true,
    },
};

export const ResizableColumns: Story = {
    render: (args) => ({
        props: {
            ...args,
            onColumnResize: (_event: unknown) => { /* resize handled externally */ },
        },
        template: `
            <div class="h-[600px] w-full p-4">
                <p class="text-sm text-muted-foreground mb-4">
                    Drag the right edge of column headers to resize columns.
                    Minimum width is enforced (50px default, 80px for Name column).
                </p>
                <ui-data-table
                    [data]="data"
                    [columns]="columns"
                    [showToolbar]="showToolbar"
                    [showPagination]="showPagination"
                    [enableRowSelection]="enableRowSelection"
                    [enableColumnResize]="enableColumnResize"
                    (columnResize)="onColumnResize($event)"
                />
            </div>
        `,
    }),
    args: {
        data: sampleData,
        columns: [
            { accessorKey: 'id', header: 'ID', width: '80px', minWidth: '60px' },
            { accessorKey: 'name', header: 'Name', enableSorting: true, width: '200px', minWidth: '80px' },
            { accessorKey: 'email', header: 'Email', enableSorting: true, width: '250px', minWidth: '100px' },
            { accessorKey: 'role', header: 'Role', enableSorting: true, width: '150px', minWidth: '80px' },
        ],
        showToolbar: true,
        showPagination: true,
        enableRowSelection: false,
        enableColumnResize: true,
    },
};

export const ColumnReordering: Story = {
    render: (args) => ({
        props: args,
        template: `
            <div class="h-[600px] w-full p-4">
                <p class="mb-4 text-sm text-muted-foreground">
                    Drag headers to reorder columns. ID stays fixed.
                </p>
                <ui-data-table
                    [data]="data"
                    [columns]="columns"
                    [showToolbar]="showToolbar"
                    [showPagination]="showPagination"
                    [enableColumnReorder]="enableColumnReorder"
                    [enableColumnResize]="enableColumnResize"
                />
            </div>
        `,
    }),
    args: {
        data: sampleData,
        columns: [
            { accessorKey: 'id', header: 'ID', width: '80px', sticky: true, enableReordering: false, enableHiding: false },
            { accessorKey: 'name', header: 'Name', enableSorting: true, width: '180px' },
            { accessorKey: 'email', header: 'Email', enableSorting: true, width: '260px' },
            { accessorKey: 'role', header: 'Role', enableSorting: true, width: '140px' },
        ],
        showToolbar: true,
        showPagination: true,
        enableColumnReorder: true,
        enableColumnResize: true,
    },
};

export const WithContextMenu: Story = {
    render: (args) => ({
        props: {
            ...args,
            onContextMenuAction: (action: string, row: unknown) => {
                const name = (row as Record<string, unknown>)?.['name'] ?? 'Unknown';
                alert(`Action: ${action}\nUser: ${name}`);
            }
        },
        moduleMetadata: {
            imports: [
                ContextMenuComponent,
                ContextMenuTriggerDirective,
                ContextMenuContentComponent,
                ContextMenuItemComponent,
                ContextMenuShortcutComponent,
                ContextMenuSeparatorComponent,
                ...ContextMenuIntegrations
            ]
        },
        template: `
            <div class="h-[600px] w-full p-4">
                <div class="flex items-center gap-2 mb-2">
                    <button class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 h-8 text-sm font-medium hover:bg-accent" (click)="grid.exportToCsv('users')">Export CSV</button>
                    <button class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 h-8 text-sm font-medium hover:bg-accent" (click)="grid.exportToExcel('users')">Export Excel</button>
                </div>
                <p class="text-sm text-muted-foreground mb-2">Click a cell then Ctrl+C to copy. Right-click for context menu.</p>
                <ui-data-table
                    #grid
                    [data]="data"
                    [columns]="columns"
                    [showToolbar]="showToolbar"
                    [showPagination]="showPagination"
                    [uiDataTableContextMenu]="tableContextMenu"
                />

                <ui-context-menu #tableContextMenu>
                    <ui-context-menu-content class="w-64">
                        <ui-context-menu-item (click)="grid.copyCellToClipboard()">
                            Copy Cell
                            <ui-context-menu-shortcut>⌘C</ui-context-menu-shortcut>
                        </ui-context-menu-item>
                        <ui-context-menu-separator />
                        <ui-context-menu-item (click)="onContextMenuAction('view', tableContextMenu.data())">
                            View Details
                            <ui-context-menu-shortcut>⌘V</ui-context-menu-shortcut>
                        </ui-context-menu-item>
                        <ui-context-menu-item (click)="onContextMenuAction('edit', tableContextMenu.data())">
                            Edit User
                            <ui-context-menu-shortcut>⌘E</ui-context-menu-shortcut>
                        </ui-context-menu-item>
                        <ui-context-menu-separator />
                        <ui-context-menu-item variant="destructive" (click)="onContextMenuAction('delete', tableContextMenu.data())">
                            Delete
                            <ui-context-menu-shortcut>⌘⌫</ui-context-menu-shortcut>
                        </ui-context-menu-item>
                    </ui-context-menu-content>
                </ui-context-menu>
            </div>
        `,
    }),
    args: {
        data: sampleData,
        columns: columns,
        showToolbar: true,
        showPagination: true,
    },
};

export const EnterpriseOperationsConsole: Story = {
    render: () => ({
        props: {},
        template: `<app-enterprise-ops-table-story />`,
        moduleMetadata: {
            imports: [EnterpriseOpsTableStoryComponent],
        },
    }),
};

export const WithRowActions: Story = {
    render: (args) => ({
        props: {
            ...args,
            rowActions: (ctx: RowActionContext<User>): ContextMenuItem[] => [
                {
                    label: `View ${ctx.row.name}`,
                    click: () => alert(`View: ${ctx.row.name} (index: ${ctx.index}, selected: ${ctx.selected})`),
                },
                {
                    label: 'Edit',
                    click: () => alert(`Edit: ${ctx.row.name}`),
                },
                { type: 'separator' },
                {
                    label: 'Delete',
                    disabled: ctx.row.role === 'Admin',
                    click: () => alert(`Delete: ${ctx.row.name}`),
                },
            ],
        },
        template: `
            <div class="h-[600px] w-full p-4">
                <p class="text-sm text-muted-foreground mb-2">Right-click a row or click the "..." button for actions. Admin users cannot be deleted.</p>
                <ui-data-table
                    [data]="data"
                    [columns]="columns"
                    [showToolbar]="showToolbar"
                    [showPagination]="showPagination"
                    [enableRowSelection]="enableRowSelection"
                    [rowActions]="rowActions"
                />
            </div>
        `,
    }),
    args: {
        data: sampleData,
        columns: columns,
        showToolbar: true,
        showPagination: true,
        enableRowSelection: true,
    },
};

export const WithRowActionsColumnOnly: Story = {
    render: (args) => ({
        props: {
            ...args,
            rowActions: (ctx: RowActionContext<User>): ContextMenuItem[] => [
                { label: 'View', click: () => alert(`View: ${ctx.row.name}`) },
                { label: 'Edit', click: () => alert(`Edit: ${ctx.row.name}`) },
            ],
        },
        template: `
            <div class="h-[600px] w-full p-4">
                <p class="text-sm text-muted-foreground mb-2">Only the action column (no context menu on right-click).</p>
                <ui-data-table
                    [data]="data"
                    [columns]="columns"
                    [showPagination]="showPagination"
                    [rowActions]="rowActions"
                    [showRowActionsContextMenu]="false"
                />
            </div>
        `,
    }),
    args: {
        data: sampleData,
        columns: columns,
        showPagination: true,
    },
};

export const WithRowActionsContextMenuOnly: Story = {
    render: (args) => ({
        props: {
            ...args,
            rowActions: (ctx: RowActionContext<User>): ContextMenuItem[] => [
                { label: 'View', click: () => alert(`View: ${ctx.row.name}`) },
                { label: 'Edit', click: () => alert(`Edit: ${ctx.row.name}`) },
            ],
        },
        template: `
            <div class="h-[600px] w-full p-4">
                <p class="text-sm text-muted-foreground mb-2">Only context menu on right-click (no action column).</p>
                <ui-data-table
                    [data]="data"
                    [columns]="columns"
                    [showPagination]="showPagination"
                    [rowActions]="rowActions"
                    [showRowActionsColumn]="false"
                />
            </div>
        `,
    }),
    args: {
        data: sampleData,
        columns: columns,
        showPagination: true,
    },
};

interface Order {
    id: string;
    customer: string;
    createdAt: Date;
    amount: number;
}

type OrderStory = StoryObj<DataTableComponent<Order>>;

const orderData: Order[] = Array.from({ length: 20 }, (_, i) => ({
    id: `ORD-${String(i + 1).padStart(3, '0')}`,
    customer: ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'][i % 5],
    createdAt: new Date(Date.now() - i * 1000 * 60 * 60 * 24),
    amount: Math.round((50 + Math.random() * 450) * 100) / 100,
}));

export const WithDateFilter: OrderStory = {
    render: (args) => ({
        props: args,
        template: `
            <div class="h-[600px] w-full p-4">
                <ui-data-table
                    [data]="data"
                    [columns]="columns"
                    [showToolbar]="showToolbar"
                    [showPagination]="showPagination"
                />
            </div>
        `,
    }),
    args: {
        data: orderData,
        columns: [
            { accessorKey: 'id', header: 'Order ID', width: '120px' },
            { accessorKey: 'customer', header: 'Customer', enableSorting: true },
            {
                accessorKey: 'createdAt',
                header: 'Created',
                enableSorting: true,
                enableFiltering: true,
                filterComponent: DataTableDateFilterComponent,
                filterComponentInputs: { title: 'Filter by date' },
                filterFn: (row: Order, filterValue: unknown) =>
                    dateFilterFn(row, filterValue as Date | null, (r) => r.createdAt),
                cell: (row: Order) => row.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            },
            {
                accessorKey: 'amount',
                header: 'Amount',
                enableSorting: true,
                cell: (row: Order) => `$${row.amount.toFixed(2)}`,
            },
        ] as ColumnDef<Order>[],
        showToolbar: true,
        showPagination: true,
    },
};

export const WithDateRangeFilter: OrderStory = {
    render: (args) => ({
        props: args,
        template: `
            <div class="h-[600px] w-full p-4">
                <ui-data-table
                    [data]="data"
                    [columns]="columns"
                    [showToolbar]="showToolbar"
                    [showPagination]="showPagination"
                />
            </div>
        `,
    }),
    args: {
        data: orderData,
        columns: [
            { accessorKey: 'id', header: 'Order ID', width: '120px' },
            { accessorKey: 'customer', header: 'Customer', enableSorting: true },
            {
                accessorKey: 'createdAt',
                header: 'Created',
                enableSorting: true,
                enableFiltering: true,
                filterComponent: DataTableDateRangeFilterComponent,
                filterComponentInputs: { title: 'Date range' },
                filterFn: (row: Order, filterValue: unknown) =>
                    dateRangeFilterFn(row, filterValue as DateRange | null, (r) => r.createdAt),
                cell: (row: Order) => row.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            },
            {
                accessorKey: 'amount',
                header: 'Amount',
                enableSorting: true,
                cell: (row: Order) => `$${row.amount.toFixed(2)}`,
            },
        ] as ColumnDef<Order>[],
        showToolbar: true,
        showPagination: true,
    },
};

// --- Virtual Scroll Performance Story ---

@Component({
    selector: 'app-virtual-status-cell',
    template: `
        <div class="flex items-center gap-2">
            <div class="h-2 w-2 rounded-full"
                 [class.bg-green-500]="status() === 'active'"
                 [class.bg-red-500]="status() === 'inactive'"
                 [class.bg-yellow-500]="status() === 'pending'">
            </div>
            <span class="text-xs">{{ status() }}</span>
        </div>
    `,
    changeDetection: ChangeDetectionStrategy.OnPush,
})
class VirtualStatusCellComponent {
    readonly status = input<string>('active');
}

@Component({
    selector: 'app-virtual-toggle-cell',
    template: `
        <label class="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" [checked]="enabled()" (change)="onToggle()" class="h-3 w-3" />
            <span class="text-xs">{{ enabled() ? 'On' : 'Off' }}</span>
        </label>
    `,
    changeDetection: ChangeDetectionStrategy.OnPush,
})
class VirtualToggleCellComponent {
    readonly enabled = input(false);
    readonly toggled = output<boolean>();
    private readonly state = signal(false);

    onToggle() {
        this.state.update(v => !v);
        this.toggled.emit(this.state());
    }
}

interface VirtualRow {
    id: number;
    name: string;
    [key: string]: unknown;
}

function generateVirtualData(rowCount: number, colCount: number): VirtualRow[] {
    const statuses = ['active', 'inactive', 'pending'];
    const data: VirtualRow[] = [];
    for (let r = 0; r < rowCount; r++) {
        const row: VirtualRow = {
            id: r + 1,
            name: `Row ${r + 1}`,
        };
        for (let c = 0; c < colCount; c++) {
            row[`col${c}`] = `R${r + 1}C${c}`;
        }
        row['status'] = statuses[r % 3];
        row['enabled'] = r % 2 === 0;
        data.push(row);
    }
    return data;
}

function generateVirtualColumns(colCount: number): ColumnDef<VirtualRow>[] {
    const cols: ColumnDef<VirtualRow>[] = [
        { accessorKey: 'id', header: 'ID', width: '80px', sticky: true },
        { accessorKey: 'name', header: 'Name', width: '150px', sticky: true },
    ];

    for (let c = 0; c < colCount; c++) {
        if (c < 25) {
            cols.push({
                accessorKey: `col${c}`,
                header: `Status ${c}`,
                width: '120px',
                component: VirtualStatusCellComponent,
                componentInputs: (row: VirtualRow) => ({ status: row['status'] }),
            });
        } else if (c < 50) {
            cols.push({
                accessorKey: `col${c}`,
                header: `Toggle ${c}`,
                width: '100px',
                component: VirtualToggleCellComponent,
                componentInputs: (row: VirtualRow) => ({ enabled: row['enabled'] }),
            });
        } else if (c < 55) {
            cols.push({
                accessorKey: `col${c}`,
                header: `Image ${c}`,
                width: '80px',
                cell: (_row: VirtualRow) => '🖼️',
            });
        } else {
            cols.push({
                accessorKey: `col${c}`,
                header: `Col ${c}`,
                width: `${80 + (c % 5) * 20}px`,
                cell: (row: VirtualRow) => String(row[`col${c}`] ?? ''),
            });
        }
    }

    return cols;
}

const virtualData = generateVirtualData(10000, 100);
const virtualColumns = generateVirtualColumns(100);

type VirtualStory = StoryObj<DataTableComponent<VirtualRow>>;

export const VirtualScrollPerformance: VirtualStory = {
    render: (args) => ({
        props: args,
        template: `
            <div class="h-[700px] w-full p-4">
                <h3 class="mb-2 text-sm text-muted-foreground">10,000 rows × 100+ columns (50 stateful components) — Virtual Scroll</h3>
                <ui-data-table
                    [data]="data"
                    [columns]="columns"
                    [showToolbar]="showToolbar"
                    [showPagination]="showPagination"
                    [enableVirtualScroll]="enableVirtualScroll"
                    [virtualRowHeight]="virtualRowHeight"
                    [virtualRowBuffer]="virtualRowBuffer"
                    [virtualColumnBuffer]="virtualColumnBuffer"
                    [virtualRecycleComponents]="virtualRecycleComponents"
                    [virtualAutoThreshold]="virtualAutoThreshold"
                />
            </div>
        `,
    }),
    args: {
        data: virtualData,
        columns: virtualColumns as ColumnDef<VirtualRow>[],
        showToolbar: true,
        showPagination: false,
        enableVirtualScroll: true,
        virtualRowHeight: 40,
        virtualRowBuffer: 5,
        virtualColumnBuffer: 3,
        virtualRecycleComponents: false,
        virtualAutoThreshold: { rows: 500, columns: 20 },
    } as Record<string, unknown>,
};

const editableColumns: ColumnDef<User>[] = [
    { accessorKey: 'id', header: 'ID', width: '70px' },
    {
        accessorKey: 'name',
        header: 'Name',
        editable: true,
        editType: 'text',
        editValidator: (val) => String(val).trim().length > 0 || 'Name is required',
        valueSetter: (row, val) => ({ ...row, name: String(val) }),
    },
    {
        accessorKey: 'email',
        header: 'Email',
        editable: true,
        editType: 'text',
        editValidator: (val) => String(val).includes('@') || 'Email must contain "@"',
        valueSetter: (row, val) => ({ ...row, email: String(val) }),
    },
    {
        accessorKey: 'role',
        header: 'Role',
        editable: true,
        editType: 'select',
        editOptions: [
            { label: 'Admin', value: 'Admin' },
            { label: 'User', value: 'User' },
            { label: 'Manager', value: 'Manager' },
        ],
        valueSetter: (row, val) => ({ ...row, role: String(val) }),
    },
];

export const InlineEditing: Story = {
    render: (args) => ({
        props: args,
        template: `
            <div class="h-[600px] w-full p-4">
                <p class="mb-2 text-sm text-muted-foreground">
                    Focus a cell and press Enter (or double-click) to edit. Committed edits are written
                    back through each column's valueSetter. The Name column rejects empty values and
                    Email requires an "@" — invalid edits show an inline error and emit (editError).
                </p>
                <ui-data-table
                    [(data)]="data"
                    [columns]="columns"
                    [showToolbar]="false"
                    [showPagination]="false"
                />
            </div>
        `,
    }),
    args: {
        data: sampleData.slice(0, 6),
        columns: editableColumns,
    },
};

interface PerfRow {
    rep: string;
    sales: number;
    growth: number;
    score: number;
}

const perfRows: PerfRow[] = [
    { rep: 'Alice', sales: 92000, growth: 0.24, score: 96 },
    { rep: 'Bob', sales: 41000, growth: -0.08, score: 58 },
    { rep: 'Charlie', sales: 67000, growth: 0.11, score: 74 },
    { rep: 'Dora', sales: 15000, growth: -0.31, score: 33 },
    { rep: 'Evan', sales: 78000, growth: 0.05, score: 81 },
];

function growthIcon(value: unknown): CellIcon | undefined {
    const n = value as number;
    if (n > 0) return { icon: '▲', class: 'text-green-600' };
    if (n < 0) return { icon: '▼', class: 'text-red-600' };
    return undefined;
}

const perfColumns: ColumnDef<PerfRow>[] = [
    { accessorKey: 'rep', header: 'Rep' },
    {
        accessorKey: 'sales',
        header: 'Sales',
        cell: (r) => `$${r.sales.toLocaleString()}`,
        // Inline data bar scaled to the column max.
        dataBar: { min: 0, max: 100000, color: 'color-mix(in srgb, var(--primary) 30%, transparent)' },
    },
    {
        accessorKey: 'growth',
        header: 'Growth',
        cell: (r) => `${(r.growth * 100).toFixed(0)}%`,
        // Value-driven text color + a trend glyph.
        cellClassRules: [
            { when: (v) => (v as number) > 0, class: 'font-medium' },
            { when: (v) => (v as number) < 0, class: 'font-medium' },
        ],
        iconSet: growthIcon,
    },
    {
        accessorKey: 'score',
        header: 'Score',
        // Heat-map background interpolated white -> emerald across 0..100.
        colorScale: { min: 0, max: 100, from: 'transparent', to: 'color-mix(in srgb, #10b981 45%, transparent)' },
    },
];

export const ConditionalFormatting: StoryObj<DataTableComponent<PerfRow>> = {
    render: (args) => ({
        props: args,
        template: `
            <div class="w-full p-4">
                <p class="mb-2 text-sm text-muted-foreground">
                    Per-column conditional formatting: <strong>data bars</strong> on Sales,
                    value-driven <strong>icons + classes</strong> on Growth, and a
                    <strong>color scale</strong> heat-map on Score — all declarative on the ColumnDef,
                    no custom cell components.
                </p>
                <ui-data-table [data]="data" [columns]="columns" [showToolbar]="false" [showPagination]="false" />
            </div>
        `,
    }),
    args: {
        data: perfRows,
        columns: perfColumns,
    },
};
