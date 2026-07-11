import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { FormsModule } from '@angular/forms';
import { signal } from '@angular/core';
import { PhoneInputComponent } from './phone-input.component';
import { DEFAULT_COUNTRIES } from './phone-input-data';

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct visual mode.
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
        defaultCountry: { control: 'text', description: "ISO 3166-1 alpha-2 code of the initially selected country. Defaults to `'US'`." },
        disabled: { control: 'boolean', description: 'Disables both the country selector and the number input.' },
        placeholder: { control: 'text', description: "Overrides the country's example placeholder." },
        class: { control: 'text', description: 'Extra CSS classes for the outer wrapper (the `ui-input-group`).' },
        variant: {
            control: 'select',
            options: ['outline', 'underline', 'ghost'],
            description: 'Visual style of the wrapping `ui-input-group`.',
        },
        countries: { control: 'object', description: 'Country list shown in the dropdown. Defaults to `DEFAULT_COUNTRIES`.' },
        value: { control: 'text', description: 'External value (E.164 string). Use this for one-way binding without forms.' },
        locale: { control: false, description: 'Locale dictionary or registry key. Falls back to `UI_LOCALE_ID` when not set.' },
        valueChange: { control: false, description: 'Emits the E.164-formatted phone number on every change (`\'\'` when empty).' },
    },
    args: {
        defaultCountry: 'US',
        disabled: false,
        placeholder: undefined,
        class: '',
        variant: 'outline',
        countries: DEFAULT_COUNTRIES,
        value: null,
    },
};

export default meta;
type Story = StoryObj<PhoneInputComponent>;

const TEMPLATE = `
    <div class="max-w-[calc(100vw-2rem)] sm:max-w-xs">
        <ui-phone-input
            [defaultCountry]="defaultCountry" [disabled]="disabled"
            [placeholder]="placeholder" [class]="class" [variant]="variant"
            [countries]="countries" [value]="value" />
    </div>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const DefaultGB: Story = {
    args: { defaultCountry: 'GB' },
    render,
};

export const Disabled: Story = {
    args: { disabled: true, value: '+15551234567' },
    render,
};

export const Underline: Story = {
    args: { variant: 'underline' },
    render,
};

export const Ghost: Story = {
    args: { variant: 'ghost' },
    render,
};

export const CustomPlaceholder: Story = {
    args: { placeholder: 'Enter your phone' },
    render,
};

export const TwoWayBinding: Story = {
    decorators: [moduleMetadata({ imports: [FormsModule] })],
    render: () => ({
        props: { phone: signal('') },
        template: `
            <div class="max-w-[calc(100vw-2rem)] sm:max-w-xs space-y-2">
                <ui-phone-input [ngModel]="phone()" (ngModelChange)="phone.set($event)" />
                <p class="text-sm text-muted-foreground">Value: {{ phone() }}</p>
            </div>`,
    }),
};
