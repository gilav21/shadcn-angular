import { Meta, StoryObj } from '@storybook/angular';
import { AreaChartComponent } from './area-chart.component';
import { ChartSeries } from '../../lib/chart.types';

const meta: Meta<AreaChartComponent> = {
  title: 'Charts/Area Chart',
  component: AreaChartComponent,
  argTypes: {
    curve: { control: 'select', options: ['linear', 'monotone', 'step'] },
    stackingMode: { control: 'select', options: ['absolute', 'percent'] },
    dir: { control: 'select', options: ['auto', 'ltr', 'rtl'] },
  },
};
export default meta;
type Story = StoryObj<AreaChartComponent>;

const series: ChartSeries[] = [
  { name: 'Desktop', data: [
    { name: 'Jan', value: 120 }, { name: 'Feb', value: 180 }, { name: 'Mar', value: 150 },
    { name: 'Apr', value: 220 }, { name: 'May', value: 260 },
  ] },
  { name: 'Mobile', data: [
    { name: 'Jan', value: 80 }, { name: 'Feb', value: 100 }, { name: 'Mar', value: 130 },
    { name: 'Apr', value: 160 }, { name: 'May', value: 210 },
  ] },
];

export const Default: Story = {
  args: { series, width: 560, height: 320, curve: 'monotone' },
};

export const Stacked: Story = {
  args: { series, width: 560, height: 320, curve: 'monotone', stacked: true },
};

export const StackedPercent: Story = {
  args: { series, width: 560, height: 320, curve: 'linear', stacked: true, stackingMode: 'percent' },
};

export const RightToLeft: Story = {
  args: { series, width: 560, height: 320, curve: 'monotone', stacked: true, dir: 'rtl' },
};
