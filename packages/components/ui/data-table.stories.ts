import { Meta, StoryObj, moduleMetadata, applicationConfig } from '@storybook/angular';
import { DataTableComponent } from './data-table/data-table.component';
import { ColumnDef, PaginationState, SortState, DataTableLoadingVisibility } from './data-table/data-table.types';
import { importProvidersFrom, Component, ChangeDetectionStrategy, output, input, signal } from '@angular/core';
import { InputComponent } from './input.component';
import { ContextMenuComponent, ContextMenuTriggerDirective, ContextMenuContentComponent, ContextMenuItemComponent, ContextMenuShortcutComponent, ContextMenuSeparatorComponent } from './context-menu.component';
import { ContextMenuIntegrations } from './context-menu-integrations';

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

    private source: OpsTicket[] = Array.from({ length: 120 }, (_, i) => ({
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
        const sorts = this.sorts().length > 0 ? this.sorts() : (this.sort().direction ? [this.sort()] : []);
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
                        return (aVal! > bVal! ? 1 : -1) * direction;
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
            onColumnResize: (event: any) => console.log('Column resized:', event),
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

export const WithContextMenu: Story = {
    render: (args) => ({
        props: {
            ...args,
            onContextMenuAction: (action: string, row: any) => {
                console.log(`Action: ${action}`, row);
                alert(`Action: ${action}\nUser: ${row?.name || 'Unknown'}`);
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
                <ui-data-table
                    [data]="data"
                    [columns]="columns"
                    [showToolbar]="showToolbar"
                    [showPagination]="showPagination"
                    [uiDataTableContextMenu]="tableContextMenu"
                />

                <ui-context-menu #tableContextMenu>
                    <ui-context-menu-content class="w-64">
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
