import { Meta, StoryObj } from '@storybook/angular';
import { ColumnRangeChartComponent } from './column-range-chart.component';
import { RangeDataPoint } from '../../lib/chart.types';

const temperatureRanges: RangeDataPoint[] = [
    { name: 'Jan', low: -5, high: 4 },
    { name: 'Feb', low: -3, high: 6 },
    { name: 'Mar', low: 1, high: 11 },
    { name: 'Apr', low: 5, high: 17 },
    { name: 'May', low: 10, high: 22 },
    { name: 'Jun', low: 14, high: 27 },
    { name: 'Jul', low: 17, high: 30 },
    { name: 'Aug', low: 16, high: 29 },
];

const stockRanges: RangeDataPoint[] = [
    { name: 'Mon', low: 142, high: 151, color: '#3b82f6' },
    { name: 'Tue', low: 148, high: 156, color: '#3b82f6' },
    { name: 'Wed', low: 139, high: 149, color: '#ef4444' },
    { name: 'Thu', low: 144, high: 158, color: '#22c55e' },
    { name: 'Fri', low: 150, high: 162, color: '#22c55e' },
];

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct mode.
const meta: Meta<ColumnRangeChartComponent> = {
    title: 'Charts/Column Range Chart',
    component: ColumnRangeChartComponent,
    tags: ['autodocs'],
    argTypes: {
        data: { control: 'object', description: 'Range data points (`{ name, low, high, color? }`) to plot.' },
        dir: { control: 'select', options: ['auto', 'ltr', 'rtl'], description: 'Chart reading direction. `auto` detects from the surrounding DOM.' },
        width: { control: 'number', description: 'Fallback SVG width used before the container is measured.' },
        height: { control: 'number', description: 'SVG height.' },
        showGrid: { control: 'boolean', description: 'Shows horizontal gridlines and axis ticks.' },
        showRangeLabels: { control: 'boolean', description: 'Shows the low/high value labels above/below each bar.' },
        barRadius: { control: 'number', description: 'Corner radius of each range bar.' },
        barGap: { control: 'number', description: 'Gap in pixels between bars.' },
        title: { control: 'text', description: 'Accessible chart title, used in the generated aria-label.' },
        unit: { control: 'text', description: 'Unit suffix appended to formatted values (e.g. "°C").' },
        class: { control: 'text', description: 'Extra classes merged onto the host container.' },
    },
    args: {
        data: temperatureRanges,
        dir: 'auto',
        width: 500,
        height: 300,
        showGrid: true,
        showRangeLabels: true,
        barRadius: 4,
        barGap: 12,
        title: 'Monthly temperature range',
        unit: '°C',
        class: '',
    },
};

export default meta;
type Story = StoryObj<ColumnRangeChartComponent>;

const TEMPLATE = `
    <ui-column-range-chart
        [data]="data" [dir]="dir" [width]="width" [height]="height"
        [showGrid]="showGrid" [showRangeLabels]="showRangeLabels"
        [barRadius]="barRadius" [barGap]="barGap"
        [title]="title" [unit]="unit" [class]="class">
    </ui-column-range-chart>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Default: Story = { render };

export const StockPriceRanges: Story = {
    args: {
        data: stockRanges,
        title: 'Weekly stock price range',
        unit: '',
    },
    render,
};

export const NoGrid: Story = {
    args: { showGrid: false },
    render,
};

export const NoRangeLabels: Story = {
    args: { showRangeLabels: false },
    render,
};

export const RightToLeft: Story = {
    args: { dir: 'rtl' },
    render,
};
