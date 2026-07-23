import { describe, it, expect } from 'vitest';
import { InjectionToken } from '@angular/core';
import { RICH_TEXT_FILE_IMPORT_BUTTON_CONTEXT } from './rich-text-file-import.context';

describe('RICH_TEXT_FILE_IMPORT_BUTTON_CONTEXT', () => {
    it('is an InjectionToken with a descriptive name', () => {
        expect(RICH_TEXT_FILE_IMPORT_BUTTON_CONTEXT).toBeInstanceOf(InjectionToken);
        expect(String(RICH_TEXT_FILE_IMPORT_BUTTON_CONTEXT)).toContain('RICH_TEXT_FILE_IMPORT_BUTTON_CONTEXT');
    });
});
