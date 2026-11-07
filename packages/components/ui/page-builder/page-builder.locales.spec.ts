// A missing key or a dropped `{placeholder}` compiles, ships, and surfaces as
// a blank label or a sentence with a hole in it, so the shape is asserted.
import { describe, it, expect } from 'vitest';
import type { LocaleMeta } from '../../lib/i18n';
import { PAGE_BUILDER_LOCALES } from './page-builder.locales';
import { PROPERTY_EDITOR_LOCALES } from './sub/property-editor.locales';

const TEN = ['ar', 'de', 'en', 'es', 'fr', 'he', 'ja', 'pt', 'ru', 'zh'];

/** `{name}` placeholders a template expects. */
function placeholders(template: string): string[] {
    return [...template.matchAll(/\{([^}]{1,256})\}/g)]
        .map(m => m[1])
        .sort((a, b) => a.localeCompare(b));
}

function messages(locale: LocaleMeta): [string, string][] {
    return Object.entries(locale).filter((e): e is [string, string] => typeof e[1] === 'string' && e[0] !== 'code');
}

describe.each([
    ['page builder', PAGE_BUILDER_LOCALES],
    ['property editor', PROPERTY_EDITOR_LOCALES],
] as [string, Record<string, LocaleMeta>][])('%s locales', (...[, registry]) => {
    const reference = messages(registry['en']);

    it('ships the ten the rest of the library ships', () => {
        expect(Object.keys(registry).sort((a, b) => a.localeCompare(b))).toEqual(TEN);
    });

    it.each(TEN)('%s carries every English message, non-empty, with the same placeholders', code => {
        const locale = registry[code];
        expect(locale.code).toBe(code);
        const own = new Map(messages(locale));
        expect([...own.keys()].sort((a, b) => a.localeCompare(b)))
            .toEqual(reference.map(([key]) => key).sort((a, b) => a.localeCompare(b)));
        for (const [key, english] of reference) {
            expect(own.get(key)!.trim(), key).not.toBe('');
            expect(placeholders(own.get(key)!), key).toEqual(placeholders(english));
        }
    });

    it('marks exactly the right-to-left locales', () => {
        expect(TEN.filter(code => registry[code].rtl)).toEqual(['ar', 'he']);
    });
});
