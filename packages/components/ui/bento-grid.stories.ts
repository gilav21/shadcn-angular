import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { BentoGridComponent, BentoGridItemComponent, DashboardItem } from './bento-grid.component';

const meta: Meta<BentoGridComponent> = {
    title: 'UI/BentoGrid',
    component: BentoGridComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [BentoGridComponent, BentoGridItemComponent],
        }),
    ],
    argTypes: {
        cols: {
            control: 'number',
        },
        rowHeight: {
            control: 'text',
        },
        gap: {
            control: 'text',
        },
        showBorders: {
            control: 'boolean',
        },
        editable: {
            control: 'boolean',
        },
    },
    args: {
        cols: 4,
        rowHeight: '120px',
        gap: '1rem',
        showBorders: true,
        editable: false,
    },
};

export default meta;
type Story = StoryObj<BentoGridComponent>;

const sampleItems: DashboardItem[] = [
    { id: '1', x: 1, y: 1, cols: 2, rows: 2, content: 'Featured Item' },
    { id: '2', x: 3, y: 1, cols: 1, rows: 1, content: 'Item 2' },
    { id: '3', x: 4, y: 1, cols: 1, rows: 1, content: 'Item 3' },
    { id: '4', x: 3, y: 2, cols: 2, rows: 1, content: 'Item 4' },
    { id: '5', x: 1, y: 3, cols: 1, rows: 1, content: 'Item 5' },
    { id: '6', x: 2, y: 3, cols: 3, rows: 1, content: 'Wide Item 6' },
];

export const Default: Story = {
    args: {
        items: sampleItems,
    },
    render: (args) => ({
        props: args,
        template: `
            <div style="height: 500px;">
                <ui-bento-grid
                    [items]="items"
                    [cols]="cols"
                    [rowHeight]="rowHeight"
                    [gap]="gap"
                    [showBorders]="showBorders"
                    [editable]="editable"
                />
            </div>
        `,
    }),
};

export const ThreeByThreeGrid: Story = {
    args: {
        items: [
            { id: 'a', x: 1, y: 1, cols: 1, rows: 1, content: 'Cell 1' },
            { id: 'b', x: 2, y: 1, cols: 1, rows: 1, content: 'Cell 2' },
            { id: 'c', x: 3, y: 1, cols: 1, rows: 1, content: 'Cell 3' },
            { id: 'd', x: 1, y: 2, cols: 1, rows: 1, content: 'Cell 4' },
            { id: 'e', x: 2, y: 2, cols: 1, rows: 1, content: 'Cell 5' },
            { id: 'f', x: 3, y: 2, cols: 1, rows: 1, content: 'Cell 6' },
            { id: 'g', x: 1, y: 3, cols: 1, rows: 1, content: 'Cell 7' },
            { id: 'h', x: 2, y: 3, cols: 1, rows: 1, content: 'Cell 8' },
            { id: 'i', x: 3, y: 3, cols: 1, rows: 1, content: 'Cell 9' },
        ] as DashboardItem[],
        cols: 3,
        rowHeight: '100px',
        gap: '0.75rem',
    },
    render: (args) => ({
        props: args,
        template: `
            <div style="height: 400px;">
                <ui-bento-grid
                    [items]="items"
                    [cols]="cols"
                    [rowHeight]="rowHeight"
                    [gap]="gap"
                    [showBorders]="showBorders"
                    [editable]="editable"
                />
            </div>
        `,
    }),
};

export const WithContentProjection: Story = {
    render: () => ({
        template: `
            <div style="height: 400px;" class="grid grid-cols-3 gap-4">
                <ui-bento-grid-item [span]="2" [rowSpan]="2">
                    <h3 class="text-lg font-semibold">Featured</h3>
                    <p class="text-muted-foreground">This is a large featured item spanning 2 columns and 2 rows.</p>
                </ui-bento-grid-item>
                <ui-bento-grid-item>
                    <h3 class="font-semibold">Small Item</h3>
                    <p class="text-sm text-muted-foreground">A single cell item.</p>
                </ui-bento-grid-item>
                <ui-bento-grid-item>
                    <h3 class="font-semibold">Another Item</h3>
                    <p class="text-sm text-muted-foreground">Another single cell item.</p>
                </ui-bento-grid-item>
            </div>
        `,
    }),
};

export const NoBorders: Story = {
    args: {
        items: sampleItems,
        showBorders: false,
    },
    render: (args) => ({
        props: args,
        template: `
            <div style="height: 500px;">
                <ui-bento-grid
                    [items]="items"
                    [cols]="cols"
                    [rowHeight]="rowHeight"
                    [gap]="gap"
                    [showBorders]="showBorders"
                    [editable]="editable"
                />
            </div>
        `,
    }),
};

export const Editable: Story = {
    args: {
        items: sampleItems,
        editable: true,
    },
    render: (args) => ({
        props: args,
        template: `
            <div style="height: 500px;">
                <ui-bento-grid
                    [items]="items"
                    [cols]="cols"
                    [rowHeight]="rowHeight"
                    [gap]="gap"
                    [showBorders]="showBorders"
                    [editable]="editable"
                />
            </div>
        `,
    }),
};
