import { InjectionToken } from '@angular/core';
import { describe, it, expect } from 'vitest';
import { RICH_TEXT_COLOR_BUTTON_CONTEXT } from './rich-text-colors.context';

describe('RICH_TEXT_COLOR_BUTTON_CONTEXT', () => {
    it('is an InjectionToken describing the colour button context', () => {
        expect(RICH_TEXT_COLOR_BUTTON_CONTEXT).toBeInstanceOf(InjectionToken);
        expect(RICH_TEXT_COLOR_BUTTON_CONTEXT.toString()).toContain('RICH_TEXT_COLOR_BUTTON_CONTEXT');
    });
});
