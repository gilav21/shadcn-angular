import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { BlurFadeComponent } from './blur-fade.component';

const meta: Meta<BlurFadeComponent> = {
    title: 'UI/Blur Fade',
    component: BlurFadeComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [BlurFadeComponent],
        }),
    ],
    argTypes: {
        delay: {
            control: 'number',
        },
        duration: {
            control: 'number',
        },
        direction: {
            control: 'select',
            options: ['up', 'down', 'left', 'right'],
        },
        inView: {
            control: 'boolean',
        },
    },
    args: {
        delay: 0,
        duration: 500,
        direction: 'up',
        inView: true,
    },
};

export default meta;
type Story = StoryObj<BlurFadeComponent>;

export const Default: Story = {
    args: {
        delay: 0,
        duration: 500,
        direction: 'up',
    },
    render: (args) => ({
        props: args,
        template: `
            <div class="p-12 flex items-center justify-center">
                <ui-blur-fade [delay]="delay" [duration]="duration" [direction]="direction" [inView]="false">
                    <div class="max-w-sm p-6 rounded-xl border bg-card shadow-sm">
                        <h3 class="text-xl font-semibold">Blur Fade In</h3>
                        <p class="text-muted-foreground mt-2 text-sm">
                            This element fades in from below with a blur effect.
                            Reload the page to see the animation.
                        </p>
                    </div>
                </ui-blur-fade>
            </div>
        `,
    }),
};

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
            </div>
        `,
    }),
};

export const DirectionLeft: Story = {
    args: {
        direction: 'left',
        delay: 0,
        duration: 600,
    },
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
            </div>
        `,
    }),
};

export const AllDirections: Story = {
    render: () => ({
        template: `
            <div class="p-12 grid grid-cols-2 gap-6 max-w-xl mx-auto">
                <ui-blur-fade direction="up" [delay]="0" [inView]="false">
                    <div class="p-4 rounded-lg border bg-card text-center">
                        <p class="text-2xl mb-1">↑</p>
                        <p class="font-medium text-sm">Up</p>
                    </div>
                </ui-blur-fade>
                <ui-blur-fade direction="down" [delay]="100" [inView]="false">
                    <div class="p-4 rounded-lg border bg-card text-center">
                        <p class="text-2xl mb-1">↓</p>
                        <p class="font-medium text-sm">Down</p>
                    </div>
                </ui-blur-fade>
                <ui-blur-fade direction="left" [delay]="200" [inView]="false">
                    <div class="p-4 rounded-lg border bg-card text-center">
                        <p class="text-2xl mb-1">←</p>
                        <p class="font-medium text-sm">Left</p>
                    </div>
                </ui-blur-fade>
                <ui-blur-fade direction="right" [delay]="300" [inView]="false">
                    <div class="p-4 rounded-lg border bg-card text-center">
                        <p class="text-2xl mb-1">→</p>
                        <p class="font-medium text-sm">Right</p>
                    </div>
                </ui-blur-fade>
            </div>
        `,
    }),
};
