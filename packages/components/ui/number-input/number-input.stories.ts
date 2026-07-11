import { Meta, StoryObj } from '@storybook/angular';
import { NumberInputComponent } from './number-input.component';

const meta: Meta<NumberInputComponent> = {
    title: 'UI/NumberInput',
    component: NumberInputComponent,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Numeric input wrapping a native `type="number"` field. Step the value using the spinner arrows, the ArrowUp/ArrowDown keys, or by scrolling the mouse wheel while the input is focused.',
            },
        },
    },
    argTypes: {
        value: { control: 'number', description: 'Current numeric value (or `null` when empty).' },
        min: { control: 'number', description: 'Minimum allowed value.' },
        max: { control: 'number', description: 'Maximum allowed value.' },
        step: { control: 'number', description: 'Increment/decrement step.' },
        disabled: { control: 'boolean', description: 'Disables interaction.' },
        placeholder: { control: 'text', description: 'Placeholder shown when empty.' },
        class: { control: 'text', description: 'Extra classes merged onto the wrapper.' },
        variant: {
            control: 'select',
            options: ['outline', 'underline', 'ghost'],
            description: 'Visual style of the wrapper.',
        },
        locale: {
            control: 'text',
            description: 'BCP-47 locale tag for the input `lang` attribute. Falls back to the app-wide locale.',
        },
    },
    args: {
        variant: 'outline',
        value: null,
        step: 1,
        disabled: false,
        placeholder: '0',
        class: '',
    },
};

export default meta;
type Story = StoryObj<NumberInputComponent>;

const TEMPLATE = `
    <div class="max-w-xs">
        <ui-number-input
            [value]="value" [min]="min" [max]="max" [step]="step"
            [disabled]="disabled" [placeholder]="placeholder"
            [variant]="variant" [class]="class" [locale]="locale" />
    </div>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const WithMinMax: Story = {
    args: {
        value: 5,
        min: 0,
        max: 10,
        step: 1,
    },
    render,
};

export const WithDecimalStep: Story = {
    args: {
        value: 0,
        step: 0.5,
        min: 0,
        max: 5,
    },
    render,
};

export const Disabled: Story = {
    args: {
        value: 42,
        disabled: true,
    },
    render,
};

export const Underline: Story = {
    args: {
        variant: 'underline',
        value: 10,
    },
    render,
};

export const Ghost: Story = {
    args: {
        variant: 'ghost',
        value: 10,
    },
    render,
};

export const CustomClass: Story = {
    args: {
        value: 5,
        class: 'w-32',
    },
    render,
};
