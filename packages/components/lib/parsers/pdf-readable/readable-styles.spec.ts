import { describe, expect, it } from 'vitest';
import {
    computeLineHeight,
    computeTextIndent,
    detectAlignment,
    resolveBlockStyle,
} from './readable-styles';
import type { Line, TextDirection } from './readable-types';

function makeLine(x: number, endX: number, y: number, overrides?: Partial<Line>): Line {
    return {
        words: [],
        x,
        endX,
        y,
        fontSize: 12,
        dir: 'ltr',
        page: 0,
        ...overrides,
    };
}

const bounds = { x0: 50, x1: 550 };

describe('detectAlignment', () => {
    it('returns natural alignment for a left-anchored ragged-right block', () => {
        const lines = [
            makeLine(50, 540, 700),
            makeLine(50, 480, 686),
            makeLine(50, 510, 672),
        ];
        expect(detectAlignment(lines, bounds, 'ltr')).toBe('');
    });

    it('detects justify when both edges are tight over three or more lines', () => {
        const lines = [
            makeLine(50, 550, 700),
            makeLine(50.5, 549.5, 686),
            makeLine(50, 550, 672),
        ];
        expect(detectAlignment(lines, bounds, 'ltr')).toBe('justify');
    });

    it('detects centered blocks from mirrored margins', () => {
        const lines = [
            makeLine(200, 400, 700),
            makeLine(150, 450, 686),
        ];
        expect(detectAlignment(lines, bounds, 'ltr')).toBe('center');
    });

    it('detects a right-aligned block in LTR text', () => {
        const lines = [
            makeLine(300, 549, 700),
            makeLine(360, 550, 686),
        ];
        expect(detectAlignment(lines, bounds, 'ltr')).toBe('right');
    });

    it('treats a tight right edge as natural for RTL blocks', () => {
        const lines: Line[] = [
            makeLine(120, 550, 700, { dir: 'rtl' as TextDirection }),
            makeLine(200, 549.5, 686, { dir: 'rtl' as TextDirection }),
        ];
        expect(detectAlignment(lines, bounds, 'rtl')).toBe('');
    });

    it('centers a lone short line sitting mid-column', () => {
        expect(detectAlignment([makeLine(250, 350, 700)], bounds, 'ltr')).toBe('center');
    });

    it('does not force justify on two-line paragraphs', () => {
        const lines = [
            makeLine(50, 550, 700),
            makeLine(50, 550, 686),
        ];
        expect(detectAlignment(lines, bounds, 'ltr')).not.toBe('justify');
    });
});

describe('computeTextIndent', () => {
    it('measures a first-line indent against following lines', () => {
        const lines = [
            makeLine(70, 540, 700),
            makeLine(50, 545, 686),
            makeLine(50, 500, 672),
        ];
        expect(computeTextIndent(lines, 'ltr')).toBe(20);
    });

    it('returns 0 for aligned first lines', () => {
        const lines = [
            makeLine(50, 540, 700),
            makeLine(50, 545, 686),
        ];
        expect(computeTextIndent(lines, 'ltr')).toBe(0);
    });

    it('measures RTL indent from the right edge', () => {
        const lines: Line[] = [
            makeLine(60, 530, 700, { dir: 'rtl' as TextDirection }),
            makeLine(50, 550, 686, { dir: 'rtl' as TextDirection }),
        ];
        expect(computeTextIndent(lines, 'rtl')).toBe(20);
    });
});

describe('computeLineHeight', () => {
    it('derives the ratio from baseline gaps and font size', () => {
        const lines = [
            makeLine(50, 500, 700),
            makeLine(50, 500, 682),
            makeLine(50, 500, 664),
        ];
        expect(computeLineHeight(lines)).toBe(1.5);
    });

    it('returns 0 for single-line blocks', () => {
        expect(computeLineHeight([makeLine(50, 500, 700)])).toBe(0);
    });
});

describe('resolveBlockStyle', () => {
    it('computes margin-top from the gap to the previous block', () => {
        const lines = [
            makeLine(50, 500, 660),
            makeLine(50, 500, 646),
        ];
        const style = resolveBlockStyle(lines, bounds, 700);
        expect(style.marginTop).toBeGreaterThan(0);
        expect(style.marginTop).toBeLessThanOrEqual(24);
    });

    it('reports rtl direction when most lines are RTL', () => {
        const lines: Line[] = [
            makeLine(50, 500, 700, { dir: 'rtl' as TextDirection }),
            makeLine(50, 500, 686, { dir: 'rtl' as TextDirection }),
        ];
        expect(resolveBlockStyle(lines, bounds, null).dir).toBe('rtl');
    });
});
