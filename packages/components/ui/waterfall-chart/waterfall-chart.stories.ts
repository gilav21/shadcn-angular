import { Meta, StoryObj } from '@storybook/angular';
import { WaterfallChartComponent } from './waterfall-chart.component';
import { WaterfallBar } from '../../lib/chart.types';

const meta: Meta<WaterfallChartComponent> = {
  title: 'Charts/Waterfall Chart',
  component: WaterfallChartComponent,
  argTypes: {
    dir: { control: 'select', options: ['auto', 'ltr', 'rtl'] },
  },
};
export default meta;
type Story = StoryObj<WaterfallChartComponent>;

const data: WaterfallBar[] = [
  { name: 'Start', value: 1200, type: 'total' },
  { name: 'Sales', value: 450 },
  { name: 'Returns', value: -180 },
  { name: 'Services', value: 300 },
  { name: 'Costs', value: -520 },
  { name: 'Net', value: 1250, type: 'total' },
];

export const Default: Story = {
  args: { data, width: 560, height: 340, showValues: true },
};

export const NoConnectors: Story = {
  args: { data, width: 560, height: 340, showConnectors: false },
};
