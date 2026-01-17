import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { PieChartComponent } from './pie-chart.component';
import { ChartDataPoint } from './chart.types';

const sampleData: ChartDataPoint[] = [
    { name: 'Chrome', value: 61.41 },
    { name: 'Safari', value: 24.43 },
    { name: 'Edge', value: 6.28 },
    { name: 'Firefox', value: 4.14 },
    { name: 'Opera', value: 1.73 },
    { name: 'Other', value: 2.01 },
];

const meta: Meta<PieChartComponent> = {
    title: 'UI/Charts/Pie Chart',
    component: PieChartComponent,
    tags: ['autodocs'],
    argTypes: {
        size: { control: { type: 'range', min: 200, max: 500 } },
        innerRadius: { control: { type: 'range', min: 0, max: 0.8, step: 0.1 } },
        showLabels: { control: 'boolean' },
        showLegend: { control: 'boolean' },
        showTooltip: { control: 'boolean' },
        legendPosition: { control: 'select', options: ['top', 'bottom', 'left', 'right', 'none'] },
    },
};

export default meta;
type Story = StoryObj<PieChartComponent>;

export const Default: Story = {
    args: {
        data: sampleData,
        size: 300,
        innerRadius: 0,
        showLabels: true,
        showLegend: true,
        legendPosition: 'right',
    },
};

export const DonutChart: Story = {
    args: {
        data: sampleData,
        size: 300,
        innerRadius: 0.5,
        showLabels: true,
        showLegend: true,
        legendPosition: 'right',
    },
};

export const WithCustomColors: Story = {
    args: {
        data: [
            { name: 'Primary', value: 40, color: 'hsl(220 70% 50%)' },
            { name: 'Secondary', value: 30, color: 'hsl(160 60% 45%)' },
            { name: 'Tertiary', value: 20, color: 'hsl(30 80% 55%)' },
            { name: 'Other', value: 10, color: 'hsl(280 65% 60%)' },
        ],
        size: 300,
        innerRadius: 0,
    },
};

export const LegendPositions: Story = {
    render: () => ({
        props: { data: sampleData.slice(0, 4) },
        template: `
            <div class="grid grid-cols-2 gap-8">
                <div>
                    <h3 class="text-sm font-medium mb-2">Legend: Right (default)</h3>
                    <ui-pie-chart [data]="data" [size]="200" legendPosition="right" />
                </div>
                <div>
                    <h3 class="text-sm font-medium mb-2">Legend: Bottom</h3>
                    <ui-pie-chart [data]="data" [size]="200" legendPosition="bottom" />
                </div>
                <div>
                    <h3 class="text-sm font-medium mb-2">Legend: Left</h3>
                    <ui-pie-chart [data]="data" [size]="200" legendPosition="left" />
                </div>
                <div>
                    <h3 class="text-sm font-medium mb-2">Legend: Top</h3>
                    <ui-pie-chart [data]="data" [size]="200" legendPosition="top" />
                </div>
            </div>
        `,
    }),
};

export const NoLegend: Story = {
    args: {
        data: sampleData,
        size: 300,
        innerRadius: 0.6,
        showLegend: false,
    },
};

export const SmallChart: Story = {
    args: {
        data: sampleData.slice(0, 3),
        size: 150,
        showLabels: false,
        showLegend: false,
    },
};
