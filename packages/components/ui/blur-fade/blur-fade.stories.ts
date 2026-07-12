import { Meta, StoryObj } from '@storybook/angular';
import { BlurFadeComponent } from './blur-fade.component';

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct visual mode.
const meta: Meta<BlurFadeComponent> = {
    title: 'UI/Blur Fade',
    component: BlurFadeComponent,
    tags: ['autodocs'],
    argTypes: {
        delay: {
            control: 'number',
            description: 'Animation start delay in milliseconds.',
        },
        duration: {
            control: 'number',
            description: 'Animation duration in milliseconds.',
        },
        direction: {
            control: 'select',
            options: ['up', 'down', 'left', 'right'],
            description: 'Direction the content translates in from while fading/blurring into place.',
        },
        inView: {
            control: 'boolean',
            description: 'When true, the animation only plays once the host scrolls into the viewport (IntersectionObserver). When false, it plays immediately on mount.',
        },
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
    },
    args: {
        delay: 0,
        duration: 500,
        direction: 'up',
        inView: false,
        class: '',
    },
};

export default meta;
type Story = StoryObj<BlurFadeComponent>;

const TEMPLATE = `
    <div class="p-12 flex items-center justify-center">
        <ui-blur-fade
            [delay]="delay" [duration]="duration" [direction]="direction"
            [inView]="inView" [class]="class">
            <div class="max-w-sm p-6 rounded-xl border bg-card shadow-sm">
                <h3 class="text-xl font-semibold">Blur Fade In</h3>
                <p class="text-muted-foreground mt-2 text-sm">
                    This element fades in with a blur effect and translates in from the
                    "{{ direction }}" direction.
                </p>
            </div>
        </ui-blur-fade>
    </div>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. Reload the story to replay the animation. */
export const Playground: Story = { render };

export const WithDelay: Story = {
    render: () => ({
        template: `
            <div class="p-12 space-y-4 max-w-md mx-auto">
                <ui-blur-fade [delay]="0" [inView]="false">
                    <div class="p-4 rounded-lg border bg-card">
                        <h4 class="font-semibold">First Item</h4>
                        <p class="text-sm text-muted-foreground">Appears immediately (delay: 0ms)</p>
                    </div>
                </ui-blur-fade>
                <ui-blur-fade [delay]="150" [inView]="false">
                    <div class="p-4 rounded-lg border bg-card">
                        <h4 class="font-semibold">Second Item</h4>
                        <p class="text-sm text-muted-foreground">Appears after 150ms delay</p>
                    </div>
                </ui-blur-fade>
                <ui-blur-fade [delay]="300" [inView]="false">
                    <div class="p-4 rounded-lg border bg-card">
                        <h4 class="font-semibold">Third Item</h4>
                        <p class="text-sm text-muted-foreground">Appears after 300ms delay</p>
                    </div>
                </ui-blur-fade>
                <ui-blur-fade [delay]="450" [inView]="false">
                    <div class="p-4 rounded-lg border bg-card">
                        <h4 class="font-semibold">Fourth Item</h4>
                        <p class="text-sm text-muted-foreground">Appears after 450ms delay</p>
                    </div>
                </ui-blur-fade>
            </div>`,
    }),
};

export const DirectionLeft: Story = {
    args: { direction: 'left', delay: 0, duration: 600 },
    render: (args) => ({
        props: args,
        template: `
            <div class="p-12 flex items-center justify-center">
                <ui-blur-fade [direction]="direction" [delay]="delay" [duration]="duration" [inView]="false">
                    <div class="max-w-sm p-6 rounded-xl border bg-card shadow-sm">
                        <h3 class="text-xl font-semibold">Slides from Right</h3>
                        <p class="text-muted-foreground mt-2 text-sm">
                            Direction is set to "left", so the element enters from the right side.
                        </p>
                    </div>
                </ui-blur-fade>
            </div>`,
    }),
};

export const AllDirections: Story = {
    render: () => ({
        template: `
            <div class="p-12 grid grid-cols-2 gap-6 max-w-xl mx-auto">
                <ui-blur-fade direction="up" [delay]="0" [inView]="false">
                    <div class="p-4 rounded-lg border bg-card text-center">
                        <p class="text-2xl mb-1">&uarr;</p>
                        <p class="font-medium text-sm">Up</p>
                    </div>
                </ui-blur-fade>
                <ui-blur-fade direction="down" [delay]="100" [inView]="false">
                    <div class="p-4 rounded-lg border bg-card text-center">
                        <p class="text-2xl mb-1">&darr;</p>
                        <p class="font-medium text-sm">Down</p>
                    </div>
                </ui-blur-fade>
                <ui-blur-fade direction="left" [delay]="200" [inView]="false">
                    <div class="p-4 rounded-lg border bg-card text-center">
                        <p class="text-2xl mb-1">&larr;</p>
                        <p class="font-medium text-sm">Left</p>
                    </div>
                </ui-blur-fade>
                <ui-blur-fade direction="right" [delay]="300" [inView]="false">
                    <div class="p-4 rounded-lg border bg-card text-center">
                        <p class="text-2xl mb-1">&rarr;</p>
                        <p class="font-medium text-sm">Right</p>
                    </div>
                </ui-blur-fade>
            </div>`,
    }),
};

export const TriggeredOnScrollIntoView: Story = {
    args: { inView: true },
    render: (args) => ({
        props: args,
        template: `
            <div class="p-12">
                <p class="text-sm text-muted-foreground mb-[60vh]">
                    Scroll down inside this story's canvas — the card below only animates in once
                    it enters the viewport (default "inView" behavior).
                </p>
                <div class="flex items-center justify-center">
                    <ui-blur-fade
                        [delay]="delay" [duration]="duration" [direction]="direction" [inView]="true">
                        <div class="max-w-sm p-6 rounded-xl border bg-card shadow-sm">
                            <h3 class="text-xl font-semibold">Triggered on Scroll</h3>
                            <p class="text-muted-foreground mt-2 text-sm">
                                inView is true, so this fades in only when it becomes visible.
                            </p>
                        </div>
                    </ui-blur-fade>
                </div>
            </div>`,
    }),
};
