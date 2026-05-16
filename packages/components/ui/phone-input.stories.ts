import { Meta, StoryObj } from '@storybook/angular';
import { PhoneInputComponent } from './phone-input.component';

const meta: Meta<PhoneInputComponent> = {
    title: 'UI/PhoneInput',
    component: PhoneInputComponent,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'International phone input built on `ui-input-group`. Pick a country to set the dial code, ' +
                    'then type the local number. The input is masked per country using `uiInputMask` so invalid ' +
                    'characters cannot be entered. Emits E.164 format (e.g. `+15551234567`).',
            },
        },
    },
    argTypes: {
        variant: { control: 'select', options: ['outline', 'underline', 'ghost'] },
        defaultCountry: { control: 'text' },
        disabled: { control: 'boolean' },
        placeholder: { control: 'text' },
    },
    args: {
        variant: 'outline',
        defaultCountry: 'US',
        disabled: false,
    },
};

export default meta;
type Story = StoryObj<PhoneInputComponent>;

export const Default: Story = {
    render: (args) => ({
        props: args,
        template: `<div class="max-w-xs"><ui-phone-input [variant]="variant" [defaultCountry]="defaultCountry" [disabled]="disabled" /></div>`,
    }),
};

export const DefaultGB: Story = {
    args: { defaultCountry: 'GB' },
    render: (args) => ({
        props: args,
        template: `<div class="max-w-xs"><ui-phone-input [defaultCountry]="defaultCountry" /></div>`,
    }),
};

export const Disabled: Story = {
    args: { disabled: true, value: '+15551234567' },
    render: (args) => ({
        props: args,
        template: `<div class="max-w-xs"><ui-phone-input [disabled]="disabled" [value]="value" /></div>`,
    }),
};

export const Underline: Story = {
    args: { variant: 'underline' },
    render: (args) => ({
        props: args,
        template: `<div class="max-w-xs"><ui-phone-input variant="underline" /></div>`,
    }),
};

export const Ghost: Story = {
    args: { variant: 'ghost' },
    render: (args) => ({
        props: args,
        template: `<div class="max-w-xs"><ui-phone-input variant="ghost" /></div>`,
    }),
};

export const CustomPlaceholder: Story = {
    args: { placeholder: 'Enter your phone' },
    render: (args) => ({
        props: args,
        template: `<div class="max-w-xs"><ui-phone-input [placeholder]="placeholder" /></div>`,
    }),
};
