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
import { clusterIntoLineItems, linesFromClusters } from './readable-lines';
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

    it('keeps a per-glyph word intact when overshooting advances make every gap negative', () => {
        const step = 5.5;
        const width = 8;
        const xs = [0, step, 2 * step, 3 * step, 4 * step, 5 * step];
        const chars = ['s', 't', 'a', 't', 'e', 'n'];
        const items = xs.map((x, i) => makeItem({ text: chars[i], x, endX: x + width, fontSize: 13.5 }));
        const words = buildWords(items, ctx);
        expect(words.map(w => w.text)).toEqual(['staten']);
    });

    it('splits per-glyph words at the small near-zero gap between them', () => {
        const step = 5.5;
        const width = 8;
        const wordGap = 0.5;
        const xs = [0, step, 2 * step, 2 * step + width + wordGap];
        xs.push(xs[3] + step, xs[3] + 2 * step);
        const chars = ['a', 'b', 'c', 'd', 'e', 'f'];
        const items = xs.map((x, i) => makeItem({ text: chars[i], x, endX: x + width, fontSize: 13.5 }));
        const words = buildWords(items, ctx);
        expect(words.map(w => w.text)).toEqual(['abc def']);
    });

    it('breaks a word-tier gap that a larger field-tier gap would otherwise mask', () => {
        const items = [
            makeItem({ text: 'a', x: 0, endX: 8 }),
            makeItem({ text: 'a', x: 8, endX: 16 }),
            makeItem({ text: 'b', x: 18.2, endX: 26.2 }),
            makeItem({ text: 'b', x: 26.2, endX: 34.2 }),
            makeItem({ text: 'c', x: 48.2, endX: 56.2 }),
            makeItem({ text: 'c', x: 56.2, endX: 64.2 }),
        ];
        const words = buildWords(items, ctx);
        expect(words.map(w => w.text)).toEqual(['aa bb cc']);
    });

    it('splits words on a line where word gaps outnumber letter gaps', () => {
        const items = [
            makeItem({ text: 'a', x: 0, endX: 8 }),
            makeItem({ text: 'a', x: 8, endX: 16 }),
            makeItem({ text: 'a', x: 16, endX: 24 }),
            makeItem({ text: 'b', x: 26.2, endX: 34.2 }),
            makeItem({ text: 'c', x: 36.4, endX: 44.4 }),
            makeItem({ text: 'd', x: 46.6, endX: 54.6 }),
            makeItem({ text: 'e', x: 56.8, endX: 64.8 }),
            makeItem({ text: 'f', x: 67, endX: 75 }),
        ];
        const words = buildWords(items, ctx);
        expect(words.map(w => w.text)).toEqual(['aaa b c d e f']);
    });

    it('keeps trailing punctuation after an RTL word when it leads visually', () => {
        // Visual left-to-right "!" then Hebrew letters => logical "הצלחה!".
        const glyphs = ['!', 'ה', 'ח', 'ל', 'צ', 'ה'];
        const items = glyphs.map((text, i) => makeItem({ text, x: i * 8, endX: i * 8 + 8 }));
        const words = buildWords(items, ctx);
        expect(words.map(w => w.text)).toEqual(['הצלחה!']);
    });

    it('does not merge an RTL run with an adjacent number even at a hairline gap', () => {
        const words = buildWords([
            makeItem({ text: '25024809', x: 0, endX: 87 }),
            makeItem({ text: 'מספר', x: 87.02, endX: 130 }),
        ], ctx);
        expect(words).toHaveLength(2);
        expect(words[1].spaceBefore).toBe(true);
    });

    it('splits words on the declared space width without a bimodal valley', () => {
        // Font declares a 0.25em space; at fontSize 12 that is 3pt, break
        // threshold 0.45*3 = 1.35pt. A 3pt gap is a space, a 0.5pt gap merges.
        const declared: WordBuildContext = { annotations: [], spaceAdvance: () => 250 };
        const joined = buildWords([
            makeItem({ text: 'foo', x: 0, endX: 20, fontSize: 12 }),
            makeItem({ text: 'bar', x: 20.5, endX: 40, fontSize: 12 }),
            makeItem({ text: 'baz', x: 43, endX: 63, fontSize: 12 }),
        ], declared).map(w => w.text).join('|');
        expect(joined).toBe('foobar baz');
    });

    it('keeps words whole in tracked-out text the declared space width misreads', () => {
        // Declared space 2.17pt sits below the 2.25pt letter gaps, so the
        // measured valley has to outrank it.
        const tracked: WordBuildContext = { annotations: [], spaceAdvance: () => 241 };
        let x = 0;
        const items: TextItem[] = [];
        for (const ch of 'ABC DEF GHI') {
            if (ch === ' ') { x += 4.42; continue; }
            items.push(makeItem({ text: ch, x, endX: x + 6, fontSize: 9 }));
            x += 6 + 2.25;
        }
        expect(buildWords(items, tracked).map(w => w.text).join(' ')).toBe('ABC DEF GHI');
    });

    it('breaks words of both sizes on a line that mixes a title and a kicker', () => {
        // Both runs break words at 0.28em, but at 5.28pt and 2.64pt.
        const items: TextItem[] = [];
        let x = 0;
        const push = (text: string, fontSize: number, gapAfter: number) => {
            for (const ch of text) {
                items.push(makeItem({ text: ch, x, endX: x + fontSize * 0.5, fontSize }));
                x += fontSize * 0.5;
            }
            x += gapAfter;
        };
        push('Lighthouse', 19, 5.28);
        push('Library', 19, 5.28);
        push('Network', 19, 138.92);
        push('Quarterly', 9.49, 2.64);
        push('Report', 9.49, 2.64);
        push('Q1', 9.49, 2.64);
        push('2026', 9.49, 0);
        const text = buildWords(items, ctx).map(w => w.text).join(' ');
        expect(text).toContain('Lighthouse Library Network');
        expect(text).toContain('Quarterly Report');
        expect(text).toContain('Q1 2026');
    });

    it('measures the valley per run, not across two runs sharing a baseline', () => {
        // A letterspaced run sharing a baseline with tight display type: the
        // tight run's ~0 gaps would sink the pooled letter tier.
        const items: TextItem[] = [];
        let x = 0;
        const push = (text: string, fontSize: number, letterGap: number, gapAfter: number) => {
            for (const ch of text) {
                items.push(makeItem({ text: ch, x, endX: x + fontSize * 0.6, fontSize }));
                x += fontSize * 0.6 + letterGap;
            }
            x += gapAfter - letterGap;
        };
        push('SPECIALTY', 9, 1.5, 5.34);
        push('COFFEE', 9, 1.5, 119.4);
        push('INVOICE', 16, 0, 4.45);
        push('#2047', 16, 0, 0);
        const text = buildWords(items, ctx).map(w => w.text).join(' ');
        expect(text).toContain('SPECIALTY COFFEE');
        expect(text).toContain('INVOICE #2047');
    });

    describe('tracking reconstruction', () => {
        function trackedRun(letterGap: number, fontSize = 9, charSpacing = 0): TextItem[] {
            const items: TextItem[] = [];
            let x = 0;
            for (const ch of 'QUARTERLY') {
                items.push(makeItem({ text: ch, x, endX: x + fontSize * 0.6, fontSize, charSpacing }));
                x += fontSize * 0.6 + letterGap;
            }
            return items;
        }

        it('recovers tracking a PDF drew with glyph positioning instead of Tc', () => {
            const words = buildWords(trackedRun(2.25), ctx);
            expect(words[0].style.letterSpacing).toBeCloseTo(2.25, 1);
        });

        it('leaves normally set text unwidened', () => {
            const words = buildWords(trackedRun(0), ctx);
            expect(words[0].style.letterSpacing).toBe(0);
        });

        it('does not mistake a hair of advance rounding for tracking', () => {
            const words = buildWords(trackedRun(0.2), ctx);
            expect(words[0].style.letterSpacing).toBe(0);
        });

        it('keeps the declared Tc value when the PDF states one', () => {
            const words = buildWords(trackedRun(2.25, 9, 3), ctx);
            expect(words[0].style.letterSpacing).toBeCloseTo(3, 1);
        });
    });

    it('returns no bimodal threshold for uniform gaps', () => {
        const items = [0, 10, 20, 30, 40].map(x => makeItem({ text: 'a', x, endX: x + 8 }));
        expect(bimodalGapThreshold(items)).toBeNull();
    });

    it('excludes script-direction-boundary gaps from the bimodal valley', () => {
        // Uniform ~2.3pt gaps between whole RTL words, with one embedded digit
        // whose wider gaps sit at RTL/LTR boundaries. The direction-flip gaps
        // must not form a false valley that merges the genuine word gaps.
        const texts = ['אבג', 'דהו', 'זחט', '0', 'יכל', 'מנס', 'עפצ'];
        let x = 0;
        const items = texts.map(text => {
            const item = makeItem({ text, x, endX: x + 20, fontSize: 10 });
            const flip = text === '0';
            x = item.endX + (flip ? 5.3 : 2.3);
            return item;
        });
        expect(bimodalGapThreshold(items)).toBeNull();
    });

    it('separates RTL words around an embedded digit instead of mooshing them', () => {
        const texts = ['אבג', 'דהו', 'זחט', '0', 'יכל', 'מנס'];
        let x = 0;
        const items = texts.map(text => {
            const item = makeItem({ text, x, endX: x + 20, fontSize: 10 });
            x = item.endX + (text === '0' ? 5.3 : 2.3);
            return item;
        });
        const joined = buildWords(items, ctx).map(w => w.text).join(' ');
        expect(joined).toContain('אבג');
        expect(joined).toContain('דהו');
        expect(joined.includes('אבגדהו')).toBe(false);
        expect(joined.includes('דהוזחט')).toBe(false);
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

    it('keeps a multi-part number left-to-right inside an RTL line', () => {
        const words = [wordOf('שלום', 0), wordOf('12', 20), wordOf('-', 30), wordOf('34', 40), wordOf('עולם', 60)];
        const logical = toLogicalOrder(words, 'rtl');
        expect(logical.map(w => w.text)).toEqual(['עולם', '12', '-', '34', 'שלום']);
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

    it('keeps a boundary colon on the RTL side of an embedded number', () => {
        const words = [wordOf('00313', 184), wordOf(':', 255), wordOf('זהות', 278)];
        const logical = toLogicalOrder(words, 'rtl');
        expect(logical.map(w => w.text)).toEqual(['זהות', ':', '00313']);
    });

    it('still carries a neutral between two LTR numbers with them', () => {
        const words = [wordOf('שלום', 0), wordOf('12', 20), wordOf(':', 30), wordOf('34', 40), wordOf('עולם', 60)];
        const logical = toLogicalOrder(words, 'rtl');
        expect(logical.map(w => w.text)).toEqual(['עולם', '12', ':', '34', 'שלום']);
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
            fontFamily: '',
            fontSize: 12,
            color: '#000000',
            bold: false,
            italic: false,
            underline: false,
            baselineShift: 'none',
            letterSpacing: 0,
            link: '',
        },
        mcid: -1,
        spaceBefore: true,
        hardBreak: false,
    };
}

describe('neutral colon between an LTR value and an RTL label', () => {
    it('breaks the colon off the LTR value so the RTL label absorbs it', () => {
        const items = [
            makeItem({ text: '19011466', x: 464, endX: 512 }),
            makeItem({ text: ':', x: 515, endX: 519 }),
            makeItem({ text: 'מספר חשבונית', x: 519, endX: 582 }),
        ];
        const words = buildWords(items, ctx);
        const texts = words.map(w => w.text);
        expect(texts).toContain('19011466');
        expect(texts.some(t => t.includes('מספר חשבונית') && t.includes(':'))).toBe(true);
        expect(texts.some(t => t.includes('19011466') && t.includes(':'))).toBe(false);
    });

    it('keeps a colon glued to an LTR value when LTR text follows', () => {
        const items = [
            makeItem({ text: 'Total', x: 100, endX: 130 }),
            makeItem({ text: ':', x: 131, endX: 134 }),
            makeItem({ text: '42', x: 137, endX: 148 }),
        ];
        const words = buildWords(items, ctx);
        expect(words.map(w => w.text).join(' ')).toContain('Total:');
    });
});

describe('bare RTL label binds its column-aligned value', () => {
    it('moves an LTR value from the neighbouring segment onto its value-less label', () => {
        const items = [
            makeItem({ text: 'ז', x: 65, endX: 69 }),
            makeItem({ text: ':', x: 80, endX: 82 }),
            makeItem({ text: 'מין', x: 82, endX: 93 }),
            makeItem({ text: '31.00', x: 100, endX: 120 }),
            makeItem({ text: ':', x: 142, endX: 144 }),
            makeItem({ text: 'גיל', x: 144, endX: 155 }),
        ];
        const clusters = clusterIntoLineItems(items);
        const lines = linesFromClusters(clusters, 0, ctx);
        const texts = lines.map(l => l.words.map(w => w.text).join(' '));
        expect(texts.some(t => t.includes('גיל') && t.includes('31.00'))).toBe(true);
        expect(texts.some(t => t.includes('מין') && t.includes('31.00'))).toBe(false);
    });

    it('leaves a labelled value pair alone when the label already has its value', () => {
        const items = [
            makeItem({ text: '00313475139', x: 184, endX: 244 }),
            makeItem({ text: ':', x: 256, endX: 258 }),
            makeItem({ text: 'זהות', x: 258, endX: 276 }),
            makeItem({ text: 'מס', x: 279, endX: 290 }),
        ];
        const clusters = clusterIntoLineItems(items);
        const lines = linesFromClusters(clusters, 0, ctx);
        expect(lines).toHaveLength(1);
        const text = lines[0].words.map(w => w.text).join(' ');
        expect(text).toContain('מס זהות');
        expect(text).toContain('00313475139');
    });
});
