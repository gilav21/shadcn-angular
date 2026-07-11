import { Meta, StoryObj } from '@storybook/angular';
import { PieChartComponent } from './pie-chart.component';
import { ChartDataPoint } from '../../lib/chart.types';

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct visual mode.
const meta: Meta<PieChartComponent> = {
    title: 'Charts/Pie Chart',
    component: PieChartComponent,
    tags: ['autodocs'],
    argTypes: {
        data: { control: 'object', description: 'Chart data points (`{ name, value, color? }[]`).' },
        size: { control: 'number', description: 'SVG viewBox size (width and height), in px.', min: 100, max: 600 },
        innerRadius: { control: { type: 'range', min: 0, max: 0.9, step: 0.05 }, description: 'Inner radius as a fraction of the outer radius — `0` is a full pie, `>0` renders a donut.' },
        showLabels: { control: 'boolean', description: 'Shows percentage labels outside each slice.' },
        showLegend: { control: 'boolean', description: 'Shows the color legend.' },
        legendPosition: {
            control: 'select',
            options: ['top', 'bottom', 'left', 'right', 'none'],
            description: 'Placement of the legend relative to the chart.',
        },
        showTooltip: { control: 'boolean', description: 'Shows a tooltip while hovering a slice.' },
        animated: { control: 'boolean', description: 'Animates slice transitions.' },
        class: { control: 'text', description: 'Extra classes merged onto the host container.' },
        title: { control: 'text', description: 'Accessible chart title used to build the SVG aria-label.' },
        sliceClick: { control: false, description: 'Emits `{ point, index, event }` when a slice is clicked.' },
        sliceHover: { control: false, description: 'Emits `{ point, index }` on hover, or `null` on leave.' },
    },
    args: {
        data: [
            { name: 'Chrome', value: 65 },
            { name: 'Safari', value: 18 },
            { name: 'Firefox', value: 9 },
            { name: 'Edge', value: 8 },
        ],
        size: 300,
        innerRadius: 0,
        showLabels: true,
        showLegend: true,
        legendPosition: 'right',
        showTooltip: true,
        animated: true,
        class: '',
        title: undefined,
    },
};

export default meta;
type Story = StoryObj<PieChartComponent>;

const TEMPLATE = `
    <ui-pie-chart
        [data]="data" [size]="size" [innerRadius]="innerRadius"
        [showLabels]="showLabels" [showLegend]="showLegend" [legendPosition]="legendPosition"
        [showTooltip]="showTooltip" [animated]="animated"
        [class]="class" [title]="title" />`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Donut: Story = {
    args: { innerRadius: 0.6 },
    render,
};

export const NoLabels: Story = {
    args: { showLabels: false },
    render,
};

export const NoLegend: Story = {
    args: { showLegend: false, legendPosition: 'none' },
    render,
};

export const LegendTop: Story = {
    args: { legendPosition: 'top' },
    render,
};

export const LegendBottom: Story = {
    args: { legendPosition: 'bottom' },
    render,
};

export const LegendLeft: Story = {
    args: { legendPosition: 'left' },
    render,
};

export const NoTooltip: Story = {
    args: { showTooltip: false },
    render,
};

export const CustomColors: Story = {
    args: {
        data: [
            { name: 'North America', value: 4200, color: '#3b82f6' },
            { name: 'Europe', value: 3100, color: '#ef4444' },
            { name: 'Asia', value: 2600, color: '#f59e0b' },
            { name: 'Other', value: 900, color: '#10b981' },
        ] as ChartDataPoint[],
        title: 'Revenue by Region',
    },
    render,
};

export const SmallSize: Story = {
    args: { size: 180, legendPosition: 'bottom' },
    render,
};
