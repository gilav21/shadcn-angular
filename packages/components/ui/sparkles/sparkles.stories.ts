import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { SparklesComponent } from './sparkles.component';
import { SparklesButtonComponent } from './sub/sparkles-button.component';

// The interesting, interactive surface lives on the sub-component
// ui-sparkles-button (variant/size/class); the bare ui-sparkles icon only
// exposes `class` and is demonstrated on its own further below.
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
            description: 'Visual style of the underlying button.',
        },
        size: {
            control: 'select',
            options: ['default', 'sm', 'lg', 'icon'],
            description: 'Sizing preset of the underlying button.',
        },
        class: { control: 'text', description: 'Extra classes merged onto the button host.' },
    },
    args: {
        variant: 'default',
        size: 'default',
        class: '',
    },
};

export default meta;
type Story = StoryObj<SparklesButtonComponent>;

const TEMPLATE = `<ui-sparkles-button [variant]="variant" [size]="size" [class]="class">Hover Me</ui-sparkles-button>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. Hover the button to trigger the sparkles. */
export const Playground: Story = { render };

export const OutlineVariant: Story = {
    args: { variant: 'outline' },
    render,
};

export const SecondaryVariant: Story = {
    args: { variant: 'secondary' },
    render,
};

export const SmallSize: Story = {
    args: { size: 'sm' },
    render,
};

export const LargeSize: Story = {
    args: { size: 'lg' },
    render,
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

/** The bare `ui-sparkles` icon (a single `class` input) used standalone, without the button wrapper. */
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
