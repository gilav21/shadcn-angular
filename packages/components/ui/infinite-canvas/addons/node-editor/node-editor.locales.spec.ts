// The editor's own words, in ten languages.
//
// Translations are the part of a component nobody re-reads. A missing key or a
// dropped `{placeholder}` compiles, ships, and only surfaces as a sentence with
// a hole in it for the one audience least able to work around it — someone
// listening to the graph rather than looking at it. So the shape is asserted
// rather than trusted.
import { describe, it, expect } from 'vitest';
import { interpolate } from '../../../../lib/i18n';
import { NODE_EDITOR_LOCALES, type NodeEditorLocale } from './node-editor.locales';

const CODES = Object.keys(NODE_EDITOR_LOCALES);
const REFERENCE = NODE_EDITOR_LOCALES['en'];

/** `{name}` placeholders a template expects. */
function placeholders(template: string): string[] {
    // Bounded like `interpolate`'s own pattern — an unbounded `[^}]+` backtracks
    // super-linearly on a string of open braces.
    return [...template.matchAll(/\{([^}]{1,256})\}/g)]
        .map(m => m[1])
        .sort((a, b) => a.localeCompare(b));
}

/** Every message key, i.e. everything but the LocaleMeta fields. */
function messageKeys(locale: NodeEditorLocale): string[] {
    return Object.entries(locale)
        .filter(([key, value]) => typeof value === 'string' && key !== 'code')
        .map(([key]) => key)
        .sort((a, b) => a.localeCompare(b));
}

describe('node editor locales', () => {
    it('ships the ten the rest of the library ships', () => {
        expect(CODES).toEqual(
            expect.arrayContaining(['en', 'he', 'ar', 'de', 'fr', 'es', 'ja', 'zh', 'ru', 'pt']),
        );
    });

    it.each(CODES)('%s carries every message English carries', code => {
        expect(messageKeys(NODE_EDITOR_LOCALES[code])).toEqual(messageKeys(REFERENCE));
    });

    it.each(CODES)('%s declares its own code', code => {
        expect(NODE_EDITOR_LOCALES[code].code).toBe(code);
    });

    /*
     * The failure that would otherwise reach a user: a translator rewrites a
     * sentence and drops `{type}`, so the port announces "input, expects" and
     * the one fact it existed to convey is gone.
     */
    it.each(CODES)('%s keeps every placeholder', code => {
        const locale = NODE_EDITOR_LOCALES[code];
        const missing: string[] = [];

        for (const key of messageKeys(REFERENCE)) {
            const expected = placeholders(REFERENCE[key as keyof NodeEditorLocale] as string);
            const actual = placeholders(locale[key as keyof NodeEditorLocale] as string);
            if (JSON.stringify(expected) !== JSON.stringify(actual)) {
                missing.push(`${key}: expected ${expected.join()} got ${actual.join()}`);
            }
        }

        expect(missing).toEqual([]);
    });

    it.each(CODES)('%s leaves no message empty', code => {
        const locale = NODE_EDITOR_LOCALES[code];
        const blank = messageKeys(locale).filter(
            key => (locale[key as keyof NodeEditorLocale] as string).trim() === '',
        );

        expect(blank).toEqual([]);
    });

    /** Hebrew and Arabic are right-to-left; nothing else should claim to be. */
    it('marks exactly the right-to-left languages', () => {
        const rtl = CODES.filter(code => NODE_EDITOR_LOCALES[code].rtl === true).sort((a, b) =>
            a.localeCompare(b),
        );

        expect(rtl).toEqual(['ar', 'he']);
    });

    it('fills a real sentence end to end', () => {
        const filled = interpolate(NODE_EDITOR_LOCALES['he'].typeMismatchDetail, {
            input: 'סגנון',
            inputType: 'object',
            output: 'טקסט',
            outputType: 'text',
        });

        expect(filled).not.toContain('{');
        expect(filled).toContain('סגנון');
    });
});
