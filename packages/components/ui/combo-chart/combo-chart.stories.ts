import { Meta, StoryObj } from '@storybook/angular';
import { ComboChartComponent } from './combo-chart.component';
import { ChartSeries } from '../../lib/chart.types';

const meta: Meta<ComboChartComponent> = {
  title: 'Charts/Combo Chart',
  component: ComboChartComponent,
  argTypes: {
    dir: { control: 'select', options: ['auto', 'ltr', 'rtl'] },
  },
};
export default meta;
type Story = StoryObj<ComboChartComponent>;

const defects: ChartSeries[] = [
  { name: 'Defects', data: [
    { name: 'Scratches', value: 50 }, { name: 'Dents', value: 30 },
    { name: 'Cracks', value: 15 }, { name: 'Stains', value: 12 }, { name: 'Other', value: 8 },
  ] },
];

const target: ChartSeries[] = [
  { name: 'Target', data: [
    { name: 'Scratches', value: 45 }, { name: 'Dents', value: 33 },
    { name: 'Cracks', value: 18 }, { name: 'Stains', value: 10 }, { name: 'Other', value: 6 },
  ] },
];

export const Pareto: Story = {
  args: { barSeries: defects, showCumulative: true, width: 560, height: 340 },
};

export const BarPlusLine: Story = {
  args: { barSeries: defects, lineSeries: target, width: 560, height: 340 },
};

export const RightToLeft: Story = {
  args: { barSeries: defects, showCumulative: true, width: 560, height: 340, dir: 'rtl' },
};
