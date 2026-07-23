import { InjectionToken } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { RICH_TEXT_OUTLINE_CONTEXT } from './rich-text-outline.context';

describe('RICH_TEXT_OUTLINE_CONTEXT', () => {
    it('is an InjectionToken with a descriptive name', () => {
        expect(RICH_TEXT_OUTLINE_CONTEXT).toBeInstanceOf(InjectionToken);
        expect(RICH_TEXT_OUTLINE_CONTEXT.toString()).toContain('RICH_TEXT_OUTLINE_CONTEXT');
    });
});
