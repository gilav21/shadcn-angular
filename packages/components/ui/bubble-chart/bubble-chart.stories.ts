import { Meta, StoryObj } from '@storybook/angular';
import { BubbleChartComponent } from './bubble-chart.component';
import { XYZSeries } from '../../lib/chart.types';

const meta: Meta<BubbleChartComponent> = {
  title: 'Charts/Bubble Chart',
  component: BubbleChartComponent,
  argTypes: {
    dir: { control: 'select', options: ['auto', 'ltr', 'rtl'] },
  },
};
export default meta;
type Story = StoryObj<BubbleChartComponent>;

const series: XYZSeries[] = [
  { name: 'Products', points: [
    { x: 10, y: 20, z: 30 }, { x: 22, y: 35, z: 80 }, { x: 30, y: 15, z: 50 },
    { x: 38, y: 42, z: 120 }, { x: 46, y: 28, z: 65 },
  ] },
  { name: 'Services', points: [
    { x: 14, y: 50, z: 40 }, { x: 26, y: 60, z: 95 }, { x: 34, y: 48, z: 70 },
  ] },
];

export const Default: Story = {
  args: { series, width: 560, height: 360 },
};

export const LargeRange: Story = {
  args: { series, width: 560, height: 360, minRadius: 4, maxRadius: 40 },
};

export const RightToLeft: Story = {
  args: { series, width: 560, height: 360, dir: 'rtl' },
};
