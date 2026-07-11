import { Meta, StoryObj } from '@storybook/angular';
import { ChartLegendComponent, ChartLegendItem } from './chart-legend.component';

// Shared, presentational chart legend. Every input is exposed as an interactive
// control (argTypes) with a sensible default (args); the Playground binds all of
// them so the Controls panel drives the live component. `itemToggle` fires with
// the item key on click/keyboard/tap when `interactive` is true.
const meta: Meta<ChartLegendComponent> = {
    title: 'UI/Chart/ChartLegend',
    component: ChartLegendComponent,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Presentational chart legend. The host chart owns the set of hidden series keys and updates it in response to `itemToggle`. Supports keyboard and touch activation (tap = click, no hover dependency).',
            },
        },
    },
    argTypes: {
        items: {
            control: 'object',
            description: 'Legend entries: `{ key, label, color }[]`.',
        },
        hidden: {
            control: 'object',
            description: 'Keys of series currently hidden (rendered dimmed / struck through).',
        },
        position: {
            control: 'select',
            options: ['top', 'bottom', 'left', 'right', 'none'],
            description: 'Layout position. `left`/`right` stack vertically; others lay out horizontally.',
        },
        interactive: {
            control: 'boolean',
            description: 'When true, items are focusable buttons that emit `itemToggle` on activation.',
        },
        class: { control: 'text', description: 'Extra classes merged onto the legend host.' },
    },
    args: {
        items: [
            { key: 'revenue', label: 'Revenue', color: '#6366f1' },
            { key: 'expenses', label: 'Expenses', color: '#f59e0b' },
            { key: 'profit', label: 'Profit', color: '#10b981' },
        ] satisfies ChartLegendItem[],
        hidden: [],
        position: 'bottom',
        interactive: true,
        class: '',
    },
};

export default meta;
type Story = StoryObj<ChartLegendComponent>;

const render: NonNullable<Story['render']> = (args) => ({
    props: {
        ...args,
        onToggle: (key: string): void => {
            // eslint-disable-next-line no-console
            console.log('itemToggle', key);
        },
    },
    template: `
        <div class="w-full max-w-md rounded-md border bg-card p-4">
            <ui-chart-legend
                [items]="items"
                [hidden]="hidden"
                [position]="position"
                [interactive]="interactive"
                [class]="class"
                (itemToggle)="onToggle($event)"
            />
        </div>
    `,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Horizontal: Story = {
    args: { position: 'bottom' },
    render,
};

export const Vertical: Story = {
    args: { position: 'left' },
    render,
};

export const WithHidden: Story = {
    args: { hidden: ['expenses'] },
    render,
};

export const NonInteractive: Story = {
    args: { interactive: false },
    render,
};
