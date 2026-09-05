import { InjectionToken, type Signal } from '@angular/core';

/**
 * Context the emoji directive hands to the toolbar-slot button component,
 * carrying the resolved locale and the insert callback.
 */
export interface RichTextEmojiContext {
    /** Localized tooltip for the emoji toolbar button. */
    readonly tooltip: Signal<string>;
    /** Insert the picked emoji into the editor content. */
    onInsert(emoji: string): void;
}

export const RICH_TEXT_EMOJI_CONTEXT = new InjectionToken<RichTextEmojiContext>(
    'RICH_TEXT_EMOJI_CONTEXT',
);
