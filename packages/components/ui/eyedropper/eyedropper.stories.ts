import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { Component, signal } from '@angular/core';
import { EyedropperComponent } from './eyedropper.component';
import { EYEDROPPER_LOCALES } from './eyedropper.locales';

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

const meta: Meta<EyedropperComponent> = {
    title: 'Inputs/Eyedropper',
    component: EyedropperComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [BasicStoryComponent, FallbackTargetStoryComponent],
        }),
    ],
    argTypes: {
        variant: {
            control: 'select',
            options: ['icon', 'button'],
            description: 'Icon-only square trigger, or a labeled button.',
        },
        disabled: { control: 'boolean', description: 'Disables interaction.' },
        label: { control: 'text', description: 'Override for the button label / aria-label. Falls back to the locale\'s pickColor.' },
        locale: {
            control: 'select',
            options: Object.keys(EYEDROPPER_LOCALES),
            description: 'Locale dictionary key. Falls back to UI_LOCALE_ID when not set.',
        },
        fallbackTarget: {
            control: false,
            description: 'img/canvas/video element to sample from when the native EyeDropper API is unavailable.',
        },
        class: { control: 'text', description: 'Extra classes merged onto the trigger button.' },
    },
    args: {
        variant: 'icon',
        disabled: false,
        label: '',
        locale: undefined,
        fallbackTarget: null,
        class: '',
    },
};

export default meta;
type Story = StoryObj<EyedropperComponent>;

const TEMPLATE = `
    <div class="space-y-3">
        <ui-eyedropper
            [variant]="variant" [disabled]="disabled" [label]="label"
            [locale]="locale" [fallbackTarget]="fallbackTarget" [class]="class"
            (colorPick)="picked = $event"
        />
        <p class="text-sm text-muted-foreground">
            Picked: <span class="font-mono">{{ picked ?? '—' }}</span>
        </p>
    </div>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: { ...args, picked: null as string | null },
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Basic: Story = {
    render: () => ({ template: `<story-eyedropper-basic />` }),
};

export const ButtonVariant: Story = {
    args: { variant: 'button', label: 'Sample color' },
    render,
};

export const FallbackTarget: Story = {
    render: () => ({ template: `<story-eyedropper-fallback />` }),
};

export const Disabled: Story = {
    args: { disabled: true },
    render,
};

export const Localized: Story = {
    args: { variant: 'button', locale: 'he' },
    render,
};
