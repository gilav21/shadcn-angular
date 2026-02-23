import { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { WobbleCardComponent } from './wobble-card.component';

const meta: Meta<WobbleCardComponent> = {
    title: 'UI/Wobble Card',
    component: WobbleCardComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [WobbleCardComponent],
        }),
    ],
    argTypes: {
        intensity: {
            control: 'number',
        },
        perspective: {
            control: 'number',
        },
    },
    args: {
        intensity: 15,
        perspective: 1000,
    },
};

export default meta;
type Story = StoryObj<WobbleCardComponent>;

export const Default: Story = {
    args: {
        intensity: 15,
        perspective: 1000,
    },
    render: (args) => ({
        props: args,
        template: `
            <div class="flex items-center justify-center p-16">
                <ui-wobble-card
                    [intensity]="intensity"
                    [perspective]="perspective"
                    class="w-72 bg-gradient-to-br from-violet-500 to-purple-700 text-white"
                >
                    <div class="p-8">
                        <div class="text-4xl mb-3">🚀</div>
                        <h3 class="text-xl font-bold">Wobble Card</h3>
                        <p class="text-sm mt-2 text-white/80">
                            Move your mouse over this card to see the 3D wobble effect.
                        </p>
                        <button class="mt-4 px-4 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors">
                            Learn More
                        </button>
                    </div>
                </ui-wobble-card>
            </div>
        `,
    }),
};

export const HighIntensity: Story = {
    args: {
        intensity: 30,
        perspective: 800,
    },
    render: (args) => ({
        props: args,
        template: `
            <div class="flex items-center justify-center p-16">
                <ui-wobble-card
                    [intensity]="intensity"
                    [perspective]="perspective"
                    class="w-72 bg-gradient-to-br from-orange-500 to-red-600 text-white"
                >
                    <div class="p-8">
                        <div class="text-4xl mb-3">🔥</div>
                        <h3 class="text-xl font-bold">High Intensity</h3>
                        <p class="text-sm mt-2 text-white/80">
                            Intensity {{ intensity }} — more dramatic tilt effect on hover.
                        </p>
                    </div>
                </ui-wobble-card>
            </div>
        `,
    }),
};

export const CardGrid: Story = {
    render: () => ({
        template: `
            <div class="flex flex-wrap items-center justify-center gap-6 p-12">
                <ui-wobble-card class="w-60 bg-gradient-to-br from-blue-500 to-cyan-500 text-white" [intensity]="12">
                    <div class="p-6">
                        <div class="text-3xl mb-2">📦</div>
                        <h3 class="text-lg font-bold">Components</h3>
                        <p class="text-xs mt-1 text-white/80">50+ ready-to-use UI components</p>
                    </div>
                </ui-wobble-card>
                <ui-wobble-card class="w-60 bg-gradient-to-br from-green-500 to-emerald-600 text-white" [intensity]="12">
                    <div class="p-6">
                        <div class="text-3xl mb-2">🎨</div>
                        <h3 class="text-lg font-bold">Themeable</h3>
                        <p class="text-xs mt-1 text-white/80">Fully customizable with Tailwind CSS</p>
                    </div>
                </ui-wobble-card>
                <ui-wobble-card class="w-60 bg-gradient-to-br from-pink-500 to-rose-600 text-white" [intensity]="12">
                    <div class="p-6">
                        <div class="text-3xl mb-2">⚡</div>
                        <h3 class="text-lg font-bold">Performant</h3>
                        <p class="text-xs mt-1 text-white/80">OnPush strategy and Angular Signals</p>
                    </div>
                </ui-wobble-card>
            </div>
        `,
    }),
};

export const LightCard: Story = {
    render: () => ({
        template: `
            <div class="flex items-center justify-center p-16">
                <ui-wobble-card class="w-80 border shadow-lg bg-card" [intensity]="10" [perspective]="1200">
                    <div class="p-8">
                        <div class="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                            <span class="text-2xl">✨</span>
                        </div>
                        <h3 class="text-xl font-semibold">Premium Feature</h3>
                        <p class="text-muted-foreground text-sm mt-2">
                            Unlock advanced capabilities with our premium tier. Hover to preview the 3D effect.
                        </p>
                        <div class="mt-4 flex items-center gap-2">
                            <span class="text-2xl font-bold">$29</span>
                            <span class="text-muted-foreground text-sm">/month</span>
                        </div>
                    </div>
                </ui-wobble-card>
            </div>
        `,
    }),
};
