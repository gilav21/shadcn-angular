import { describe, expect, it } from 'vitest';
import type { TextItem } from '../pdf-parser';
import {
    bimodalGapThreshold,
    buildWords,
    detectDirection,
    strongRtlRatio,
    toLogicalOrder,
    type WordBuildContext,
} from './readable-words';
import type { Word } from './readable-types';

function makeItem(overrides: Partial<TextItem>): TextItem {
    return {
        text: 'x',
        fontSize: 12,
        x: 0,
        y: 700,
        endX: 10,
        page: 0,
        color: '#000000',
        bold: false,
        italic: false,
        fontFamily: 'Helvetica',
        fontName: 'F1',
        mcid: -1,
        charSpacing: 0,
        wordSpacing: 0,
        textRise: 0,
        horizontalScaling: 100,
        textRenderMode: 0,
        strokeColor: '#000000',
        transformMatrix: [1, 0, 0, 1],
        isSpaceOffset: false,
        ...overrides,
    };
}

const ctx: WordBuildContext = {
    annotations: [],
    spaceAdvance: () => null,
};

describe('buildWords', () => {
    it('merges tightly adjacent fragments into one word', () => {
        const words = buildWords([
            makeItem({ text: 'Hel', x: 0, endX: 18 }),
            makeItem({ text: 'lo', x: 18.2, endX: 30 }),
        ], ctx);
        expect(words.map(w => w.text)).toEqual(['Hello']);
    });

    it('inserts a space at a space-sized gap while keeping one word run', () => {
        const words = buildWords([
            makeItem({ text: 'Hello', x: 0, endX: 30 }),
            makeItem({ text: 'World', x: 33.5, endX: 63 }),
        ], ctx);
        expect(words).toHaveLength(1);
        expect(words[0].text).toBe('Hello World');
    });

    it('starts a new word when the style changes mid-line', () => {
        const words = buildWords([
            makeItem({ text: 'normal', x: 0, endX: 36 }),
            makeItem({ text: 'bold', x: 40, endX: 64, bold: true }),
        ], ctx);
        expect(words).toHaveLength(2);
        expect(words[1].style.bold).toBe(true);
        expect(words[1].spaceBefore).toBe(true);
    });

    it('treats an isSpaceOffset fragment as a word separator', () => {
        const words = buildWords([
            makeItem({ text: 'one', x: 0, endX: 18 }),
            makeItem({ text: ' ', x: 18, endX: 21, isSpaceOffset: true }),
            makeItem({ text: 'two', x: 21, endX: 39, bold: true }),
        ], ctx);
        expect(words).toHaveLength(2);
        expect(words[1].spaceBefore).toBe(true);
    });

    it('breaks words at gaps beyond the hard-break threshold', () => {
        const words = buildWords([
            makeItem({ text: 'left', x: 0, endX: 24 }),
            makeItem({ text: 'right', x: 200, endX: 230 }),
        ], ctx);
        expect(words).toHaveLength(2);
    });

    it('uses the font space advance plus wordSpacing for the gap threshold', () => {
        const wideSpaceCtx: WordBuildContext = {
            annotations: [],
            spaceAdvance: () => 600,
        };
        const words = buildWords([
            makeItem({ text: 'a', x: 0, endX: 6 }),
            makeItem({ text: 'b', x: 8.5, endX: 14 }),
        ], wideSpaceCtx);
        expect(words.map(w => w.text)).toEqual(['ab']);
    });

    it('uses the bimodal gap valley for letter-spaced text where the fixed threshold fails', () => {
        const letterGap = 2;
        const wordGap = 6;
        const xs = [0, 8 + letterGap, 16 + 2 * letterGap, 24 + 2 * letterGap + wordGap, 32 + 3 * letterGap + wordGap, 40 + 4 * letterGap + wordGap];
        const chars = ['a', 'b', 'c', 'd', 'e', 'f'];
        const items = xs.map((x, i) => makeItem({ text: chars[i], x, endX: x + 8 }));
        const words = buildWords(items, ctx);
        expect(words.map(w => w.text)).toEqual(['abc def']);
    });

    it('returns no bimodal threshold for uniform gaps', () => {
        const items = [0, 10, 20, 30, 40].map(x => makeItem({ text: 'a', x, endX: x + 8 }));
        expect(bimodalGapThreshold(items)).toBeNull();
    });

    it('flags raised text as superscript', () => {
        const words = buildWords([
            makeItem({ text: '2', textRise: 4 }),
        ], ctx);
        expect(words[0].style.baselineShift).toBe('sup');
    });

    it('attaches URI links from annotations covering the fragment', () => {
        const linkCtx: WordBuildContext = {
            annotations: [{ x: 0, y: 695, width: 100, height: 20, page: 0, uri: 'https://a.b' }],
            spaceAdvance: () => null,
        };
        const words = buildWords([makeItem({ text: 'link', x: 10, endX: 40 })], linkCtx);
        expect(words[0].style.link).toBe('https://a.b');
    });
});

describe('direction detection', () => {
    it('classifies Hebrew text as RTL', () => {
        expect(strongRtlRatio('שלום עולם')).toBe(1);
    });

    it('classifies mixed mostly-Latin text as LTR', () => {
        const words: Word[] = [wordOf('Hello'), wordOf('World'), wordOf('בית')];
        expect(detectDirection(words)).toBe('ltr');
    });
});

describe('toLogicalOrder', () => {
    it('reverses RTL words from visual to logical order', () => {
        const words = [wordOf('עולם'), wordOf('שלום')];
        const logical = toLogicalOrder(words, 'rtl');
        expect(logical.map(w => w.text)).toEqual(['שלום', 'עולם']);
    });

    it('keeps embedded LTR runs in left-to-right order inside an RTL line', () => {
        const words = [wordOf('סוף'), wordOf('Windows'), wordOf('של'), wordOf('גרסה')];
        const logical = toLogicalOrder(words, 'rtl');
        expect(logical.map(w => w.text)).toEqual(['גרסה', 'של', 'Windows', 'סוף']);
    });

    it('restores multi-word LTR phrases inside an RTL line', () => {
        const words = [wordOf('אחרי'), wordOf('Windows'), wordOf('Vista'), wordOf('לפני')];
        const logical = toLogicalOrder(words, 'rtl');
        expect(logical.map(w => w.text)).toEqual(['לפני', 'Windows', 'Vista', 'אחרי']);
    });

    it('recomputes spaceBefore against the logical predecessor after reversal', () => {
        const glued = wordOf('לום', 30);
        glued.spaceBefore = false;
        const words = [wordOf('ש', 0), glued, wordOf('עולם', 60)];
        const logical = toLogicalOrder(words, 'rtl');
        expect(logical.map(w => w.text)).toEqual(['עולם', 'לום', 'ש']);
        expect(logical[1].spaceBefore).toBe(true);
        expect(logical[2].spaceBefore).toBe(false);
    });

    it('leaves LTR lines untouched', () => {
        const words = [wordOf('a'), wordOf('b')];
        expect(toLogicalOrder(words, 'ltr')).toBe(words);
    });
});

function wordOf(text: string, x = 0): Word {
    return {
        text,
        x,
        endX: x + 10,
        y: 700,
        fontSize: 12,
        style: {
            fontName: 'F1',
            fontSize: 12,
            color: '#000000',
            bold: false,
            italic: false,
            underline: false,
            baselineShift: 'none',
            link: '',
        },
        mcid: -1,
        spaceBefore: true,
    };
}
