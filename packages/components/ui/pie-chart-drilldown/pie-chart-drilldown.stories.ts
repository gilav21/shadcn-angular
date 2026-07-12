import { Meta, StoryObj } from '@storybook/angular';
import { PieChartDrilldownComponent } from './pie-chart-drilldown.component';
import { DrilldownDataPoint, DrilldownSeries } from '../../lib/chart.types';

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct visual mode.
const meta: Meta<PieChartDrilldownComponent> = {
    title: 'Charts/Pie Chart Drilldown',
    component: PieChartDrilldownComponent,
    tags: ['autodocs'],
    argTypes: {
        data: { control: 'object', description: 'Top-level data points; entries with a `drilldown` id can be expanded into a series.' },
        drilldownSeries: { control: 'object', description: 'Series available for drilldown, keyed by id, shown when a matching slice is clicked.' },
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
        showBreadcrumb: { control: 'boolean', description: 'Shows the back button + breadcrumb when drilled down.' },
        backButtonText: { control: 'text', description: 'Label for the breadcrumb back button.' },
        class: { control: 'text', description: 'Extra classes merged onto the host container.' },
        title: { control: 'text', description: 'Series name shown at the top level (before any drilldown).' },
    },
    args: {
        size: 300,
        innerRadius: 0,
        showLabels: true,
        showLegend: true,
        legendPosition: 'right',
        showTooltip: true,
        showBreadcrumb: true,
        backButtonText: 'Back',
        class: '',
        title: undefined,
    },
};

export default meta;
type Story = StoryObj<PieChartDrilldownComponent>;

const regionData: DrilldownDataPoint[] = [
    { name: 'North America', value: 4200, drilldown: 'na' },
    { name: 'Europe', value: 3100, drilldown: 'eu' },
    { name: 'Asia', value: 2600, drilldown: 'asia' },
    { name: 'Other', value: 900 },
];

const regionSeries: DrilldownSeries[] = [
    {
        id: 'na',
        name: 'North America',
        data: [
            { name: 'USA', value: 3100 },
            { name: 'Canada', value: 700 },
            { name: 'Mexico', value: 400 },
        ],
    },
    {
        id: 'eu',
        name: 'Europe',
        data: [
            { name: 'Germany', value: 1200 },
            { name: 'France', value: 900 },
            { name: 'UK', value: 1000 },
        ],
    },
    {
        id: 'asia',
        name: 'Asia',
        data: [
            { name: 'China', value: 1400 },
            { name: 'Japan', value: 700 },
            { name: 'India', value: 500 },
        ],
    },
];

const TEMPLATE = `
    <ui-pie-chart-drilldown
        [data]="data" [drilldownSeries]="drilldownSeries" [size]="size" [innerRadius]="innerRadius"
        [showLabels]="showLabels" [showLegend]="showLegend" [legendPosition]="legendPosition"
        [showTooltip]="showTooltip" [showBreadcrumb]="showBreadcrumb" [backButtonText]="backButtonText"
        [class]="class" [title]="title" />`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. Click a slice with a colored ring to drill down. */
export const Playground: Story = {
    args: { data: regionData, drilldownSeries: regionSeries },
    render,
};

export const WithDrilldown: Story = {
    args: { data: regionData, drilldownSeries: regionSeries, title: 'Revenue by Region' },
    render,
};

export const Donut: Story = {
    args: { data: regionData, drilldownSeries: regionSeries, innerRadius: 0.6 },
    render,
};

export const NoBreadcrumb: Story = {
    args: { data: regionData, drilldownSeries: regionSeries, showBreadcrumb: false },
    render,
};

export const CustomBackButtonText: Story = {
    args: { data: regionData, drilldownSeries: regionSeries, backButtonText: 'Up one level' },
    render,
};

export const FlatNoDrilldown: Story = {
    args: {
        data: [
            { name: 'Q1', value: 1800 },
            { name: 'Q2', value: 2200 },
            { name: 'Q3', value: 1950 },
            { name: 'Q4', value: 2600 },
        ],
        drilldownSeries: [],
        title: 'Quarterly Sales',
    },
    render,
};
