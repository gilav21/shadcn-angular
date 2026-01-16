import { Meta, StoryObj } from '@storybook/angular';
import { UiConfettiDirective } from './confetti.directive';
import { ButtonComponent } from './button.component';
import { Component, input, signal } from '@angular/core';
import { ConfettiOptions } from './confetti.directive';

@Component({
    selector: 'sb-confetti-wrapper',
    standalone: true,
    imports: [UiConfettiDirective, ButtonComponent],
    template: `
    <div class="relative h-[300px] w-full border rounded-lg flex items-center justify-center bg-background overflow-hidden"
         uiConfetti [manualTrigger]="trigger()" [options]="options()">
         <ui-button [variant]="btnVariant()" (click)="fire()">{{ btnText() }}</ui-button>
    </div>
  `,
})
class ConfettiWrapperComponent {
    options = input<ConfettiOptions>({});
    btnText = input<string>('Celebrate!');
    btnVariant = input<any>('default');

    trigger = signal(false);

    fire() {
        this.trigger.set(false);
        setTimeout(() => this.trigger.set(true), 50);
    }
}

const meta: Meta<UiConfettiDirective> = {
    title: 'UI/Confetti',
    component: UiConfettiDirective,
    tags: ['autodocs'],
    argTypes: {
        manualTrigger: { table: { disable: true } },
    },
    decorators: [
        (story) => ({
            ...story(),
            moduleMetadata: {
                imports: [ConfettiWrapperComponent],
            },
        }),
    ],
};

export default meta;
type Story = StoryObj<UiConfettiDirective>;

export const Default: Story = {
    render: (args) => ({
        props: args,
        template: `<sb-confetti-wrapper [options]="options"></sb-confetti-wrapper>`,
    }),
    args: {
        options: {
            particleCount: 100,
            spread: 70,
            origin: { x: 0.5, y: 0.6 },
        },
    },
};

export const CustomColors: Story = {
    render: (args) => ({
        props: args,
        template: `<sb-confetti-wrapper [options]="options" [btnVariant]="'outline'" [btnText]="'Black & Red'"></sb-confetti-wrapper>`,
    }),
    args: {
        options: {
            colors: ['#000000', '#E11D48'],
            shapes: ['square'],
            spread: 90,
            scalar: 1.2,
            startVelocity: 45,
            gravity: 0.1,
        },
    },
};

export const SideCannons: Story = {
    render: (args) => ({
        props: args,
        template: `<sb-confetti-wrapper [options]="options" [btnVariant]="'secondary'" [btnText]="'Fill Container'"></sb-confetti-wrapper>`,
    }),
    args: {
        options: {
            variant: 'side-cannons',
            particleCount: 200,
            ticks: 400,
            startVelocity: 60,
        },
    },
};
