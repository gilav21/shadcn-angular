import { Meta, StoryObj } from '@storybook/angular';
import { BulletChartComponent } from './bullet-chart.component';

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct visual mode.
const meta: Meta<BulletChartComponent> = {
    title: 'Charts/Bullet Chart',
    component: BulletChartComponent,
    tags: ['autodocs'],
    argTypes: {
        value: { control: 'number', description: 'Current measure value (required).' },
        target: { control: 'number', description: 'Optional target value rendered as a tick marker.' },
        ranges: {
            control: 'object',
            description: 'Qualitative range breakpoints (e.g. poor/satisfactory/good) rendered as background bands.',
        },
        min: { control: 'number', description: 'Minimum value of the scale.' },
        width: { control: 'number', min: 120, max: 800, step: 10, description: 'Fallback SVG width when no responsive container width is measured.' },
        height: { control: 'number', min: 20, max: 120, step: 2, description: 'SVG height in pixels.' },
        color: { control: 'color', description: 'Measure bar color; falls back to `hsl(var(--primary))` when empty.' },
        label: { control: 'text', description: 'Label announced before the value in the accessible name.' },
        unit: { control: 'text', description: 'Unit suffix appended to displayed/announced values.' },
        title: { control: 'text', description: 'Optional title prefixed to the accessible name.' },
        dir: {
            control: 'select',
            options: ['ltr', 'rtl', 'auto'],
            description: 'Reading direction hint. Currently declared for future RTL support but not yet wired into the chart’s rendering or ARIA output.',
        },
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
    },
    args: {
        value: 70,
        target: 80,
        ranges: [50, 75, 100],
        min: 0,
        width: 360,
        height: 44,
        color: '',
        label: 'Revenue',
        unit: 'K',
        title: undefined,
        dir: 'auto',
        class: '',
    },
};

export default meta;
type Story = StoryObj<BulletChartComponent>;

const TEMPLATE = `
    <ui-bullet-chart
        [value]="value" [target]="target" [ranges]="ranges" [min]="min"
        [width]="width" [height]="height" [color]="color"
        [label]="label" [unit]="unit" [title]="title" [dir]="dir" [class]="class" />`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Default: Story = {
    args: { value: 70, target: 80, ranges: [50, 75, 100], label: 'Revenue', unit: 'K' },
    render,
};

export const Exceeding: Story = {
    args: { value: 92, target: 80, ranges: [50, 75, 100], label: 'Signups', unit: '' },
    render,
};

export const NoTarget: Story = {
    args: { value: 40, target: undefined, ranges: [30, 60, 90], label: 'Storage', unit: 'GB' },
    render,
};

export const NoRanges: Story = {
    args: { value: 55, target: 65, ranges: [], label: 'Simple measure', unit: '' },
    render,
};

export const CustomColor: Story = {
    args: { value: 70, target: 80, ranges: [50, 75, 100], color: 'hsl(var(--chart-2))', label: 'Custom color', unit: '' },
    render,
};

export const OffsetMinimum: Story = {
    args: { value: 700, target: 800, ranges: [500, 750, 1000], min: 400, label: 'Offset scale', unit: '' },
    render,
};

export const WithTitle: Story = {
    args: { value: 70, target: 80, ranges: [50, 75, 100], title: 'Q3 Revenue', label: 'Revenue', unit: 'K' },
    render,
};
