import { describe, expect, it } from 'vitest';
import { FormControl, Validators } from '@angular/forms';
import {
    isRichTextEmpty,
    richTextHasMedia,
    richTextMaxLength,
    richTextMinWords,
    richTextRequired,
    richTextVisibleText,
} from './rich-text-editor.validators';

/**
 * Fixtures shared with the component's `isEmpty()` (T-18 in the editor spec
 * imports this table) so the two emptiness rules can never drift.
 */
export const EMPTINESS_FIXTURES: ReadonlyArray<readonly [string, boolean]> = [
    ['', true],
    ['<p><br></p>', true],
    ['<br>', true],
    ['<p>&nbsp;</p>', true],
    ['<p>​</p>', true],
    ['<ul data-task-list><li data-task><input type="checkbox"><span>&nbsp;</span></li></ul>', true],
    ['  \n', true],
    ['​', true],
    ['<p>a</p>', false],
    ['<p><img src="x.png"></p>', false],
    ['<hr>', false],
    ['<table><tr><td></td><td></td></tr></table>', false],
];

describe('richTextVisibleText', () => {
    // T-11 — HTML path.
    it('turns HTML into text with block separators, decoded entities and normalised spaces', () => {
        expect(richTextVisibleText('<p>a</p><p>b</p>')).toBe('a\nb');
        expect(richTextVisibleText('<p>one<br>two</p>')).toBe('one\ntwo');
        expect(richTextVisibleText('<p>&amp;</p>')).toBe('&');
        expect(richTextVisibleText('<p>&lt;b&gt;</p>')).toBe('<b>');
        expect(richTextVisibleText('<p>a b</p>')).toBe('a b');
        expect(richTextVisibleText('<p>a​b</p>')).toBe('ab');
        expect(richTextVisibleText('<p><b>hello</b> world</p>')).toBe('hello world');
        expect(richTextVisibleText('<ul><li>x</li><li>y</li></ul>')).toBe('x\ny');
        expect(richTextVisibleText('<table><tr><td>a</td><td>b</td></tr></table>')).toBe('a b');
        expect(richTextVisibleText('<blockquote>q</blockquote>')).toBe('q');
        expect(richTextVisibleText('<h1>H</h1><p>p</p>')).toBe('H\np');
        expect(richTextVisibleText('<details><summary>s</summary><p>d</p></details>')).toBe('s\nd');
    });

    it('collapses runs of block boundaries to a single newline and trims', () => {
        expect(richTextVisibleText('<p></p><p>a</p><p></p>')).toBe('a');
        expect(richTextVisibleText('<p><br></p>')).toBe('');
    });

    // T-12 — markdown path.
    it('strips markdown syntax down to its rendered text', () => {
        expect(richTextVisibleText('# Title')).toBe('Title');
        expect(richTextVisibleText('###### deep')).toBe('deep');
        expect(richTextVisibleText('**hello** world')).toBe('hello world');
        expect(richTextVisibleText('__hello__')).toBe('hello');
        expect(richTextVisibleText('*em*')).toBe('em');
        expect(richTextVisibleText('_em_')).toBe('em');
        expect(richTextVisibleText('~~gone~~')).toBe('gone');
        expect(richTextVisibleText('`code`')).toBe('code');
        expect(richTextVisibleText('[label](https://x.test)')).toBe('label');
        expect(richTextVisibleText('![alt text](x.png)')).toBe('alt text');
        expect(richTextVisibleText('> quoted')).toBe('quoted');
        expect(richTextVisibleText('- one\n- two')).toBe('one\ntwo');
        expect(richTextVisibleText('1. one\n2. two')).toBe('one\ntwo');
        expect(richTextVisibleText('- [ ] task\n- [x] done')).toBe('task\ndone');
        expect(richTextVisibleText('---')).toBe('');
        expect(richTextVisibleText('***')).toBe('');
    });

    it('keeps fenced-code content as text and does not read its markers as syntax', () => {
        expect(richTextVisibleText('```ts\nconst a = 1;\n```')).toBe('const a = 1;');
        expect(richTextVisibleText('```\n# not a heading\n```')).toBe('# not a heading');
    });

    it('handles nested emphasis and code spans containing stars', () => {
        expect(richTextVisibleText('***x***')).toBe('x');
        expect(richTextVisibleText('`a * b`')).toBe('a * b');
    });

    it('leaves a nested-bracket link alone, exactly as the real parser does', () => {
        // `RichTextMarkdownService.parseLinks` matches `\[([^\]]{1,4096})\]\(…\)`,
        // so `[a [b] c](u)` is not a link to the editor either — it renders as
        // literal text. The stripper must not be cleverer than the grammar it
        // shadows, or the validator would count characters the editor shows.
        expect(richTextVisibleText('[a [b] c](u)')).toBe('[a [b] c](u)');
    });

    it('strips markdown tables to their cell text', () => {
        expect(richTextVisibleText('| a | b |\n| --- | --- |\n| 1 | 2 |')).toBe('a b\n1 2');
    });

    it('strips the raw span / action-image tags the editor emits in markdown', () => {
        expect(richTextVisibleText('a <span data-action-click="open">b</span> c')).toBe('a b c');
        expect(richTextVisibleText('x <img src="y.png" data-action-click="go"> z')).toBe('x z');
    });

    // T-13 — syntax detection.
    it('treats a value carrying a tag other than span/img as HTML', () => {
        expect(richTextVisibleText('<b>*x*</b>')).toBe('*x*');
        expect(richTextVisibleText('<p>**bold**</p>')).toBe('**bold**');
    });

    it('treats a value whose only tags are span/img as markdown', () => {
        expect(richTextVisibleText('<span data-action-click="o">**bold**</span>')).toBe('bold');
        expect(richTextVisibleText('**a** <img src="i.png">')).toBe('a');
    });

    it('coerces non-string values', () => {
        expect(richTextVisibleText(null)).toBe('');
        expect(richTextVisibleText(undefined)).toBe('');
        expect(richTextVisibleText(42)).toBe('42');
    });
});

describe('richTextHasMedia', () => {
    it('detects images, rules and tables in both syntaxes', () => {
        expect(richTextHasMedia('<p><img src="x.png"></p>')).toBe(true);
        expect(richTextHasMedia('<hr>')).toBe(true);
        expect(richTextHasMedia('<table><tr><td></td></tr></table>')).toBe(true);
        expect(richTextHasMedia('![a](x.png)')).toBe(true);
        expect(richTextHasMedia('---')).toBe(true);
        expect(richTextHasMedia('| a |\n| --- |\n| 1 |')).toBe(true);
        expect(richTextHasMedia('<img src="x.png">')).toBe(true);
    });

    it('is false for text-only values', () => {
        expect(richTextHasMedia('<p>a</p>')).toBe(false);
        expect(richTextHasMedia('**a**')).toBe(false);
        expect(richTextHasMedia('')).toBe(false);
    });
});

describe('isRichTextEmpty', () => {
    it.each(EMPTINESS_FIXTURES)('%j → %s', (value, expected) => {
        expect(isRichTextEmpty(value)).toBe(expected);
    });
});

// T-14 — evidence: the built-in behaviour these validators exist to fix.
describe('evidence — Angular built-ins on rich-text values', () => {
    it('Validators.required passes an emptied HTML-mode editor', () => {
        expect(Validators.required(new FormControl('<p><br></p>'))).toBeNull();
    });

    it('Validators.maxLength counts markup characters', () => {
        expect(Validators.maxLength(4)(new FormControl('**ab**'))).toEqual({
            maxlength: { requiredLength: 4, actualLength: 6 },
        });
    });
});

// T-15
describe('richTextRequired', () => {
    const validate = (v: unknown): unknown => richTextRequired()(new FormControl(v));

    it.each([null, '', '<p><br></p>', '<p>&nbsp;</p>', '  \n', '​'])(
        'reports required for %j',
        (value) => {
            expect(validate(value)).toEqual({ required: true });
        },
    );

    it.each(['<p>a</p>', '<img src="x">', '<hr>', '![alt](x.png)', '---', '| a |\n| --- |\n| 1 |'])(
        'passes %j',
        (value) => {
            expect(validate(value)).toBeNull();
        },
    );

    it('treats undefined and non-string values sensibly', () => {
        expect(validate(undefined)).toEqual({ required: true });
        expect(validate(0)).toBeNull();
    });
});

// T-16
describe('richTextMaxLength', () => {
    const validate = (max: number, v: unknown): unknown => richTextMaxLength(max)(new FormControl(v));

    it('counts visible characters in HTML', () => {
        expect(validate(10, '<p><b>hello</b> world</p>')).toEqual({
            maxlength: { requiredLength: 10, actualLength: 11 },
        });
        expect(validate(10, '<p>hello</p>')).toBeNull();
    });

    it('counts visible characters in markdown', () => {
        expect(validate(10, '**hello** world')).toEqual({
            maxlength: { requiredLength: 10, actualLength: 11 },
        });
    });

    it('counts an entity as one character', () => {
        expect(validate(1, '<p>&amp;</p>')).toBeNull();
        expect(validate(0, '<p>&amp;</p>')).toEqual({
            maxlength: { requiredLength: 0, actualLength: 1 },
        });
    });

    it('does not count line breaks or block boundaries', () => {
        expect(validate(2, '<p>a</p><p>b</p>')).toBeNull();
        expect(validate(2, '<p>a<br>b</p>')).toBeNull();
    });

    it('counts emoji in UTF-16 units, like Angular and the editor counter', () => {
        expect(validate(1, '<p>🎉</p>')).toEqual({
            maxlength: { requiredLength: 1, actualLength: 2 },
        });
    });

    it('passes empty and nullish values', () => {
        expect(validate(3, '')).toBeNull();
        expect(validate(3, null)).toBeNull();
        expect(validate(3, '<p><br></p>')).toBeNull();
    });
});

// T-17
describe('richTextMinWords', () => {
    const validate = (min: number, v: unknown): unknown => richTextMinWords(min)(new FormControl(v));

    it('reports the shortfall', () => {
        expect(validate(3, '<p>two words</p>')).toEqual({
            minWords: { requiredWords: 3, actualWords: 2 },
        });
    });

    it('separates words across block boundaries', () => {
        expect(validate(3, '<p>one</p><p>two</p><p>three</p>')).toBeNull();
    });

    it('counts Hebrew words', () => {
        expect(validate(3, 'שלום עולם שוב')).toBeNull();
        expect(validate(4, 'שלום עולם שוב')).toEqual({
            minWords: { requiredWords: 4, actualWords: 3 },
        });
    });

    it('passes empty values — only required reports emptiness', () => {
        expect(validate(3, '')).toBeNull();
        expect(validate(3, null)).toBeNull();
        expect(validate(3, '<p><br></p>')).toBeNull();
    });

    it('counts markdown words after stripping syntax', () => {
        expect(validate(3, '**one** _two_ `three`')).toBeNull();
        expect(validate(3, '**one** _two_')).toEqual({
            minWords: { requiredWords: 3, actualWords: 2 },
        });
    });
});
