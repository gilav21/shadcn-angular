import { InjectionToken, type Signal } from '@angular/core';
import type { RichTextImagesLocale } from './rich-text-images.locales';

/** Which image source options the toolbar popover offers. */
export type RichTextImageSources = 'all' | 'upload' | 'url';

/**
 * Context the images directive hands to the toolbar image-button component slot,
 * carrying the resolved locale, the allowed sources, and the open/insert/upload
 * callbacks. The directive performs the actual insert/upload through the editor
 * host so the slot component stays presentational.
 */
export interface RichTextImagesButtonContext {
    /** Resolved locale strings. */
    readonly locale: Signal<RichTextImagesLocale>;
    /** Which sources (URL field / file upload) the popover exposes. */
    readonly sources: Signal<RichTextImageSources>;
    /** Save the selection when the popover opens. */
    onOpen(): void;
    /** Insert an image from the URL field. */
    onInsertUrl(url: string, alt: string): void;
    /** Upload + insert a picked file. */
    onUploadFile(file: File): void;
}

export const RICH_TEXT_IMAGES_BUTTON_CONTEXT = new InjectionToken<RichTextImagesButtonContext>(
    'RICH_TEXT_IMAGES_BUTTON_CONTEXT',
);
