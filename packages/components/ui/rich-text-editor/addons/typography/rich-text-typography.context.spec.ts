import { describe, it, expect, vi } from 'vitest';
import { signal } from '@angular/core';
import {
    RICH_TEXT_TYPOGRAPHY_BUTTON_CONTEXT,
    type RichTextTypographyButtonContext,
} from './rich-text-typography.context';

describe('RICH_TEXT_TYPOGRAPHY_BUTTON_CONTEXT', () => {
    it('is an injection token with a descriptive name', () => {
        expect(RICH_TEXT_TYPOGRAPHY_BUTTON_CONTEXT.toString()).toContain('RICH_TEXT_TYPOGRAPHY_BUTTON_CONTEXT');
    });

    it('describes a size-kind context whose callbacks and signals are usable', () => {
        const onSelect = vi.fn((_value: string) => undefined);
        const onOpen = vi.fn(() => undefined);
        const context: RichTextTypographyButtonContext = {
            kind: 'size',
            tooltip: signal('Font Size'),
            heading: signal('Select size'),
            placeholder: signal('e.g. 16px'),
            options: signal(['8px', '16px']),
            filter: false,
            seededValue: signal('16px'),
            onOpen,
            onSelect,
        };

        context.onOpen();
        context.onSelect('24px');

        expect(context.kind).toBe('size');
        expect(context.filter).toBe(false);
        expect(context.options()).toEqual(['8px', '16px']);
        expect(context.seededValue()).toBe('16px');
        expect(onOpen).toHaveBeenCalledTimes(1);
        expect(onSelect).toHaveBeenCalledWith('24px');
    });
});
