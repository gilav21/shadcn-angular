import { Meta, StoryObj } from '@storybook/angular';
import { FunnelChartComponent } from './funnel-chart.component';
import { ChartDataPoint } from '../../lib/chart.types';

const meta: Meta<FunnelChartComponent> = {
  title: 'Charts/Funnel Chart',
  component: FunnelChartComponent,
  argTypes: {
    percentageMode: { control: 'select', options: ['first', 'previous'] },
  },
};
export default meta;
type Story = StoryObj<FunnelChartComponent>;

const data: ChartDataPoint[] = [
  { name: 'Visits', value: 1000 },
  { name: 'Signups', value: 600 },
  { name: 'Trials', value: 300 },
  { name: 'Paid', value: 120 },
];

export const Default: Story = {
  args: { data, width: 440, height: 320 },
};

export const VsPreviousStage: Story = {
  args: { data, width: 440, height: 320, percentageMode: 'previous' },
};
