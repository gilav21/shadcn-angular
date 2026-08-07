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
    /**
     * Hex value of the colour currently in effect at the caret, tracked live so
     * the button can show it as an underline swatch. `''` when there is none
     * (only reachable for a transparent highlight background).
     */
    readonly activeColor: Signal<string>;
    /** Seed the picker from the current selection when the popover opens. */
    onOpen(): void;
    /**
     * Put the caret back where it was before the popover opened. The picker stays
     * open across picks so a colour can be refined, which means it is dismissed by
     * clicking away — and that click would otherwise land in the editor and move
     * the caret, or outside it and drop the selection entirely.
     */
    onClose(): void;
    /** Apply a picked colour to the current selection. */
    onSelect(color: string): void;
}

export const RICH_TEXT_COLOR_BUTTON_CONTEXT = new InjectionToken<RichTextColorButtonContext>(
    'RICH_TEXT_COLOR_BUTTON_CONTEXT',
);
