import { Meta, StoryObj } from '@storybook/angular';
import { BarChartDrilldownComponent } from './bar-chart-drilldown.component';
import { DrilldownDataPoint, DrilldownSeries } from '../../lib/chart.types';

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct visual mode.
const meta: Meta<BarChartDrilldownComponent> = {
    title: 'Charts/Bar Chart Drilldown',
    component: BarChartDrilldownComponent,
    tags: ['autodocs'],
    argTypes: {
        data: { control: 'object', description: 'Top-level data points; entries with a `drilldown` id can be expanded into a series.' },
        drilldownSeries: { control: 'object', description: 'Series available for drilldown, keyed by id, shown when a matching bar is clicked.' },
        dir: {
            control: 'select',
            options: ['auto', 'ltr', 'rtl'],
            description: 'Chart reading direction. `auto` detects from the surrounding DOM.',
        },
        width: { control: 'number', description: 'Intrinsic chart width in px, used when the container cannot be measured.' },
        height: { control: 'number', description: 'Chart height in px.' },
        showGrid: { control: 'boolean', description: 'Shows horizontal gridlines behind the bars.' },
        showValues: { control: 'boolean', description: 'Shows the formatted value above each bar.' },
        showTooltip: { control: 'boolean', description: 'Shows a tooltip while hovering/focusing a bar.' },
        barRadius: { control: 'number', description: 'Corner radius of each bar, in px.', min: 0, max: 20 },
        barGap: { control: 'number', description: 'Gap between bars, in px.', min: 0, max: 40 },
        showBreadcrumb: { control: 'boolean', description: 'Shows the back button + breadcrumb when drilled down.' },
        backButtonText: { control: 'text', description: 'Label for the breadcrumb back button.' },
        title: { control: 'text', description: 'Series name shown at the top level (before any drilldown).' },
        class: { control: 'text', description: 'Extra classes merged onto the host container.' },
    },
    args: {
        dir: 'auto',
        width: 500,
        height: 300,
        showGrid: true,
        showValues: true,
        showTooltip: true,
        barRadius: 4,
        barGap: 8,
        showBreadcrumb: true,
        backButtonText: 'Back',
        title: 'Revenue by Region',
        class: '',
    },
};

export default meta;
type Story = StoryObj<BarChartDrilldownComponent>;

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
    <ui-bar-chart-drilldown
        [data]="data" [drilldownSeries]="drilldownSeries" [dir]="dir"
        [width]="width" [height]="height"
        [showGrid]="showGrid" [showValues]="showValues" [showTooltip]="showTooltip"
        [barRadius]="barRadius" [barGap]="barGap"
        [showBreadcrumb]="showBreadcrumb" [backButtonText]="backButtonText"
        [title]="title" [class]="class" />`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = {
    args: { data: regionData, drilldownSeries: regionSeries },
    render,
};

export const WithDrilldown: Story = {
    args: { data: regionData, drilldownSeries: regionSeries },
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

export const NoGrid: Story = {
    args: { data: regionData, drilldownSeries: regionSeries, showGrid: false },
    render,
};

export const NoValues: Story = {
    args: { data: regionData, drilldownSeries: regionSeries, showValues: false },
    render,
};

export const NoTooltip: Story = {
    args: { data: regionData, drilldownSeries: regionSeries, showTooltip: false },
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

export const RightToLeft: Story = {
    args: { data: regionData, drilldownSeries: regionSeries, dir: 'rtl', title: 'ההכנסות לפי אזור' },
    render,
};

export const CompactSize: Story = {
    args: { data: regionData, drilldownSeries: regionSeries, width: 360, height: 220, barGap: 4, barRadius: 2 },
    render,
};
