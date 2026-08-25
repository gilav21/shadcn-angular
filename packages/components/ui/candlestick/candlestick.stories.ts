import { Meta, StoryObj } from '@storybook/angular';
import { CandlestickComponent } from './candlestick.component';
import { OhlcPoint } from './candlestick.types';

/** Three trading weeks — weekends absent, which is what the ordinal axis is for. */
const tradingDays: OhlcPoint[] = [
    { date: '2026-01-05', open: 100, high: 106, low: 99, close: 104 },
    { date: '2026-01-06', open: 104, high: 108, low: 103, close: 105 },
    { date: '2026-01-07', open: 105, high: 106, low: 98, close: 99 },
    { date: '2026-01-08', open: 99, high: 103, low: 97, close: 102 },
    { date: '2026-01-09', open: 102, high: 110, low: 101, close: 109 },
    { date: '2026-01-12', open: 109, high: 112, low: 106, close: 107 },
    { date: '2026-01-13', open: 107, high: 109, low: 101, close: 102 },
    { date: '2026-01-14', open: 102, high: 105, low: 100, close: 104 },
    { date: '2026-01-15', open: 104, high: 113, low: 104, close: 112 },
    { date: '2026-01-16', open: 112, high: 115, low: 110, close: 111 },
    { date: '2026-01-19', open: 111, high: 111, low: 104, close: 105 },
    { date: '2026-01-20', open: 105, high: 108, low: 103, close: 108 },
];

/** Every candle a doji — open === close — the zero-body case. */
const dojis: OhlcPoint[] = [
    { date: 'Mon', open: 50, high: 54, low: 46, close: 50 },
    { date: 'Tue', open: 51, high: 55, low: 48, close: 51 },
    { date: 'Wed', open: 49, high: 53, low: 45, close: 49 },
];

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct mode.
const meta: Meta<CandlestickComponent> = {
    title: 'Charts/Candlestick',
    component: CandlestickComponent,
    tags: ['autodocs'],
    argTypes: {
        points: { control: 'object', description: 'OHLC periods, in chronological order.' },
        axisMode: { control: 'radio', options: ['ordinal', 'time'], description: '`ordinal` gives every present period an equal band (no weekend gaps); `time` uses a real time scale.' },
        dir: { control: 'select', options: ['auto', 'ltr', 'rtl'], description: 'Chart reading direction. `auto` detects from the surrounding DOM.' },
        width: { control: 'number', description: 'Fallback SVG width used before the container is measured.' },
        height: { control: 'number', description: 'SVG height.' },
        showGrid: { control: 'boolean', description: 'Shows horizontal gridlines behind the candles.' },
        showTooltip: { control: 'boolean', description: 'Shows the O/H/L/C tooltip on hover or focus.' },
        risingColor: { control: 'color', description: 'Colour for candles that closed at or above their open.' },
        fallingColor: { control: 'color', description: 'Colour for candles that closed below their open.' },
        unit: { control: 'text', description: 'Suffix appended to every price (e.g. "$").' },
        locale: { control: 'text', description: 'BCP-47 locale used to format Date/epoch period labels.' },
        title: { control: 'text', description: 'Accessible chart title, used in the generated aria-label.' },
        class: { control: 'text', description: 'Extra classes merged onto the host container.' },
    },
    args: {
        points: tradingDays,
        axisMode: 'ordinal',
        dir: 'auto',
        width: 560,
        height: 320,
        showGrid: true,
        showTooltip: true,
        risingColor: 'hsl(142, 71%, 45%)',
        fallingColor: 'hsl(0, 84%, 60%)',
        unit: '$',
        locale: 'en-US',
        title: 'ACME daily price',
        class: '',
    },
};

export default meta;
type Story = StoryObj<CandlestickComponent>;

const TEMPLATE = `
    <ui-candlestick
        [points]="points" [axisMode]="axisMode" [dir]="dir"
        [width]="width" [height]="height"
        [showGrid]="showGrid" [showTooltip]="showTooltip"
        [risingColor]="risingColor" [fallingColor]="fallingColor"
        [unit]="unit" [locale]="locale" [title]="title" [class]="class">
    </ui-candlestick>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

/** The default ordinal axis: equal bands, no blank weekends. */
export const Default: Story = { render };

/** The same data on a continuous time axis — the weekend gaps become visible. */
export const TimeAxis: Story = {
    args: { axisMode: 'time' },
    render,
};

/** Themed via CSS custom properties rather than literal colours. */
export const ThemedColors: Story = {
    args: {
        risingColor: 'var(--chart-2)',
        fallingColor: 'var(--destructive)',
    },
    render,
};

/** `open === close` on every period — the body must still read as a line. */
export const Doji: Story = {
    args: { points: dojis, title: 'Doji session', unit: '' },
    render,
};

/** A single period — nothing degenerates and no scale divides by zero. */
export const SingleDataPoint: Story = {
    args: {
        points: [{ date: '2026-01-05', open: 100, high: 104, low: 97, close: 101 }],
        title: 'Single session',
    },
    render,
};

/** Plain label strings instead of dates — legal on the ordinal axis. */
export const LabelPeriods: Story = {
    args: {
        points: [
            { date: 'Week 1', open: 10, high: 14, low: 9, close: 13 },
            { date: 'Week 2', open: 13, high: 15, low: 11, close: 11 },
            { date: 'Week 3', open: 11, high: 18, low: 10, close: 17 },
        ],
        title: 'Weekly summary',
        unit: '',
    },
    render,
};

/** No usable period — the empty state. */
export const Empty: Story = {
    args: { points: [], title: 'No sessions' },
    render,
};

export const NoGrid: Story = {
    args: { showGrid: false },
    render,
};

export const RightToLeft: Story = {
    args: { dir: 'rtl' },
    render,
};
