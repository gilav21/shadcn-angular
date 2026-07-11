import { Meta, StoryObj } from '@storybook/angular';
import { LineChartComponent } from './line-chart.component';
import { ChartSeries } from '../../lib/chart.types';

const meta: Meta<LineChartComponent> = {
    title: 'Charts/Line Chart',
    component: LineChartComponent,
    tags: ['autodocs'],
    argTypes: {
        series: { control: 'object', description: 'Data series to plot (each with a name and `{ name, value }` points).' },
        width: { control: 'number', description: 'Fallback SVG width in px, used until the container is measured.' },
        height: { control: 'number', description: 'SVG height in px.' },
        curve: {
            control: 'select',
            options: ['linear', 'monotone', 'step'],
            description: 'Interpolation used between points.',
        },
        showPoints: { control: 'boolean', description: 'Renders a dot at each data point.' },
        showGrid: { control: 'boolean', description: 'Renders horizontal gridlines at each y-axis tick.' },
        showTooltip: { control: 'boolean', description: 'Shows a tooltip on hover/touch.' },
        showLegend: { control: 'boolean', description: 'Shows the series legend below the chart.' },
        showCrosshair: { control: 'boolean', description: 'Shows a vertical crosshair line on hover.' },
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
        title: { control: 'text', description: 'Accessible title used to build the chart summary.' },
        dir: {
            control: 'select',
            options: ['auto', 'ltr', 'rtl'],
            description: 'Layout direction; `auto` detects from the DOM.',
        },
        pointClick: { control: false, description: 'Emits the clicked data point and its index.' },
        pointHover: { control: false, description: 'Emits the hovered data point (or null) as the pointer moves.' },
    },
    args: {
        series: [
            { name: 'Revenue', data: [
                { name: 'Jan', value: 120 }, { name: 'Feb', value: 180 }, { name: 'Mar', value: 150 },
                { name: 'Apr', value: 220 }, { name: 'May', value: 260 }, { name: 'Jun', value: 240 },
            ] },
            { name: 'Cost', data: [
                { name: 'Jan', value: 90 }, { name: 'Feb', value: 110 }, { name: 'Mar', value: 100 },
                { name: 'Apr', value: 140 }, { name: 'May', value: 160 }, { name: 'Jun', value: 150 },
            ] },
        ],
        width: 560,
        height: 320,
        curve: 'linear',
        showPoints: true,
        showGrid: true,
        showTooltip: true,
        showLegend: true,
        showCrosshair: true,
        class: '',
        title: undefined,
        dir: 'auto',
    },
};
export default meta;
type Story = StoryObj<LineChartComponent>;

const singleSeries: ChartSeries[] = [
    { name: 'Revenue', data: [
        { name: 'Jan', value: 120 }, { name: 'Feb', value: 180 }, { name: 'Mar', value: 150 },
        { name: 'Apr', value: 220 }, { name: 'May', value: 260 }, { name: 'Jun', value: 240 },
    ] },
];

const TEMPLATE = `
    <ui-line-chart
        [series]="series" [width]="width" [height]="height" [curve]="curve"
        [showPoints]="showPoints" [showGrid]="showGrid" [showTooltip]="showTooltip"
        [showLegend]="showLegend" [showCrosshair]="showCrosshair"
        [class]="class" [title]="title" [dir]="dir" />`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const SmoothMonotone: Story = {
    args: { curve: 'monotone' },
    render,
};

export const Stepped: Story = {
    args: { curve: 'step' },
    render,
};

export const SingleSeriesNoLegend: Story = {
    args: { series: singleSeries, curve: 'monotone', showLegend: false },
    render,
};

export const NoGridNoPoints: Story = {
    args: { showGrid: false, showPoints: false },
    render,
};

export const RightToLeft: Story = {
    args: { curve: 'monotone', dir: 'rtl' },
    render,
};
