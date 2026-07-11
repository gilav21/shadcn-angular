import { Meta, StoryObj } from '@storybook/angular';
import { ComboChartComponent } from './combo-chart.component';
import { ChartSeries } from '../../lib/chart.types';

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

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct mode.
const meta: Meta<ComboChartComponent> = {
  title: 'Charts/Combo Chart',
  component: ComboChartComponent,
  tags: ['autodocs'],
  argTypes: {
    barSeries: { control: 'object', description: 'Bar series data, rendered on the primary (left) axis.' },
    lineSeries: { control: 'object', description: 'Line series data, rendered on the secondary (right) axis.' },
    width: { control: 'number', description: 'Fallback SVG width used before the container is measured.' },
    height: { control: 'number', description: 'SVG height.' },
    showCumulative: { control: 'boolean', description: 'Adds a cumulative-percentage line over the bars (Pareto mode) on the secondary axis.' },
    cumulativeLabel: { control: 'text', description: 'Legend/tooltip label for the cumulative line.' },
    barRadius: { control: 'number', description: 'Corner radius of each bar.' },
    showGrid: { control: 'boolean', description: 'Shows the primary-axis gridlines and ticks.' },
    showTooltip: { control: 'boolean', description: 'Shows the hover tooltip.' },
    showLegend: { control: 'boolean', description: 'Shows the series legend.' },
    title: { control: 'text', description: 'Accessible chart title, used in the generated aria-label.' },
    dir: { control: 'select', options: ['auto', 'ltr', 'rtl'], description: 'Chart reading direction. `auto` detects from the surrounding DOM.' },
    class: { control: 'text', description: 'Extra classes merged onto the host container.' },
  },
  args: {
    barSeries: defects,
    lineSeries: [],
    width: 560,
    height: 340,
    showCumulative: false,
    cumulativeLabel: 'Cumulative',
    barRadius: 2,
    showGrid: true,
    showTooltip: true,
    showLegend: true,
    title: undefined,
    dir: 'auto',
    class: '',
  },
};
export default meta;
type Story = StoryObj<ComboChartComponent>;

const TEMPLATE = `
    <ui-combo-chart
        [barSeries]="barSeries" [lineSeries]="lineSeries" [width]="width" [height]="height"
        [showCumulative]="showCumulative" [cumulativeLabel]="cumulativeLabel" [barRadius]="barRadius"
        [showGrid]="showGrid" [showTooltip]="showTooltip" [showLegend]="showLegend"
        [title]="title" [dir]="dir" [class]="class">
    </ui-combo-chart>`;

const render: NonNullable<Story['render']> = (args) => ({
  props: args,
  template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Pareto: Story = {
  args: { barSeries: defects, showCumulative: true, width: 560, height: 340 },
  render,
};

export const BarPlusLine: Story = {
  args: { barSeries: defects, lineSeries: target, width: 560, height: 340 },
  render,
};

export const RightToLeft: Story = {
  args: { barSeries: defects, showCumulative: true, width: 560, height: 340, dir: 'rtl' },
  render,
};
