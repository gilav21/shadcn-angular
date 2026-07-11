import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { InputOTPComponent } from './input-otp.component';
import { FormsModule } from '@angular/forms';

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
        ariaLabel: { control: 'text', description: 'Aria-label for the hidden native input.' },
        ariaLabelledby: { control: 'text', description: 'Aria-labelledby for the hidden native input.' },
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
    },
    args: {
        maxLength: 6,
        separator: [2],
        value: '',
        ariaLabel: 'One-Time Password',
        ariaLabelledby: undefined,
        class: '',
    },
};

export default meta;
type Story = StoryObj<InputOTPComponent>;

const TEMPLATE = `
    <ui-input-otp
        [maxLength]="maxLength" [separator]="separator" [(value)]="value"
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
