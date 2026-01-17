import { Meta, StoryObj } from '@storybook/angular';
import { ColumnRangeChartComponent } from './column-range-chart.component';
import { RangeDataPoint } from './chart.types';

const temperatureData: RangeDataPoint[] = [
    { name: 'Jan', low: -5, high: 5 },
    { name: 'Feb', low: -3, high: 8 },
    { name: 'Mar', low: 2, high: 14 },
    { name: 'Apr', low: 8, high: 20 },
    { name: 'May', low: 13, high: 25 },
    { name: 'Jun', low: 18, high: 30 },
    { name: 'Jul', low: 20, high: 33 },
    { name: 'Aug', low: 19, high: 32 },
    { name: 'Sep', low: 14, high: 26 },
    { name: 'Oct', low: 8, high: 18 },
    { name: 'Nov', low: 2, high: 10 },
    { name: 'Dec', low: -3, high: 6 },
];

const stockData: RangeDataPoint[] = [
    { name: 'AAPL', low: 170, high: 195 },
    { name: 'GOOGL', low: 130, high: 155 },
    { name: 'MSFT', low: 360, high: 420 },
    { name: 'AMZN', low: 145, high: 185 },
    { name: 'META', low: 300, high: 380 },
];

const meta: Meta<ColumnRangeChartComponent> = {
    title: 'UI/Charts/Column Range Chart',
    component: ColumnRangeChartComponent,
    tags: ['autodocs'],
    argTypes: {
        width: { control: { type: 'range', min: 300, max: 800 } },
        height: { control: { type: 'range', min: 200, max: 500 } },
        showGrid: { control: 'boolean' },
        showRangeLabels: { control: 'boolean' },
        barRadius: { control: { type: 'range', min: 0, max: 12 } },
    },
};

export default meta;
type Story = StoryObj<ColumnRangeChartComponent>;

export const TemperatureRange: Story = {
    args: {
        data: temperatureData,
        width: 600,
        height: 300,
        showGrid: true,
        showRangeLabels: true,
        unit: '°C',
        title: 'Monthly Temperature Range',
    },
};

export const StockPriceRange: Story = {
    args: {
        data: stockData,
        width: 500,
        height: 300,
        showGrid: true,
        showRangeLabels: true,
        unit: '$',
        title: '52-Week Stock Price Range',
    },
};

export const NoLabels: Story = {
    args: {
        data: temperatureData.slice(0, 6),
        width: 400,
        height: 280,
        showGrid: true,
        showRangeLabels: false,
        unit: '°C',
    },
};

export const CustomColors: Story = {
    args: {
        data: [
            { name: 'Mon', low: 15, high: 28, color: 'hsl(220 70% 50%)' },
            { name: 'Tue', low: 12, high: 25, color: 'hsl(220 70% 55%)' },
            { name: 'Wed', low: 18, high: 32, color: 'hsl(220 70% 60%)' },
            { name: 'Thu', low: 20, high: 35, color: 'hsl(220 70% 65%)' },
            { name: 'Fri', low: 17, high: 30, color: 'hsl(220 70% 70%)' },
        ],
        width: 400,
        height: 280,
        showRangeLabels: true,
        unit: '°C',
    },
};
