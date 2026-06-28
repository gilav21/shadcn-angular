import { Meta, StoryObj } from '@storybook/angular';
import { HeatmapComponent } from './heatmap.component';
import { HeatmapCell } from '../../lib/chart.types';

const meta: Meta<HeatmapComponent> = {
  title: 'Charts/Heatmap',
  component: HeatmapComponent,
};
export default meta;
type Story = StoryObj<HeatmapComponent>;

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const hours = ['9am', '12pm', '3pm', '6pm'];
const data: HeatmapCell[] = days.flatMap((row, ri) =>
  hours.map((col, ci) => ({ row, col, value: ((ri * 7 + ci * 3) % 10) + 1 })),
);

export const Default: Story = {
  args: { data, width: 460 },
};

export const WithValues: Story = {
  args: { data, width: 460, showValues: true },
};
