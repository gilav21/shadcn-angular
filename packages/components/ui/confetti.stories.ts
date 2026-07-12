import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { UiConfettiDirective, ConfettiOptions } from './confetti.directive';
import { ButtonComponent } from './button';
import { Component } from '@angular/core';

@Component({
    selector: 'confetti-demo',
    imports: [UiConfettiDirective, ButtonComponent],
    template: `
        <div uiConfetti [manualTrigger]="trigger" [options]="options" style="width: 400px; height: 300px; display: flex; align-items: center; justify-content: center; border: 1px dashed hsl(var(--border)); border-radius: 8px;">
            <ui-button (click)="fire()">Fire Confetti</ui-button>
        </div>
    `,
})
class ConfettiDemoComponent {
    trigger = false;
    options = {};

    fire() {
        this.trigger = false;
        setTimeout(() => {
            this.trigger = true;
        });
    }
}

function fireConfetti(component: { trigger: boolean }) {
    component.trigger = false;
    setTimeout(() => {
        component.trigger = true;
    });
}

@Component({
    selector: 'confetti-side-cannons-demo',
    imports: [UiConfettiDirective, ButtonComponent],
    template: `
        <div uiConfetti [manualTrigger]="trigger" [options]="options" style="width: 400px; height: 300px; display: flex; align-items: center; justify-content: center; border: 1px dashed hsl(var(--border)); border-radius: 8px;">
            <ui-button variant="outline" (click)="fire()">Side Cannons</ui-button>
        </div>
    `,
})
class ConfettiSideCannonsDemoComponent {
    trigger = false;
    options = { variant: 'side-cannons' as const, particleCount: 80 };

    fire() {
        fireConfetti(this);
    }
}

interface ConfettiArgs {
    manualTrigger: boolean;
    particleCount: number;
    angle: number;
    spread: number;
    startVelocity: number;
    decay: number;
    gravity: number;
    drift: number;
    ticks: number;
    scalar: number;
    zIndex: number;
    disableForReducedMotion: boolean;
    variant: 'default' | 'side-cannons';
}

// Every option is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live directive. Dedicated stories below capture each distinct mode.
const meta: Meta<ConfettiArgs> = {
    title: 'UI/Confetti',
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [
                ConfettiDemoComponent,
                ConfettiSideCannonsDemoComponent,
                UiConfettiDirective,
                ButtonComponent,
            ],
        }),
    ],
    argTypes: {
        manualTrigger: { control: 'boolean', description: 'Toggling this from `false` to `true` fires the confetti burst.' },
        particleCount: { control: 'number', description: 'Number of particles to launch.' },
        angle: { control: 'number', description: 'Angle of the explosion in degrees (90 = straight up).' },
        spread: { control: 'number', description: 'Spread of the explosion in degrees.' },
        startVelocity: { control: 'number', description: 'Initial velocity of the particles.' },
        decay: { control: { type: 'number', min: 0, max: 1, step: 0.01 }, description: 'How quickly particles lose speed. 1 = no decay.' },
        gravity: { control: { type: 'number', min: 0, max: 2, step: 0.05 }, description: 'How fast particles fall.' },
        drift: { control: 'number', description: 'How much particles drift sideways.' },
        ticks: { control: 'number', description: 'How many frames particles last (controls duration, not speed).' },
        scalar: { control: { type: 'number', min: 0.1, max: 3, step: 0.1 }, description: 'Scale factor for particle size.' },
        zIndex: { control: 'number', description: 'z-index of the confetti canvas.' },
        disableForReducedMotion: { control: 'boolean', description: 'Skips firing entirely when the user prefers reduced motion.' },
        variant: { control: 'select', options: ['default', 'side-cannons'], description: 'Burst pattern: a single origin burst, or two cannons firing from the bottom corners.' },
    },
    args: {
        manualTrigger: false,
        particleCount: 50,
        angle: 90,
        spread: 45,
        startVelocity: 25,
        decay: 0.9,
        gravity: 0.05,
        drift: 0,
        ticks: 800,
        scalar: 1,
        zIndex: 100,
        disableForReducedMotion: true,
        variant: 'default',
    },
};

export default meta;
type Story = StoryObj<ConfettiArgs>;

const toOptions = (args: ConfettiArgs): ConfettiOptions => ({
    particleCount: args.particleCount,
    angle: args.angle,
    spread: args.spread,
    startVelocity: args.startVelocity,
    decay: args.decay,
    gravity: args.gravity,
    drift: args.drift,
    ticks: args.ticks,
    scalar: args.scalar,
    zIndex: args.zIndex,
    disableForReducedMotion: args.disableForReducedMotion,
    variant: args.variant,
});

/** Interactive playground — every option is wired to the Controls panel; click "Fire" to launch a burst. */
export const Playground: Story = {
    render: (args) => ({
        props: {
            trigger: args.manualTrigger,
            get options(): ConfettiOptions {
                return toOptions(args);
            },
            fire() {
                this['trigger'] = false;
                setTimeout(() => {
                    this['trigger'] = true;
                });
            },
        },
        template: `
            <div uiConfetti [manualTrigger]="trigger" [options]="options" style="width: 400px; height: 300px; display: flex; align-items: center; justify-content: center; border: 1px dashed hsl(var(--border)); border-radius: 8px;">
                <ui-button (click)="fire()">Fire Confetti</ui-button>
            </div>
        `,
    }),
};

export const Default: Story = {
    render: () => ({
        template: `<confetti-demo />`,
    }),
};

export const SideCannons: Story = {
    render: () => ({
        template: `<confetti-side-cannons-demo />`,
    }),
};
