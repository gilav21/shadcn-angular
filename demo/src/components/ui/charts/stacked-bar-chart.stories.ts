import { Meta, StoryObj } from '@storybook/angular';
import { StackedBarChartComponent } from './stacked-bar-chart.component';
import { ChartSeries } from './chart.types';

const salesData: ChartSeries[] = [
    {
        name: 'Product A',
        data: [
            { name: 'Q1', value: 120 },
            { name: 'Q2', value: 150 },
            { name: 'Q3', value: 180 },
            { name: 'Q4', value: 200 },
        ],
    },
    {
        name: 'Product B',
        data: [
            { name: 'Q1', value: 80 },
            { name: 'Q2', value: 100 },
            { name: 'Q3', value: 90 },
            { name: 'Q4', value: 130 },
        ],
    },
    {
        name: 'Product C',
        data: [
            { name: 'Q1', value: 50 },
            { name: 'Q2', value: 60 },
            { name: 'Q3', value: 70 },
            { name: 'Q4', value: 45 },
        ],
    },
];

const categories = ['Q1', 'Q2', 'Q3', 'Q4'];

const meta: Meta<StackedBarChartComponent> = {
    title: 'UI/Charts/Stacked Bar Chart',
    component: StackedBarChartComponent,
    tags: ['autodocs'],
    argTypes: {
        width: { control: { type: 'range', min: 300, max: 800 } },
        height: { control: { type: 'range', min: 200, max: 500 } },
        stacking: { control: 'select', options: ['absolute', 'percent'] },
        showGrid: { control: 'boolean' },
        showTotal: { control: 'boolean' },
        showLegend: { control: 'boolean' },
    },
};

export default meta;
type Story = StoryObj<StackedBarChartComponent>;

export const Default: Story = {
    args: {
        series: salesData,
        categories: categories,
        width: 500,
        height: 300,
        stacking: 'absolute',
        showGrid: true,
        showTotal: false,
        showLegend: true,
        title: 'Quarterly Sales by Product',
    },
};

export const PercentStacking: Story = {
    args: {
        series: salesData,
        categories: categories,
        width: 500,
        height: 300,
        stacking: 'percent',
        showGrid: true,
        showTotal: false,
        showLegend: true,
        title: 'Sales Distribution (%)',
    },
};

export const WithTotals: Story = {
    args: {
        series: salesData,
        categories: categories,
        width: 500,
        height: 320,
        stacking: 'absolute',
        showGrid: true,
        showTotal: true,
        showLegend: true,
    },
};

export const ManyCategories: Story = {
    args: {
        series: [
            {
                name: 'Desktop',
                data: [
                    { name: 'Jan', value: 50 },
                    { name: 'Feb', value: 55 },
                    { name: 'Mar', value: 60 },
                    { name: 'Apr', value: 58 },
                    { name: 'May', value: 62 },
                    { name: 'Jun', value: 65 },
                ],
            },
            {
                name: 'Mobile',
                data: [
                    { name: 'Jan', value: 40 },
                    { name: 'Feb', value: 45 },
                    { name: 'Mar', value: 50 },
                    { name: 'Apr', value: 55 },
                    { name: 'May', value: 60 },
                    { name: 'Jun', value: 68 },
                ],
            },
            {
                name: 'Tablet',
                data: [
                    { name: 'Jan', value: 10 },
                    { name: 'Feb', value: 12 },
                    { name: 'Mar', value: 8 },
                    { name: 'Apr', value: 11 },
                    { name: 'May', value: 9 },
                    { name: 'Jun', value: 10 },
                ],
            },
        ],
        categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        width: 600,
        height: 300,
        stacking: 'absolute',
        showLegend: true,
    },
};
