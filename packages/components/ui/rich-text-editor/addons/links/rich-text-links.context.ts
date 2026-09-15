import { InjectionToken, type Signal } from '@angular/core';
import type { RichTextLinkSubmit } from './rich-text-links-form.component';
import type { RichTextLinksLocale } from './rich-text-links.locales';

/**
 * Context the links directive hands to the toolbar link-button component slot,
 * carrying the resolved locale, the link text seeded from the current selection
 * when the popover opens, and the open/submit callbacks. The directive performs
 * the actual insert through the editor host.
 */
export interface RichTextLinksButtonContext {
    /** Resolved locale strings. */
    readonly locale: Signal<RichTextLinksLocale>;
    /** Link text seeded from the selection, or from the link under the caret, while the popover is open. */
    readonly seededText: Signal<string>;
    /** The href of the link under the caret, or '' when the popover will insert a new one. */
    readonly seededUrl: Signal<string>;
    /** Whether the popover edits the link under the caret rather than inserting one. */
    readonly editing: Signal<boolean>;
    /**
     * Validation message for the URL field, or `''` when the field is fine.
     * The directive owns this because it holds the sanitizer whose verdict
     * decides whether a URL is acceptable.
     */
    readonly urlError: Signal<string>;
    /** Save the selection + seed the text field when the popover opens. */
    onOpen(): void;
    /** Insert the confirmed link into the editor, or update the one under the caret. */
    onSubmit(payload: RichTextLinkSubmit): void;
    /** Remove the link under the caret, keeping its text. */
    onRemove(): void;
}

export const RICH_TEXT_LINKS_BUTTON_CONTEXT = new InjectionToken<RichTextLinksButtonContext>(
    'RICH_TEXT_LINKS_BUTTON_CONTEXT',
);
