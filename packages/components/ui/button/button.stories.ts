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
            options: ['default', 'sm', 'lg', 'icon', 'icon-sm', 'icon-lg'],
        },
        disabled: {
            control: 'boolean',
        },
        label: {
            control: 'text',
        },
        ripple: {
            control: 'boolean',
        },
        rippleColor: {
            control: 'text',
        },
    },
    args: {
        variant: 'default',
        size: 'default',
        label: '',
        ripple: false,
        rippleColor: 'color-mix(in srgb, currentColor 35%, transparent)',
    },
};

export default meta;
type Story = StoryObj<ButtonComponent>;

export const Default: Story = {
    render: (args) => ({
        props: args,
        template: `<ui-button [variant]="variant" [size]="size" [disabled]="disabled" [label]="label" [ripple]="ripple" [rippleColor]="rippleColor">Button</ui-button>`,
    }),
};

export const Destructive: Story = {
    args: {
        variant: 'destructive',
    },
    render: (args) => ({
        props: args,
        template: `<ui-button [variant]="variant" [size]="size" [disabled]="disabled" [label]="label" [ripple]="ripple" [rippleColor]="rippleColor">Destructive</ui-button>`,
    }),
};

export const Outline: Story = {
    args: {
        variant: 'outline',
    },
    render: (args) => ({
        props: args,
        template: `<ui-button [variant]="variant" [size]="size" [disabled]="disabled" [label]="label" [ripple]="ripple" [rippleColor]="rippleColor">Outline</ui-button>`,
    }),
};

export const Secondary: Story = {
    args: {
        variant: 'secondary',
    },
    render: (args) => ({
        props: args,
        template: `<ui-button [variant]="variant" [size]="size" [disabled]="disabled" [label]="label" [ripple]="ripple" [rippleColor]="rippleColor">Secondary</ui-button>`,
    }),
};

export const Ghost: Story = {
    args: {
        variant: 'ghost',
    },
    render: (args) => ({
        props: args,
        template: `<ui-button [variant]="variant" [size]="size" [disabled]="disabled" [label]="label" [ripple]="ripple" [rippleColor]="rippleColor">Ghost</ui-button>`,
    }),
};

export const Link: Story = {
    args: {
        variant: 'link',
    },
    render: (args) => ({
        props: args,
        template: `<ui-button [variant]="variant" [size]="size" [disabled]="disabled" [label]="label" [ripple]="ripple" [rippleColor]="rippleColor">Link</ui-button>`,
    }),
};
