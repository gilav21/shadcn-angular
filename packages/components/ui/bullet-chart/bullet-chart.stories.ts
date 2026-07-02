import { Meta, StoryObj } from '@storybook/angular';
import { BulletChartComponent } from './bullet-chart.component';

const meta: Meta<BulletChartComponent> = {
  title: 'Charts/Bullet Chart',
  component: BulletChartComponent,
};
export default meta;
type Story = StoryObj<BulletChartComponent>;

export const Default: Story = {
  args: { value: 70, target: 80, ranges: [50, 75, 100], width: 360, height: 44, label: 'Revenue', unit: 'K' },
};

export const Exceeding: Story = {
  args: { value: 92, target: 80, ranges: [50, 75, 100], width: 360, height: 44, label: 'Signups' },
};

export const NoTarget: Story = {
  args: { value: 40, ranges: [30, 60, 90], width: 360, height: 44, label: 'Storage', unit: 'GB' },
};
