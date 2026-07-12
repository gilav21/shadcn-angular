import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { GradientTextComponent } from './gradient-text.component';

const meta: Meta<GradientTextComponent> = {
    title: 'UI/Gradient Text',
    component: GradientTextComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [GradientTextComponent],
        }),
    ],
    argTypes: {
        colors: {
            control: 'object',
            description: 'Array of CSS colors used to build the animated linear gradient.',
        },
        speed: {
            control: 'number',
            description: 'Duration in seconds for one full gradient animation cycle.',
        },
        direction: {
            control: 'select',
            options: ['to right', 'to left', 'to bottom', 'to top'],
            description: 'CSS gradient direction.',
        },
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
    },
    args: {
        colors: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4'],
        speed: 3,
        direction: 'to right',
        class: '',
    },
};

export default meta;
type Story = StoryObj<GradientTextComponent>;

const TEMPLATE = `
    <h1 class="text-5xl font-black">
        <ui-gradient-text [colors]="colors" [speed]="speed" [direction]="direction" [class]="class">Gradient Text</ui-gradient-text>
    </h1>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const CustomColors: Story = {
    render: () => ({
        template: `
            <div class="space-y-4">
                <h2 class="text-4xl font-bold">
                    <ui-gradient-text [colors]="['#ec4899', '#a855f7', '#3b82f6']">
                        Pink to Blue
                    </ui-gradient-text>
                </h2>
                <h2 class="text-4xl font-bold">
                    <ui-gradient-text [colors]="['#f97316', '#eab308', '#22c55e']">
                        Sunset Palette
                    </ui-gradient-text>
                </h2>
                <h2 class="text-4xl font-bold">
                    <ui-gradient-text [colors]="['#06b6d4', '#6366f1', '#8b5cf6']">
                        Ocean Depths
                    </ui-gradient-text>
                </h2>
            </div>
        `,
    }),
};

export const SlowSpeed: Story = {
    args: { speed: 8, colors: ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e'] },
    render: (args) => ({
        props: args,
        template: `
            <div class="space-y-6 text-center">
                <h2 class="text-4xl font-black">
                    <ui-gradient-text [speed]="speed" [colors]="colors">
                        Slow Shifting Gradient
                    </ui-gradient-text>
                </h2>
                <p class="text-muted-foreground text-sm">Speed set to {{ speed }} seconds per cycle</p>
            </div>
        `,
    }),
};

export const Directions: Story = {
    render: () => ({
        template: `
            <div class="space-y-4">
                <h2 class="text-3xl font-bold"><ui-gradient-text direction="to right">To Right</ui-gradient-text></h2>
                <h2 class="text-3xl font-bold"><ui-gradient-text direction="to left">To Left</ui-gradient-text></h2>
                <h2 class="text-3xl font-bold"><ui-gradient-text direction="to bottom">To Bottom</ui-gradient-text></h2>
                <h2 class="text-3xl font-bold"><ui-gradient-text direction="to top">To Top</ui-gradient-text></h2>
            </div>
        `,
    }),
};

export const HeadingShowcase: Story = {
    render: () => ({
        template: `
            <div class="space-y-6 p-8">
                <div>
                    <p class="text-xs text-muted-foreground uppercase tracking-widest mb-1">Hero Headline</p>
                    <h1 class="text-6xl font-black leading-tight">
                        Build <ui-gradient-text>Beautiful</ui-gradient-text> Apps
                    </h1>
                </div>
                <div>
                    <p class="text-xs text-muted-foreground uppercase tracking-widest mb-1">Section Title</p>
                    <h2 class="text-3xl font-bold">
                        Powered by <ui-gradient-text [colors]="['#06b6d4', '#3b82f6']" direction="to right">Angular</ui-gradient-text>
                    </h2>
                </div>
                <div>
                    <p class="text-xs text-muted-foreground uppercase tracking-widest mb-1">Badge Text</p>
                    <span class="text-xl font-semibold">
                        <ui-gradient-text [colors]="['#f97316', '#ef4444']">New Feature</ui-gradient-text>
                    </span>
                </div>
            </div>
        `,
    }),
};
