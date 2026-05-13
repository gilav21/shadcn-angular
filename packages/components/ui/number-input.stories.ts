import { Meta, StoryObj } from '@storybook/angular';
import { NumberInputComponent } from './number-input.component';

const meta: Meta<NumberInputComponent> = {
    title: 'UI/NumberInput',
    component: NumberInputComponent,
    tags: ['autodocs'],
    argTypes: {
        variant: {
            control: 'select',
            options: ['outline', 'underline', 'ghost'],
        },
        value: { control: 'number' },
        min: { control: 'number' },
        max: { control: 'number' },
        step: { control: 'number' },
        disabled: { control: 'boolean' },
        placeholder: { control: 'text' },
    },
    args: {
        variant: 'outline',
        value: null,
        step: 1,
        disabled: false,
        placeholder: '0',
    },
};

export default meta;
type Story = StoryObj<NumberInputComponent>;

export const Default: Story = {
    render: (args) => ({
        props: args,
        template: `<div class="max-w-xs"><ui-number-input [value]="value" [step]="step" [disabled]="disabled" [placeholder]="placeholder" [variant]="variant" /></div>`,
    }),
};

export const WithMinMax: Story = {
    args: {
        value: 5,
        min: 0,
        max: 10,
        step: 1,
    },
    render: (args) => ({
        props: args,
        template: `<div class="max-w-xs"><ui-number-input [value]="value" [min]="min" [max]="max" [step]="step" [placeholder]="placeholder" /></div>`,
    }),
};

export const WithDecimalStep: Story = {
    args: {
        value: 0,
        step: 0.5,
        min: 0,
        max: 5,
    },
    render: (args) => ({
        props: args,
        template: `<div class="max-w-xs"><ui-number-input [value]="value" [min]="min" [max]="max" [step]="step" /></div>`,
    }),
};

export const Disabled: Story = {
    args: {
        value: 42,
        disabled: true,
    },
    render: (args) => ({
        props: args,
        template: `<div class="max-w-xs"><ui-number-input [value]="value" [disabled]="disabled" /></div>`,
    }),
};

export const Underline: Story = {
    args: {
        variant: 'underline',
        value: 10,
    },
    render: (args) => ({
        props: args,
        template: `<div class="max-w-xs"><ui-number-input [value]="value" [variant]="variant" /></div>`,
    }),
};

export const Ghost: Story = {
    args: {
        variant: 'ghost',
        value: 10,
    },
    render: (args) => ({
        props: args,
        template: `<div class="max-w-xs"><ui-number-input [value]="value" [variant]="variant" /></div>`,
    }),
};
