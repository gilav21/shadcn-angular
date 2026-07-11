import { Meta, StoryObj } from '@storybook/angular';
import { HeatmapComponent } from './heatmap.component';
import { HeatmapCell, ChartDirection } from '../../lib/chart.types';

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const hours = ['9am', '12pm', '3pm', '6pm'];
const data: HeatmapCell[] = days.flatMap((row, ri) =>
    hours.map((col, ci) => ({ row, col, value: ((ri * 7 + ci * 3) % 10) + 1 })),
);

const meta: Meta<HeatmapComponent> = {
    title: 'Charts/Heatmap',
    component: HeatmapComponent,
    tags: ['autodocs'],
    argTypes: {
        data: { control: 'object', description: 'Array of { row, col, value } cells to render.' },
        width: { control: 'number', description: 'Fallback pixel width used before the container has been measured.' },
        maxCellSize: { control: 'number', description: 'Maximum square cell size in pixels.' },
        minCellSize: { control: 'number', description: 'Minimum square cell size in pixels.' },
        fromColor: { control: 'color', description: 'Color at the low end of the value domain.' },
        toColor: { control: 'color', description: 'Color at the high end of the value domain.' },
        showValues: { control: 'boolean', description: 'Renders the numeric value inside each cell.' },
        showLegend: { control: 'boolean', description: 'Shows the low-to-high color legend below the grid.' },
        showTooltip: { control: 'boolean', description: 'Shows a tooltip on cell hover/focus.' },
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
        title: { control: 'text', description: 'Accessible title, prefixed onto the aria-label.' },
        dir: {
            control: 'select',
            options: ['auto', 'ltr', 'rtl'],
            description: 'Reading direction for the chart.',
        },
        cellHover: { control: false, description: 'Emits the hovered/focused cell, or null on leave.' },
    },
    args: {
        data,
        width: 460,
        maxCellSize: 52,
        minCellSize: 18,
        fromColor: 'hsl(214, 95%, 93%)',
        toColor: 'hsl(221, 83%, 40%)',
        showValues: false,
        showLegend: true,
        showTooltip: true,
        class: '',
        title: undefined,
        dir: 'auto' as ChartDirection,
    },
};

export default meta;
type Story = StoryObj<HeatmapComponent>;

const TEMPLATE = `
    <ui-heatmap
        [data]="data" [width]="width" [maxCellSize]="maxCellSize" [minCellSize]="minCellSize"
        [fromColor]="fromColor" [toColor]="toColor"
        [showValues]="showValues" [showLegend]="showLegend" [showTooltip]="showTooltip"
        [class]="class" [title]="title" [dir]="dir" />`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Default: Story = {
    args: { data, width: 460 },
    render,
};

export const WithValues: Story = {
    args: { data, width: 460, showValues: true },
    render,
};

export const CustomColorScale: Story = {
    args: { data, width: 460, fromColor: '#fef3c7', toColor: '#b45309' },
    render,
};

export const NoLegendOrTooltip: Story = {
    args: { data, width: 460, showLegend: false, showTooltip: false },
    render,
};

export const WithTitle: Story = {
    args: { data, width: 460, title: 'Weekly activity' },
    render,
};
