import { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { UiRippleDirective } from './ripple.directive';

const meta: Meta = {
    title: 'UI/Ripple',
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [UiRippleDirective],
        }),
    ],
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
    render: () => ({
        template: `
            <div class="flex items-center justify-center p-12">
                <button
                    uiRipple
                    class="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors"
                >
                    Click for Ripple Effect
                </button>
            </div>
        `,
    }),
};

export const CustomColor: Story = {
    render: () => ({
        template: `
            <div class="flex items-center justify-center gap-4 p-12">
                <button
                    uiRipple
                    uiRippleColor="rgba(0, 0, 255, 0.3)"
                    class="px-6 py-3 bg-blue-500 text-white rounded-lg font-medium text-sm hover:bg-blue-600 transition-colors"
                >
                    Blue Ripple
                </button>
                <button
                    uiRipple
                    uiRippleColor="rgba(236, 72, 153, 0.4)"
                    class="px-6 py-3 bg-pink-500 text-white rounded-lg font-medium text-sm hover:bg-pink-600 transition-colors"
                >
                    Pink Ripple
                </button>
                <button
                    uiRipple
                    uiRippleColor="rgba(234, 179, 8, 0.5)"
                    class="px-6 py-3 bg-yellow-500 text-white rounded-lg font-medium text-sm hover:bg-yellow-600 transition-colors"
                >
                    Yellow Ripple
                </button>
            </div>
        `,
    }),
};

export const OnCard: Story = {
    render: () => ({
        template: `
            <div class="flex items-center justify-center gap-6 p-12">
                <div
                    uiRipple
                    uiRippleColor="rgba(99, 102, 241, 0.2)"
                    class="w-48 p-5 rounded-xl border bg-card shadow-sm cursor-pointer hover:shadow-md transition-shadow select-none"
                >
                    <div class="text-2xl mb-2">🚀</div>
                    <h3 class="font-semibold">Launch Project</h3>
                    <p class="text-xs text-muted-foreground mt-1">Click anywhere on the card</p>
                </div>
                <div
                    uiRipple
                    uiRippleColor="rgba(16, 185, 129, 0.2)"
                    class="w-48 p-5 rounded-xl border bg-card shadow-sm cursor-pointer hover:shadow-md transition-shadow select-none"
                >
                    <div class="text-2xl mb-2">📦</div>
                    <h3 class="font-semibold">View Packages</h3>
                    <p class="text-xs text-muted-foreground mt-1">Click anywhere on the card</p>
                </div>
                <div
                    uiRipple
                    uiRippleColor="rgba(239, 68, 68, 0.2)"
                    class="w-48 p-5 rounded-xl border bg-card shadow-sm cursor-pointer hover:shadow-md transition-shadow select-none"
                >
                    <div class="text-2xl mb-2">⚙️</div>
                    <h3 class="font-semibold">Settings</h3>
                    <p class="text-xs text-muted-foreground mt-1">Click anywhere on the card</p>
                </div>
            </div>
        `,
    }),
};

export const ButtonVariants: Story = {
    render: () => ({
        template: `
            <div class="flex flex-wrap items-center justify-center gap-4 p-12">
                <button uiRipple class="px-5 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium dark:bg-slate-100 dark:text-slate-900">
                    Default
                </button>
                <button uiRipple uiRippleColor="rgba(0,0,0,0.15)" class="px-5 py-2.5 border bg-transparent rounded-lg text-sm font-medium hover:bg-accent transition-colors">
                    Outline
                </button>
                <button uiRipple uiRippleColor="rgba(0,0,0,0.15)" class="px-5 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors">
                    Secondary
                </button>
                <button uiRipple uiRippleColor="rgba(239,68,68,0.35)" class="px-5 py-2.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors">
                    Destructive
                </button>
                <button uiRipple class="h-10 w-10 flex items-center justify-center rounded-full bg-primary text-primary-foreground">
                    ★
                </button>
            </div>
        `,
    }),
};
