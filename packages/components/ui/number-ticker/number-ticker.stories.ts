import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { NumberTickerComponent, NumberTickerDigitComponent } from './number-ticker.component';

const meta: Meta<NumberTickerComponent> = {
    title: 'UI/NumberTicker',
    component: NumberTickerComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [NumberTickerComponent, NumberTickerDigitComponent],
        }),
    ],
    argTypes: {
        value: { control: 'number', description: 'Target value to animate to.' },
        direction: {
            control: 'select',
            options: ['up', 'down'],
            description: 'Animation direction (currently used for future extensibility; animation always eases from the previous value).',
        },
        delay: { control: 'number', description: 'Delay in seconds before the animation starts.' },
        duration: { control: 'number', description: 'Animation duration in seconds.' },
        decimalPlaces: { control: 'number', min: 0, max: 6, description: 'Number of decimal places to display.' },
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
        locale: {
            control: 'text',
            description: 'BCP-47 locale tag passed to `Intl.NumberFormat`. Falls back to the app-wide locale.',
        },
    },
    args: {
        value: 1234,
        direction: 'up',
        delay: 0,
        duration: 1,
        decimalPlaces: 0,
        class: '',
    },
};

export default meta;
type Story = StoryObj<NumberTickerComponent>;

const TEMPLATE = `
    <div class="text-4xl font-bold">
        <ui-number-ticker
            [value]="value" [direction]="direction" [delay]="delay"
            [duration]="duration" [decimalPlaces]="decimalPlaces"
            [class]="class" [locale]="locale" />
    </div>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const WithDecimals: Story = {
    args: {
        value: 99.99,
        decimalPlaces: 2,
    },
    render,
};

export const LargeNumber: Story = {
    args: {
        value: 1000000,
    },
    render,
};

export const WithDelay: Story = {
    args: {
        value: 5678,
        delay: 1,
    },
    render: (args) => ({
        props: args,
        template: `
            <div class="text-4xl font-bold">
                <p class="text-sm text-muted-foreground mb-2">Starts after 1 second delay:</p>
                <ui-number-ticker [value]="value" [delay]="delay" [duration]="duration" [decimalPlaces]="decimalPlaces" />
            </div>
        `,
    }),
};

export const SlowDuration: Story = {
    args: {
        value: 42,
        duration: 3,
    },
    render: (args) => ({
        props: args,
        template: `
            <div class="text-4xl font-bold">
                <p class="text-sm text-muted-foreground mb-2">3 second animation duration:</p>
                <ui-number-ticker [value]="value" [duration]="duration" [decimalPlaces]="decimalPlaces" />
            </div>
        `,
    }),
};
