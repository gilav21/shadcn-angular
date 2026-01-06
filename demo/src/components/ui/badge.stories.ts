import { Meta, StoryObj } from '@storybook/angular';
import { BadgeComponent } from './badge.component';

const meta: Meta<BadgeComponent> = {
    title: 'UI/Badge',
    component: BadgeComponent,
    tags: ['autodocs'],
    argTypes: {
        variant: {
            control: 'select',
            options: ['default', 'secondary', 'destructive', 'outline'],
        },
    },
    args: {
        variant: 'default',
    },
};

export default meta;
type Story = StoryObj<BadgeComponent>;

export const Default: Story = {
    render: (args) => ({
        props: args,
        template: `<ui-badge [variant]="variant">Badge</ui-badge>`,
    }),
};

export const Secondary: Story = {
    args: {
        variant: 'secondary',
    },
    render: (args) => ({
        props: args,
        template: `<ui-badge [variant]="variant">Secondary</ui-badge>`,
    }),
};

export const Destructive: Story = {
    args: {
        variant: 'destructive',
    },
    render: (args) => ({
        props: args,
        template: `<ui-badge [variant]="variant">Destructive</ui-badge>`,
    }),
};

export const Outline: Story = {
    args: {
        variant: 'outline',
    },
    render: (args) => ({
        props: args,
        template: `<ui-badge [variant]="variant">Outline</ui-badge>`,
    }),
};
