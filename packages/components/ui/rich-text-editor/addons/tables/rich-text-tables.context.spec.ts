import { describe, it, expect, vi } from 'vitest';
import { signal } from '@angular/core';
import { RICH_TEXT_TABLES_BUTTON_CONTEXT, type RichTextTablesButtonContext } from './rich-text-tables.context';
import { RICH_TEXT_TABLES_LOCALES } from './rich-text-tables.locales';

describe('RICH_TEXT_TABLES_BUTTON_CONTEXT', () => {
    it('is an injection token with a descriptive name', () => {
        expect(RICH_TEXT_TABLES_BUTTON_CONTEXT.toString()).toContain('RICH_TEXT_TABLES_BUTTON_CONTEXT');
    });

    it('describes a context shape whose callbacks and locale signal are usable', () => {
        const onSelect = vi.fn((_rows: number, _cols: number) => undefined);
        const onOpen = vi.fn(() => undefined);
        const context: RichTextTablesButtonContext = {
            locale: signal(RICH_TEXT_TABLES_LOCALES.en),
            onOpen,
            onSelect,
        };

        context.onOpen();
        context.onSelect(2, 3);

        expect(onOpen).toHaveBeenCalledTimes(1);
        expect(onSelect).toHaveBeenCalledWith(2, 3);
        expect(context.locale().tooltip).toBe(RICH_TEXT_TABLES_LOCALES.en.tooltip);
    });
});
