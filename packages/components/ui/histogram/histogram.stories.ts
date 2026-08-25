import { Meta, StoryObj } from '@storybook/angular';
import { HistogramComponent } from './histogram.component';

/** Deterministic bell-ish sample so the story renders the same on every reload. */
function gaussianSample(count: number, mean: number, spread: number): number[] {
    let seed = 42;
    const next = (): number => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return seed / 2147483648;
    };
    return Array.from({ length: count }, () => {
        const sum = next() + next() + next() + next() + next() + next();
        return mean + (sum - 3) * spread;
    });
}

const latencies = gaussianSample(400, 120, 30).map(v => Math.max(0, Math.round(v)));
const returns = gaussianSample(300, 0, 4);

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct mode.
const meta: Meta<HistogramComponent> = {
    title: 'Charts/Histogram',
    component: HistogramComponent,
    tags: ['autodocs'],
    argTypes: {
        values: { control: 'object', description: 'Raw numeric sample. The component bins it — pass observations, not counts.' },
        binCount: { control: 'number', description: 'Number of equal-width bins. Undefined uses Sturges’ rule.' },
        binEdges: { control: 'object', description: 'Explicit ascending bin boundaries; overrides `binCount`.' },
        dir: { control: 'select', options: ['auto', 'ltr', 'rtl'], description: 'Chart reading direction. `auto` detects from the surrounding DOM.' },
        width: { control: 'number', description: 'Fallback SVG width used before the container is measured.' },
        height: { control: 'number', description: 'SVG height.' },
        showGrid: { control: 'boolean', description: 'Shows horizontal gridlines behind the bars.' },
        showValues: { control: 'boolean', description: 'Prints each bin’s count above its bar.' },
        showTooltip: { control: 'boolean', description: 'Shows the bin-range/count tooltip on hover or focus.' },
        barRadius: { control: 'number', description: 'Corner radius of each bar.' },
        barGap: { control: 'number', description: 'Visual gap between bars, taken out of the bar width.' },
        color: { control: 'color', description: 'Overrides the palette colour used for every bar.' },
        unit: { control: 'text', description: 'Unit suffix appended to bin bounds (e.g. "ms").' },
        title: { control: 'text', description: 'Accessible chart title, used in the generated aria-label.' },
        class: { control: 'text', description: 'Extra classes merged onto the host container.' },
    },
    args: {
        values: latencies,
        binCount: undefined,
        binEdges: undefined,
        dir: 'auto',
        width: 560,
        height: 300,
        showGrid: true,
        showValues: false,
        showTooltip: true,
        barRadius: 2,
        barGap: 2,
        color: undefined,
        unit: 'ms',
        title: 'Request latency distribution',
        class: '',
    },
};

export default meta;
type Story = StoryObj<HistogramComponent>;

const TEMPLATE = `
    <ui-histogram
        [values]="values" [binCount]="binCount" [binEdges]="binEdges"
        [dir]="dir" [width]="width" [height]="height"
        [showGrid]="showGrid" [showValues]="showValues" [showTooltip]="showTooltip"
        [barRadius]="barRadius" [barGap]="barGap" [color]="color"
        [unit]="unit" [title]="title" [class]="class">
    </ui-histogram>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

/** Auto-binned with Sturges' rule: no `binCount`, no `binEdges`. */
export const Default: Story = { render };

/** A fixed `binCount` overrides Sturges' rule. */
export const FixedBinCount: Story = {
    args: { binCount: 20 },
    render,
};

/** Explicit `binEdges` for unequal, domain-meaningful buckets (SLA tiers). */
export const ExplicitBinEdges: Story = {
    args: {
        binEdges: [0, 50, 100, 150, 250, 500],
        title: 'Latency by SLA tier',
    },
    render,
};

/** Negative values are binned like any other — nothing is anchored at zero. */
export const NegativeValues: Story = {
    args: {
        values: returns,
        unit: '%',
        title: 'Daily returns',
    },
    render,
};

/** Per-bar counts printed above the bars. */
export const WithValueLabels: Story = {
    args: { binCount: 10, showValues: true },
    render,
};

/** A single observation still renders one finite, non-degenerate bin. */
export const SingleDataPoint: Story = {
    args: { values: [42], title: 'Single observation' },
    render,
};

/** Every observation identical — the zero-variance case that must not divide by zero. */
export const ZeroVariance: Story = {
    args: { values: [7, 7, 7, 7, 7, 7], title: 'Zero variance' },
    render,
};

/** No finite samples — the empty state. */
export const Empty: Story = {
    args: { values: [], title: 'No samples' },
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
