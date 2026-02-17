import { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { UiConfettiDirective } from './confetti.directive';
import { ButtonComponent } from './button.component';
import { Component, viewChild } from '@angular/core';

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
        this.trigger = false;
        setTimeout(() => {
            this.trigger = true;
        });
    }
}

const meta: Meta = {
    title: 'UI/Confetti',
    decorators: [
        moduleMetadata({
            imports: [ConfettiDemoComponent, ConfettiSideCannonsDemoComponent],
        }),
    ],
};

export default meta;
type Story = StoryObj;

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
