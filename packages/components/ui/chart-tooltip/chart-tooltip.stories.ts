import { Meta, StoryObj } from '@storybook/angular';
import { ChartTooltipComponent, ChartTooltipRow } from './chart-tooltip.component';

// The tooltip is absolutely positioned, so every story wraps it in a
// `relative` box that stands in for a chart plot area. Every input is exposed
// as an interactive control (argTypes) with a sensible default (args); the
// Playground binds all of them so the Controls panel drives the live component.
const SAMPLE_ROWS: ChartTooltipRow[] = [
    { label: 'Desktop', value: '1,204', color: 'var(--chart-1, #2563eb)' },
    { label: 'Mobile', value: '842', color: 'var(--chart-2, #16a34a)' },
    { label: 'Tablet', value: '318', color: 'var(--chart-3, #f59e0b)' },
];

const meta: Meta<ChartTooltipComponent> = {
    title: 'UI/ChartTooltip',
    component: ChartTooltipComponent,
    tags: ['autodocs'],
    argTypes: {
        visible: { control: 'boolean', description: 'Shows or hides the tooltip.' },
        x: { control: 'number', description: 'Left offset in px, relative to the positioned ancestor.' },
        y: { control: 'number', description: 'Top offset in px, relative to the positioned ancestor.' },
        title: { control: 'text', description: 'Optional heading rendered above the rows.' },
        rows: { control: 'object', description: 'Rows of `{ label, value, color? }` to display.' },
        flipX: { control: 'boolean', description: 'Flip left of the anchor when near the right edge.' },
        flipY: { control: 'boolean', description: 'Flip above the anchor when near the bottom edge.' },
        class: { control: 'text', description: 'Extra classes merged onto the tooltip.' },
    },
    args: {
        visible: true,
        x: 40,
        y: 40,
        title: 'March 2024',
        rows: SAMPLE_ROWS,
        flipX: false,
        flipY: false,
        class: '',
    },
};

export default meta;
type Story = StoryObj<ChartTooltipComponent>;

const TEMPLATE = `
    <div class="relative h-64 w-full rounded-md border bg-muted/30">
        <ui-chart-tooltip
            [visible]="visible" [x]="x" [y]="y" [title]="title"
            [rows]="rows" [flipX]="flipX" [flipY]="flipY" [class]="class" />
    </div>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const WithTitle: Story = {
    args: { title: 'Revenue by device' },
    render,
};

export const WithoutTitle: Story = {
    args: { title: undefined },
    render,
};

export const SingleRow: Story = {
    args: {
        title: 'Total',
        rows: [{ label: 'Sales', value: '2,364', color: 'var(--chart-1, #2563eb)' }],
    },
    render,
};

export const NoColorSwatches: Story = {
    args: {
        title: 'Plain rows',
        rows: [
            { label: 'Min', value: '12' },
            { label: 'Max', value: '98' },
        ],
    },
    render,
};

export const FlippedX: Story = {
    args: { x: 260, flipX: true },
    render,
};

export const FlippedY: Story = {
    args: { y: 220, flipY: true },
    render,
};

export const Hidden: Story = {
    args: { visible: false },
    render,
};
