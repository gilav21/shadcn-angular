import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { InputOTPComponent } from './input-otp.component';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ButtonComponent } from '../button';

const meta: Meta<InputOTPComponent> = {
    title: 'UI/InputOTP',
    component: InputOTPComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [InputOTPComponent, FormsModule],
        }),
    ],
    argTypes: {
        maxLength: { control: 'number', description: 'Number of slots (and the input\'s maxlength).' },
        separator: {
            control: 'object',
            description: 'Zero-based slot indices after which a visual separator dot is rendered.',
        },
        value: { control: 'text', description: 'Current OTP value (two-way bindable via `[(value)]`).' },
        disabled: { control: 'boolean', description: 'Disables the field. A reactive-forms `disable()` disables it too.' },
        ariaLabel: { control: 'text', description: 'Aria-label for the hidden native input.' },
        ariaLabelledby: { control: 'text', description: 'Aria-labelledby for the hidden native input.' },
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
    },
    args: {
        maxLength: 6,
        separator: [2],
        value: '',
        disabled: false,
        ariaLabel: 'One-Time Password',
        ariaLabelledby: undefined,
        class: '',
    },
};

export default meta;
type Story = StoryObj<InputOTPComponent>;

const TEMPLATE = `
    <ui-input-otp
        [maxLength]="maxLength" [separator]="separator" [(value)]="value" [disabled]="disabled"
        [ariaLabel]="ariaLabel" [ariaLabelledby]="ariaLabelledby" [class]="class">
    </ui-input-otp>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Default: Story = { render };

export const FourDigits: Story = {
    args: { maxLength: 4, separator: [] },
    render,
};

export const TwoGroupsOfThree: Story = {
    args: { maxLength: 6, separator: [2] },
    render,
};

export const ThreeGroupsOfTwo: Story = {
    args: { maxLength: 6, separator: [1, 3] },
    render,
};

export const Prefilled: Story = {
    args: { value: '123' },
    render,
};

export const Disabled: Story = {
    args: { value: '123', disabled: true },
    render,
};

/** Reactive forms: `formControlName` renders the form value, reports each edit once, marks touched on blur, and honours `disable()`. */
export const ReactiveForm: Story = {
    decorators: [moduleMetadata({ imports: [ReactiveFormsModule, ButtonComponent] })],
    render: (args) => {
        const form = new FormGroup({ code: new FormControl('') });
        return {
            props: { ...args, form },
            template: `
                <form [formGroup]="form" class="space-y-3">
                    <ui-input-otp formControlName="code" [maxLength]="maxLength" [separator]="separator" [class]="class" />
                    <p class="text-sm text-muted-foreground">
                        Form value: {{ form.value.code }} · touched: {{ form.controls.code.touched }}
                    </p>
                    <ui-button size="sm" variant="outline"
                        (click)="form.controls.code.disabled ? form.controls.code.enable() : form.controls.code.disable()">
                        Toggle disabled
                    </ui-button>
                </form>`,
        };
    },
};

/** An RTL page keeps the code left to right: the slot row is pinned `dir="ltr"`. */
export const Rtl: Story = {
    args: { value: '123456' },
    render: (args) => ({
        props: args,
        template: `<div dir="rtl">${TEMPLATE}</div>`,
    }),
};
