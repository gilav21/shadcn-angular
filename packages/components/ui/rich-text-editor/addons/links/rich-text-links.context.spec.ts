import { InjectionToken } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { RICH_TEXT_LINKS_BUTTON_CONTEXT } from './rich-text-links.context';

describe('RICH_TEXT_LINKS_BUTTON_CONTEXT', () => {
    it('is an InjectionToken with a descriptive name', () => {
        expect(RICH_TEXT_LINKS_BUTTON_CONTEXT).toBeInstanceOf(InjectionToken);
        expect(RICH_TEXT_LINKS_BUTTON_CONTEXT.toString()).toContain('RICH_TEXT_LINKS_BUTTON_CONTEXT');
    });
});
