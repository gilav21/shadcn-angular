import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { Component, signal } from '@angular/core';
import { EyedropperComponent } from './eyedropper.component';

@Component({
    selector: 'story-eyedropper-basic',
    imports: [EyedropperComponent],
    template: `
        <div class="space-y-3">
            <ui-eyedropper (colorPick)="picked.set($event)" />
            <p class="text-sm text-muted-foreground">
                Picked: <span class="font-mono">{{ picked() ?? '—' }}</span>
            </p>
        </div>
    `,
})
class BasicStoryComponent {
    picked = signal<string | null>(null);
}

@Component({
    selector: 'story-eyedropper-button',
    imports: [EyedropperComponent],
    template: `
        <ui-eyedropper
            variant="button"
            label="Sample color"
            (colorPick)="picked.set($event)"
        />
        <p class="mt-3 text-sm text-muted-foreground">
            Picked: <span class="font-mono">{{ picked() ?? '—' }}</span>
        </p>
    `,
})
class ButtonVariantStoryComponent {
    picked = signal<string | null>(null);
}

@Component({
    selector: 'story-eyedropper-fallback',
    imports: [EyedropperComponent],
    template: `
        <div class="space-y-3">
            <img
                #img
                src="https://picsum.photos/300/200"
                alt="Sample"
                crossorigin="anonymous"
                class="rounded-md"
            />
            <ui-eyedropper
                variant="button"
                label="Pick from image"
                [fallbackTarget]="img"
                (colorPick)="picked.set($event)"
            />
            <p class="text-sm text-muted-foreground">
                Picked: <span class="font-mono">{{ picked() ?? '—' }}</span>
            </p>
            @if (picked()) {
                <div class="h-12 w-full rounded" [style.backgroundColor]="picked()"></div>
            }
        </div>
    `,
})
class FallbackTargetStoryComponent {
    picked = signal<string | null>(null);
}

@Component({
    selector: 'story-eyedropper-disabled',
    imports: [EyedropperComponent],
    template: `<ui-eyedropper [disabled]="true" />`,
})
class DisabledStoryComponent { }

const meta: Meta = {
    title: 'Inputs/Eyedropper',
    decorators: [
        moduleMetadata({
            imports: [
                BasicStoryComponent,
                ButtonVariantStoryComponent,
                FallbackTargetStoryComponent,
                DisabledStoryComponent,
            ],
        }),
    ],
};

export default meta;

type Story = StoryObj;

export const Basic: Story = {
    render: () => ({ template: `<story-eyedropper-basic />` }),
};

export const ButtonVariant: Story = {
    render: () => ({ template: `<story-eyedropper-button />` }),
};

export const FallbackTarget: Story = {
    render: () => ({ template: `<story-eyedropper-fallback />` }),
};

export const Disabled: Story = {
    render: () => ({ template: `<story-eyedropper-disabled />` }),
};
