import { describe, expect, it } from 'vitest';
import type { ImageItem, PathRect } from '../pdf-parser';
import { applyUnderlines, buildPageBlocks, xyCut } from './readable-blocks';
import type { ClassifyContext } from './readable-classify';
import { blockLines } from './readable-emit';
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

describe('xyCut — spanner-tolerant columns', () => {
    it('splits columns under a full-width title instead of collapsing them', () => {
        const title = lineOf('Full Width Title Spanning The Whole Region Here', 50, 550, 700);
        const left = [
            lineOf('L1', 50, 280, 686),
            lineOf('L2', 50, 280, 672),
            lineOf('L3', 50, 280, 658),
        ];
        const right = [
            lineOf('R1', 320, 550, 686),
            lineOf('R2', 320, 550, 672),
            lineOf('R3', 320, 550, 658),
        ];
        const regions = xyCut([title, ...left, ...right], 4 - 1);
        expect(regions.length).toBeGreaterThanOrEqual(3);
        expect(regions[0][0].words[0].text).toContain('Full Width Title');
        const l1Region = regions.findIndex(r => r.some(l => l.words[0].text === 'L1'));
        const r1Region = regions.findIndex(r => r.some(l => l.words[0].text === 'R1'));
        expect(l1Region).toBeGreaterThan(-1);
        expect(r1Region).toBeGreaterThan(-1);
        expect(l1Region).not.toBe(r1Region);
    });

    it('keeps a chunk whole when a line crosses the valley', () => {
        const lines = [
            lineOf('Wide Title Spanning All Of The Columns Below', 50, 550, 700),
            lineOf('a', 50, 280, 686), lineOf('b', 320, 550, 686),
            lineOf('crosses the gutter here', 200, 400, 672),
            lineOf('c', 50, 280, 658), lineOf('d', 320, 550, 658),
        ];
        const regions = xyCut(lines, 4 - 1);
        const flat = regions.flat();
        expect(flat).toHaveLength(lines.length);
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

    it('gives a table cell the saturated fill it sits on (highlighted total)', () => {
        const lines: Line[] = [];
        for (const y of [700, 680, 660]) {
            lines.push(lineOf('Item', 50, 100, y), lineOf('Qty', 250, 290, y), lineOf('Total', 450, 500, y));
        }
        const fill: PathRect = {
            x: 440, y: 653, width: 90, height: 22,
            page: 0, stroked: false, filled: true,
            strokeColor: '#000000', fillColor: '#3b82f6', lineWidth: 0,
        };
        const page = pageExtractOf(lines, { rects: [fill] });
        const blocks = buildPageBlocks([...lines], page, false, ctx);
        const table = blocks.find(b => b.kind === 'table');
        expect(table?.kind).toBe('table');
        if (table?.kind === 'table') {
            const highlighted = table.rows.flat().filter(c => c.background === '#3b82f6');
            expect(highlighted).toHaveLength(1);
            expect(highlighted[0].lines[0].words[0].text).toBe('Total');
        }
    });

    it('does not emit a table row separator as a document rule', () => {
        const lines: Line[] = [];
        for (const y of [700, 680, 660, 640]) {
            lines.push(lineOf('Item', 50, 120, y), lineOf('Qty', 250, 300, y), lineOf('Total', 430, 500, y));
        }
        const rowSeparator: PathRect = {
            x: 50, y: 670, width: 300, height: 0.75,
            page: 0, stroked: true, filled: false,
            strokeColor: '#999999', fillColor: '#ffffff', lineWidth: 0.75,
        };
        const page = pageExtractOf(lines, { rects: [rowSeparator] });
        const blocks = buildPageBlocks([...lines], page, false, ctx);
        expect(blocks.some(b => b.kind === 'table')).toBe(true);
        expect(blocks.some(b => b.kind === 'rule')).toBe(false);
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

describe('buildPageBlocks — subheadings interleaved in a bullet list', () => {
    const bullet = (text: string, y: number) => lineOf(text, 50, 520, y, { fontSize: 10 });
    const title = (text: string, y: number) => lineOf(text, 50, 400, y, { fontSize: 11 });

    it('keeps a subheading before the first bullet and between bullet groups out of the list', () => {
        const lines = [
            title('Job Alpha Position', 700),
            bullet('• first responsibility here', 686),
            bullet('• second responsibility here', 672),
            title('Job Beta Position', 658),
            bullet('• third responsibility here', 644),
            bullet('• fourth responsibility here', 630),
        ];
        const blocks = buildPageBlocks([...lines], pageExtractOf(lines), false, ctx);
        const kinds = blocks.map(b => b.kind);
        expect(kinds.filter(k => k === 'list')).toHaveLength(2);
        expect(kinds.filter(k => k !== 'list')).toHaveLength(2);
        const flat = blocks.flatMap(b => blockLines(b)).flatMap(l => l.words.map(w => w.text)).join(' ');
        expect(flat).toContain('Job Alpha Position');
        expect(flat).toContain('Job Beta Position');
        const listLineText = blocks
            .filter(b => b.kind === 'list')
            .flatMap(list => list.kind === 'list' ? list.items : [])
            .flatMap(item => item.lines)
            .flatMap(line => line.words.map(w => w.text))
            .join(' ');
        expect(listLineText).not.toContain('Position');
    });

    it('keeps a same-font wrapped continuation attached to its bullet', () => {
        const lines = [
            bullet('• a responsibility that wraps onto', 700),
            bullet('the following continuation line here', 686),
            bullet('• another standalone responsibility', 672),
        ];
        const blocks = buildPageBlocks([...lines], pageExtractOf(lines), false, ctx);
        const list = blocks.find(b => b.kind === 'list');
        expect(list?.kind).toBe('list');
        if (list?.kind === 'list') {
            expect(list.items).toHaveLength(2);
            expect(list.items[0].lines).toHaveLength(2);
        }
    });
});

describe('buildPageBlocks — side-by-side columns', () => {
    function twoColumns(rowCount: number): Line[] {
        const lines: Line[] = [];
        let y = 700;
        for (let i = 0; i < rowCount; i++) {
            lines.push(lineOf(`left row ${i}`, 50, 200, y), lineOf(`right row ${i}`, 350, 500, y));
            y -= 16;
        }
        return lines;
    }

    it('wraps two multi-row columns in a columns block', () => {
        const lines = twoColumns(4);
        const blocks = buildPageBlocks([...lines], pageExtractOf(lines), false, ctx);
        const columns = blocks.find(b => b.kind === 'columns');
        expect(columns).toBeDefined();
        if (columns?.kind === 'columns') {
            expect(columns.columns).toHaveLength(2);
            const total = columns.columns.reduce((s, c) => s + c.widthRatio, 0);
            expect(total).toBeCloseTo(1, 5);
        }
    });

    it('column-zones a prose region when a single-column body floods the gutter', () => {
        const lines: Line[] = [];
        let y = 700;
        for (let i = 0; i < 4; i++) {
            lines.push(
                lineOf(`left prose row ${i} flowing text`, 50, 260, y),
                lineOf(`right prose row ${i} flowing text`, 310, 510, y),
            );
            y -= 16;
        }
        for (let i = 0; i < 3; i++) {
            lines.push(lineOf(`body line ${i} crossing the gutter`, 150, 400, y));
            y -= 16;
        }
        const blocks = buildPageBlocks([...lines], pageExtractOf(lines), false, ctx);
        expect(blocks.some(b => b.kind === 'columns')).toBe(true);
        const bodyBlock = blocks.find(b =>
            b.kind !== 'columns' && blockLines(b).some(l => l.words[0].text.startsWith('body')));
        expect(bodyBlock).toBeDefined();
    });

    it('does not column-wrap a single shared baseline (label/value line)', () => {
        const lines = [
            lineOf('Total', 50, 120, 700),
            lineOf('42', 400, 430, 700),
        ];
        const blocks = buildPageBlocks([...lines], pageExtractOf(lines), false, ctx);
        expect(blocks.some(b => b.kind === 'columns')).toBe(false);
    });
});

describe('button box reconstruction', () => {
    function outlineOf(
        x: number, y: number, w: number, h: number,
        overrides?: Partial<ImageItem>,
    ): ImageItem {
        return {
            dataUrl: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
            width: w, height: h, renderWidth: w, renderHeight: h,
            x, y, page: 0,
            svgStrokeColor: '#707070', svgStrokeWidth: 1,
            ...overrides,
        };
    }

    it('gives a short label inside a stroked outline a border and drops the box', () => {
        const label = lineOf('Print', 40, 92, 503, { fontSize: 17 });
        const outline = outlineOf(29, 509, 77, 36);
        const blocks = buildPageBlocks([label], pageExtractOf([label], { images: [outline] }), true, ctx);
        expect(blocks.some(b => b.kind === 'image')).toBe(false);
        const boxed = blocks.find(b => (b.kind === 'paragraph' || b.kind === 'heading') && b.style.border !== '');
        expect(boxed).toBeDefined();
        expect(boxed?.style.border).toBe('1.0pt solid #707070');
    });

    it('also drops the white fill twin painted behind the outline', () => {
        const label = lineOf('OK', 40, 70, 503, { fontSize: 17 });
        const fill = outlineOf(29, 509, 77, 36, { svgStrokeColor: '', svgStrokeWidth: 0 });
        const stroke = outlineOf(29, 509, 77, 36);
        const blocks = buildPageBlocks([label], pageExtractOf([label], { images: [fill, stroke] }), true, ctx);
        expect(blocks.some(b => b.kind === 'image')).toBe(false);
    });

    it('leaves a large framed panel alone (outline too big for a button)', () => {
        const label = lineOf('Section title inside a page frame', 60, 400, 700, { fontSize: 12 });
        const frame = outlineOf(40, 400, 500, 300);
        const blocks = buildPageBlocks([label], pageExtractOf([label], { images: [frame] }), true, ctx);
        expect(blocks.some(b => b.kind === 'image')).toBe(true);
        const boxed = blocks.find(b => (b.kind === 'paragraph' || b.kind === 'heading') && b.style.border !== '');
        expect(boxed).toBeUndefined();
    });

    it('leaves an outline enclosing several labels alone (ambiguous)', () => {
        const a = lineOf('One', 40, 70, 512, { fontSize: 12 });
        const b = lineOf('Two', 40, 70, 500, { fontSize: 12 });
        const outline = outlineOf(29, 506, 77, 36);
        const blocks = buildPageBlocks([a, b], pageExtractOf([a, b], { images: [outline] }), true, ctx);
        expect(blocks.some(b2 => b2.kind === 'image')).toBe(true);
    });
});
