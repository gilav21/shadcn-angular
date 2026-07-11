import { Meta, StoryObj } from '@storybook/angular';
import { RadarChartComponent } from './radar-chart.component';
import { ChartSeries } from '../../lib/chart.types';

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct visual mode.
const meta: Meta<RadarChartComponent> = {
    title: 'Charts/Radar Chart',
    component: RadarChartComponent,
    tags: ['autodocs'],
    argTypes: {
        series: { control: 'object', description: 'Chart series (`{ id?, name, data: { name, value }[], color? }[]`); all series share the same axes.' },
        size: { control: 'number', description: 'SVG viewBox size (width and height), in px.', min: 150, max: 600 },
        levels: { control: 'number', description: 'Number of concentric grid rings.', min: 1, max: 10 },
        maxValueInput: { control: 'number', description: 'Explicit max value for the radial scale. Defaults to the max value across all series.' },
        fillOpacity: { control: { type: 'range', min: 0, max: 1, step: 0.05 }, description: 'Fill opacity of each series polygon.' },
        showLegend: { control: 'boolean', description: 'Shows the series legend below the chart.' },
        class: { control: 'text', description: 'Extra classes merged onto the host container.' },
        title: { control: 'text', description: 'Accessible chart title used to build the SVG aria-label.' },
        dir: {
            control: 'select',
            options: ['ltr', 'rtl', 'auto'],
            description: 'Reading direction. `auto` detects the DOM direction at render time.',
        },
    },
    args: {
        size: 320,
        levels: 4,
        maxValueInput: undefined,
        fillOpacity: 0.2,
        showLegend: true,
        class: '',
        title: undefined,
        dir: 'auto',
    },
};

export default meta;
type Story = StoryObj<RadarChartComponent>;

const series: ChartSeries[] = [
    {
        name: 'Product A',
        data: [
            { name: 'Speed', value: 8 }, { name: 'Power', value: 6 }, { name: 'Range', value: 9 },
            { name: 'Comfort', value: 5 }, { name: 'Price', value: 7 }, { name: 'Safety', value: 8 },
        ],
    },
    {
        name: 'Product B',
        data: [
            { name: 'Speed', value: 5 }, { name: 'Power', value: 9 }, { name: 'Range', value: 4 },
            { name: 'Comfort', value: 8 }, { name: 'Price', value: 6 }, { name: 'Safety', value: 7 },
        ],
    },
];

const TEMPLATE = `
    <ui-radar-chart
        [series]="series" [size]="size" [levels]="levels" [maxValueInput]="maxValueInput"
        [fillOpacity]="fillOpacity" [showLegend]="showLegend"
        [class]="class" [title]="title" [dir]="dir" />`;

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
    args: { series: [series[0]], levels: 5, showLegend: false },
    render,
};

export const NoLegend: Story = {
    args: { series, showLegend: false },
    render,
};

export const CustomMaxValue: Story = {
    args: { series, maxValueInput: 10 },
    render,
};

export const HighFillOpacity: Story = {
    args: { series, fillOpacity: 0.6 },
    render,
};

export const RightToLeft: Story = {
    args: {
        dir: 'rtl',
        series: [
            {
                name: 'מוצר א',
                data: [
                    { name: 'מהירות', value: 8 }, { name: 'כוח', value: 6 }, { name: 'טווח', value: 9 },
                    { name: 'נוחות', value: 5 }, { name: 'מחיר', value: 7 }, { name: 'בטיחות', value: 8 },
                ],
            },
        ],
    },
    render,
};

export const SmallSize: Story = {
    args: { series, size: 220, levels: 3 },
    render,
};
