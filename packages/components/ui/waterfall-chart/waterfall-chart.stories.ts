import { Meta, StoryObj } from '@storybook/angular';
import { WaterfallChartComponent } from './waterfall-chart.component';
import { WaterfallBar } from '../../lib/chart.types';

const meta: Meta<WaterfallChartComponent> = {
    title: 'Charts/Waterfall Chart',
    component: WaterfallChartComponent,
    tags: ['autodocs'],
    argTypes: {
        data: { control: 'object', description: 'Waterfall bars: `{ name, value, type?: "relative" | "total", color? }`.' },
        width: { control: 'number', description: 'Fallback SVG width in px when the container cannot be measured.' },
        height: { control: 'number', description: 'SVG height in px.' },
        showConnectors: { control: 'boolean', description: 'Draws connector lines between consecutive bars.' },
        showValues: { control: 'boolean', description: 'Shows the value label on each bar.' },
        showTooltip: { control: 'boolean', description: 'Enables the hover tooltip.' },
        positiveColor: { control: 'color', description: 'Bar color for positive relative values.' },
        negativeColor: { control: 'color', description: 'Bar color for negative relative values.' },
        totalColor: { control: 'color', description: 'Bar color for `type: "total"` bars.' },
        barRadius: { control: 'number', description: 'Corner radius of each bar, in px.', min: 0, max: 16 },
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
        title: { control: 'text', description: 'Accessible chart title, also used in the ARIA summary.' },
        dir: { control: 'select', options: ['ltr', 'rtl', 'auto'], description: 'Layout direction; `auto` detects from the DOM.' },
        barClick: { control: false, description: 'Emits `{ point, index }` when a bar is clicked.' },
    },
    args: {
        data: [
            { name: 'Start', value: 1200, type: 'total' },
            { name: 'Sales', value: 450 },
            { name: 'Returns', value: -180 },
            { name: 'Services', value: 300 },
            { name: 'Costs', value: -520 },
            { name: 'Net', value: 1250, type: 'total' },
        ],
        width: 560,
        height: 340,
        showConnectors: true,
        showValues: false,
        showTooltip: true,
        positiveColor: 'hsl(142, 71%, 45%)',
        negativeColor: 'hsl(0, 84%, 60%)',
        totalColor: 'hsl(221, 83%, 53%)',
        barRadius: 2,
        class: '',
        title: undefined,
        dir: 'auto',
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

const TEMPLATE = `
    <ui-waterfall-chart
        [data]="data" [width]="width" [height]="height"
        [showConnectors]="showConnectors" [showValues]="showValues" [showTooltip]="showTooltip"
        [positiveColor]="positiveColor" [negativeColor]="negativeColor" [totalColor]="totalColor"
        [barRadius]="barRadius" [class]="class" [title]="title" [dir]="dir" />`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render, args: { data } };

export const Default: Story = {
    args: { data, width: 560, height: 340, showValues: true },
    render,
};

export const NoConnectors: Story = {
    args: { data, width: 560, height: 340, showConnectors: false },
    render,
};

export const WithTitle: Story = {
    args: { data, width: 560, height: 340, title: 'Q3 Revenue Bridge' },
    render,
};

export const CustomColors: Story = {
    args: {
        data,
        width: 560,
        height: 340,
        positiveColor: 'hsl(266, 84%, 60%)',
        negativeColor: 'hsl(340, 82%, 55%)',
        totalColor: 'hsl(38, 92%, 50%)',
    },
    render,
};

export const RoundedBars: Story = {
    args: { data, width: 560, height: 340, barRadius: 8 },
    render,
};

export const Rtl: Story = {
    args: { data, width: 560, height: 340, dir: 'rtl' },
    render,
};
