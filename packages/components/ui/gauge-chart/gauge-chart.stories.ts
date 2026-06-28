import { Meta, StoryObj } from '@storybook/angular';
import { GaugeChartComponent } from './gauge-chart.component';

const meta: Meta<GaugeChartComponent> = {
  title: 'Charts/Gauge Chart',
  component: GaugeChartComponent,
};
export default meta;
type Story = StoryObj<GaugeChartComponent>;

export const Default: Story = {
  args: { value: 70, min: 0, max: 100, unit: '%', label: 'CPU load' },
};

export const WithThresholds: Story = {
  args: {
    value: 88, min: 0, max: 100, unit: '%', label: 'Disk usage',
    thresholds: [
      { value: 0, color: 'hsl(142, 71%, 45%)' },
      { value: 60, color: 'hsl(48, 96%, 53%)' },
      { value: 85, color: 'hsl(0, 84%, 60%)' },
    ],
  },
};

export const CustomRange: Story = {
  args: { value: 320, min: 0, max: 500, unit: ' rpm', label: 'Engine', size: 260 },
};
