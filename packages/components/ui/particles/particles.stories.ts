import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { ParticlesComponent } from './particles.component';

const meta: Meta<ParticlesComponent> = {
    title: 'UI/Particles',
    component: ParticlesComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [ParticlesComponent],
        }),
    ],
    argTypes: {
        count: {
            control: 'number',
        },
        color: {
            control: 'text',
        },
        speed: {
            control: 'number',
        },
        connectDistance: {
            control: 'number',
        },
        mouseInteraction: {
            control: 'boolean',
        },
    },
    args: {
        count: 50,
        color: 'hsl(var(--foreground))',
        speed: 0.5,
        connectDistance: 120,
        mouseInteraction: true,
    },
};

export default meta;
type Story = StoryObj<ParticlesComponent>;

export const Default: Story = {
    args: {
        count: 50,
        speed: 0.5,
        connectDistance: 120,
        mouseInteraction: true,
    },
    render: (args) => ({
        props: args,
        template: `
            <div class="relative w-full rounded-xl overflow-hidden border bg-background" style="height: 400px;">
                <ui-particles
                    [count]="count"
                    [speed]="speed"
                    [connectDistance]="connectDistance"
                    [mouseInteraction]="mouseInteraction"
                    class="absolute inset-0 w-full h-full"
                    style="height: 400px;"
                />
                <div class="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
                    <h2 class="text-3xl font-bold">Particle Network</h2>
                    <p class="text-muted-foreground mt-2 text-sm">Move your mouse over the canvas to interact</p>
                </div>
            </div>
        `,
    }),
};

export const HighCount: Story = {
    args: {
        count: 120,
        speed: 0.4,
        connectDistance: 80,
        mouseInteraction: true,
    },
    render: (args) => ({
        props: args,
        template: `
            <div class="relative w-full rounded-xl overflow-hidden border bg-background" style="height: 400px;">
                <ui-particles
                    [count]="count"
                    [speed]="speed"
                    [connectDistance]="connectDistance"
                    [mouseInteraction]="mouseInteraction"
                    class="absolute inset-0 w-full h-full"
                    style="height: 400px;"
                />
                <div class="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
                    <h2 class="text-3xl font-bold">High Density</h2>
                    <p class="text-muted-foreground mt-2 text-sm">{{ count }} particles — dense network</p>
                </div>
            </div>
        `,
    }),
};

export const CustomColor: Story = {
    args: {
        count: 60,
        color: '#6366f1',
        speed: 0.6,
        connectDistance: 100,
        mouseInteraction: true,
    },
    render: (args) => ({
        props: args,
        template: `
            <div class="relative w-full rounded-xl overflow-hidden border bg-slate-950" style="height: 400px;">
                <ui-particles
                    [count]="count"
                    [color]="color"
                    [speed]="speed"
                    [connectDistance]="connectDistance"
                    [mouseInteraction]="mouseInteraction"
                    class="absolute inset-0 w-full h-full"
                    style="height: 400px;"
                />
                <div class="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
                    <h2 class="text-3xl font-bold text-white">Indigo Particles</h2>
                    <p class="text-slate-400 mt-2 text-sm">Custom color: {{ color }}</p>
                </div>
            </div>
        `,
    }),
};

export const DarkHero: Story = {
    render: () => ({
        template: `
            <div class="relative w-full rounded-2xl overflow-hidden bg-slate-950" style="height: 400px;">
                <ui-particles
                    [count]="70"
                    color="#a78bfa"
                    [speed]="0.3"
                    [connectDistance]="130"
                    [mouseInteraction]="true"
                    class="absolute inset-0 w-full h-full"
                    style="height: 400px;"
                />
                <div class="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none text-center px-6">
                    <div class="inline-flex items-center gap-2 bg-violet-500/20 border border-violet-500/30 rounded-full px-3 py-1 text-xs text-violet-300 mb-4">
                        ✨ New in v2.0
                    </div>
                    <h1 class="text-4xl font-black text-white leading-tight">
                        Beautiful by Default
                    </h1>
                    <p class="text-slate-400 mt-3 max-w-sm text-sm">
                        Interactive particle networks powered by Angular and Canvas 2D API.
                    </p>
                    <button class="mt-6 px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-semibold transition-colors pointer-events-auto">
                        Explore Components
                    </button>
                </div>
            </div>
        `,
    }),
};
