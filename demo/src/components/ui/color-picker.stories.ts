import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { FormsModule } from '@angular/forms';
import { signal } from '@angular/core';
import { ColorPickerComponent } from './color-picker.component';

const meta: Meta<ColorPickerComponent> = {
    title: 'UI/ColorPicker',
    component: ColorPickerComponent,
    decorators: [
        moduleMetadata({
            imports: [FormsModule],
        }),
    ],
    tags: ['autodocs'],
    argTypes: {
        disabled: { control: 'boolean' },
    },
    args: {
        disabled: false,
    },
};

export default meta;
type Story = StoryObj<ColorPickerComponent>;

export const Default: Story = {
    render: () => ({
        props: { color: signal('#3b82f6') },
        template: `
            <div class="flex items-center gap-4">
                <ui-color-picker
                    [ngModel]="color()"
                    (ngModelChange)="color.set($event)"
                    class="w-48"
                />
                <div class="flex items-center gap-2">
                    <span class="text-sm text-muted-foreground">Selected:</span>
                    <span class="h-8 w-8 rounded border" [style.backgroundColor]="color()"></span>
                    <code class="text-sm font-mono">{{ color() }}</code>
                </div>
            </div>
        `,
    }),
};

export const WithPresets: Story = {
    render: () => ({
        props: {
            color: signal('#ef4444'),
            presets: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#000000', '#ffffff'],
        },
        template: `
            <div class="flex items-center gap-4">
                <ui-color-picker
                    [ngModel]="color()"
                    (ngModelChange)="color.set($event)"
                    [presets]="presets"
                    class="w-48"
                />
                <div class="flex items-center gap-2">
                    <span class="text-sm text-muted-foreground">Selected:</span>
                    <span class="h-8 w-8 rounded border" [style.backgroundColor]="color()"></span>
                    <code class="text-sm font-mono">{{ color() }}</code>
                </div>
            </div>
        `,
    }),
};

export const Disabled: Story = {
    render: () => ({
        props: { color: signal('#22c55e') },
        template: `
            <ui-color-picker
                [ngModel]="color()"
                [disabled]="true"
                class="w-48"
            />
        `,
    }),
};

export const BrandColors: Story = {
    render: () => ({
        props: {
            color: signal('#1DA1F2'),
            presets: [
                '#1DA1F2', // Twitter
                '#4267B2', // Facebook
                '#E4405F', // Instagram
                '#FF0000', // YouTube
                '#0A66C2', // LinkedIn
                '#25D366', // WhatsApp
                '#BD081C', // Pinterest
                '#1DB954', // Spotify
            ],
        },
        template: `
            <div class="space-y-2">
                <p class="text-sm text-muted-foreground">Brand color presets</p>
                <ui-color-picker
                    [ngModel]="color()"
                    (ngModelChange)="color.set($event)"
                    [presets]="presets"
                    class="w-48"
                />
            </div>
        `,
    }),
};

export const RTL: Story = {
    render: () => ({
        props: {
            color: signal('#8b5cf6'),
            presets: ['#ef4444', '#22c55e', '#3b82f6', '#8b5cf6'],
        },
        template: `
            <div dir="rtl" class="flex items-center gap-4">
                <ui-color-picker
                    [ngModel]="color()"
                    (ngModelChange)="color.set($event)"
                    [presets]="presets"
                    class="w-48"
                />
                <div class="flex items-center gap-2">
                    <span class="text-sm text-muted-foreground">اللون المحدد:</span>
                    <span class="h-8 w-8 rounded border" [style.backgroundColor]="color()"></span>
                    <code class="text-sm font-mono">{{ color() }}</code>
                </div>
            </div>
        `,
    }),
};
