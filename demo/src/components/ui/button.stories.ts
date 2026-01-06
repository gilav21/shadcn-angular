import { Meta, StoryObj } from '@storybook/angular';
import { ButtonComponent } from './button.component';

const meta: Meta<ButtonComponent> = {
    title: 'UI/Button',
    component: ButtonComponent,
    tags: ['autodocs'],
    argTypes: {
        variant: {
            control: 'select',
            options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
        },
        size: {
            control: 'select',
            options: ['default', 'sm', 'lg', 'icon'],
        },
    },
    args: {
        variant: 'default',
        size: 'default',
    },
};

export default meta;
type Story = StoryObj<ButtonComponent>;

export const Default: Story = {
    render: (args) => ({
        props: args,
        template: `<ui-button [variant]="variant" [size]="size">Button</ui-button>`,
    }),
};

export const Destructive: Story = {
    args: {
        variant: 'destructive',
    },
    render: (args) => ({
        props: args,
        template: `<ui-button [variant]="variant" [size]="size">Destructive</ui-button>`,
    }),
};

export const Outline: Story = {
    args: {
        variant: 'outline',
    },
    render: (args) => ({
        props: args,
        template: `<ui-button [variant]="variant" [size]="size">Outline</ui-button>`,
    }),
};

export const Secondary: Story = {
    args: {
        variant: 'secondary',
    },
    render: (args) => ({
        props: args,
        template: `<ui-button [variant]="variant" [size]="size">Secondary</ui-button>`,
    }),
};

export const Ghost: Story = {
    args: {
        variant: 'ghost',
    },
    render: (args) => ({
        props: args,
        template: `<ui-button [variant]="variant" [size]="size">Ghost</ui-button>`,
    }),
};

export const Link: Story = {
    args: {
        variant: 'link',
    },
    render: (args) => ({
        props: args,
        template: `<ui-button [variant]="variant" [size]="size">Link</ui-button>`,
    }),
};
