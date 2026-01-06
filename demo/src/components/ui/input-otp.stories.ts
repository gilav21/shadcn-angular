import { Meta, StoryObj } from '@storybook/angular';
import { InputOTPComponent } from './input-otp.component';
import { FormsModule } from '@angular/forms';
import { moduleMetadata } from '@storybook/angular';

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
        maxLength: { control: 'number' },
        separator: { control: 'object' },
    },
    args: {
        maxLength: 6,
        separator: [2],
    },
};

export default meta;
type Story = StoryObj<InputOTPComponent>;

export const Default: Story = {
    render: (args) => ({
        props: args,
        template: `
      <ui-input-otp [maxLength]="maxLength" [separator]="separator" [ariaLabel]="'One-Time Password'"></ui-input-otp>
    `,
    }),
};
