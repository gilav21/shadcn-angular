import { Meta, StoryObj } from '@storybook/angular';
import { TreemapComponent } from './treemap.component';
import { TreemapNode } from './treemap.types';

const flat: TreemapNode[] = [
    { label: 'Documents', value: 1240 },
    { label: 'Media', value: 860 },
    { label: 'Source', value: 540 },
    { label: 'Archives', value: 320 },
    { label: 'Caches', value: 210 },
    { label: 'Logs', value: 120 },
    { label: 'Temp', value: 60 },
];

const nested: TreemapNode[] = [
    {
        label: 'Documents',
        children: [
            { label: 'Specs', value: 620 },
            { label: 'Guides', value: 380 },
            { label: 'Notes', value: 240 },
        ],
    },
    {
        label: 'Media',
        children: [
            { label: 'Video', value: 540 },
            { label: 'Images', value: 220 },
            { label: 'Audio', value: 100 },
        ],
    },
    { label: 'Source', value: 540 },
    { label: 'Archives', value: 320 },
];

/** Skewed enough that slice-and-dice would produce unreadable slivers. */
const skewed: TreemapNode[] = [
    { label: 'Dominant', value: 5000 },
    ...Array.from({ length: 14 }, (_, i) => ({ label: `n${i}`, value: 40 - i * 2 })),
];

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct mode.
const meta: Meta<TreemapComponent> = {
    title: 'Charts/Treemap',
    component: TreemapComponent,
    tags: ['autodocs'],
    argTypes: {
        nodes: { control: 'object', description: 'Hierarchy to lay out. `children` makes a node a group whose area is their sum.' },
        dir: { control: 'select', options: ['auto', 'ltr', 'rtl'], description: 'Chart reading direction. `auto` detects from the surrounding DOM.' },
        width: { control: 'number', description: 'Fallback SVG width used before the container is measured.' },
        height: { control: 'number', description: 'SVG height.' },
        groupPadding: { control: 'number', description: 'Inset applied inside each group before laying its children out.' },
        showLabels: { control: 'boolean', description: 'Draws node labels where the rectangle is big enough.' },
        minLabelWidth: { control: 'number', description: 'Narrowest rectangle that still gets a label.' },
        minLabelHeight: { control: 'number', description: 'Shortest rectangle that still gets a label.' },
        showTooltip: { control: 'boolean', description: 'Shows the value/share tooltip on hover or focus.' },
        cellRadius: { control: 'number', description: 'Corner radius of each rectangle.' },
        unit: { control: 'text', description: 'Suffix appended to every value (e.g. " MB").' },
        title: { control: 'text', description: 'Accessible chart title, used in the generated aria-label.' },
        class: { control: 'text', description: 'Extra classes merged onto the host container.' },
    },
    args: {
        nodes: flat,
        dir: 'auto',
        width: 560,
        height: 340,
        groupPadding: 3,
        showLabels: true,
        minLabelWidth: 44,
        minLabelHeight: 16,
        showTooltip: true,
        cellRadius: 2,
        unit: ' MB',
        title: 'Disk usage by category',
        class: '',
    },
};

export default meta;
type Story = StoryObj<TreemapComponent>;

const TEMPLATE = `
    <ui-treemap
        [nodes]="nodes" [dir]="dir" [width]="width" [height]="height"
        [groupPadding]="groupPadding" [showLabels]="showLabels"
        [minLabelWidth]="minLabelWidth" [minLabelHeight]="minLabelHeight"
        [showTooltip]="showTooltip" [cellRadius]="cellRadius"
        [unit]="unit" [title]="title" [class]="class">
    </ui-treemap>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

/** A flat `{ label, value }[]` — proportional rectangles, no hierarchy. */
export const Default: Story = { render };

/** Nested children render inside their group, which is drawn as a border. */
export const Nested: Story = {
    args: { nodes: nested },
    render,
};

/** One dominant value plus a long tail — where squarified beats slice-and-dice. */
export const SkewedDistribution: Story = {
    args: { nodes: skewed, unit: '', title: 'Skewed distribution' },
    render,
};

/** Raising the label thresholds drops labels from the smaller rectangles. */
export const LargeLabelThreshold: Story = {
    args: { minLabelWidth: 120, minLabelHeight: 40 },
    render,
};

export const WithoutLabels: Story = {
    args: { showLabels: false },
    render,
};

/** A zero-value node collapses to nothing instead of distorting its siblings. */
export const ZeroValueNode: Story = {
    args: {
        nodes: [
            { label: 'a', value: 50 },
            { label: 'zero', value: 0 },
            { label: 'b', value: 50 },
        ],
        unit: '',
        title: 'Zero-value node',
    },
    render,
};

/** A single node takes the whole plot. */
export const SingleNode: Story = {
    args: { nodes: [{ label: 'only', value: 9 }], unit: '', title: 'Single node' },
    render,
};

/** Nothing with a positive value — the empty state. */
export const Empty: Story = {
    args: { nodes: [], title: 'No data' },
    render,
};

export const RightToLeft: Story = {
    args: { dir: 'rtl' },
    render,
};
