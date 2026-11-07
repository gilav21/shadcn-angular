// A missing key or a dropped `{placeholder}` compiles, ships, and surfaces as
// a blank label for one audience only — so the shape is asserted, not trusted.
import { describe, it, expect } from 'vitest';
import { FILE_VIEWER_LOCALES, type FileViewerLocale } from './file-viewer.locales';

const CODES = Object.keys(FILE_VIEWER_LOCALES);
const REFERENCE = FILE_VIEWER_LOCALES['en'];

function messageKeys(locale: FileViewerLocale): string[] {
    return Object.entries(locale)
        .filter(([key, value]) => typeof value === 'string' && key !== 'code')
        .map(([key]) => key)
        .sort((a, b) => a.localeCompare(b));
}

describe('file viewer locales', () => {
    it('ships the ten the rest of the library ships', () => {
        const sorted = [...CODES];
        sorted.sort((a, b) => a.localeCompare(b));
        expect(sorted).toEqual(['ar', 'de', 'en', 'es', 'fr', 'he', 'ja', 'pt', 'ru', 'zh']);
    });

    it.each(CODES)('%s carries every message English carries, non-empty, under its own code', code => {
        const locale = FILE_VIEWER_LOCALES[code];
        expect(locale.code).toBe(code);
        expect(messageKeys(locale)).toEqual(messageKeys(REFERENCE));
        for (const key of messageKeys(locale)) {
            expect((locale as unknown as Record<string, string>)[key].trim()).not.toBe('');
        }
    });

    it('marks exactly the right-to-left locales', () => {
        expect(CODES.filter(code => FILE_VIEWER_LOCALES[code].rtl)).toEqual(['he', 'ar']);
    });
});
