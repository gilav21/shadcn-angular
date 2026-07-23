import { describe, expect, it } from 'vitest';
import type { PathRect } from '../pdf-parser';
import { applyUnderlines, buildPageBlocks, xyCut } from './readable-blocks';
import type { ClassifyContext } from './readable-classify';
import { lineOf } from './readable-spec-helpers';
import type { Line, PageExtract } from './readable-types';

const ctx: Omit<ClassifyContext, 'pageBounds'> = {
    bodyFontSize: 12,
    bodyLeading: 14.4,
    structure: { mcidToType: new Map(), hasStructure: false },
};

function pageExtractOf(lines: readonly Line[], overrides?: Partial<PageExtract>): PageExtract {
    return {
        index: 0,
        width: 612,
        height: 792,
        items: [],
        images: [],
        rects: [],
        annotations: [],
        ...overrides,
    };
}

function rectOf(x: number, y: number, width: number, height: number): PathRect {
    return {
        x, y, width, height,
        page: 0,
        stroked: true,
        filled: false,
        strokeColor: '#000000',
        fillColor: '#000000',
        lineWidth: 1,
    };
}

describe('xyCut', () => {
    it('keeps a single flowing region intact', () => {
        const lines = [
            lineOf('one', 50, 550, 700),
            lineOf('two', 50, 550, 686),
            lineOf('three', 50, 550, 672),
        ];
        expect(xyCut(lines, 0)).toHaveLength(1);
    });

    it('splits two side-by-side columns and orders them left to right', () => {
        const left = [
            lineOf('L1', 50, 280, 700),
            lineOf('L2', 50, 280, 686),
            lineOf('L3', 50, 280, 672),
        ];
        const right = [
            lineOf('R1', 320, 550, 700),
            lineOf('R2', 320, 550, 686),
            lineOf('R3', 320, 550, 672),
        ];
        const regions = xyCut([...left, ...right], 0);
        expect(regions).toHaveLength(2);
        expect(regions[0][0].words[0].text).toBe('L1');
        expect(regions[1][0].words[0].text).toBe('R1');
    });

    it('orders RTL columns right to left', () => {
        const left = [
            lineOf('שמאל א', 50, 280, 700, { dir: 'rtl' }),
            lineOf('שמאל ב', 50, 280, 686, { dir: 'rtl' }),
        ];
        const right = [
            lineOf('ימין א', 320, 550, 700, { dir: 'rtl' }),
            lineOf('ימין ב', 320, 550, 686, { dir: 'rtl' }),
        ];
        const regions = xyCut([...left, ...right], 0);
        expect(regions).toHaveLength(2);
        expect(regions[0][0].words[0].text).toBe('ימין א');
    });

    it('splits vertically separated bands before column analysis', () => {
        const title = [lineOf('Full Width Title Spanning Everything', 50, 550, 750)];
        const body = [
            lineOf('L1', 50, 280, 650),
            lineOf('L2', 50, 280, 636),
            lineOf('R1', 320, 550, 650),
            lineOf('R2', 320, 550, 636),
        ];
        const regions = xyCut([...title, ...body], 0);
        expect(regions.length).toBeGreaterThanOrEqual(3);
        expect(regions[0][0].words[0].text).toContain('Full Width Title');
    });

    it('does not split three columns short of the minimum lines', () => {
        const lines = [
            lineOf('a', 50, 100, 700),
            lineOf('b', 300, 350, 700),
        ];
        expect(xyCut(lines, 0)).toHaveLength(1);
    });
});

describe('applyUnderlines', () => {
    it('flags words above a thin rect as underlined', () => {
        const line = lineOf('underlined text', 50, 150, 700);
        const rect = rectOf(48, 697.5, 105, 1);
        const used = applyUnderlines([line], [rect]);
        expect(line.words[0].style.underline).toBe(true);
        expect(used.has(rect)).toBe(true);
    });

    it('ignores rects far below the baseline', () => {
        const line = lineOf('plain text', 50, 150, 700);
        const rect = rectOf(48, 650, 105, 1);
        applyUnderlines([line], [rect]);
        expect(line.words[0].style.underline).toBe(false);
    });
});

describe('buildPageBlocks', () => {
    it('emits a wide thin rect as a horizontal rule between blocks', () => {
        const lines = [
            lineOf('Above the rule content', 50, 550, 700),
            lineOf('Below the rule content', 50, 550, 600),
        ];
        const page = pageExtractOf(lines, { rects: [rectOf(50, 655, 500, 1)] });
        const blocks = buildPageBlocks([...lines], page, true, ctx);
        const kinds = blocks.map(b => b.kind);
        expect(kinds).toEqual(['paragraph', 'rule', 'paragraph']);
    });

    it('floats an image sitting beside a multi-line paragraph', () => {
        const lines = [
            lineOf('Wrapping text beside image line one', 200, 550, 700),
            lineOf('wrapping text beside image line two', 200, 550, 686),
            lineOf('wrapping text beside image line three', 200, 550, 672),
        ];
        const image = {
            dataUrl: 'data:image/png;base64,x',
            width: 100, height: 100,
            renderWidth: 120, renderHeight: 40,
            x: 50, y: 660, page: 0,
        };
        const page = pageExtractOf(lines, { images: [image] });
        const blocks = buildPageBlocks([...lines], page, true, ctx);
        const imageBlock = blocks.find(b => b.kind === 'image');
        expect(imageBlock).toBeDefined();
        if (imageBlock?.kind === 'image') expect(imageBlock.float).toBe('left');
    });
});
