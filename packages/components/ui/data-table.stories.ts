import { Meta, StoryObj, moduleMetadata, applicationConfig } from '@storybook/angular';
import { DataTableComponent } from './data-table/data-table.component';
import { ColumnDef } from './data-table/data-table.types';
import { LucideAngularModule, ArrowDown, ArrowUp, ChevronsUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Check } from 'lucide-angular';
import { importProvidersFrom, Component, ChangeDetectionStrategy, output } from '@angular/core';
import { InputComponent } from './input.component';

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

const meta: Meta<DataTableComponent<User>> = {
    title: 'Data Table/DataTable',
    component: DataTableComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [DataTableComponent],
        }),
        applicationConfig({
            providers: [
                importProvidersFrom(
                    LucideAngularModule.pick({
                        ArrowDown,
                        ArrowUp,
                        ChevronsUpDown,
                        ChevronLeft,
                        ChevronRight,
                        ChevronsLeft,
                        ChevronsRight,
                        Check,
                    })
                ),
            ],
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
