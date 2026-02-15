import { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
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
        value: {
            control: 'number',
        },
        direction: {
            control: 'select',
            options: ['up', 'down'],
        },
        delay: {
            control: 'number',
        },
        duration: {
            control: 'number',
        },
        decimalPlaces: {
            control: 'number',
        },
    },
    args: {
        value: 1234,
        direction: 'up',
        delay: 0,
        duration: 1,
        decimalPlaces: 0,
    },
};

export default meta;
type Story = StoryObj<NumberTickerComponent>;

export const Default: Story = {
    args: {
        value: 1234,
    },
    render: (args) => ({
        props: args,
        template: `
            <div class="text-4xl font-bold">
                <ui-number-ticker [value]="value" [direction]="direction" [delay]="delay" [duration]="duration" [decimalPlaces]="decimalPlaces" />
            </div>
        `,
    }),
};

export const WithDecimals: Story = {
    args: {
        value: 99.99,
        decimalPlaces: 2,
    },
    render: (args) => ({
        props: args,
        template: `
            <div class="text-4xl font-bold">
                <ui-number-ticker [value]="value" [decimalPlaces]="decimalPlaces" />
            </div>
        `,
    }),
};

export const LargeNumber: Story = {
    args: {
        value: 1000000,
    },
    render: (args) => ({
        props: args,
        template: `
            <div class="text-4xl font-bold">
                <ui-number-ticker [value]="value" />
            </div>
        `,
    }),
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
                <ui-number-ticker [value]="value" [delay]="delay" />
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
                <ui-number-ticker [value]="value" [duration]="duration" />
            </div>
        `,
    }),
};
