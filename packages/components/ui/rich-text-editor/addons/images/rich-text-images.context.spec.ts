import { describe, it, expect } from 'vitest';
import { InjectionToken } from '@angular/core';
import { RICH_TEXT_IMAGES_BUTTON_CONTEXT } from './rich-text-images.context';

describe('RICH_TEXT_IMAGES_BUTTON_CONTEXT', () => {
    it('is an InjectionToken with a descriptive name', () => {
        expect(RICH_TEXT_IMAGES_BUTTON_CONTEXT).toBeInstanceOf(InjectionToken);
        expect(String(RICH_TEXT_IMAGES_BUTTON_CONTEXT)).toContain('RICH_TEXT_IMAGES_BUTTON_CONTEXT');
    });
});
