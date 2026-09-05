import { InjectionToken, type Signal } from '@angular/core';
import type { RichTextTablesLocale } from './rich-text-tables.locales';

/**
 * Context the tables directive hands to the toolbar grid-picker button
 * component slot, carrying the resolved locale and the open/select callbacks.
 * The directive performs the actual table insert through the editor host.
 */
export interface RichTextTablesButtonContext {
    /** Resolved locale strings. */
    readonly locale: Signal<RichTextTablesLocale>;
    /** Save the editor selection when the grid popover opens. */
    onOpen(): void;
    /** Insert a `rows`×`cols` table at the saved caret. */
    onSelect(rows: number, cols: number): void;
}

export const RICH_TEXT_TABLES_BUTTON_CONTEXT = new InjectionToken<RichTextTablesButtonContext>(
    'RICH_TEXT_TABLES_BUTTON_CONTEXT',
);
