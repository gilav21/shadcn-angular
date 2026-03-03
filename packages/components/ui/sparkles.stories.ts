import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { SparklesComponent, SparklesButtonComponent } from './sparkles.component';

const meta: Meta<SparklesButtonComponent> = {
    title: 'UI/Sparkles',
    component: SparklesButtonComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [SparklesComponent, SparklesButtonComponent],
        }),
    ],
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
type Story = StoryObj<SparklesButtonComponent>;

export const Default: Story = {
    render: (args) => ({
        props: args,
        template: `<ui-sparkles-button [variant]="variant" [size]="size">Hover Me</ui-sparkles-button>`,
    }),
};

export const OutlineVariant: Story = {
    args: {
        variant: 'outline',
    },
    render: (args) => ({
        props: args,
        template: `<ui-sparkles-button [variant]="variant" [size]="size">Outline Sparkles</ui-sparkles-button>`,
    }),
};

export const SecondaryVariant: Story = {
    args: {
        variant: 'secondary',
    },
    render: (args) => ({
        props: args,
        template: `<ui-sparkles-button [variant]="variant" [size]="size">Secondary Sparkles</ui-sparkles-button>`,
    }),
};

export const SmallSize: Story = {
    args: {
        size: 'sm',
    },
    render: (args) => ({
        props: args,
        template: `<ui-sparkles-button [variant]="variant" [size]="size">Small</ui-sparkles-button>`,
    }),
};

export const LargeSize: Story = {
    args: {
        size: 'lg',
    },
    render: (args) => ({
        props: args,
        template: `<ui-sparkles-button [variant]="variant" [size]="size">Large Sparkles</ui-sparkles-button>`,
    }),
};

export const SparklesIcon: Story = {
    render: () => ({
        template: `
            <div class="flex items-center gap-4">
                <ui-sparkles class="w-8 h-8 text-yellow-400" />
                <ui-sparkles class="w-6 h-6 text-cyan-400" />
                <ui-sparkles class="w-4 h-4 text-purple-400" />
            </div>
        `,
    }),
};

export const AllVariants: Story = {
    render: () => ({
        template: `
            <div class="flex flex-wrap items-center gap-4">
                <ui-sparkles-button variant="default">Default</ui-sparkles-button>
                <ui-sparkles-button variant="destructive">Destructive</ui-sparkles-button>
                <ui-sparkles-button variant="outline">Outline</ui-sparkles-button>
                <ui-sparkles-button variant="secondary">Secondary</ui-sparkles-button>
                <ui-sparkles-button variant="ghost">Ghost</ui-sparkles-button>
                <ui-sparkles-button variant="link">Link</ui-sparkles-button>
            </div>
        `,
    }),
};
