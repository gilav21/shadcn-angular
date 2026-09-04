import { describe, expect, it } from 'vitest';
import {
    INLINE_RULE_LOOKBEHIND,
    matchBlockInputRule,
    matchInlineInputRule,
} from './rich-text-input-rules';

describe('matchBlockInputRule', () => {
    // T-1 — heading markers, and the deliberate absence of h4+.
    describe('headings', () => {
        it('maps "#", "##", "###" to heading levels 1-3 with a space terminator', () => {
            expect(matchBlockInputRule('#', ' ')).toEqual({ kind: 'heading1', markerLength: 2 });
            expect(matchBlockInputRule('##', ' ')).toEqual({ kind: 'heading2', markerLength: 3 });
            expect(matchBlockInputRule('###', ' ')).toEqual({ kind: 'heading3', markerLength: 4 });
        });

        it('does not match "####" — h4-h6 are deliberately out of scope', () => {
            expect(matchBlockInputRule('####', ' ')).toBeNull();
            expect(matchBlockInputRule('#####', ' ')).toBeNull();
        });

        it('does not match a heading marker without its space terminator', () => {
            expect(matchBlockInputRule('#', '')).toBeNull();
            expect(matchBlockInputRule('#', '\n')).toBeNull();
        });
    });

    // T-2 — bullet and ordered list markers.
    describe('lists', () => {
        it('maps "-" and "*" to a bullet list', () => {
            expect(matchBlockInputRule('-', ' ')).toEqual({ kind: 'bulletList', markerLength: 2 });
            expect(matchBlockInputRule('*', ' ')).toEqual({ kind: 'bulletList', markerLength: 2 });
        });

        it('maps 1-3 digit "N." to an ordered list', () => {
            expect(matchBlockInputRule('1.', ' ')).toEqual({ kind: 'orderedList', markerLength: 3 });
            expect(matchBlockInputRule('12.', ' ')).toEqual({ kind: 'orderedList', markerLength: 4 });
            expect(matchBlockInputRule('999.', ' ')).toEqual({ kind: 'orderedList', markerLength: 5 });
        });

        it('rejects a 4-digit number and a bare "1." with no terminator', () => {
            expect(matchBlockInputRule('1000.', ' ')).toBeNull();
            expect(matchBlockInputRule('1.', '')).toBeNull();
        });
    });

    // T-3 — blockquote and the two task-list markers.
    describe('blockquote and task items', () => {
        it('maps ">" to a blockquote', () => {
            expect(matchBlockInputRule('>', ' ')).toEqual({ kind: 'blockquote', markerLength: 2 });
        });

        it('maps "[]" to an unchecked task and "[x]"/"[X]" to a checked one', () => {
            expect(matchBlockInputRule('[]', ' ')).toEqual({ kind: 'taskUnchecked', markerLength: 3 });
            expect(matchBlockInputRule('[x]', ' ')).toEqual({ kind: 'taskChecked', markerLength: 4 });
            expect(matchBlockInputRule('[X]', ' ')).toEqual({ kind: 'taskChecked', markerLength: 4 });
        });

        it('does not match "[ ]" — only the empty bracket pair is a rule', () => {
            expect(matchBlockInputRule('[ ]', ' ')).toBeNull();
        });
    });

    // T-4 — the horizontal rule is the one marker with no terminator.
    describe('horizontal rule', () => {
        it('maps exactly three dashes with no terminator', () => {
            expect(matchBlockInputRule('---', '')).toEqual({ kind: 'horizontalRule', markerLength: 3 });
        });

        it('does not match two or four dashes', () => {
            expect(matchBlockInputRule('--', '')).toBeNull();
            expect(matchBlockInputRule('----', '')).toBeNull();
        });
    });

    // T-5 — the code fence, its optional language, and its two terminators.
    describe('code fence', () => {
        it('maps "```" with a space terminator to a code block with no language', () => {
            expect(matchBlockInputRule('```', ' ')).toEqual({
                kind: 'codeBlock',
                markerLength: 4,
                language: '',
            });
        });

        it('captures the language word after the fence', () => {
            expect(matchBlockInputRule('```ts', ' ')).toEqual({
                kind: 'codeBlock',
                markerLength: 6,
                language: 'ts',
            });
        });

        it('accepts a newline terminator (the Enter path)', () => {
            expect(matchBlockInputRule('```', '\n')).toEqual({
                kind: 'codeBlock',
                markerLength: 4,
                language: '',
            });
        });

        it('does not match a bare fence with no terminator', () => {
            expect(matchBlockInputRule('```', '')).toBeNull();
        });

        it('does not match a language word longer than 16 characters', () => {
            expect(matchBlockInputRule('```' + 'a'.repeat(17), ' ')).toBeNull();
        });
    });

    describe('terminator scope', () => {
        it('accepts a newline only for the code fence — every other rule needs a space', () => {
            expect(matchBlockInputRule('#', '\n')).toBeNull();
            expect(matchBlockInputRule('-', '\n')).toBeNull();
            expect(matchBlockInputRule('>', '\n')).toBeNull();
        });

        it('treats a non-breaking space in the marker text as a plain space', () => {
            expect(matchBlockInputRule(' #', ' ')).toBeNull();
            expect(matchBlockInputRule('# ', '')).toEqual({ kind: 'heading1', markerLength: 2 });
        });
    });
});

describe('matchInlineInputRule', () => {
    // T-6 — strong.
    describe('strong', () => {
        it('matches "**bold**" anchored at the end of the text', () => {
            expect(matchInlineInputRule('**bold**')).toEqual({
                kind: 'strong',
                start: 0,
                end: 8,
                text: 'bold',
            });
        });

        it('matches a multi-word body', () => {
            expect(matchInlineInputRule('**bo ld**')).toEqual({
                kind: 'strong',
                start: 0,
                end: 9,
                text: 'bo ld',
            });
        });

        it('keeps the offsets relative to the whole string when preceded by text', () => {
            expect(matchInlineInputRule('say **hi**')).toEqual({
                kind: 'strong',
                start: 4,
                end: 10,
                text: 'hi',
            });
        });

        it('does not match a whitespace-only body or a bare "***"', () => {
            expect(matchInlineInputRule('** **')).toBeNull();
            expect(matchInlineInputRule('***')).toBeNull();
        });

        it('matches a body that reaches the lookbehind window and not one beyond it', () => {
            const inside = '**' + 'a'.repeat(INLINE_RULE_LOOKBEHIND - 4) + '**';
            expect(matchInlineInputRule(inside)?.kind).toBe('strong');

            const beyond = '**' + 'a'.repeat(INLINE_RULE_LOOKBEHIND + 100) + '**';
            expect(matchInlineInputRule(beyond)).toBeNull();
        });
    });

    // T-7 — emphasis, including the "not the inner star of **bo*" rule.
    describe('emphasis', () => {
        it('matches "*it*"', () => {
            expect(matchInlineInputRule('*it*')).toEqual({
                kind: 'em',
                start: 0,
                end: 4,
                text: 'it',
            });
        });

        it('does not fire on the inner star of an unfinished "**bo*"', () => {
            expect(matchInlineInputRule('**bo*')).toBeNull();
        });

        it('does not match "a*b*" — the opening star needs a leading boundary', () => {
            expect(matchInlineInputRule('a*b*')).toBeNull();
        });

        it('matches after a space boundary', () => {
            expect(matchInlineInputRule('a *b*')).toEqual({
                kind: 'em',
                start: 2,
                end: 5,
                text: 'b',
            });
        });
    });

    // T-8 — inline code.
    describe('inline code', () => {
        it('matches "`x`"', () => {
            expect(matchInlineInputRule('`x`')).toEqual({
                kind: 'code',
                start: 0,
                end: 3,
                text: 'x',
            });
        });

        it('does not match an empty pair "``"', () => {
            expect(matchInlineInputRule('``')).toBeNull();
        });
    });

    it('returns null when nothing is anchored at the end', () => {
        expect(matchInlineInputRule('plain text')).toBeNull();
        expect(matchInlineInputRule('')).toBeNull();
        expect(matchInlineInputRule('**bold** trailing')).toBeNull();
    });

    it('prefers strong over emphasis when both could read the same tail', () => {
        expect(matchInlineInputRule('**x**')?.kind).toBe('strong');
    });
});
