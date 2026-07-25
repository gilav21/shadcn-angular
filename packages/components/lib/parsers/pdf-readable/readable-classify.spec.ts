import { describe, expect, it } from 'vitest';
import { assignHeadingLevels, classifyGroup, type ClassifyContext } from './readable-classify';
import { lineOf } from './readable-spec-helpers';
import type { HeadingBlock, PageModel } from './readable-types';

const bounds = { x0: 50, x1: 550 };
const ctx: ClassifyContext = {
    bodyFontSize: 12,
    bodyLeading: 14.4,
    structure: { mcidToType: new Map(), hasStructure: false },
    pageBounds: bounds,
};

describe('classifyGroup — headings', () => {
    it('classifies a much larger line as an h1', () => {
        const result = classifyGroup(
            [lineOf('Document Title', 50, 300, 700, { fontSize: 22 })], bounds, null, ctx);
        expect(result).toEqual({ kind: 'heading', level: 1 });
    });

    it('classifies a bold same-size short line with spacing above as a heading', () => {
        const result = classifyGroup(
            [lineOf('Section overview', 50, 250, 600, { style: { bold: true } })],
            bounds, 40, ctx);
        expect(result.kind).toBe('heading');
    });

    it('does not classify ordinary body lines as headings', () => {
        const result = classifyGroup(
            [
                lineOf('A perfectly ordinary sentence that spans most of the column width here.', 50, 540, 700),
                lineOf('And a second line to make it a paragraph.', 50, 400, 686),
                lineOf('And a third line to finish it off properly.', 50, 420, 672),
            ],
            bounds, 14, ctx);
        expect(result.kind).toBe('paragraph');
    });

    it('penalizes sentence-like lines ending with a period', () => {
        const result = classifyGroup(
            [lineOf('This is just a short sentence.', 50, 250, 700)], bounds, null, ctx);
        expect(result.kind).toBe('paragraph');
    });

    it('honors structure-tree heading tags over heuristics', () => {
        const structured: ClassifyContext = {
            ...ctx,
            structure: { mcidToType: new Map([['0:5', 'H2']]), hasStructure: true },
        };
        const line = lineOf('Tagged heading', 50, 300, 700);
        line.words[0] = { ...line.words[0], mcid: 5 };
        const result = classifyGroup([line], bounds, null, structured);
        expect(result).toEqual({ kind: 'heading', level: 2 });
    });
});

describe('classifyGroup — lists', () => {
    it('detects bulleted lists and strips the marker', () => {
        const result = classifyGroup(
            [
                lineOf('• First item text', 60, 300, 700),
                lineOf('• Second item text', 60, 310, 686),
            ],
            bounds, null, ctx);
        expect(result.kind).toBe('list');
        if (result.kind === 'list') {
            expect(result.ordered).toBe(false);
            expect(result.items).toHaveLength(2);
            expect(result.items[0].lines[0].words[0].text).toBe('First item text');
        }
    });

    it('detects numbered lists as ordered', () => {
        const result = classifyGroup(
            [
                lineOf('1. Do the first thing', 60, 300, 700),
                lineOf('2. Do the second thing', 60, 310, 686),
            ],
            bounds, null, ctx);
        expect(result.kind).toBe('list');
        if (result.kind === 'list') expect(result.ordered).toBe(true);
    });

    it('attaches continuation lines to the previous list item', () => {
        const result = classifyGroup(
            [
                lineOf('• First item text that wraps', 60, 300, 700),
                lineOf('onto a second line', 75, 200, 686),
                lineOf('• Second item', 60, 200, 672),
            ],
            bounds, null, ctx);
        expect(result.kind).toBe('list');
        if (result.kind === 'list') {
            expect(result.items).toHaveLength(2);
            expect(result.items[0].lines).toHaveLength(2);
        }
    });

    it('assigns nesting levels from marker indentation', () => {
        const result = classifyGroup(
            [
                lineOf('• Top level', 60, 200, 700),
                lineOf('• Nested item', 90, 220, 686),
            ],
            bounds, null, ctx);
        expect(result.kind).toBe('list');
        if (result.kind === 'list') {
            expect(result.items[0].level).toBe(0);
            expect(result.items[1].level).toBe(1);
        }
    });
});

describe('classifyGroup — list false positives', () => {
    it('does not turn a single numbered heading-like line into a one-item list', () => {
        const result = classifyGroup(
            [lineOf('2. Methods', 50, 150, 700, { fontSize: 16, style: { bold: true } })],
            bounds, 40, ctx);
        expect(result.kind).toBe('heading');
    });

    it('does not turn a lone sentence starting with a letter marker into a list', () => {
        const result = classifyGroup(
            [lineOf('A) reasonable body sentence continues here', 50, 400, 700)],
            bounds, null, ctx);
        expect(result.kind).toBe('paragraph');
    });
});

describe('assignHeadingLevels', () => {
    it('re-ranks heading levels by size signature document-wide', () => {
        const h1: HeadingBlock = {
            kind: 'heading', level: 2,
            lines: [lineOf('Big', 50, 200, 700, { fontSize: 20 })],
            page: 0, style: { align: '', indentStart: 0, textIndent: 0, lineHeight: 0, marginTop: 0, dir: '', background: '', border: '' },
        };
        const h2: HeadingBlock = {
            kind: 'heading', level: 3,
            lines: [lineOf('Small', 50, 200, 600, { fontSize: 15 })],
            page: 0, style: { align: '', indentStart: 0, textIndent: 0, lineHeight: 0, marginTop: 0, dir: '', background: '', border: '' },
        };
        const pages: PageModel[] = [{ index: 0, width: 612, height: 792, blocks: [h1, h2] }];
        assignHeadingLevels(pages, false);
        expect(h1.level).toBe(1);
        expect(h2.level).toBe(2);
    });

    it('ranks bold above regular at the same size', () => {
        const bold: HeadingBlock = {
            kind: 'heading', level: 4,
            lines: [lineOf('Bold', 50, 200, 700, { fontSize: 14, style: { bold: true } })],
            page: 0, style: { align: '', indentStart: 0, textIndent: 0, lineHeight: 0, marginTop: 0, dir: '', background: '', border: '' },
        };
        const regular: HeadingBlock = {
            kind: 'heading', level: 4,
            lines: [lineOf('Regular', 50, 200, 600, { fontSize: 14 })],
            page: 0, style: { align: '', indentStart: 0, textIndent: 0, lineHeight: 0, marginTop: 0, dir: '', background: '', border: '' },
        };
        const pages: PageModel[] = [{ index: 0, width: 612, height: 792, blocks: [bold, regular] }];
        assignHeadingLevels(pages, false);
        expect(bold.level).toBe(1);
        expect(regular.level).toBe(2);
    });

    it('leaves structure-tagged documents untouched', () => {
        const tagged: HeadingBlock = {
            kind: 'heading', level: 3,
            lines: [lineOf('Tagged', 50, 200, 700, { fontSize: 20 })],
            page: 0, style: { align: '', indentStart: 0, textIndent: 0, lineHeight: 0, marginTop: 0, dir: '', background: '', border: '' },
        };
        assignHeadingLevels([{ index: 0, width: 612, height: 792, blocks: [tagged] }], true);
        expect(tagged.level).toBe(3);
    });
});

describe('classifyGroup — blockquote', () => {
    it('classifies a deep both-side indent as blockquote', () => {
        const result = classifyGroup(
            [
                lineOf('An inset quotation line one,', 120, 470, 700),
                lineOf('and its second line here.', 120, 450, 686),
            ],
            bounds, null, ctx);
        expect(result.kind).toBe('blockquote');
    });

    it('does not classify a single centered line as blockquote', () => {
        const result = classifyGroup(
            [lineOf('centered subtitle here included', 200, 400, 700)], bounds, null, ctx);
        expect(result.kind).not.toBe('blockquote');
    });
});
