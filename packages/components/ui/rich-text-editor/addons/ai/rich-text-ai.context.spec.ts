import { InjectionToken } from '@angular/core';
import { describe, it, expect } from 'vitest';
import { RICH_TEXT_AI_CONTEXT } from './rich-text-ai.context';

describe('RICH_TEXT_AI_CONTEXT', () => {
    it('is an InjectionToken describing the AI addon context', () => {
        expect(RICH_TEXT_AI_CONTEXT).toBeInstanceOf(InjectionToken);
        expect(RICH_TEXT_AI_CONTEXT.toString()).toContain('RICH_TEXT_AI_CONTEXT');
    });
});
