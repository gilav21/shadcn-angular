import { Meta, StoryObj } from '@storybook/angular';
import { ScatterChartComponent } from './scatter-chart.component';
import { XYSeries } from '../../lib/chart.types';

const meta: Meta<ScatterChartComponent> = {
    title: 'Charts/Scatter Chart',
    component: ScatterChartComponent,
    tags: ['autodocs'],
    argTypes: {
        series: { control: 'object', description: 'Series to plot, each with a name and (x, y) points.' },
        width: { control: 'number', description: 'Fallback SVG width used until the container is measured.' },
        height: { control: 'number', description: 'SVG height in pixels.' },
        pointRadius: { control: 'number', description: 'Radius of each scatter point in pixels.', min: 1, max: 20 },
        showGrid: { control: 'boolean', description: 'Shows horizontal gridlines.' },
        showTooltip: { control: 'boolean', description: 'Shows a tooltip on point hover.' },
        showLegend: { control: 'boolean', description: 'Shows the series legend below the chart.' },
        xAxisLabel: { control: 'text', description: 'Label for the x-axis (currently unused in the template).' },
        yAxisLabel: { control: 'text', description: 'Label for the y-axis (currently unused in the template).' },
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
        title: { control: 'text', description: 'Accessible chart title used in the aria-label summary.' },
        dir: { control: 'select', options: ['auto', 'ltr', 'rtl'], description: 'Layout direction; `auto` detects from the DOM.' },
        pointClick: { control: false, description: 'Emits when a scatter point is clicked or activated via keyboard.' },
    },
    args: {
        series: [],
        width: 540,
        height: 340,
        pointRadius: 5,
        showGrid: true,
        showTooltip: true,
        showLegend: true,
        xAxisLabel: '',
        yAxisLabel: '',
        class: '',
        title: undefined,
        dir: 'auto',
    },
};

export default meta;
type Story = StoryObj<ScatterChartComponent>;

const series: XYSeries[] = [
    { name: 'Group A', points: [
        { x: 12, y: 22 }, { x: 18, y: 30 }, { x: 25, y: 18 }, { x: 30, y: 40 }, { x: 36, y: 33 },
    ] },
    { name: 'Group B', points: [
        { x: 15, y: 55 }, { x: 22, y: 48 }, { x: 28, y: 62 }, { x: 35, y: 51 }, { x: 41, y: 70 },
    ] },
];

const TEMPLATE = `
    <ui-scatter-chart
        [series]="series" [width]="width" [height]="height" [pointRadius]="pointRadius"
        [showGrid]="showGrid" [showTooltip]="showTooltip" [showLegend]="showLegend"
        [xAxisLabel]="xAxisLabel" [yAxisLabel]="yAxisLabel" [class]="class"
        [title]="title" [dir]="dir">
    </ui-scatter-chart>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = {
    args: { series },
    render,
};

export const SingleSeries: Story = {
    args: { series: [series[0]], showLegend: false },
    render,
};

export const NoGrid: Story = {
    args: { series, showGrid: false },
    render,
};

export const NoTooltip: Story = {
    args: { series, showTooltip: false },
    render,
};

export const RightToLeft: Story = {
    args: { series, dir: 'rtl' },
    render,
};
