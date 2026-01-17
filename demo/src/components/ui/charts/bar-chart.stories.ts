import { Meta, StoryObj } from '@storybook/angular';
import { BarChartComponent } from './bar-chart.component';
import { ChartDataPoint } from './chart.types';

const sampleData: ChartDataPoint[] = [
    { name: 'Jan', value: 4500 },
    { name: 'Feb', value: 3800 },
    { name: 'Mar', value: 5200 },
    { name: 'Apr', value: 4800 },
    { name: 'May', value: 6100 },
    { name: 'Jun', value: 5500 },
];

const countryData: ChartDataPoint[] = [
    { name: 'China', value: 1425 },
    { name: 'India', value: 1417 },
    { name: 'USA', value: 339 },
    { name: 'Indonesia', value: 275 },
    { name: 'Pakistan', value: 235 },
    { name: 'Nigeria', value: 223 },
];

const meta: Meta<BarChartComponent> = {
    title: 'UI/Charts/Bar Chart',
    component: BarChartComponent,
    tags: ['autodocs'],
    argTypes: {
        width: { control: { type: 'range', min: 300, max: 800 } },
        height: { control: { type: 'range', min: 200, max: 500 } },
        orientation: { control: 'select', options: ['vertical', 'horizontal'] },
        showGrid: { control: 'boolean' },
        showValues: { control: 'boolean' },
        showTooltip: { control: 'boolean' },
        barRadius: { control: { type: 'range', min: 0, max: 12 } },
        barGap: { control: { type: 'range', min: 2, max: 24 } },
    },
};

export default meta;
type Story = StoryObj<BarChartComponent>;

export const VerticalBars: Story = {
    args: {
        data: sampleData,
        width: 500,
        height: 300,
        orientation: 'vertical',
        showGrid: true,
        showValues: true,
        title: 'Monthly Revenue',
    },
};

export const HorizontalBars: Story = {
    args: {
        data: countryData,
        width: 500,
        height: 350,
        orientation: 'horizontal',
        showGrid: true,
        showValues: true,
        title: 'Population by Country (millions)',
    },
};

export const WithAxisLabels: Story = {
    args: {
        data: sampleData,
        width: 520,
        height: 320,
        orientation: 'vertical',
        showGrid: true,
        showValues: true,
        xAxisLabel: 'Month',
        yAxisLabel: 'Revenue ($)',
    },
};

export const NoGridLines: Story = {
    args: {
        data: sampleData,
        width: 500,
        height: 300,
        orientation: 'vertical',
        showGrid: false,
        showValues: true,
    },
};

export const CustomColors: Story = {
    args: {
        data: [
            { name: 'Q1', value: 1200, color: 'hsl(220 70% 50%)' },
            { name: 'Q2', value: 1800, color: 'hsl(160 60% 45%)' },
            { name: 'Q3', value: 1500, color: 'hsl(30 80% 55%)' },
            { name: 'Q4', value: 2100, color: 'hsl(280 65% 60%)' },
        ],
        width: 400,
        height: 280,
        orientation: 'vertical',
    },
};

export const RoundedBars: Story = {
    args: {
        data: sampleData,
        width: 500,
        height: 300,
        orientation: 'vertical',
        barRadius: 8,
        barGap: 16,
    },
};
