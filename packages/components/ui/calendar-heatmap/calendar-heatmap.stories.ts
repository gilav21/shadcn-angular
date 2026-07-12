import { Meta, StoryObj } from '@storybook/angular';
import { CalendarHeatmapComponent } from './calendar-heatmap.component';
import { CalendarDay } from '../../lib/chart.types';

function yearOfData(days = 180): CalendarDay[] {
    const out: CalendarDay[] = [];
    const start = Date.UTC(2026, 0, 1);
    for (let i = 0; i < days; i++) {
        const ms = start + i * 86_400_000;
        const d = new Date(ms);
        const date = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
        out.push({ date, value: (i * 13) % 11 });
    }
    return out;
}

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct mode.
const meta: Meta<CalendarHeatmapComponent> = {
    title: 'Charts/Calendar Heatmap',
    component: CalendarHeatmapComponent,
    tags: ['autodocs'],
    argTypes: {
        data: { control: 'object', description: 'Array of `{ date: "YYYY-MM-DD", value: number }` days to plot.' },
        cellSize: { control: 'number', min: 6, max: 24, step: 1, description: 'Square size of each day cell in pixels.' },
        fromColor: { control: 'color', description: 'Start color of the low-value end of the sequential scale.' },
        toColor: { control: 'color', description: 'End color of the high-value end of the sequential scale.' },
        emptyColor: { control: 'color', description: 'Fill color used for days with no data.' },
        showLegend: { control: 'boolean', description: 'Toggles the Less…More color legend below the grid.' },
        showTooltip: { control: 'boolean', description: 'Toggles the hover/focus tooltip.' },
        title: { control: 'text', description: 'Accessible title prefixed to the aria-label.' },
        dir: {
            control: 'select',
            options: ['ltr', 'rtl', 'auto'],
            description: 'Text/layout direction.',
        },
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
    },
    args: {
        data: yearOfData(),
        cellSize: 13,
        fromColor: 'hsl(214, 95%, 92%)',
        toColor: 'hsl(221, 83%, 38%)',
        emptyColor: 'hsl(220, 13%, 91%)',
        showLegend: true,
        showTooltip: true,
        title: '',
        dir: 'auto',
        class: '',
    },
};

export default meta;
type Story = StoryObj<CalendarHeatmapComponent>;

const TEMPLATE = `
    <ui-calendar-heatmap
        [data]="data" [cellSize]="cellSize"
        [fromColor]="fromColor" [toColor]="toColor" [emptyColor]="emptyColor"
        [showLegend]="showLegend" [showTooltip]="showTooltip"
        [title]="title" [dir]="dir" [class]="class" />`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Default: Story = { render };

export const EmeraldScale: Story = {
    args: { fromColor: 'hsl(152, 76%, 90%)', toColor: 'hsl(160, 84%, 30%)' },
    render,
};

export const LargeCells: Story = {
    args: { cellSize: 20 },
    render,
};

export const NoLegend: Story = {
    args: { showLegend: false },
    render,
};

export const NoTooltip: Story = {
    args: { showTooltip: false },
    render,
};

export const Rtl: Story = {
    args: { dir: 'rtl' },
    render: (args) => ({
        props: args,
        template: `<div dir="rtl">${TEMPLATE}</div>`,
    }),
};
