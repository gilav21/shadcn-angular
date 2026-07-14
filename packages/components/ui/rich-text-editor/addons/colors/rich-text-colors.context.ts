import { InjectionToken, type Signal } from '@angular/core';

/** Which colour a colour button controls. */
export type RichTextColorKind = 'foreground' | 'background';

/**
 * Context the colors directive hands to each colour toolbar-slot button
 * component, carrying the resolved locale strings, the preset palette, the
 * seeded value shown when the popover opens, and the apply callback.
 */
export interface RichTextColorButtonContext {
    /** Whether this button sets the text colour or the highlight colour. */
    readonly kind: RichTextColorKind;
    /** Localized button tooltip. */
    readonly tooltip: Signal<string>;
    /** Localized popover heading. */
    readonly heading: Signal<string>;
    /** Preset swatches offered by the inline colour picker. */
    readonly presets: Signal<string[]>;
    /** Whether the picker exposes an alpha channel (highlight colours only). */
    readonly alpha: boolean;
    /** The hex value the picker is seeded with while the popover is open. */
    readonly seededColor: Signal<string>;
    /** Seed the picker from the current selection when the popover opens. */
    onOpen(): void;
    /** Apply a picked colour to the current selection. */
    onSelect(color: string): void;
}

export const RICH_TEXT_COLOR_BUTTON_CONTEXT = new InjectionToken<RichTextColorButtonContext>(
    'RICH_TEXT_COLOR_BUTTON_CONTEXT',
);
