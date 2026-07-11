import { Meta, StoryObj } from '@storybook/angular';
import { FunnelChartComponent } from './funnel-chart.component';
import { ChartDataPoint } from '../../lib/chart.types';

const meta: Meta<FunnelChartComponent> = {
    title: 'Charts/Funnel Chart',
    component: FunnelChartComponent,
    tags: ['autodocs'],
    argTypes: {
        data: { control: 'object', description: 'Ordered stages of the funnel, each with a name and value.' },
        width: { control: 'number', description: 'Fallback SVG width used before the container is measured.', min: 100 },
        height: { control: 'number', description: 'SVG height in pixels.', min: 100 },
        percentageMode: {
            control: 'select',
            options: ['first', 'previous'],
            description: 'Whether each stage\'s percentage is relative to the first stage or to the previous one.',
        },
        gap: { control: 'number', description: 'Vertical gap in pixels between stages.', min: 0 },
        showValues: { control: 'boolean', description: 'Shows the raw value label on each stage.' },
        showTooltip: { control: 'boolean', description: 'Shows a tooltip on hover.' },
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
        title: { control: 'text', description: 'Accessible chart title, announced via aria-label.' },
        dir: {
            control: 'select',
            options: ['ltr', 'rtl', 'auto'],
            description: 'Text/layout direction of the chart.',
        },
    },
    args: {
        width: 440,
        height: 300,
        percentageMode: 'first',
        gap: 2,
        showValues: true,
        showTooltip: true,
        class: '',
        title: undefined,
        dir: 'auto',
    },
};
export default meta;
type Story = StoryObj<FunnelChartComponent>;

const data: ChartDataPoint[] = [
    { name: 'Visits', value: 1000 },
    { name: 'Signups', value: 600 },
    { name: 'Trials', value: 300 },
    { name: 'Paid', value: 120 },
];

const TEMPLATE = `
    <ui-funnel-chart
        [data]="data" [width]="width" [height]="height" [percentageMode]="percentageMode"
        [gap]="gap" [showValues]="showValues" [showTooltip]="showTooltip" [class]="class"
        [title]="title" [dir]="dir"
    />`;

const render: NonNullable<Story['render']> = (args) => ({
    props: { ...args, data },
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Default: Story = {
    args: { data, width: 440, height: 320 },
    render,
};

export const VsPreviousStage: Story = {
    args: { data, width: 440, height: 320, percentageMode: 'previous' },
    render,
};

export const WithoutValues: Story = {
    args: { data, showValues: false },
    render,
};

export const WithoutTooltip: Story = {
    args: { data, showTooltip: false },
    render,
};

export const RTL: Story = {
    args: { data, dir: 'rtl', title: 'משפך המרות' },
    render,
};
