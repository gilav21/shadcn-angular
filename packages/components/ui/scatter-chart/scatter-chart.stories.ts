import { Meta, StoryObj } from '@storybook/angular';
import { ScatterChartComponent } from './scatter-chart.component';
import { XYSeries } from '../../lib/chart.types';

const meta: Meta<ScatterChartComponent> = {
  title: 'Charts/Scatter Chart',
  component: ScatterChartComponent,
  argTypes: {
    dir: { control: 'select', options: ['auto', 'ltr', 'rtl'] },
  },
};
export default meta;
type Story = StoryObj<ScatterChartComponent>;

const series: XYSeries[] = [
  { name: 'Group A', points: [
    { x: 12, y: 22 }, { x: 18, y: 30 }, { x: 25, y: 18 }, { x: 30, y: 40 }, { x: 36, y: 33 },
  ] },
  { name: 'Group B', points: [
    { x: 15, y: 55 }, { x: 22, y: 48 }, { x: 28, y: 62 }, { x: 35, y: 51 }, { x: 41, y: 70 },
  ] },
];

export const Default: Story = {
  args: { series, width: 540, height: 340 },
};

export const SingleSeries: Story = {
  args: { series: [series[0]], width: 540, height: 340, showLegend: false },
};

export const RightToLeft: Story = {
  args: { series, width: 540, height: 340, dir: 'rtl' },
};
