import { Meta, StoryObj } from '@storybook/angular';
import { BarChartComponent } from './bar-chart.component';
import { ChartDataPoint } from '../../lib/chart.types';

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct visual mode.
const meta: Meta<BarChartComponent> = {
    title: 'Charts/Bar Chart',
    component: BarChartComponent,
    tags: ['autodocs'],
    argTypes: {
        data: { control: 'object', description: 'Chart data points (`{ name, value, color? }[]`).' },
        orientation: {
            control: 'select',
            options: ['horizontal', 'vertical'],
            description: 'Bar orientation — `vertical` renders columns, `horizontal` renders bars.',
        },
        width: { control: 'number', description: 'Intrinsic SVG width in px (scales to container width).' },
        height: { control: 'number', description: 'SVG height in px.' },
        showGrid: { control: 'boolean', description: 'Shows the dashed gridlines behind the bars.' },
        showValues: { control: 'boolean', description: 'Shows the formatted value label on each bar.' },
        showTooltip: { control: 'boolean', description: 'Shows a tooltip on hover/focus of a bar.' },
        barRadius: { control: 'number', description: 'Corner radius of each bar rect, in px.', min: 0, max: 20 },
        barGap: { control: 'number', description: 'Gap between bars, in px.', min: 0, max: 40 },
        xAxisLabel: { control: 'text', description: 'Label rendered below the x-axis.' },
        yAxisLabel: { control: 'text', description: 'Label rendered beside the y-axis (rotated).' },
        class: { control: 'text', description: 'Extra classes merged onto the host container.' },
        title: { control: 'text', description: 'Accessible chart title used to build the SVG aria-label.' },
        dir: {
            control: 'select',
            options: ['auto', 'ltr', 'rtl'],
            description: 'Reading direction. `auto` detects the DOM direction at render time.',
        },
        barClick: { control: false, description: 'Emits `{ point, index, event }` when a bar is clicked.' },
        barHover: { control: false, description: 'Emits `{ point, index }` on hover/focus, or `null` on leave/blur.' },
    },
    args: {
        data: [
            { name: 'Jan', value: 120 },
            { name: 'Feb', value: 180 },
            { name: 'Mar', value: 150 },
            { name: 'Apr', value: 220 },
            { name: 'May', value: 260 },
        ],
        orientation: 'vertical',
        width: 500,
        height: 300,
        showGrid: true,
        showValues: true,
        showTooltip: true,
        barRadius: 4,
        barGap: 8,
        xAxisLabel: '',
        yAxisLabel: '',
        class: '',
        title: undefined,
        dir: 'auto',
    },
};

export default meta;
type Story = StoryObj<BarChartComponent>;

const TEMPLATE = `
    <ui-bar-chart
        [data]="data" [orientation]="orientation" [width]="width" [height]="height"
        [showGrid]="showGrid" [showValues]="showValues" [showTooltip]="showTooltip"
        [barRadius]="barRadius" [barGap]="barGap"
        [xAxisLabel]="xAxisLabel" [yAxisLabel]="yAxisLabel"
        [class]="class" [title]="title" [dir]="dir" />`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Vertical: Story = {
    args: { orientation: 'vertical' },
    render,
};

export const Horizontal: Story = {
    args: { orientation: 'horizontal' },
    render,
};

export const WithAxisLabels: Story = {
    args: { xAxisLabel: 'Month', yAxisLabel: 'Revenue' },
    render,
};

export const WithoutGrid: Story = {
    args: { showGrid: false },
    render,
};

export const WithoutValues: Story = {
    args: { showValues: false },
    render,
};

export const NegativeAndPositiveValues: Story = {
    args: {
        data: [
            { name: 'Q1', value: -40 },
            { name: 'Q2', value: 60 },
            { name: 'Q3', value: -15 },
            { name: 'Q4', value: 90 },
        ] as ChartDataPoint[],
    },
    render,
};

export const CustomColors: Story = {
    args: {
        data: [
            { name: 'Chrome', value: 65, color: '#3b82f6' },
            { name: 'Safari', value: 18, color: '#ef4444' },
            { name: 'Firefox', value: 9, color: '#f59e0b' },
            { name: 'Edge', value: 8, color: '#10b981' },
        ] as ChartDataPoint[],
    },
    render,
};

export const RightToLeft: Story = {
    args: { dir: 'rtl', xAxisLabel: 'חודש', yAxisLabel: 'הכנסה' },
    render,
};
