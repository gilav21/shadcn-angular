import { Meta, StoryObj } from '@storybook/angular';
import { StackedBarChartComponent } from './stacked-bar-chart.component';
import { ChartSeries } from '../../lib/chart.types';

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct visual mode.
const DEMO_SERIES: ChartSeries[] = [
    {
        id: 'desktop',
        name: 'Desktop',
        data: [
            { name: 'Jan', value: 120 },
            { name: 'Feb', value: 150 },
            { name: 'Mar', value: 180 },
            { name: 'Apr', value: 160 },
        ],
    },
    {
        id: 'mobile',
        name: 'Mobile',
        data: [
            { name: 'Jan', value: 80 },
            { name: 'Feb', value: 95 },
            { name: 'Mar', value: 110 },
            { name: 'Apr', value: 130 },
        ],
    },
    {
        id: 'tablet',
        name: 'Tablet',
        data: [
            { name: 'Jan', value: 30 },
            { name: 'Feb', value: 35 },
            { name: 'Mar', value: 28 },
            { name: 'Apr', value: 40 },
        ],
    },
];

const DEMO_CATEGORIES = ['Jan', 'Feb', 'Mar', 'Apr'];

const meta: Meta<StackedBarChartComponent> = {
    title: 'Charts/Stacked Bar Chart',
    component: StackedBarChartComponent,
    tags: ['autodocs'],
    argTypes: {
        series: { control: 'object', description: 'Stacked series (`{ id?, name, data: { name, value, color? }[], color? }[]`).' },
        categories: { control: 'object', description: 'Category labels along the x-axis; index-aligned with each series\' `data`.' },
        stacking: {
            control: 'select',
            options: ['absolute', 'percent'],
            description: 'Stacking mode — `absolute` sums raw values, `percent` normalizes each bar to 100%.',
        },
        width: { control: 'number', description: 'Intrinsic SVG width in px (scales to container width).' },
        height: { control: 'number', description: 'SVG height in px.' },
        showGrid: { control: 'boolean', description: 'Shows the dashed gridlines behind the bars.' },
        showTotal: { control: 'boolean', description: 'Shows the summed total label above each stacked bar.' },
        showLegend: { control: 'boolean', description: 'Shows the series color legend below the chart.' },
        barRadius: { control: 'number', description: 'Corner radius of each segment rect, in px.', min: 0, max: 20 },
        barGap: { control: 'number', description: 'Gap between bars, in px.', min: 0, max: 40 },
        class: { control: 'text', description: 'Extra classes merged onto the host container.' },
        title: { control: 'text', description: 'Accessible chart title used to build the SVG aria-label.' },
        dir: {
            control: 'select',
            options: ['auto', 'ltr', 'rtl'],
            description: 'Reading direction. `auto` detects the DOM direction at render time.',
        },
    },
    args: {
        series: DEMO_SERIES,
        categories: DEMO_CATEGORIES,
        stacking: 'absolute',
        width: 500,
        height: 300,
        showGrid: true,
        showTotal: false,
        showLegend: true,
        barRadius: 4,
        barGap: 12,
        class: '',
        title: undefined,
        dir: 'auto',
    },
};

export default meta;
type Story = StoryObj<StackedBarChartComponent>;

const TEMPLATE = `
    <ui-stacked-bar-chart
        [series]="series" [categories]="categories" [stacking]="stacking"
        [width]="width" [height]="height"
        [showGrid]="showGrid" [showTotal]="showTotal" [showLegend]="showLegend"
        [barRadius]="barRadius" [barGap]="barGap"
        [class]="class" [title]="title" [dir]="dir" />`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Absolute: Story = {
    args: { stacking: 'absolute' },
    render,
};

export const Percent: Story = {
    args: { stacking: 'percent' },
    render,
};

export const WithTotals: Story = {
    args: { showTotal: true },
    render,
};

export const WithoutGrid: Story = {
    args: { showGrid: false },
    render,
};

export const WithoutLegend: Story = {
    args: { showLegend: false },
    render,
};

export const CustomColors: Story = {
    args: {
        series: [
            { id: 'chrome', name: 'Chrome', color: '#3b82f6', data: [{ name: 'Q1', value: 60 }, { name: 'Q2', value: 65 }] },
            { id: 'safari', name: 'Safari', color: '#ef4444', data: [{ name: 'Q1', value: 20 }, { name: 'Q2', value: 18 }] },
            { id: 'firefox', name: 'Firefox', color: '#f59e0b', data: [{ name: 'Q1', value: 12 }, { name: 'Q2', value: 9 }] },
        ] as ChartSeries[],
        categories: ['Q1', 'Q2'],
    },
    render,
};

export const RightToLeft: Story = {
    args: { dir: 'rtl', title: 'שימוש לפי מכשיר' },
    render,
};
