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
        title: { control: 'text', description: 'Header label text shown in the column header.' },
        column: { control: 'text', description: 'Column id this header sorts/identifies.' },
        direction: {
            control: 'select',
            options: [null, 'asc', 'desc', ''],
            description: 'Current sort direction: `asc`, `desc`, or `null` for unsorted.',
        },
        enableSorting: { control: 'boolean', description: 'Whether clicking the header toggles sorting.' },
        sortIndex: { control: 'number', description: 'Position of this column in a multi-column sort (or `null`).' },
        class: { control: 'text', description: 'Extra classes merged onto the header container.' },
    },
    args: {
        title: 'Name',
        column: 'name',
        direction: null as SortDirection,
        enableSorting: true,
        sortIndex: null,
        class: '',
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
                    [class]="class"
                    (sort)="onSort($event)"
                />
            </div>
        `,
    }),
};

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = Default;

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
