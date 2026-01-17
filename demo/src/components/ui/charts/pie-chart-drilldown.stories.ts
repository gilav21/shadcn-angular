import { Meta, StoryObj } from '@storybook/angular';
import { PieChartDrilldownComponent } from './pie-chart-drilldown.component';
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
            { name: 'Chrome 120', value: 35 },
            { name: 'Chrome 119', value: 15 },
            { name: 'Chrome 118', value: 8 },
            { name: 'Chrome 117', value: 3 },
        ],
    },
    {
        id: 'safari',
        name: 'Safari Versions',
        data: [
            { name: 'Safari 17', value: 18 },
            { name: 'Safari 16', value: 5 },
            { name: 'Safari 15', value: 1.5 },
        ],
    },
    {
        id: 'edge',
        name: 'Edge Versions',
        data: [
            { name: 'Edge 120', value: 4 },
            { name: 'Edge 119', value: 1.5 },
            { name: 'Edge 118', value: 0.8 },
        ],
    },
];

const meta: Meta<PieChartDrilldownComponent> = {
    title: 'UI/Charts/Pie Chart Drilldown',
    component: PieChartDrilldownComponent,
    tags: ['autodocs'],
    argTypes: {
        size: { control: { type: 'range', min: 200, max: 500 } },
        innerRadius: { control: { type: 'range', min: 0, max: 0.8, step: 0.1 } },
        showLabels: { control: 'boolean' },
        showLegend: { control: 'boolean' },
        showBreadcrumb: { control: 'boolean' },
        legendPosition: { control: 'select', options: ['top', 'bottom', 'left', 'right', 'none'] },
    },
};

export default meta;
type Story = StoryObj<PieChartDrilldownComponent>;

export const Default: Story = {
    args: {
        data: browserData,
        drilldownSeries: drilldownSeries,
        size: 300,
        innerRadius: 0,
        showLabels: true,
        showLegend: true,
        showBreadcrumb: true,
        legendPosition: 'right',
        title: 'Browser Market Share',
    },
};

export const DonutWithDrilldown: Story = {
    args: {
        data: browserData,
        drilldownSeries: drilldownSeries,
        size: 300,
        innerRadius: 0.5,
        showLabels: true,
        showLegend: true,
        title: 'Browser Market Share',
    },
};

export const LegendBottom: Story = {
    args: {
        data: browserData,
        drilldownSeries: drilldownSeries,
        size: 280,
        innerRadius: 0,
        showLegend: true,
        legendPosition: 'bottom',
        title: 'Browser Market Share',
    },
};
