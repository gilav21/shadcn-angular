import { Meta, StoryObj } from '@storybook/angular';
import { BadgeComponent } from './badge.component';

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct visual mode.
const meta: Meta<BadgeComponent> = {
    title: 'UI/Badge',
    component: BadgeComponent,
    tags: ['autodocs'],
    argTypes: {
        variant: {
            control: 'select',
            options: ['default', 'secondary', 'destructive', 'outline'],
            description: 'Visual style of the badge.',
        },
        label: { control: 'text', description: 'Text content when no content is projected.' },
        skeleton: { control: 'boolean', description: 'Renders a skeleton placeholder instead of the badge.' },
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
    },
    args: {
        variant: 'default',
        label: 'Badge',
        skeleton: false,
        class: '',
    },
};

export default meta;
type Story = StoryObj<BadgeComponent>;

const TEMPLATE = `
    <ui-badge
        [variant]="variant" [label]="label"
        [skeleton]="skeleton" [class]="class">
        {{ label || 'Badge' }}
    </ui-badge>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Variants: Story = {
    render: (args) => ({
        props: args,
        template: `
            <div class="flex flex-wrap items-center gap-3">
                <ui-badge variant="default">Default</ui-badge>
                <ui-badge variant="secondary">Secondary</ui-badge>
                <ui-badge variant="destructive">Destructive</ui-badge>
                <ui-badge variant="outline">Outline</ui-badge>
            </div>`,
    }),
};

export const Secondary: Story = {
    args: { variant: 'secondary' },
    render,
};

export const Destructive: Story = {
    args: { variant: 'destructive' },
    render,
};

export const Outline: Story = {
    args: { variant: 'outline' },
    render,
};

export const Skeleton: Story = {
    args: { skeleton: true },
    render,
};
