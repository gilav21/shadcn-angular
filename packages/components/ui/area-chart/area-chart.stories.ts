import { Meta, StoryObj } from '@storybook/angular';
import { AreaChartComponent } from './area-chart.component';
import { ChartSeries } from '../../lib/chart.types';

const series: ChartSeries[] = [
    {
        name: 'Desktop', data: [
            { name: 'Jan', value: 120 }, { name: 'Feb', value: 180 }, { name: 'Mar', value: 150 },
            { name: 'Apr', value: 220 }, { name: 'May', value: 260 },
        ],
    },
    {
        name: 'Mobile', data: [
            { name: 'Jan', value: 80 }, { name: 'Feb', value: 100 }, { name: 'Mar', value: 130 },
            { name: 'Apr', value: 160 }, { name: 'May', value: 210 },
        ],
    },
];

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct visual mode.
const meta: Meta<AreaChartComponent> = {
    title: 'Charts/Area Chart',
    component: AreaChartComponent,
    tags: ['autodocs'],
    argTypes: {
        series: { control: 'object', description: 'Chart series data — each series has a `name`, `color`, and `data` points (`{ name, value }`).' },
        width: { control: 'number', min: 200, max: 1200, step: 10, description: 'Fallback SVG width used before the container is measured for responsive sizing.' },
        height: { control: 'number', min: 100, max: 800, step: 10, description: 'SVG height in pixels.' },
        curve: {
            control: 'select',
            options: ['linear', 'monotone', 'step'],
            description: 'Interpolation curve used for the area and line paths.',
        },
        stacked: { control: 'boolean', description: 'Stacks series on top of each other instead of overlapping.' },
        stackingMode: {
            control: 'select',
            options: ['absolute', 'percent'],
            description: 'When stacked, whether values stack as raw totals or normalized percentages.',
        },
        fillOpacity: { control: 'number', min: 0, max: 1, step: 0.05, description: 'Fill opacity of the area fill.' },
        showGrid: { control: 'boolean', description: 'Shows horizontal gridlines.' },
        showTooltip: { control: 'boolean', description: 'Shows the hover tooltip.' },
        showLegend: { control: 'boolean', description: 'Shows the series legend below the chart.' },
        showCrosshair: { control: 'boolean', description: 'Shows a vertical crosshair line at the hovered category.' },
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
        title: { control: 'text', description: 'Accessible title used to build the chart\'s aria-label.' },
        dir: {
            control: 'select',
            options: ['auto', 'ltr', 'rtl'],
            description: 'Layout direction. `auto` detects RTL from the DOM; `ltr`/`rtl` force it.',
        },
    },
    args: {
        series,
        width: 560,
        height: 320,
        curve: 'monotone',
        stacked: false,
        stackingMode: 'absolute',
        fillOpacity: 0.25,
        showGrid: true,
        showTooltip: true,
        showLegend: true,
        showCrosshair: true,
        class: '',
        title: '',
        dir: 'auto',
    },
};
export default meta;
type Story = StoryObj<AreaChartComponent>;

const TEMPLATE = `
    <ui-area-chart
        [series]="series" [width]="width" [height]="height"
        [curve]="curve" [stacked]="stacked" [stackingMode]="stackingMode"
        [fillOpacity]="fillOpacity" [showGrid]="showGrid" [showTooltip]="showTooltip"
        [showLegend]="showLegend" [showCrosshair]="showCrosshair"
        [class]="class" [title]="title" [dir]="dir" />`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Default: Story = {
    args: { series, width: 560, height: 320, curve: 'monotone' },
    render,
};

export const Stacked: Story = {
    args: { series, width: 560, height: 320, curve: 'monotone', stacked: true },
    render,
};

export const StackedPercent: Story = {
    args: { series, width: 560, height: 320, curve: 'linear', stacked: true, stackingMode: 'percent' },
    render,
};

export const Curves: Story = {
    render: (args) => ({
        props: { ...args, series },
        template: `
            <div class="flex flex-col gap-6">
                <ui-area-chart [series]="series" [width]="480" [height]="220" curve="linear" title="Linear" />
                <ui-area-chart [series]="series" [width]="480" [height]="220" curve="monotone" title="Monotone" />
                <ui-area-chart [series]="series" [width]="480" [height]="220" curve="step" title="Step" />
            </div>`,
    }),
};

export const RightToLeft: Story = {
    args: { series, width: 560, height: 320, curve: 'monotone', stacked: true, dir: 'rtl' },
    render: (args) => ({
        props: args,
        template: `<div dir="rtl">${TEMPLATE}</div>`,
    }),
};

export const Minimal: Story = {
    args: {
        series, width: 560, height: 320,
        showGrid: false, showTooltip: false, showLegend: false, showCrosshair: false,
    },
    render,
};
