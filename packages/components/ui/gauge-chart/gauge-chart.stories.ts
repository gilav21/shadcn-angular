import { Meta, StoryObj } from '@storybook/angular';
import { GaugeChartComponent } from './gauge-chart.component';
import { GaugeThreshold } from '../../lib/chart.types';

const meta: Meta<GaugeChartComponent> = {
    title: 'Charts/Gauge Chart',
    component: GaugeChartComponent,
    tags: ['autodocs'],
    argTypes: {
        value: { control: 'number', description: 'Current value shown by the needle/arc.' },
        min: { control: 'number', description: 'Minimum value of the gauge range.' },
        max: { control: 'number', description: 'Maximum value of the gauge range.' },
        size: { control: 'number', description: 'Overall SVG width/height in pixels.', min: 100 },
        thickness: { control: 'number', description: 'Arc thickness as a fraction of the outer radius (0-1).', min: 0, max: 1, step: 0.05 },
        thresholds: { control: 'object', description: 'Color breakpoints applied as the value crosses each threshold.' },
        label: { control: 'text', description: 'Label rendered under the value.' },
        unit: { control: 'text', description: 'Unit suffix appended to the displayed value.' },
        showValue: { control: 'boolean', description: 'Shows the numeric value and label under the arc.' },
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
        title: { control: 'text', description: 'Accessible chart title, announced via aria-label.' },
        dir: {
            control: 'select',
            options: ['ltr', 'rtl', 'auto'],
            description: 'Text/layout direction of the chart.',
        },
    },
    args: {
        value: 70,
        min: 0,
        max: 100,
        size: 220,
        thickness: 0.2,
        thresholds: [],
        label: 'CPU load',
        unit: '%',
        showValue: true,
        class: '',
        title: undefined,
        dir: 'auto',
    },
};
export default meta;
type Story = StoryObj<GaugeChartComponent>;

const TEMPLATE = `
    <ui-gauge-chart
        [value]="value" [min]="min" [max]="max" [size]="size" [thickness]="thickness"
        [thresholds]="thresholds" [label]="label" [unit]="unit" [showValue]="showValue"
        [class]="class" [title]="title" [dir]="dir"
    />`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Default: Story = {
    args: { value: 70, min: 0, max: 100, unit: '%', label: 'CPU load' },
    render,
};

export const WithThresholds: Story = {
    args: {
        value: 88, min: 0, max: 100, unit: '%', label: 'Disk usage',
        thresholds: [
            { value: 0, color: 'hsl(142, 71%, 45%)' },
            { value: 60, color: 'hsl(48, 96%, 53%)' },
            { value: 85, color: 'hsl(0, 84%, 60%)' },
        ] satisfies GaugeThreshold[],
    },
    render,
};

export const CustomRange: Story = {
    args: { value: 320, min: 0, max: 500, unit: ' rpm', label: 'Engine', size: 260 },
    render,
};

export const WithoutValue: Story = {
    args: { value: 45, showValue: false },
    render,
};

export const RTL: Story = {
    args: { value: 70, label: 'עומס מעבד', dir: 'rtl' },
    render,
};
