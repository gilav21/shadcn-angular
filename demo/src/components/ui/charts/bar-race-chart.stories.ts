import { Meta, StoryObj } from '@storybook/angular';
import { BarRaceChartComponent } from './bar-race-chart.component';
import { ChartDataPoint } from './chart.types';

// Generate sample data for population race
const countries = [
    'China', 'India', 'USA', 'Indonesia', 'Pakistan',
    'Brazil', 'Nigeria', 'Bangladesh', 'Russia', 'Japan',
    'Mexico', 'Ethiopia', 'Philippines', 'Egypt', 'Vietnam'
];

const generateFrame = (year: number): ChartDataPoint[] => {
    // Simulate population growth with some randomization
    const baseValues: Record<string, number> = {
        'China': 1000 + (year - 1960) * 10 + Math.random() * 20,
        'India': 450 + (year - 1960) * 15 + Math.random() * 20,
        'USA': 180 + (year - 1960) * 2 + Math.random() * 5,
        'Indonesia': 95 + (year - 1960) * 3 + Math.random() * 5,
        'Pakistan': 45 + (year - 1960) * 4 + Math.random() * 5,
        'Brazil': 70 + (year - 1960) * 2.5 + Math.random() * 5,
        'Nigeria': 45 + (year - 1960) * 4.5 + Math.random() * 5,
        'Bangladesh': 50 + (year - 1960) * 3 + Math.random() * 5,
        'Russia': 120 + (year - 1960) * 0.5 + Math.random() * 5,
        'Japan': 95 + (year - 1960) * 0.8 + Math.random() * 5,
        'Mexico': 35 + (year - 1960) * 2 + Math.random() * 5,
        'Ethiopia': 22 + (year - 1960) * 2.5 + Math.random() * 5,
        'Philippines': 28 + (year - 1960) * 2 + Math.random() * 5,
        'Egypt': 26 + (year - 1960) * 1.8 + Math.random() * 5,
        'Vietnam': 32 + (year - 1960) * 1.5 + Math.random() * 5,
    };

    return countries.map(name => ({
        name,
        value: Math.round(baseValues[name] || 50),
    }));
};

const years = Array.from({ length: 13 }, (_, i) => 1960 + i * 5);
const frames = years.map(year => generateFrame(year));
const frameLabels = years.map(y => y.toString());

const meta: Meta<BarRaceChartComponent> = {
    title: 'UI/Charts/Bar Race Chart',
    component: BarRaceChartComponent,
    tags: ['autodocs'],
    argTypes: {
        width: { control: { type: 'range', min: 400, max: 900 } },
        height: { control: { type: 'range', min: 300, max: 600 } },
        animationDuration: { control: { type: 'range', min: 200, max: 2000 } },
        maxBars: { control: { type: 'range', min: 5, max: 15 } },
        autoPlay: { control: 'boolean' },
        loop: { control: 'boolean' },
    },
};

export default meta;
type Story = StoryObj<BarRaceChartComponent>;

export const PopulationRace: Story = {
    args: {
        frames: frames,
        frameLabels: frameLabels,
        width: 700,
        height: 450,
        animationDuration: 500,
        maxBars: 10,
        autoPlay: false,
        loop: false,
        title: 'World Population by Country (millions)',
    },
};

export const AutoPlayWithLoop: Story = {
    args: {
        frames: frames,
        frameLabels: frameLabels,
        width: 700,
        height: 450,
        animationDuration: 800,
        maxBars: 10,
        autoPlay: true,
        loop: true,
    },
};

export const FastAnimation: Story = {
    args: {
        frames: frames,
        frameLabels: frameLabels,
        width: 700,
        height: 400,
        animationDuration: 250,
        maxBars: 8,
        autoPlay: false,
        loop: false,
    },
};

export const Top5Only: Story = {
    args: {
        frames: frames,
        frameLabels: frameLabels,
        width: 600,
        height: 300,
        animationDuration: 600,
        maxBars: 5,
        autoPlay: false,
        loop: false,
    },
};

// Simple sales race example
const salesRaceFrames: ChartDataPoint[][] = [
    [
        { name: 'Alice', value: 45 },
        { name: 'Bob', value: 30 },
        { name: 'Charlie', value: 55 },
        { name: 'Diana', value: 40 },
        { name: 'Eve', value: 25 },
    ],
    [
        { name: 'Alice', value: 82 },
        { name: 'Bob', value: 68 },
        { name: 'Charlie', value: 71 },
        { name: 'Diana', value: 90 },
        { name: 'Eve', value: 55 },
    ],
    [
        { name: 'Alice', value: 120 },
        { name: 'Bob', value: 145 },
        { name: 'Charlie', value: 98 },
        { name: 'Diana', value: 130 },
        { name: 'Eve', value: 88 },
    ],
    [
        { name: 'Alice', value: 175 },
        { name: 'Bob', value: 190 },
        { name: 'Charlie', value: 155 },
        { name: 'Diana', value: 168 },
        { name: 'Eve', value: 142 },
    ],
];

export const SalesLeaderboard: Story = {
    args: {
        frames: salesRaceFrames,
        frameLabels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
        width: 500,
        height: 320,
        animationDuration: 600,
        maxBars: 5,
        autoPlay: false,
        title: 'Sales Leaderboard',
    },
};
