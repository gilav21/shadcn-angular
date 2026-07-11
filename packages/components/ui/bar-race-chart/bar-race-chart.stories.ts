import { Meta, StoryObj } from '@storybook/angular';
import { BarRaceChartComponent } from './bar-race-chart.component';
import { ChartDataPoint } from '../../lib/chart.types';

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct visual mode.
const meta: Meta<BarRaceChartComponent> = {
    title: 'Charts/Bar Race Chart',
    component: BarRaceChartComponent,
    tags: ['autodocs'],
    argTypes: {
        frames: {
            control: 'object',
            description: 'Required. One entry per animation frame, each an array of `{ name, value, color? }` data points.',
        },
        frameLabels: {
            control: 'object',
            description: 'Labels shown above the chart and at the ends of the timeline slider, one per frame.',
        },
        animationDuration: {
            control: 'number',
            min: 100,
            max: 3000,
            step: 100,
            description: 'Milliseconds spent transitioning between two frames / delay between auto-play ticks.',
        },
        autoPlay: { control: 'boolean', description: 'Starts playback automatically after the first render.' },
        loop: { control: 'boolean', description: 'Restarts from frame 0 instead of stopping after the last frame.' },
        maxBars: { control: 'number', min: 1, max: 20, step: 1, description: 'Maximum number of bars shown per frame (top N by value).' },
        width: { control: 'number', min: 200, max: 1200, step: 20, description: 'Intrinsic SVG width in pixels (chart still scales to container width).' },
        height: { control: 'number', min: 150, max: 900, step: 10, description: 'SVG height in pixels.' },
        barRadius: { control: 'number', min: 0, max: 20, step: 1, description: 'Corner radius of each bar in pixels.' },
        barGap: { control: 'number', min: 0, max: 30, step: 1, description: 'Gap between stacked bars in pixels.' },
        dir: {
            control: 'select',
            options: ['auto', 'ltr', 'rtl'],
            description: 'Text/layout direction. `auto` detects from the DOM.',
        },
        title: { control: 'text', description: 'Accessible chart title used to build the SVG `aria-label`.' },
        locale: { control: 'object', description: 'Locale dictionary or registry key for UI strings (play/pause/reset/timeline).' },
        class: { control: 'text', description: 'Extra classes merged onto the host container.' },
        frameChange: { control: false, description: 'Emits the new frame index whenever the current frame changes.' },
        animationComplete: { control: false, description: 'Emits once playback reaches the last frame without looping.' },
    },
    args: {
        frames: [],
        frameLabels: [],
        animationDuration: 500,
        autoPlay: false,
        loop: false,
        maxBars: 10,
        width: 600,
        height: 400,
        barRadius: 4,
        barGap: 4,
        dir: 'auto',
        title: 'Top cities by population',
        class: '',
    },
};

export default meta;
type Story = StoryObj<BarRaceChartComponent>;

const CITY_FRAMES: ChartDataPoint[][] = [
    [
        { name: 'Tokyo', value: 33 },
        { name: 'Delhi', value: 12 },
        { name: 'Shanghai', value: 14 },
        { name: 'Sao Paulo', value: 15 },
        { name: 'Mexico City', value: 16 },
        { name: 'Cairo', value: 9 },
        { name: 'Mumbai', value: 15 },
        { name: 'Beijing', value: 12 },
    ],
    [
        { name: 'Tokyo', value: 34 },
        { name: 'Delhi', value: 19 },
        { name: 'Shanghai', value: 20 },
        { name: 'Sao Paulo', value: 18 },
        { name: 'Mexico City', value: 19 },
        { name: 'Cairo', value: 14 },
        { name: 'Mumbai', value: 20 },
        { name: 'Beijing', value: 17 },
    ],
    [
        { name: 'Tokyo', value: 36 },
        { name: 'Delhi', value: 28 },
        { name: 'Shanghai', value: 25 },
        { name: 'Sao Paulo', value: 21 },
        { name: 'Mexico City', value: 21 },
        { name: 'Cairo', value: 20 },
        { name: 'Mumbai', value: 24 },
        { name: 'Beijing', value: 20 },
    ],
    [
        { name: 'Tokyo', value: 37 },
        { name: 'Delhi', value: 32 },
        { name: 'Shanghai', value: 29 },
        { name: 'Sao Paulo', value: 22 },
        { name: 'Mexico City', value: 22 },
        { name: 'Cairo', value: 22 },
        { name: 'Mumbai', value: 27 },
        { name: 'Beijing', value: 21 },
    ],
];

const CITY_FRAME_LABELS = ['1990', '2000', '2010', '2020'];

const COLORED_FRAMES: ChartDataPoint[][] = CITY_FRAMES.map((frame) =>
    frame.map((point, index) => ({
        ...point,
        color: ['#f97316', '#0ea5e9', '#22c55e', '#a855f7', '#ef4444', '#eab308', '#14b8a6', '#ec4899'][index % 8],
    })),
);

const TEMPLATE = `
    <ui-bar-race-chart
        [frames]="frames" [frameLabels]="frameLabels"
        [animationDuration]="animationDuration" [autoPlay]="autoPlay" [loop]="loop"
        [maxBars]="maxBars" [width]="width" [height]="height"
        [barRadius]="barRadius" [barGap]="barGap"
        [dir]="dir" [title]="title" [class]="class" />`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = {
    args: {
        frames: CITY_FRAMES,
        frameLabels: CITY_FRAME_LABELS,
    },
    render,
};

export const FastPlayback: Story = {
    args: {
        frames: CITY_FRAMES,
        frameLabels: CITY_FRAME_LABELS,
        animationDuration: 150,
        autoPlay: true,
        loop: true,
    },
    render,
};

export const SlowPlayback: Story = {
    args: {
        frames: CITY_FRAMES,
        frameLabels: CITY_FRAME_LABELS,
        animationDuration: 1500,
        autoPlay: true,
    },
    render,
};

export const CustomColors: Story = {
    args: {
        frames: COLORED_FRAMES,
        frameLabels: CITY_FRAME_LABELS,
    },
    render,
};

export const FewerBars: Story = {
    args: {
        frames: CITY_FRAMES,
        frameLabels: CITY_FRAME_LABELS,
        maxBars: 4,
    },
    render,
};

export const CompactSize: Story = {
    args: {
        frames: CITY_FRAMES,
        frameLabels: CITY_FRAME_LABELS,
        width: 360,
        height: 260,
        barGap: 2,
    },
    render,
};

export const RightToLeft: Story = {
    args: {
        frames: CITY_FRAMES,
        frameLabels: CITY_FRAME_LABELS,
        dir: 'rtl',
    },
    render,
};

export const SingleFrame: Story = {
    args: {
        frames: [CITY_FRAMES[0]],
        frameLabels: [CITY_FRAME_LABELS[0]],
    },
    render,
};

export const EmptyState: Story = {
    args: {
        frames: [[]],
        frameLabels: [],
    },
    render,
};
