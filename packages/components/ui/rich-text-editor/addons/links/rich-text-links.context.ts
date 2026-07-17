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
    /** Link text seeded from the selection while the popover is open. */
    readonly seededText: Signal<string>;
    /** Save the selection + seed the text field when the popover opens. */
    onOpen(): void;
    /** Insert the confirmed link into the editor. */
    onSubmit(payload: RichTextLinkSubmit): void;
}

export const RICH_TEXT_LINKS_BUTTON_CONTEXT = new InjectionToken<RichTextLinksButtonContext>(
    'RICH_TEXT_LINKS_BUTTON_CONTEXT',
);
