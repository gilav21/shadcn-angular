import { Meta, StoryObj } from '@storybook/angular';
import { LineChartComponent } from './line-chart.component';
import { ChartSeries } from '../../lib/chart.types';

const meta: Meta<LineChartComponent> = {
  title: 'Charts/Line Chart',
  component: LineChartComponent,
  argTypes: {
    curve: { control: 'select', options: ['linear', 'monotone', 'step'] },
    dir: { control: 'select', options: ['auto', 'ltr', 'rtl'] },
  },
};
export default meta;
type Story = StoryObj<LineChartComponent>;

const series: ChartSeries[] = [
  { name: 'Revenue', data: [
    { name: 'Jan', value: 120 }, { name: 'Feb', value: 180 }, { name: 'Mar', value: 150 },
    { name: 'Apr', value: 220 }, { name: 'May', value: 260 }, { name: 'Jun', value: 240 },
  ] },
  { name: 'Cost', data: [
    { name: 'Jan', value: 90 }, { name: 'Feb', value: 110 }, { name: 'Mar', value: 100 },
    { name: 'Apr', value: 140 }, { name: 'May', value: 160 }, { name: 'Jun', value: 150 },
  ] },
];

export const Default: Story = {
  args: { series, width: 560, height: 320, curve: 'linear' },
};

export const SmoothMonotone: Story = {
  args: { series, width: 560, height: 320, curve: 'monotone' },
};

export const Stepped: Story = {
  args: { series, width: 560, height: 320, curve: 'step' },
};

export const SingleSeriesNoLegend: Story = {
  args: { series: [series[0]], width: 560, height: 320, curve: 'monotone', showLegend: false },
};

export const RightToLeft: Story = {
  args: { series, width: 560, height: 320, curve: 'monotone', dir: 'rtl' },
};
