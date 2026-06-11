import { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { DataTableColumnHeaderComponent } from './data-table-column-header.component';
import { SortDirection } from '../data-table.types';

const meta: Meta<DataTableColumnHeaderComponent> = {
    title: 'UI/DataTable/ColumnHeader',
    component: DataTableColumnHeaderComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [DataTableColumnHeaderComponent],
        }),
    ],
    argTypes: {
        title: { control: 'text' },
        column: { control: 'text' },
        direction: {
            control: 'select',
            options: [null, 'asc', 'desc', ''],
        },
        enableSorting: { control: 'boolean' },
        sortIndex: { control: 'number' },
    },
    args: {
        title: 'Name',
        column: 'name',
        direction: null as SortDirection,
        enableSorting: true,
        sortIndex: null,
    },
};

export default meta;
type Story = StoryObj<DataTableColumnHeaderComponent>;

export const Default: Story = {
    render: (args) => ({
        props: {
            ...args,
            onSort: (_direction: SortDirection) => {
                // sort handled externally
            },
        },
        template: `
            <div class="p-4">
                <ui-data-table-column-header
                    [title]="title"
                    [column]="column"
                    [direction]="direction"
                    [enableSorting]="enableSorting"
                    [sortIndex]="sortIndex"
                    (sort)="onSort($event)"
                />
            </div>
        `,
    }),
};

export const SortedAscending: Story = {
    args: {
        title: 'Email',
        column: 'email',
        direction: 'asc',
    },
};

export const SortedDescending: Story = {
    args: {
        title: 'Created At',
        column: 'createdAt',
        direction: 'desc',
    },
};

export const SortingDisabled: Story = {
    args: {
        title: 'Actions',
        column: 'actions',
        enableSorting: false,
    },
};

export const WithSortIndex: Story = {
    args: {
        title: 'Name',
        column: 'name',
        direction: 'asc',
        sortIndex: 0,
    },
};

export const MultipleHeaders: Story = {
    render: () => ({
        props: {
            headers: [
                { title: 'Name', column: 'name', direction: 'asc' as SortDirection, sortIndex: 0 },
                { title: 'Email', column: 'email', direction: null as SortDirection, sortIndex: null },
                { title: 'Role', column: 'role', direction: 'desc' as SortDirection, sortIndex: 1 },
                { title: 'Actions', column: 'actions', enableSorting: false },
            ],
        },
        template: `
            <div class="flex gap-8 p-4">
                @for (header of headers; track header.column) {
                    <ui-data-table-column-header
                        [title]="header.title"
                        [column]="header.column"
                        [direction]="header.direction ?? null"
                        [enableSorting]="header.enableSorting ?? true"
                        [sortIndex]="header.sortIndex ?? null"
                    />
                }
            </div>
        `,
    }),
};
