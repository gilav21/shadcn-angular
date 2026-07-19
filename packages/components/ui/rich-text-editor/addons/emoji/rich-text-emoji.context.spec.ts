import { InjectionToken } from '@angular/core';
import { describe, it, expect } from 'vitest';
import { RICH_TEXT_EMOJI_CONTEXT } from './rich-text-emoji.context';

describe('RICH_TEXT_EMOJI_CONTEXT', () => {
    it('is an InjectionToken describing the emoji addon context', () => {
        expect(RICH_TEXT_EMOJI_CONTEXT).toBeInstanceOf(InjectionToken);
        expect(RICH_TEXT_EMOJI_CONTEXT.toString()).toContain('RICH_TEXT_EMOJI_CONTEXT');
    });
});
