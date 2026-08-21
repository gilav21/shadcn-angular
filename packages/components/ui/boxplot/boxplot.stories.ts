import { Meta, StoryObj } from '@storybook/angular';
import { BoxplotComponent } from './boxplot.component';
import { BoxplotGroup } from './boxplot.types';

const buildTimes: BoxplotGroup[] = [
    { label: 'main', values: [42, 44, 45, 46, 47, 48, 49, 51, 53, 92] },
    { label: 'feature', values: [50, 52, 55, 57, 58, 60, 61, 64, 70] },
    { label: 'release', values: [38, 39, 41, 42, 43, 44, 45, 46, 47] },
];

/** The same three groups, summarised up-front — renders identically to `buildTimes`. */
const preComputed: BoxplotGroup[] = [
    { label: 'main', stats: { min: 42, q1: 45.25, median: 47.5, q3: 50.5, max: 53, outliers: [92] } },
    { label: 'feature', stats: { min: 50, q1: 55, median: 58, q3: 61, max: 70, outliers: [] } },
    { label: 'release', stats: { min: 38, q1: 41, median: 43, q3: 45, max: 47, outliers: [] } },
];

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct mode.
const meta: Meta<BoxplotComponent> = {
    title: 'Charts/Boxplot',
    component: BoxplotComponent,
    tags: ['autodocs'],
    argTypes: {
        groups: { control: 'object', description: 'Groups to summarise. Each carries raw `values` or a pre-computed `stats`.' },
        orientation: { control: 'radio', options: ['vertical', 'horizontal'], description: 'Which axis carries the categories.' },
        dir: { control: 'select', options: ['auto', 'ltr', 'rtl'], description: 'Chart reading direction. `auto` detects from the surrounding DOM.' },
        width: { control: 'number', description: 'Fallback SVG width used before the container is measured.' },
        height: { control: 'number', description: 'SVG height.' },
        showGrid: { control: 'boolean', description: 'Shows gridlines behind the boxes.' },
        showOutliers: { control: 'boolean', description: 'Draws samples beyond the 1.5×IQR fences as points.' },
        showTooltip: { control: 'boolean', description: 'Shows the five-number-summary tooltip on hover or focus.' },
        boxRadius: { control: 'number', description: 'Corner radius of each box.' },
        unit: { control: 'text', description: 'Unit suffix appended to every number (e.g. "s").' },
        title: { control: 'text', description: 'Accessible chart title, used in the generated aria-label.' },
        class: { control: 'text', description: 'Extra classes merged onto the host container.' },
    },
    args: {
        groups: buildTimes,
        orientation: 'vertical',
        dir: 'auto',
        width: 520,
        height: 320,
        showGrid: true,
        showOutliers: true,
        showTooltip: true,
        boxRadius: 2,
        unit: 's',
        title: 'CI build duration by branch',
        class: '',
    },
};

export default meta;
type Story = StoryObj<BoxplotComponent>;

const TEMPLATE = `
    <ui-boxplot
        [groups]="groups" [orientation]="orientation" [dir]="dir"
        [width]="width" [height]="height"
        [showGrid]="showGrid" [showOutliers]="showOutliers" [showTooltip]="showTooltip"
        [boxRadius]="boxRadius" [unit]="unit" [title]="title" [class]="class">
    </ui-boxplot>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

/** Raw samples: the component derives quartiles, whiskers and outliers. */
export const Default: Story = { render };

/** Pre-computed `stats` instead of raw `values` — identical output. */
export const PreComputedStats: Story = {
    args: { groups: preComputed },
    render,
};

/** Transposed, which reads better when the category labels are long. */
export const Horizontal: Story = {
    args: { orientation: 'horizontal' },
    render,
};

/** Whiskers still stop at the fence; only the dots are suppressed. */
export const WithoutOutliers: Story = {
    args: { showOutliers: false },
    render,
};

/** Every sample identical — an IQR of 0, which must still draw a visible box. */
export const ZeroVariance: Story = {
    args: {
        groups: [{ label: 'flat', values: [7, 7, 7, 7, 7] }],
        unit: '',
        title: 'Zero variance',
    },
    render,
};

/** One observation per group — nothing degenerates to a zero-size mark. */
export const SingleDataPoint: Story = {
    args: {
        groups: [{ label: 'one', values: [42] }],
        unit: '',
        title: 'Single observation',
    },
    render,
};

/** Negative values are summarised like any other — nothing is anchored at zero. */
export const NegativeValues: Story = {
    args: {
        groups: [
            { label: 'Q1', values: [-8, -6, -5, -4, -3, -1] },
            { label: 'Q2', values: [-4, -2, -1, 0, 2, 3] },
        ],
        unit: '%',
        title: 'Quarterly change',
    },
    render,
};

/** No usable group — the empty state. */
export const Empty: Story = {
    args: { groups: [], title: 'No groups' },
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
