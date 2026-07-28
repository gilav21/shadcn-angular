import { describe, expect, it } from 'vitest';
import type { TextItem } from '../pdf-parser';
import { embeddedRunWidth, type GlyphAdvanceSource } from './readable-extract';

function makeItem(overrides: Partial<TextItem>): TextItem {
    return {
        text: 'ab', fontSize: 20, x: 0, y: 700, endX: 30, page: 0,
        color: '#000000', bold: false, italic: false,
        fontFamily: 'Helvetica', fontName: 'F1', mcid: -1,
        charSpacing: 0, wordSpacing: 0, textRise: 0, horizontalScaling: 100,
        textRenderMode: 0, strokeColor: '#000000', transformMatrix: [1, 0, 0, 1],
        isSpaceOffset: false, ...overrides,
    };
}

/** Registry stub returning a fixed advance (in thousandths of an em) per code point. */
function source(advances: Record<string, number | null>): GlyphAdvanceSource {
    return {
        getGlyphAdvance: (_font, code, unicode) => {
            const key = code === 32 ? ' ' : unicode ?? '';
            return key in advances ? advances[key] : 500;
        },
    };
}

describe('embeddedRunWidth', () => {
    it('sums embedded advances into a run width in points', () => {
        // (250 + 250)/1000 * 20pt = 10pt — half the overestimated /Widths endX.
        const width = embeddedRunWidth(makeItem({ text: 'ab' }), source({ a: 250, b: 250 }));
        expect(width).toBeCloseTo(10, 5);
    });

    it('counts the space glyph via its code, not the fallback', () => {
        const width = embeddedRunWidth(makeItem({ text: 'a b' }), source({ a: 250, b: 250, ' ': 200 }));
        expect(width).toBeCloseTo((250 + 200 + 250) / 1000 * 20, 5);
    });

    it('adds character and word spacing on top of the glyph advances', () => {
        const width = embeddedRunWidth(
            makeItem({ text: 'ab', charSpacing: 1 }), source({ a: 250, b: 250 }));
        expect(width).toBeCloseTo(10 + 2, 5);
    });

    it('applies horizontal scaling', () => {
        const width = embeddedRunWidth(
            makeItem({ text: 'ab', horizontalScaling: 50 }), source({ a: 250, b: 250 }));
        expect(width).toBeCloseTo(5, 5);
    });

    it('returns null when any glyph is unknown to the registry', () => {
        const width = embeddedRunWidth(makeItem({ text: 'ab' }), source({ a: 250, b: null }));
        expect(width).toBeNull();
    });
});
