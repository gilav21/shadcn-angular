import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { MeteorsComponent } from './meteors.component';

const meta: Meta<MeteorsComponent> = {
    title: 'UI/Meteors',
    component: MeteorsComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [MeteorsComponent],
        }),
    ],
    argTypes: {
        count: {
            control: 'number',
            description: 'Number of meteors rendered simultaneously.',
        },
        speed: {
            control: 'select',
            options: ['slow', 'medium', 'fast'],
            description: 'Overall animation speed preset.',
        },
        color: {
            control: 'color',
            description: 'Meteor color (any CSS color).',
        },
    },
    args: {
        count: 20,
        speed: 'medium',
        color: 'white',
    },
};

export default meta;
type Story = StoryObj<MeteorsComponent>;

const TEMPLATE = `
    <div class="relative h-96 w-full rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center">
        <ui-meteors [count]="count" [speed]="speed" [color]="color" />
        <div class="relative z-10 text-center">
            <h2 class="text-3xl font-bold text-white">Meteor Shower</h2>
            <p class="text-slate-400 mt-2">Animated background effect</p>
        </div>
    </div>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const HighCount: Story = {
    args: {
        count: 40,
        speed: 'medium',
    },
    render: (args) => ({
        props: args,
        template: `
            <div class="relative h-96 w-full rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center">
                <ui-meteors [count]="count" [speed]="speed" [color]="color" />
                <div class="relative z-10 text-center px-6">
                    <h2 class="text-3xl font-bold text-white">{{ count }} Meteors</h2>
                    <p class="text-slate-400 mt-2">High density meteor shower</p>
                </div>
            </div>
        `,
    }),
};

export const FastSpeed: Story = {
    args: {
        count: 25,
        speed: 'fast',
    },
    render: (args) => ({
        props: args,
        template: `
            <div class="relative h-96 w-full rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center">
                <ui-meteors [count]="count" [speed]="speed" [color]="color" />
                <div class="relative z-10 text-center">
                    <h2 class="text-3xl font-bold text-white">Fast Meteors</h2>
                    <p class="text-slate-400 mt-2">Speed: fast</p>
                </div>
            </div>
        `,
    }),
};

export const HeroCard: Story = {
    render: () => ({
        template: `
            <div class="relative h-80 w-full max-w-lg mx-auto rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 flex items-center justify-center p-8">
                <ui-meteors [count]="15" speed="slow" />
                <div class="relative z-10 text-center space-y-3">
                    <div class="inline-flex items-center gap-2 bg-slate-800/80 border border-slate-600 rounded-full px-3 py-1 text-xs text-slate-300">
                        ✨ New Release
                    </div>
                    <h2 class="text-2xl font-bold text-white">shadcn-angular v2.0</h2>
                    <p class="text-slate-400 text-sm">Beautiful components built for Angular</p>
                    <button class="mt-2 px-4 py-2 bg-white text-slate-900 rounded-lg text-sm font-semibold hover:bg-slate-100 transition-colors">
                        Get Started
                    </button>
                </div>
            </div>
        `,
    }),
};
