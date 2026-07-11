import { Meta, StoryObj } from '@storybook/angular';
import { BubbleChartComponent } from './bubble-chart.component';
import { XYZSeries } from '../../lib/chart.types';

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct visual mode.
const meta: Meta<BubbleChartComponent> = {
    title: 'Charts/Bubble Chart',
    component: BubbleChartComponent,
    tags: ['autodocs'],
    argTypes: {
        series: { control: 'object', description: 'XYZ series data — each series has points with x/y/z (radius) values.' },
        width: { control: 'number', min: 200, max: 1200, step: 10, description: 'Fallback SVG width used until the container is measured.' },
        height: { control: 'number', min: 100, max: 800, step: 10, description: 'SVG height in pixels.' },
        minRadius: { control: 'number', min: 1, max: 40, step: 1, description: 'Minimum bubble radius in pixels (smallest z value).' },
        maxRadius: { control: 'number', min: 1, max: 80, step: 1, description: 'Maximum bubble radius in pixels (largest z value).' },
        showGrid: { control: 'boolean', description: 'Shows horizontal gridlines behind the bubbles.' },
        showTooltip: { control: 'boolean', description: 'Shows a tooltip on hover/touch with the point x/y/z values.' },
        showLegend: { control: 'boolean', description: 'Shows a legend below the chart that toggles series visibility.' },
        title: { control: 'text', description: 'Accessible title announced with the chart summary; not rendered visually.' },
        dir: { control: 'select', options: ['auto', 'ltr', 'rtl'], description: 'Reading direction; `auto` detects from the DOM.' },
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
        pointClick: { control: false, description: 'Emits the clicked data point and its index.' },
    },
    args: {
        width: 560,
        height: 360,
        minRadius: 6,
        maxRadius: 28,
        showGrid: true,
        showTooltip: true,
        showLegend: true,
        title: undefined,
        dir: 'auto',
        class: '',
    },
};

export default meta;
type Story = StoryObj<BubbleChartComponent>;

const series: XYZSeries[] = [
    {
        name: 'Products', points: [
            { x: 10, y: 20, z: 30 }, { x: 22, y: 35, z: 80 }, { x: 30, y: 15, z: 50 },
            { x: 38, y: 42, z: 120 }, { x: 46, y: 28, z: 65 },
        ],
    },
    {
        name: 'Services', points: [
            { x: 14, y: 50, z: 40 }, { x: 26, y: 60, z: 95 }, { x: 34, y: 48, z: 70 },
        ],
    },
];

const singleSeries: XYZSeries[] = [
    {
        name: 'Campaign reach', points: [
            { x: 5, y: 12, z: 20 }, { x: 18, y: 28, z: 55 }, { x: 32, y: 9, z: 90 },
        ],
    },
];

const emptySeries: XYZSeries[] = [];

const TEMPLATE = `
    <ui-bubble-chart
        [series]="series" [width]="width" [height]="height"
        [minRadius]="minRadius" [maxRadius]="maxRadius"
        [showGrid]="showGrid" [showTooltip]="showTooltip" [showLegend]="showLegend"
        [title]="title" [dir]="dir" [class]="class" />`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Default: Story = {
    args: { series },
    render,
};

export const LargeRadiusRange: Story = {
    args: { series, minRadius: 4, maxRadius: 40 },
    render,
};

export const NoGrid: Story = {
    args: { series, showGrid: false },
    render,
};

export const NoLegend: Story = {
    args: { series, showLegend: false },
    render,
};

export const NoTooltip: Story = {
    args: { series, showTooltip: false },
    render,
};

export const SingleSeries: Story = {
    args: { series: singleSeries },
    render,
};

export const Empty: Story = {
    args: { series: emptySeries },
    render,
};

export const RightToLeft: Story = {
    args: { series, dir: 'rtl' },
    render,
};

export const WithTitle: Story = {
    args: { series, title: 'Product vs. service reach by size' },
    render,
};
