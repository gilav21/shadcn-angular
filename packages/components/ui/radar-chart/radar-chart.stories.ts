import { Meta, StoryObj } from '@storybook/angular';
import { RadarChartComponent } from './radar-chart.component';
import { ChartSeries } from '../../lib/chart.types';

const meta: Meta<RadarChartComponent> = {
  title: 'Charts/Radar Chart',
  component: RadarChartComponent,
};
export default meta;
type Story = StoryObj<RadarChartComponent>;

const series: ChartSeries[] = [
  { name: 'Product A', data: [
    { name: 'Speed', value: 8 }, { name: 'Power', value: 6 }, { name: 'Range', value: 9 },
    { name: 'Comfort', value: 5 }, { name: 'Price', value: 7 }, { name: 'Safety', value: 8 },
  ] },
  { name: 'Product B', data: [
    { name: 'Speed', value: 5 }, { name: 'Power', value: 9 }, { name: 'Range', value: 4 },
    { name: 'Comfort', value: 8 }, { name: 'Price', value: 6 }, { name: 'Safety', value: 7 },
  ] },
];

export const Default: Story = {
  args: { series, size: 360, levels: 4 },
};

export const SingleSeries: Story = {
  args: { series: [series[0]], size: 360, levels: 5, showLegend: false },
};
