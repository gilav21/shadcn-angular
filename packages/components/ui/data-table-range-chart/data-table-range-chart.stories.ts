import { Meta, StoryObj } from '@storybook/angular';
import { DataTableRangeChartComponent, RangeChartData } from './data-table-range-chart.component';

const meta: Meta<DataTableRangeChartComponent> = {
  title: 'Data Display/Data Table Range Chart',
  component: DataTableRangeChartComponent,
};
export default meta;
type Story = StoryObj<DataTableRangeChartComponent>;

const multiSeries: RangeChartData = {
  categories: ['Alice', 'Bob', 'Charlie', 'Dora'],
  series: [
    { name: 'Q1', values: [12, 30, 21, 8] },
    { name: 'Q2', values: [18, 24, 27, 14] },
  ],
};

export const MultiSeries: Story = {
  args: { payload: multiSeries, open: true, title: 'Range chart' },
};

export const SingleSeries: Story = {
  args: {
    payload: { categories: ['Q1', 'Q2', 'Q3', 'Q4'], series: [{ name: 'Revenue', values: [42, 55, 38, 61] }] },
    open: true,
    title: 'Quarterly revenue',
  },
};
