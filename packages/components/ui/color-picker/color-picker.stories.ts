import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { FormsModule } from '@angular/forms';
import { signal } from '@angular/core';
import { ColorPickerComponent } from './color-picker.component';
import { COLOR_PICKER_LOCALES } from './color-picker.locales';

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
        presets: { control: 'object', description: 'Preset swatch colors shown below the picker area.' },
        inline: { control: 'boolean', description: 'Renders just the picker panel, without the built-in trigger + popover, for embedding inside another surface.' },
        disabled: { control: 'boolean', description: 'Disables the picker.' },
        alpha: { control: 'boolean', description: 'Enables the alpha (opacity) slider and 8-char hex output.' },
        recentColors: { control: 'object', description: 'Externally-controlled recent-colors list. When set (non-null) the component no longer tracks recents internally; use with `(recentColorsChange)`.' },
        maxRecent: { control: 'number', description: 'Maximum number of recent colors kept.' },
        storageKey: { control: 'text', description: 'When set, persists recent colors to localStorage under this key.' },
        enableEyedropper: { control: 'boolean', description: 'Shows the eyedropper tool (Chromium EyeDropper API, with an image-sampling fallback).' },
        fallbackTarget: { control: false, description: 'Image/canvas/video element sampled by the eyedropper fallback when the native EyeDropper API is unavailable.' },
        enableImagePick: { control: 'boolean', description: 'Shows the "extract from image" tool.' },
        imageExtractAlgorithm: { control: 'select', options: ['median-cut', 'k-means'], description: 'Palette-extraction algorithm used by the image picker.' },
        imageExtractCount: { control: 'number', description: 'Number of dominant colors to extract from a picked image.' },
        showHarmonies: { control: 'boolean', description: 'Shows the color-harmony suggestion groups (readable, opposite, neighbors, trio, quartet).' },
        showContrast: { control: 'boolean', description: 'Shows the WCAG contrast checker against `contrastBackground`.' },
        contrastBackground: { control: 'color', description: 'Background color the contrast checker compares against.' },
        formats: { control: 'object', description: 'Which format tabs to show (`hex`, `rgb`, `hsl`, `oklch`).' },
        locale: {
            control: 'select',
            options: Object.keys(COLOR_PICKER_LOCALES),
            description: 'Locale dictionary registry key (or a full ColorPickerLocale object). Falls back to `UI_LOCALE_ID` when not set.',
        },
        class: { control: 'text', description: 'Extra classes merged onto the trigger.' },
    },
    args: {
        presets: [],
        inline: false,
        disabled: false,
        alpha: false,
        recentColors: null,
        maxRecent: 8,
        storageKey: null,
        enableEyedropper: true,
        enableImagePick: false,
        imageExtractAlgorithm: 'median-cut',
        imageExtractCount: 6,
        showHarmonies: false,
        showContrast: false,
        contrastBackground: '#ffffff',
        formats: ['hex', 'rgb', 'hsl'],
        locale: 'en',
        class: '',
    },
};

export default meta;
type Story = StoryObj<ColorPickerComponent>;

const SELECTED_BLOCK = `
    <div class="flex items-center gap-2">
        <span class="text-sm text-muted-foreground">Selected:</span>
        <span class="h-8 w-8 rounded border" [style.backgroundColor]="color()"></span>
        <code class="text-sm font-mono">{{ color() }}</code>
    </div>
`;

const PLAYGROUND_TEMPLATE = `
    <div class="flex flex-wrap items-center gap-4">
        <ui-color-picker
            [ngModel]="color()" (ngModelChange)="color.set($event)"
            [presets]="presets" [inline]="inline" [disabled]="disabled" [alpha]="alpha"
            [recentColors]="recentColors" [maxRecent]="maxRecent" [storageKey]="storageKey"
            [enableEyedropper]="enableEyedropper" [enableImagePick]="enableImagePick"
            [imageExtractAlgorithm]="imageExtractAlgorithm" [imageExtractCount]="imageExtractCount"
            [showHarmonies]="showHarmonies" [showContrast]="showContrast"
            [contrastBackground]="contrastBackground" [formats]="formats"
            [locale]="locale" [class]="class">
        </ui-color-picker>
        ${SELECTED_BLOCK}
    </div>`;

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = {
    render: (args) => ({
        props: { ...args, color: signal('#3b82f6') },
        template: PLAYGROUND_TEMPLATE,
    }),
};

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
                ${SELECTED_BLOCK}
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
                ${SELECTED_BLOCK}
            </div>
        `,
    }),
};

export const WithAlpha: Story = {
    render: () => ({
        props: { color: signal('#3b82f6cc') },
        template: `
            <div class="flex items-center gap-4">
                <ui-color-picker
                    [ngModel]="color()"
                    (ngModelChange)="color.set($event)"
                    [alpha]="true"
                    class="w-48"
                />
                ${SELECTED_BLOCK}
            </div>
        `,
    }),
};

export const WithEyedropper: Story = {
    render: () => ({
        props: { color: signal('#22c55e') },
        template: `
            <div class="flex items-center gap-4">
                <ui-color-picker
                    [ngModel]="color()"
                    (ngModelChange)="color.set($event)"
                    [enableEyedropper]="true"
                    class="w-48"
                />
                ${SELECTED_BLOCK}
            </div>
            <p class="mt-3 text-xs text-muted-foreground">
                In Chromium-based browsers, click the pipette icon in the popover to sample any pixel on screen.
            </p>
        `,
    }),
};

export const WithImagePick: Story = {
    render: () => ({
        props: { color: signal('#000000') },
        template: `
            <div class="flex items-center gap-4">
                <ui-color-picker
                    [ngModel]="color()"
                    (ngModelChange)="color.set($event)"
                    [enableImagePick]="true"
                    [imageExtractCount]="6"
                    imageExtractAlgorithm="median-cut"
                    class="w-48"
                />
                ${SELECTED_BLOCK}
            </div>
            <p class="mt-3 text-xs text-muted-foreground">
                Click the framed-pipette icon to upload an image; the dominant colors appear as clickable swatches.
            </p>
        `,
    }),
};

export const WithHarmonies: Story = {
    render: () => ({
        props: { color: signal('#3b82f6') },
        template: `
            <div class="flex items-center gap-4">
                <ui-color-picker
                    [ngModel]="color()"
                    (ngModelChange)="color.set($event)"
                    [showHarmonies]="true"
                    class="w-48"
                />
                ${SELECTED_BLOCK}
            </div>
        `,
    }),
};

export const WithContrastChecker: Story = {
    render: () => ({
        props: { color: signal('#fbbf24') },
        template: `
            <div class="flex items-center gap-4">
                <ui-color-picker
                    [ngModel]="color()"
                    (ngModelChange)="color.set($event)"
                    [showContrast]="true"
                    contrastBackground="#ffffff"
                    class="w-48"
                />
                ${SELECTED_BLOCK}
            </div>
        `,
    }),
};

export const FullToolkit: Story = {
    render: () => ({
        props: {
            color: signal('#3b82f6'),
            presets: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6'],
        },
        template: `
            <div class="flex items-center gap-4">
                <ui-color-picker
                    [ngModel]="color()"
                    (ngModelChange)="color.set($event)"
                    [presets]="presets"
                    [alpha]="true"
                    [enableEyedropper]="true"
                    [enableImagePick]="true"
                    [showHarmonies]="true"
                    [showContrast]="true"
                    contrastBackground="#ffffff"
                    [formats]="['hex', 'rgb', 'hsl', 'oklch']"
                    class="w-48"
                />
                ${SELECTED_BLOCK}
            </div>
        `,
    }),
};

export const PersistedRecents: Story = {
    render: () => ({
        props: { color: signal('#22c55e') },
        template: `
            <div class="flex items-center gap-4">
                <ui-color-picker
                    [ngModel]="color()"
                    (ngModelChange)="color.set($event)"
                    storageKey="story-recents"
                    [maxRecent]="6"
                    class="w-48"
                />
                ${SELECTED_BLOCK}
            </div>
            <p class="mt-3 text-xs text-muted-foreground">
                Picks are remembered across reloads under the localStorage key <code>ui-color-picker:story-recents</code>.
            </p>
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

export const Inline: Story = {
    render: () => ({
        props: {
            color: signal('#3b82f6'),
            presets: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#000000'],
        },
        template: `
            <div class="space-y-2">
                <p class="text-sm text-muted-foreground">
                    Inline mode renders just the panel (no trigger or popover) for embedding inside
                    another surface — e.g. a toolbar's own popover.
                </p>
                <div class="w-72 rounded-md border p-3">
                    <ui-color-picker
                        [inline]="true"
                        [ngModel]="color()"
                        (ngModelChange)="color.set($event)"
                        [presets]="presets"
                    />
                </div>
                ${SELECTED_BLOCK}
            </div>
        `,
    }),
};

export const BrandColors: Story = {
    render: () => ({
        props: {
            color: signal('#1DA1F2'),
            presets: [
                '#1DA1F2',
                '#4267B2',
                '#E4405F',
                '#FF0000',
                '#0A66C2',
                '#25D366',
                '#BD081C',
                '#1DB954',
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
