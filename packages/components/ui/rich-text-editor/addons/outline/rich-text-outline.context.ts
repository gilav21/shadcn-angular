import { InjectionToken, type Signal } from '@angular/core';
import type { RichTextOutlineLocale } from './rich-text-outline.locales';

/** A single entry in the document outline (table of contents). */
export interface OutlineHeading {
    /** Heading level, 1-6, derived from the tag name (h1-h6). */
    level: number;
    /** Trimmed text content of the heading. */
    text: string;
    /** Zero-based position of the heading within the document's heading list. */
    index: number;
}

/**
 * The state and callbacks the outline directive hands to its docked panel
 * component through DI. Injected via {@link RICH_TEXT_OUTLINE_CONTEXT} so the
 * panel stays a dumb view over the directive's signals.
 */
export interface RichTextOutlineContext {
    /** Resolved addon locale for the panel strings. */
    readonly locale: Signal<RichTextOutlineLocale>;
    /** Live table of contents, in document order. */
    readonly headings: Signal<readonly OutlineHeading[]>;
    /** Whether the panel is currently open. */
    readonly isOpen: Signal<boolean>;
    /** Close the panel. */
    close(): void;
    /** Smoothly scroll the heading at `index` to the top of the editor. */
    scrollTo(index: number): void;
    /** Handle Enter/Space activation on an outline entry row. */
    onEntryKeydown(event: KeyboardEvent, index: number): void;
}

/** DI token carrying the {@link RichTextOutlineContext} to the panel component. */
export const RICH_TEXT_OUTLINE_CONTEXT = new InjectionToken<RichTextOutlineContext>(
    'RICH_TEXT_OUTLINE_CONTEXT',
);
