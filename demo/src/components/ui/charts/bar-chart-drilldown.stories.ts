import { Meta, StoryObj } from '@storybook/angular';
import { BarChartDrilldownComponent } from './bar-chart-drilldown.component';
import { DrilldownDataPoint, DrilldownSeries } from './chart.types';

const browserData: DrilldownDataPoint[] = [
    { name: 'Chrome', value: 61.41, drilldown: 'chrome' },
    { name: 'Safari', value: 24.43, drilldown: 'safari' },
    { name: 'Edge', value: 6.28, drilldown: 'edge' },
    { name: 'Firefox', value: 4.14 },
    { name: 'Other', value: 3.74 },
];

const drilldownSeries: DrilldownSeries[] = [
    {
        id: 'chrome',
        name: 'Chrome Versions',
        data: [
            { name: 'v120', value: 35 },
            { name: 'v119', value: 15 },
            { name: 'v118', value: 8 },
            { name: 'v117', value: 3 },
        ],
    },
    {
        id: 'safari',
        name: 'Safari Versions',
        data: [
            { name: 'v17', value: 18 },
            { name: 'v16', value: 5 },
            { name: 'v15', value: 1.5 },
        ],
    },
    {
        id: 'edge',
        name: 'Edge Versions',
        data: [
            { name: 'v120', value: 4 },
            { name: 'v119', value: 1.5 },
            { name: 'v118', value: 0.8 },
        ],
    },
];

const meta: Meta<BarChartDrilldownComponent> = {
    title: 'UI/Charts/Bar Chart Drilldown',
    component: BarChartDrilldownComponent,
    tags: ['autodocs'],
    argTypes: {
        width: { control: { type: 'range', min: 300, max: 800 } },
        height: { control: { type: 'range', min: 200, max: 500 } },
        showGrid: { control: 'boolean' },
        showValues: { control: 'boolean' },
        showBreadcrumb: { control: 'boolean' },
    },
};

export default meta;
type Story = StoryObj<BarChartDrilldownComponent>;

export const Default: Story = {
    args: {
        data: browserData,
        drilldownSeries: drilldownSeries,
        width: 500,
        height: 300,
        showGrid: true,
        showValues: true,
        showBreadcrumb: true,
        title: 'Browser Market Share',
    },
};

export const WithoutBreadcrumb: Story = {
    args: {
        data: browserData,
        drilldownSeries: drilldownSeries,
        width: 500,
        height: 300,
        showBreadcrumb: false,
    },
};
