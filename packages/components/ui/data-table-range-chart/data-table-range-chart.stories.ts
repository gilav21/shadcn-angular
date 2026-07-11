import { Meta, StoryObj } from '@storybook/angular';
import { DataTableRangeChartComponent, RangeChartData } from './data-table-range-chart.component';

const multiSeries: RangeChartData = {
    categories: ['Alice', 'Bob', 'Charlie', 'Dora'],
    series: [
        { name: 'Q1', values: [12, 30, 21, 8] },
        { name: 'Q2', values: [18, 24, 27, 14] },
    ],
};

const singleSeries: RangeChartData = {
    categories: ['Q1', 'Q2', 'Q3', 'Q4'],
    series: [{ name: 'Revenue', values: [42, 55, 38, 61] }],
};

const meta: Meta<DataTableRangeChartComponent> = {
    title: 'Data Display/Data Table Range Chart',
    component: DataTableRangeChartComponent,
    tags: ['autodocs'],
    argTypes: {
        payload: {
            control: 'object',
            description: 'The range payload to chart (categories + one or more numeric series); the dialog shows nothing useful when null.',
        },
        open: { control: 'boolean', description: 'Two-way dialog visibility.' },
        title: { control: 'text', description: 'Dialog title.' },
        chartType: {
            control: 'select',
            options: ['bar', 'pie', 'stacked'],
            description: 'Active chart type; two-way so consumers can preset/observe it.',
        },
        class: { control: 'text', description: 'Extra classes merged onto the chart content wrapper.' },
    },
    args: {
        payload: multiSeries,
        open: true,
        title: 'Range chart',
        chartType: 'bar',
        class: '',
    },
};
export default meta;
type Story = StoryObj<DataTableRangeChartComponent>;

const TEMPLATE = `
    <ui-data-table-range-chart
        [payload]="payload"
        [open]="open"
        [title]="title"
        [chartType]="chartType"
        [class]="class"
    />`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

export const Playground: Story = { render };

export const BarChart: Story = {
    args: { payload: multiSeries, open: true, title: 'Range chart', chartType: 'bar' },
    render,
};

export const PieChart: Story = {
    args: { payload: multiSeries, open: true, title: 'Range chart', chartType: 'pie' },
    render,
};

export const StackedChart: Story = {
    args: { payload: multiSeries, open: true, title: 'Range chart', chartType: 'stacked' },
    render,
};

export const SingleSeries: Story = {
    args: { payload: singleSeries, open: true, title: 'Quarterly revenue', chartType: 'bar' },
    render,
};
