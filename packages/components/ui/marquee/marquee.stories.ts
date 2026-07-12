import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { MarqueeComponent } from './marquee.component';

const meta: Meta<MarqueeComponent> = {
    title: 'UI/Marquee',
    component: MarqueeComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [MarqueeComponent],
        }),
    ],
    argTypes: {
        direction: {
            control: 'select',
            options: ['left', 'right', 'up', 'down'],
            description: 'Scroll direction of the marquee track.',
        },
        speed: {
            control: 'number',
            description: 'Duration (seconds) for one full loop of the track.',
        },
        pauseOnHover: {
            control: 'boolean',
            description: 'Pauses the animation while hovered/touched.',
        },
        gap: {
            control: 'number',
            description: 'Gap (px) between projected items and between the looped segments.',
        },
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
    },
    args: {
        direction: 'left',
        speed: 20,
        pauseOnHover: false,
        gap: 16,
        class: '',
    },
};

export default meta;
type Story = StoryObj<MarqueeComponent>;

const TEMPLATE = `
    <div class="w-full overflow-hidden py-4">
        <ui-marquee [direction]="direction" [speed]="speed" [pauseOnHover]="pauseOnHover" [gap]="gap" [class]="class">
            <div class="flex items-center gap-4">
                <div class="flex items-center gap-2 px-4 py-2 rounded-full border bg-card shadow-sm">
                    <span class="text-lg">⚡</span>
                    <span class="text-sm font-medium">Angular</span>
                </div>
                <div class="flex items-center gap-2 px-4 py-2 rounded-full border bg-card shadow-sm">
                    <span class="text-lg">🎨</span>
                    <span class="text-sm font-medium">Tailwind CSS</span>
                </div>
                <div class="flex items-center gap-2 px-4 py-2 rounded-full border bg-card shadow-sm">
                    <span class="text-lg">🛠️</span>
                    <span class="text-sm font-medium">TypeScript</span>
                </div>
                <div class="flex items-center gap-2 px-4 py-2 rounded-full border bg-card shadow-sm">
                    <span class="text-lg">🔮</span>
                    <span class="text-sm font-medium">shadcn-angular</span>
                </div>
                <div class="flex items-center gap-2 px-4 py-2 rounded-full border bg-card shadow-sm">
                    <span class="text-lg">🚀</span>
                    <span class="text-sm font-medium">Storybook</span>
                </div>
                <div class="flex items-center gap-2 px-4 py-2 rounded-full border bg-card shadow-sm">
                    <span class="text-lg">🧪</span>
                    <span class="text-sm font-medium">Jest</span>
                </div>
            </div>
        </ui-marquee>
    </div>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Vertical: Story = {
    args: {
        direction: 'up',
        speed: 15,
        gap: 12,
    },
    render: (args) => ({
        props: args,
        template: `
            <div class="h-64 overflow-hidden w-48 mx-auto">
                <ui-marquee [direction]="direction" [speed]="speed" [gap]="gap" class="h-full">
                    <div class="flex flex-col gap-3">
                        <div class="px-4 py-2.5 rounded-lg border bg-card shadow-sm text-sm font-medium">TypeScript</div>
                        <div class="px-4 py-2.5 rounded-lg border bg-card shadow-sm text-sm font-medium">Angular 17</div>
                        <div class="px-4 py-2.5 rounded-lg border bg-card shadow-sm text-sm font-medium">RxJS</div>
                        <div class="px-4 py-2.5 rounded-lg border bg-card shadow-sm text-sm font-medium">NgRx</div>
                        <div class="px-4 py-2.5 rounded-lg border bg-card shadow-sm text-sm font-medium">Signals</div>
                        <div class="px-4 py-2.5 rounded-lg border bg-card shadow-sm text-sm font-medium">Tailwind</div>
                    </div>
                </ui-marquee>
            </div>
        `,
    }),
};

export const PauseOnHover: Story = {
    args: {
        direction: 'left',
        speed: 15,
        pauseOnHover: true,
    },
    render: (args) => ({
        props: args,
        template: `
            <div class="w-full overflow-hidden py-6 space-y-2">
                <p class="text-xs text-muted-foreground text-center mb-3">Hover over the marquee to pause</p>
                <ui-marquee [direction]="direction" [speed]="speed" [pauseOnHover]="pauseOnHover" [gap]="20">
                    <div class="flex items-center gap-5">
                        <div class="w-32 h-16 rounded-xl border bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center text-sm font-semibold">Card A</div>
                        <div class="w-32 h-16 rounded-xl border bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center text-sm font-semibold">Card B</div>
                        <div class="w-32 h-16 rounded-xl border bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center text-sm font-semibold">Card C</div>
                        <div class="w-32 h-16 rounded-xl border bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center text-sm font-semibold">Card D</div>
                        <div class="w-32 h-16 rounded-xl border bg-gradient-to-br from-pink-500/20 to-rose-500/20 flex items-center justify-center text-sm font-semibold">Card E</div>
                    </div>
                </ui-marquee>
            </div>
        `,
    }),
};

export const TestimonialsRow: Story = {
    render: () => ({
        template: `
            <div class="w-full overflow-hidden py-4 space-y-4">
                <ui-marquee [speed]="25" [gap]="16">
                    <div class="flex gap-4">
                        <div class="w-56 p-4 rounded-xl border bg-card shadow-sm shrink-0">
                            <p class="text-xs text-muted-foreground">"Absolutely love this library!"</p>
                            <p class="text-xs font-medium mt-2">— Alice M.</p>
                        </div>
                        <div class="w-56 p-4 rounded-xl border bg-card shadow-sm shrink-0">
                            <p class="text-xs text-muted-foreground">"Saved us weeks of work."</p>
                            <p class="text-xs font-medium mt-2">— Bob K.</p>
                        </div>
                        <div class="w-56 p-4 rounded-xl border bg-card shadow-sm shrink-0">
                            <p class="text-xs text-muted-foreground">"Best Angular UI kit out there."</p>
                            <p class="text-xs font-medium mt-2">— Carol J.</p>
                        </div>
                        <div class="w-56 p-4 rounded-xl border bg-card shadow-sm shrink-0">
                            <p class="text-xs text-muted-foreground">"The components are stunning."</p>
                            <p class="text-xs font-medium mt-2">— Dave R.</p>
                        </div>
                    </div>
                </ui-marquee>
                <ui-marquee [speed]="20" direction="right" [gap]="16">
                    <div class="flex gap-4">
                        <div class="w-56 p-4 rounded-xl border bg-card shadow-sm shrink-0">
                            <p class="text-xs text-muted-foreground">"Highly customizable and clean."</p>
                            <p class="text-xs font-medium mt-2">— Eve S.</p>
                        </div>
                        <div class="w-56 p-4 rounded-xl border bg-card shadow-sm shrink-0">
                            <p class="text-xs text-muted-foreground">"Our team adopted it in a day."</p>
                            <p class="text-xs font-medium mt-2">— Frank T.</p>
                        </div>
                        <div class="w-56 p-4 rounded-xl border bg-card shadow-sm shrink-0">
                            <p class="text-xs text-muted-foreground">"Accessibility first, beautiful always."</p>
                            <p class="text-xs font-medium mt-2">— Grace L.</p>
                        </div>
                        <div class="w-56 p-4 rounded-xl border bg-card shadow-sm shrink-0">
                            <p class="text-xs text-muted-foreground">"Production-ready from day one."</p>
                            <p class="text-xs font-medium mt-2">— Henry P.</p>
                        </div>
                    </div>
                </ui-marquee>
            </div>
        `,
    }),
};
