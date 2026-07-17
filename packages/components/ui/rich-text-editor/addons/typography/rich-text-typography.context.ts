import { InjectionToken, type Signal } from '@angular/core';

/** Which typography property a toolbar button controls. */
export type RichTextTypographyKind = 'size' | 'family';

/**
 * Context the typography directive hands to each typography toolbar-slot button
 * component, carrying the resolved locale strings, the option list, the seeded
 * value shown when the popover opens, and the apply callback.
 */
export interface RichTextTypographyButtonContext {
    /** Whether this button sets the font size or the font family. */
    readonly kind: RichTextTypographyKind;
    /** Localized button tooltip. */
    readonly tooltip: Signal<string>;
    /** Localized popover heading. */
    readonly heading: Signal<string>;
    /** Localized autocomplete placeholder. */
    readonly placeholder: Signal<string>;
    /** Options offered by the inline autocomplete. */
    readonly options: Signal<string[]>;
    /** Whether the autocomplete filters options as the user types (family only). */
    readonly filter: boolean;
    /** The value the autocomplete is seeded with while the popover is open. */
    readonly seededValue: Signal<string>;
    /** Seed the autocomplete from the current selection when the popover opens. */
    onOpen(): void;
    /** Apply a picked value to the current selection. */
    onSelect(value: string): void;
}

export const RICH_TEXT_TYPOGRAPHY_BUTTON_CONTEXT = new InjectionToken<RichTextTypographyButtonContext>(
    'RICH_TEXT_TYPOGRAPHY_BUTTON_CONTEXT',
);
