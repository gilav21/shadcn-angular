import { Meta, StoryObj } from '@storybook/angular';
import { CalendarHeatmapComponent } from './calendar-heatmap.component';
import { CalendarDay } from '../../lib/chart.types';

const meta: Meta<CalendarHeatmapComponent> = {
  title: 'Charts/Calendar Heatmap',
  component: CalendarHeatmapComponent,
};
export default meta;
type Story = StoryObj<CalendarHeatmapComponent>;

function yearOfData(): CalendarDay[] {
  const out: CalendarDay[] = [];
  const start = Date.UTC(2026, 0, 1);
  for (let i = 0; i < 180; i++) {
    const ms = start + i * 86_400_000;
    const d = new Date(ms);
    const date = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    out.push({ date, value: (i * 13) % 11 });
  }
  return out;
}

export const Default: Story = {
  args: { data: yearOfData(), cellSize: 13 },
};
