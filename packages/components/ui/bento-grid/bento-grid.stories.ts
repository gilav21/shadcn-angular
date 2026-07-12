import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { Component, input, output } from '@angular/core';
import { BentoGridComponent, DashboardItem } from './bento-grid.component';
import { BentoGridItemComponent } from './sub/bento-grid-item.component';

/**
 * A dynamically-projected demo widget used to show `DashboardItem.content`
 * accepting an arbitrary `Type<unknown>` (not just plain text).
 */
@Component({
    selector: 'bento-grid-stat-widget-demo',
    template: `
        <div class="flex h-full w-full flex-col justify-between">
            <span class="text-xs font-medium text-muted-foreground">{{ label() }}</span>
            <span class="text-2xl font-bold">{{ value() }}</span>
            <button type="button" class="self-start text-xs text-primary underline" (click)="dismiss.emit()">
                Dismiss
            </button>
        </div>
    `,
})
class BentoGridStatWidgetDemoComponent {
    readonly label = input('Revenue');
    readonly value = input('$12,4K');
    readonly dismiss = output<void>();
}

const meta: Meta<BentoGridComponent> = {
    title: 'UI/BentoGrid',
    component: BentoGridComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [BentoGridComponent, BentoGridItemComponent, BentoGridStatWidgetDemoComponent],
        }),
    ],
    argTypes: {
        items: {
            control: 'object',
            description: 'Data-driven grid items. `content` may be a string or an Angular `Type<unknown>` for dynamic component projection.',
        },
        cols: { control: 'number', description: 'Number of columns in the grid.' },
        rowHeight: { control: 'text', description: 'Row height (number treated as px, or any CSS length).' },
        columnWidth: { control: 'text', description: 'Column width; `1fr` (default) distributes evenly.' },
        gap: { control: 'text', description: 'Gap between grid cells.' },
        showBorders: { control: 'boolean', description: 'Shows a border/shadow around each item even when not editable.' },
        borderRadius: { control: 'text', description: 'Border radius applied to each item.' },
        itemPadding: { control: 'text', description: 'Inner padding applied to each item.' },
        editable: { control: 'boolean', description: 'Enables drag, resize, selection, merge and the context menu.' },
        resizeHandleType: {
            control: 'select',
            options: ['corners', 'edges', 'both'],
            description: 'Which resize handles render on each item while editable (corner grips, edge bars, or both).',
        },
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
    },
    args: {
        cols: 4,
        rowHeight: '120px',
        columnWidth: '1fr',
        gap: '1rem',
        showBorders: true,
        borderRadius: '0.75rem',
        itemPadding: '1rem',
        editable: false,
        resizeHandleType: 'both',
        class: '',
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

const TEMPLATE = `
    <div style="height: 500px;">
        <ui-bento-grid
            [items]="items" [cols]="cols" [rowHeight]="rowHeight" [columnWidth]="columnWidth"
            [gap]="gap" [showBorders]="showBorders" [borderRadius]="borderRadius" [itemPadding]="itemPadding"
            [editable]="editable" [resizeHandleType]="resizeHandleType" [class]="class">
        </ui-bento-grid>
    </div>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: { ...args, items: args.items ?? sampleItems },
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { args: { items: sampleItems }, render };

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
        template: TEMPLATE,
    }),
};

export const NoBorders: Story = {
    args: { showBorders: false },
    render,
};

/** Data-driven simple mode: items are supplied as a plain array of `DashboardItem`. */
export const DataDrivenItems: Story = {
    args: { items: sampleItems },
    render,
};

/**
 * Template-projection mode: `ui-bento-grid-item` is composed directly for
 * full control over each cell's markup instead of driving the grid from
 * the `items` input.
 */
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

/**
 * `DashboardItem.content` accepts an Angular `Type<unknown>` alongside its
 * `inputs`/`outputs` maps, so grid cells can host live, dynamic components
 * (not just static text) — rendered via `uiComponentOutlet` under the hood.
 */
export const DynamicComponentContent: Story = {
    args: {
        items: [
            {
                id: 'w1', x: 1, y: 1, cols: 2, rows: 1,
                content: BentoGridStatWidgetDemoComponent,
                inputs: { label: 'Monthly Revenue', value: '$48,912' },
            },
            {
                id: 'w2', x: 3, y: 1, cols: 1, rows: 1,
                content: BentoGridStatWidgetDemoComponent,
                inputs: { label: 'Active Users', value: '2,381' },
            },
            { id: 'w3', x: 4, y: 1, cols: 1, rows: 1, content: 'Plain text cell' },
        ] as DashboardItem[],
    },
    render,
};

/** Corner-only resize grips, visible while hovering an editable item. */
export const ResizeHandlesCorners: Story = {
    args: { items: sampleItems, editable: true, resizeHandleType: 'corners' },
    render,
};

/** Edge resize bars along all four sides of an editable item. */
export const ResizeHandlesEdges: Story = {
    args: { items: sampleItems, editable: true, resizeHandleType: 'edges' },
    render,
};

/** Both corner grips and edge bars — the default when `editable` is true. */
export const ResizeHandlesBoth: Story = {
    args: { items: sampleItems, editable: true, resizeHandleType: 'both' },
    render,
};

export const Editable: Story = {
    args: { items: sampleItems, editable: true },
    render,
};
