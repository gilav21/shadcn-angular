import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { StatCardComponent } from './stat-card.component';

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct visual mode.
const meta: Meta<StatCardComponent> = {
    title: 'UI/Stat Card',
    component: StatCardComponent,
    decorators: [moduleMetadata({ imports: [StatCardComponent] })],
    tags: ['autodocs'],
    argTypes: {
        label: { control: 'text', description: 'Metric name, rendered muted above the value.' },
        value: { control: 'text', description: 'The headline figure. Rendered verbatim — format it before binding.' },
        delta: { control: 'text', description: 'Change since the previous period. Leave empty to omit the badge entirely.' },
        trend: {
            control: 'inline-radio',
            options: ['up', 'down', 'neutral'],
            description:
                "Direction of the change — drives the badge colour and the arrow. `'up'` means *favourable*, not arithmetically positive: a falling churn rate is `'up'`.",
        },
        trendIcon: {
            control: 'boolean',
            description:
                'Draw the direction arrow beside the delta. Turn it off to keep the trend colour without the glyph — the dashboard block does this, because its tiles encode favourability but not direction.',
        },
        class: { control: 'text', description: 'Extra classes merged onto the card surface (not the `display: contents` host).' },
    },
    args: {
        label: 'Total Revenue',
        value: '$45,231.89',
        delta: '+20.1%',
        trend: 'up',
        trendIcon: true,
        class: '',
    },
};

export default meta;
type Story = StoryObj<StatCardComponent>;

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = {
    render: args => ({
        props: args,
        template: `
            <div class="w-full max-w-sm">
                <ui-stat-card
                    [label]="label"
                    [value]="value"
                    [delta]="delta"
                    [trend]="trend"
                    [trendIcon]="trendIcon"
                    [class]="class"
                />
            </div>
        `,
    }),
};

/** The three trends side by side: primary + up arrow, destructive + down arrow, secondary + no arrow. */
export const Trends: Story = {
    render: () => ({
        template: `
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <ui-stat-card label="Revenue" value="$45,231" delta="+12.5%" trend="up" />
                <ui-stat-card label="Orders" value="1,210" delta="-3.2%" trend="down" />
                <ui-stat-card label="Sessions" value="18,402" delta="0.0%" trend="neutral" />
            </div>
        `,
    }),
};

/**
 * A falling churn rate is good news, so it is `trend="up"` despite the negative
 * delta — the trend describes whether the change is favourable, never the sign
 * of the string.
 */
export const FavourableDecrease: Story = {
    render: () => ({
        template: `
            <div class="w-full max-w-sm">
                <ui-stat-card label="Churn rate" value="1.8%" delta="-0.4%" trend="up" />
            </div>
        `,
    }),
};

/** With no delta bound, the badge is omitted rather than rendered blank. */
export const WithoutDelta: Story = {
    render: () => ({
        template: `
            <div class="w-full max-w-sm">
                <ui-stat-card label="Active users" value="2,350" />
            </div>
        `,
    }),
};

/** Anything projected renders under the value — typically a sparkline. */
export const WithProjectedSparkline: Story = {
    render: () => ({
        template: `
            <div class="w-full max-w-sm">
                <ui-stat-card label="Active users" value="2,350" delta="+8.1%" trend="up">
                    <svg viewBox="0 0 120 32" class="mt-2 h-8 w-full text-primary" fill="none"
                         stroke="currentColor" stroke-width="2" stroke-linecap="round"
                         stroke-linejoin="round" aria-hidden="true">
                        <path d="M0 26 L20 22 L40 24 L60 14 L80 17 L100 8 L120 4" />
                    </svg>
                </ui-stat-card>
            </div>
        `,
    }),
};

/** Overlong label and value truncate instead of widening the grid column. */
export const Truncation: Story = {
    render: () => ({
        template: `
            <div class="w-full max-w-[240px]">
                <ui-stat-card
                    label="Monthly recurring revenue across every region"
                    value="$45,231,890.12345"
                    delta="+20.1%"
                    trend="up"
                />
            </div>
        `,
    }),
};

/** The dashboard-block layout: four tiles in a responsive grid. */
export const InAGrid: Story = {
    render: () => ({
        template: `
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <ui-stat-card label="Revenue" value="$45,231" delta="+12.5%" trend="up" />
                <ui-stat-card label="Active users" value="2,340" delta="+8.1%" trend="up" />
                <ui-stat-card label="Orders" value="1,210" delta="-3.2%" trend="down" />
                <ui-stat-card label="Churn rate" value="1.8%" delta="-0.4%" trend="up" />
            </div>
        `,
    }),
};

/**
 * The same three trends with the arrow suppressed: colour survives, glyph does
 * not. This is the shape the `dashboard` block uses, so extracting the tile
 * left the block pixel-identical.
 */
export const WithoutTrendIcons: Story = {
    render: () => ({
        template: `
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <ui-stat-card label="Revenue" value="$45,231" delta="+12.5%" trend="up" [trendIcon]="false" />
                <ui-stat-card label="Orders" value="1,210" delta="-3.2%" trend="down" [trendIcon]="false" />
                <ui-stat-card label="Churn rate" value="1.8%" delta="-0.4%" trend="up" [trendIcon]="false" />
            </div>
        `,
    }),
};

/** Restyling the tile. `class` lands on the card surface, in either spelling. */
export const Restyled: Story = {
    render: () => ({
        template: `
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <ui-stat-card label="Revenue" value="$45,231" delta="+12.5%" trend="up"
                              [class]="'ring-2 ring-primary/40'" />
                <ui-stat-card label="Orders" value="1,210" delta="-3.2%" trend="down"
                              [class]="'border-dashed bg-muted/40 shadow-none'" />
            </div>
        `,
    }),
};

/** Right-to-left: the tile uses only logical spacing, so it mirrors wholesale. */
export const RightToLeft: Story = {
    render: () => ({
        template: `
            <div dir="rtl" class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <ui-stat-card label="הכנסות" value="₪45,231" delta="+12.5%" trend="up" />
                <ui-stat-card label="הזמנות" value="1,210" delta="-3.2%" trend="down" />
            </div>
        `,
    }),
};
