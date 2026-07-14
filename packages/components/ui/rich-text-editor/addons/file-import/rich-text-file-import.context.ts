import { InjectionToken, type Signal } from '@angular/core';
import type { RichTextFileImportLocale } from './rich-text-file-import.locales';

/**
 * Context the file-import directive hands to its toolbar button component slot,
 * carrying the resolved locale, the accepted-types string for the hidden file
 * input, and the import callback. The directive performs the actual parse +
 * insert through the editor host.
 */
export interface RichTextFileImportButtonContext {
    /** Resolved locale strings. */
    readonly locale: Signal<RichTextFileImportLocale>;
    /** `accept` attribute for the hidden file input (e.g. `.pdf,.docx`). */
    readonly accept: Signal<string>;
    /** Parse and insert the chosen file's content into the editor. */
    onImport(file: File): void;
}

export const RICH_TEXT_FILE_IMPORT_BUTTON_CONTEXT =
    new InjectionToken<RichTextFileImportButtonContext>('RICH_TEXT_FILE_IMPORT_BUTTON_CONTEXT');
