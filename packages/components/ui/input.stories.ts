import { Meta, StoryObj } from '@storybook/angular';
import { InputComponent } from './input.component';
import { FormsModule } from '@angular/forms';
import { moduleMetadata } from '@storybook/angular';

const meta: Meta<InputComponent> = {
    title: 'UI/Input',
    component: InputComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [FormsModule, InputComponent],
        }),
    ],
    argTypes: {
        type: {
            control: 'text',
        },
        placeholder: {
            control: 'text',
        },
        disabled: {
            control: 'boolean',
        },
    },
    args: {
        type: 'text',
        placeholder: 'Enter text...',
        disabled: false,
    },
};

export default meta;
type Story = StoryObj<InputComponent>;

export const Default: Story = {
    render: (args) => ({
        props: args,
        template: `<ui-input [type]="type" [placeholder]="placeholder" [disabled]="disabled"></ui-input>`,
    }),
};

export const Disabled: Story = {
    args: {
        disabled: true,
        placeholder: 'Disabled input',
    },
    render: (args) => ({
        props: args,
        template: `<ui-input [type]="type" [placeholder]="placeholder" [disabled]="disabled"></ui-input>`,
    }),
};

export const Email: Story = {
    args: {
        type: 'email',
        placeholder: 'Email',
    },
    render: (args) => ({
        props: args,
        template: `<ui-input [type]="type" [placeholder]="placeholder" [disabled]="disabled"></ui-input>`,
    }),
};
