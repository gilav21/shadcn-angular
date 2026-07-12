import { Meta, StoryObj } from '@storybook/angular';
import { ButtonComponent } from './button.component';

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct visual mode.
const meta: Meta<ButtonComponent> = {
    title: 'UI/Button',
    component: ButtonComponent,
    tags: ['autodocs'],
    argTypes: {
        variant: {
            control: 'select',
            options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
            description: 'Visual style of the button.',
        },
        size: {
            control: 'select',
            options: ['default', 'sm', 'lg', 'icon', 'icon-sm', 'icon-lg'],
            description: 'Sizing preset. `icon*` sizes produce square icon buttons.',
        },
        disabled: { control: 'boolean', description: 'Disables interaction.' },
        loading: { control: 'boolean', description: 'Shows a spinner overlay and blocks clicks.' },
        skeleton: { control: 'boolean', description: 'Renders a skeleton placeholder instead of the button.' },
        ripple: { control: 'boolean', description: 'Enables the click ripple effect.' },
        rippleColor: { control: 'color', description: 'Ripple color (any CSS color).' },
        label: { control: 'text', description: 'Aria-label / text when no content is projected.' },
        ariaLabel: { control: 'text', description: 'Explicit `aria-label` override. Leave empty to fall back to projected content / `label`.' },
        type: {
            control: 'select',
            options: ['button', 'submit', 'reset'],
            description: 'Native button `type`. Use `submit`/`reset` inside a form.',
        },
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
    },
    args: {
        variant: 'default',
        size: 'default',
        disabled: false,
        loading: false,
        skeleton: false,
        ripple: false,
        rippleColor: 'color-mix(in srgb, currentColor 35%, transparent)',
        label: '',
        ariaLabel: undefined,
        type: 'button',
        class: '',
    },
};

export default meta;
type Story = StoryObj<ButtonComponent>;

const TEMPLATE = `
    <ui-button
        [variant]="variant" [size]="size" [disabled]="disabled"
        [loading]="loading" [skeleton]="skeleton"
        [ripple]="ripple" [rippleColor]="rippleColor"
        [label]="label" [ariaLabel]="ariaLabel" [type]="type" [class]="class">
        {{ label || 'Button' }}
    </ui-button>`;

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
                <ui-button variant="default">Default</ui-button>
                <ui-button variant="destructive">Destructive</ui-button>
                <ui-button variant="outline">Outline</ui-button>
                <ui-button variant="secondary">Secondary</ui-button>
                <ui-button variant="ghost">Ghost</ui-button>
                <ui-button variant="link">Link</ui-button>
            </div>`,
    }),
};

export const Sizes: Story = {
    render: (args) => ({
        props: args,
        template: `
            <div class="flex flex-wrap items-center gap-3">
                <ui-button size="sm">Small</ui-button>
                <ui-button size="default">Default</ui-button>
                <ui-button size="lg">Large</ui-button>
            </div>`,
    }),
};

export const Loading: Story = {
    args: { loading: true },
    render,
};

export const Skeleton: Story = {
    args: { skeleton: true },
    render,
};

export const Disabled: Story = {
    args: { disabled: true },
    render,
};
