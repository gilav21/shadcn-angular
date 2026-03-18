import { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
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
        speed: {
            control: 'number',
        },
        direction: {
            control: 'select',
            options: ['to right', 'to left', 'to bottom', 'to top'],
        },
        colors: {
            control: 'object',
        },
    },
    args: {
        speed: 3,
        direction: 'to right',
        colors: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4'],
    },
};

export default meta;
type Story = StoryObj<GradientTextComponent>;

export const Default: Story = {
    render: (args) => ({
        props: args,
        template: `
            <h1 class="text-5xl font-black">
                <ui-gradient-text [colors]="colors" [speed]="speed" [direction]="direction">Gradient Text</ui-gradient-text>
            </h1>
        `,
    }),
};

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
    render: () => ({
        template: `
            <div class="space-y-6 text-center">
                <h2 class="text-4xl font-black">
                    <ui-gradient-text [speed]="8" [colors]="['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e']">
                        Slow Shifting Gradient
                    </ui-gradient-text>
                </h2>
                <p class="text-muted-foreground text-sm">Speed set to 8 seconds per cycle</p>
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
