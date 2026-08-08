import { describe, expect, it } from 'vitest';
import type { ImageItem, PathRect } from '../pdf-parser';
import {
    applySlotUnderlines,
    applyUnderlines,
    asJustifiedRow,
    asQuadrantRow,
    buildPageBlocks,
    extractKeyValueRun,
    extractLeadingQuadrant,
    splitFieldRows,
    splitJustifiedRows,
    xyCut,
} from './readable-blocks';
import type { ClassifyContext } from './readable-classify';
import { blockLines } from './readable-emit';
import { lineOf, wordAt } from './readable-spec-helpers';
import type { DocBlock, Line, PageExtract } from './readable-types';

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

describe('applySlotUnderlines', () => {
    const slot = (color: string, width = 200): PathRect => ({
        x: 350, y: 520, width, height: 0.8,
        page: 0, stroked: true, filled: false,
        strokeColor: color, fillColor: color, lineWidth: 0.8,
    });
    const value = (): Line => lineOf('Signature Value', 400, 500, 530);
    const label = (): Line => lineOf('Field label', 410, 490, 506);

    it('underlines a saturated slot value sandwiched by a label below', () => {
        const v = value();
        const used = new Set<PathRect>();
        applySlotUnderlines([v, label()], [slot('#00008b')], used, 612);
        expect(v.words[0].style.underline).toBe(true);
        expect(used.size).toBe(1);
    });

    it('ignores a grey/black line (a gridline or answer blank, not a slot)', () => {
        const v = value();
        applySlotUnderlines([v, label()], [slot('#999999')], new Set(), 612);
        expect(v.words[0].style.underline).toBe(false);
    });

    it('ignores a slot with no label below (a bare answer blank)', () => {
        const v = value();
        applySlotUnderlines([v], [slot('#00008b')], new Set(), 612);
        expect(v.words[0].style.underline).toBe(false);
    });

    it('ignores a rule wider than half the page (a separator, not a slot)', () => {
        const v = value();
        applySlotUnderlines([v, label()], [slot('#00008b', 400)], new Set(), 612);
        expect(v.words[0].style.underline).toBe(false);
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

    it('emits a full-page rule crossing a table band as a document separator', () => {
        const lines: Line[] = [];
        for (const y of [700, 680, 660, 640]) {
            lines.push(lineOf('Item', 120, 200, y), lineOf('Qty', 250, 300, y), lineOf('Total', 430, 500, y));
        }
        const headerRule: PathRect = {
            x: 20, y: 670, width: 570, height: 0.8,
            page: 0, stroked: true, filled: false,
            strokeColor: '#00008b', fillColor: '#000000', lineWidth: 0.8,
        };
        const page = pageExtractOf(lines, { rects: [headerRule] });
        const blocks = buildPageBlocks([...lines], page, false, ctx);
        expect(blocks.some(b => b.kind === 'table')).toBe(true);
        expect(blocks.some(b => b.kind === 'rule')).toBe(true);
    });

    it('wraps blocks enclosed by a drawn rectangle in a bordered box', () => {
        const lines = [
            lineOf('Patient details panel heading', 60, 300, 690),
            lineOf('Name value plus more details here', 60, 340, 664),
        ];
        const edge = (x: number, y: number, width: number, height: number): PathRect => ({
            x, y, width, height,
            page: 0, stroked: true, filled: false,
            strokeColor: '#00008b', fillColor: '#000000', lineWidth: 0.8,
        });
        const top = edge(40, 700, 400, 0.8);
        const bottom = edge(40, 640, 400, 0.8);
        const leftEdge = edge(40, 640, 0.8, 60);
        const page = pageExtractOf(lines, { rects: [top, bottom, leftEdge] });
        const blocks = buildPageBlocks([...lines], page, false, ctx);
        const box = blocks.find(b => b.kind === 'columns');
        expect(box?.kind).toBe('columns');
        if (box?.kind === 'columns') expect(box.style.border).toContain('#00008b');
        expect(blocks.some(b => b.kind === 'rule')).toBe(false);
    });

    it('does not box a table grid (a family of same-span lines)', () => {
        const lines: Line[] = [];
        for (const y of [700, 680, 660, 640]) {
            lines.push(lineOf('Item', 50, 120, y), lineOf('Qty', 250, 300, y), lineOf('Total', 430, 500, y));
        }
        const gridLines = [712, 690, 670, 650, 628].map(y => rectOf(40, y, 470, 0.8));
        const leftEdge: PathRect = {
            x: 40, y: 628, width: 0.8, height: 84,
            page: 0, stroked: true, filled: false,
            strokeColor: '#000000', fillColor: '#000000', lineWidth: 0.8,
        };
        const page = pageExtractOf(lines, { rects: [...gridLines, leftEdge] });
        const blocks = buildPageBlocks([...lines], page, false, ctx);
        expect(blocks.some(b => b.kind === 'columns' && b.style.border !== '')).toBe(false);
    });

    it('anchors a left-side standalone image to the left on an RTL page', () => {
        const lines = [
            lineOf('שלום עולם זהו טקסט עברית', 300, 560, 700, { dir: 'rtl' }),
            lineOf('עוד שורה של טקסט עברית כאן', 300, 560, 686, { dir: 'rtl' }),
        ];
        const logo = {
            dataUrl: 'data:image/png;base64,x',
            width: 100, height: 40, renderWidth: 100, renderHeight: 40,
            x: 20, y: 730, page: 0,
        };
        const page = pageExtractOf(lines, { images: [logo] });
        const blocks = buildPageBlocks([...lines], page, true, ctx);
        const imageBlock = blocks.find(b => b.kind === 'image');
        expect(imageBlock?.kind).toBe('image');
        if (imageBlock?.kind === 'image') {
            expect(imageBlock.float).toBe('');
            expect(imageBlock.style.align).toBe('left');
        }
    });

    it('leaves a standalone image unanchored on an LTR page', () => {
        const lines = [
            lineOf('This is a line of ordinary English body text here', 50, 550, 700),
            lineOf('and a second line of ordinary English body text', 50, 550, 686),
        ];
        const logo = {
            dataUrl: 'data:image/png;base64,x',
            width: 100, height: 40, renderWidth: 100, renderHeight: 40,
            x: 20, y: 730, page: 0,
        };
        const page = pageExtractOf(lines, { images: [logo] });
        const blocks = buildPageBlocks([...lines], page, true, ctx);
        const imageBlock = blocks.find(b => b.kind === 'image');
        if (imageBlock?.kind === 'image') expect(imageBlock.style.align).toBe('');
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

    it('column-wraps two prose columns sitting under a full-width heading', () => {
        // A spanning heading vetoes the plain column valley, so only the
        // spanner-tolerant split finds the two columns.
        const heading = lineOf('The Quiet Art of Urban Beekeeping Spans It All', 50, 550, 716);
        const lines: Line[] = [heading];
        let y = 700;
        for (let i = 0; i < 5; i++) {
            lines.push(
                lineOf(`left prose row ${i} flowing text`, 50, 280, y),
                lineOf(`right prose row ${i} flowing text`, 320, 550, y),
            );
            y -= 16;
        }
        const blocks = buildPageBlocks([...lines], pageExtractOf(lines), false, ctx);
        const columns = blocks.find(b => b.kind === 'columns');
        expect(columns?.kind).toBe('columns');
        if (columns?.kind !== 'columns') return;
        expect(columns.columns).toHaveLength(2);
        const textOf = (i: number) => columns.columns[i].blocks
            .flatMap(b => blockLines(b)).map(l => l.words[0].text).join(' ');
        expect(textOf(0)).toContain('left');
        expect(textOf(0)).not.toContain('right');
        expect(textOf(1)).toContain('right');
        expect(blocks.some(b => b.kind !== 'columns' &&
            blockLines(b).some(l => l.words[0].text.startsWith('The Quiet Art')))).toBe(true);
    });

    it('keeps a genuine double rule as two, and one rule painted in slices as one', () => {
        const lines = [lineOf('body text under the rules', 50, 550, 600)];
        const doubleRule = [rectOf(45, 736.4, 506, 0.7), rectOf(45, 734.1, 506, 0.7)];
        const doubled = buildPageBlocks(
            [...lines], pageExtractOf(lines, { rects: doubleRule }), false, ctx);
        expect(doubled.filter(b => b.kind === 'rule')).toHaveLength(2);

        const slices = [rectOf(45, 700, 506, 1), rectOf(45, 699.6, 506, 1.2)];
        const sliced = buildPageBlocks(
            [...lines], pageExtractOf(lines, { rects: slices }), false, ctx);
        expect(sliced.filter(b => b.kind === 'rule')).toHaveLength(1);
    });

    it('carries a drawn bar beside a quote onto the block as a start rule', () => {
        const lines = [
            lineOf('the honey changes flavour room by room', 69, 380, 480),
            lineOf('across the calendar.', 69, 300, 466),
        ];
        const bar = rectOf(57, 455.1, 2.2, 41.2);
        const blocks = buildPageBlocks([...lines], pageExtractOf(lines, { rects: [bar] }), false, ctx);
        const marked = blocks.find(b => b.style.ruleStart);
        expect(marked?.style.ruleStart?.widthPt).toBeCloseTo(2.2, 1);
        expect(marked?.style.ruleStart?.gapPt).toBeCloseTo(69 - 59.2, 1);
    });

    it('leaves a quote with no drawn bar unmarked', () => {
        const lines = [
            lineOf('the honey changes flavour room by room', 69, 380, 480),
            lineOf('across the calendar.', 69, 300, 466),
        ];
        const blocks = buildPageBlocks([...lines], pageExtractOf(lines, { rects: [] }), false, ctx);
        expect(blocks.some(b => b.style.ruleStart)).toBe(false);
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

// Sub-detector B — left/right justified single-baseline rows.
describe('asJustifiedRow', () => {
    const bounds = { x0: 50, x1: 500 };
    const width = bounds.x1 - bounds.x0;
    function justCtx(
        pageBounds: { x0: number; x1: number } = { x0: 40, x1: 560 },
        bodyFontSize = 13,
    ): ClassifyContext {
        return {
            bodyFontSize,
            bodyLeading: bodyFontSize * 1.2,
            structure: { mcidToType: new Map(), hasStructure: false },
            pageBounds,
        };
    }
    const leftLabel = lineOf('Amount due', 50, 150, 700, { fontSize: 13.5 });
    const rightLabel = lineOf('Vendor Name LLC', 360, 500, 700, { fontSize: 13.5 });

    it('fires on two edge-pinned labels with a wide gap', () => {
        const row = asJustifiedRow([leftLabel, rightLabel], bounds, width, justCtx());
        expect(row).not.toBeNull();
        expect(row?.left.words[0].text).toBe('Amount due');
        expect(row?.right.words[0].text).toBe('Vendor Name LLC');
    });

    it('rejects a single-segment row', () => {
        expect(asJustifiedRow([leftLabel], bounds, width, justCtx())).toBeNull();
    });

    it('rejects segments that are not pinned to both edges', () => {
        const midLeft = lineOf('Amount due', 200, 260, 700, { fontSize: 13.5 });
        const midRight = lineOf('Vendor Name LLC', 300, 360, 700, { fontSize: 13.5 });
        expect(asJustifiedRow([midLeft, midRight], bounds, width, justCtx())).toBeNull();
    });

    it('rejects an inter-segment gap too small to be a justified split', () => {
        const near = lineOf('Vendor Name LLC', 170, 500, 700, { fontSize: 13.5 });
        expect(asJustifiedRow([leftLabel, near], bounds, width, justCtx())).toBeNull();
    });

    it('rejects a page-number / marker segment (list-marker + text case)', () => {
        const pageNo = lineOf('7', 480, 500, 700, { fontSize: 13.5 });
        expect(asJustifiedRow([leftLabel, pageNo], bounds, width, justCtx())).toBeNull();
    });

    it('rejects duplicated segments (rendered-twice visibility test)', () => {
        const dupA = lineOf('e cient', 50, 150, 700, { fontSize: 13.5 });
        const dupB = lineOf('e cient', 360, 500, 700, { fontSize: 13.5 });
        expect(asJustifiedRow([dupA, dupB], bounds, width, justCtx())).toBeNull();
    });

    it('rejects a narrow band (an in-cell amount|label row)', () => {
        const narrow = { x0: 50, x1: 280 };
        const l = lineOf('Amount due', 50, 120, 700, { fontSize: 13.5 });
        const r = lineOf('Vendor LLC', 220, 280, 700, { fontSize: 13.5 });
        expect(asJustifiedRow([l, r], narrow, narrow.x1 - narrow.x0, justCtx(narrow))).toBeNull();
    });

    it('rejects a sub-body font strip (print-chrome footer)', () => {
        const l = lineOf('4/20/26, 10:52 PM', 50, 150, 700, { fontSize: 8 });
        const r = lineOf('Vendor Name LLC', 360, 500, 700, { fontSize: 8 });
        expect(asJustifiedRow([l, r], bounds, width, justCtx())).toBeNull();
    });
});

describe('splitJustifiedRows', () => {
    const ctxB: ClassifyContext = {
        bodyFontSize: 13,
        bodyLeading: 15.6,
        structure: { mcidToType: new Map(), hasStructure: false },
        pageBounds: { x0: 40, x1: 560 },
    };
    const left = lineOf('Amount due', 50, 150, 700, { fontSize: 13.5 });
    const right = lineOf('Vendor Name LLC', 360, 500, 700, { fontSize: 13.5 });

    it('emits a two-column row for a justified header and flows the rest', () => {
        const below = lineOf('Some following prose line here', 50, 400, 680, { fontSize: 13.5 });
        const blocks = splitJustifiedRows([left, right, below], 0, ctxB);
        expect(blocks).not.toBeNull();
        expect(blocks?.[0].kind).toBe('columns');
        if (blocks?.[0].kind === 'columns') expect(blocks[0].columns).toHaveLength(2);
    });

    it('leaves a region with no justified row to the normal flow (returns null)', () => {
        const prose = [
            lineOf('ordinary line one', 50, 300, 700, { fontSize: 13 }),
            lineOf('ordinary line two', 50, 300, 686, { fontSize: 13 }),
        ];
        expect(splitJustifiedRows(prose, 0, ctxB)).toBeNull();
    });

    it('splits a leading masthead even in a dense region', () => {
        const dense = [
            lineOf('Lighthouse Library Network', 50, 300, 700, { fontSize: 19 }),
            lineOf('Quarterly Report · Q1 2026', 425, 500, 700, { fontSize: 9.5 }),
            lineOf('body row one', 50, 400, 680, { fontSize: 13 }),
            lineOf('body row two', 50, 400, 660, { fontSize: 13 }),
            lineOf('body row three', 50, 400, 640, { fontSize: 13 }),
        ];
        const blocks = splitJustifiedRows(dense, 0, ctxB);
        expect(blocks?.[0].kind).toBe('columns');
    });

    it('does not fire inside a dense region (more than a short header band)', () => {
        const dense = [
            left, right,
            lineOf('body row one', 50, 400, 680, { fontSize: 13 }),
            lineOf('body row two', 50, 400, 660, { fontSize: 13 }),
        ];
        expect(splitJustifiedRows(dense, 0, ctxB)).toBeNull();
    });
});

// Sub-detector A — nested 2×2 quadrant at the head of a column cell.
describe('asQuadrantRow', () => {
    const cellLeft = 311;
    const farXMin = 311 + 253 * 0.45; // 424.85

    it('splits a left-edge segment and a far-x quadrant segment', () => {
        const l = lineOf('Jerusalem Israel', 311, 427, 741, { fontSize: 14 });
        const r = lineOf('/in/name/', 453, 543, 741, { fontSize: 14 });
        const q = asQuadrantRow([l, r], cellLeft, farXMin);
        expect(q?.left.words[0].text).toBe('Jerusalem Israel');
        expect(q?.right.words[0].text).toBe('/in/name/');
    });

    it('rejects a single-segment row', () => {
        const l = lineOf('Core Skills', 311, 376, 741, { fontSize: 14 });
        expect(asQuadrantRow([l], cellLeft, farXMin)).toBeNull();
    });

    it('rejects a second segment that is not past the far-x threshold', () => {
        const l = lineOf('label', 311, 360, 741, { fontSize: 14 });
        const near = lineOf('value', 380, 420, 741, { fontSize: 14 });
        expect(asQuadrantRow([l, near], cellLeft, farXMin)).toBeNull();
    });

    it('rejects a left segment that is not at the cell edge', () => {
        const indented = lineOf('label', 345, 420, 741, { fontSize: 14 });
        const r = lineOf('value', 453, 543, 741, { fontSize: 14 });
        expect(asQuadrantRow([indented, r], cellLeft, farXMin)).toBeNull();
    });
});

describe('extractLeadingQuadrant', () => {
    const cellCtx: ClassifyContext = {
        bodyFontSize: 14,
        bodyLeading: 16.8,
        structure: { mcidToType: new Map(), hasStructure: false },
        pageBounds: { x0: 311, x1: 564 },
    };
    const q0L = lineOf('Jerusalem Israel', 311, 427, 741, { fontSize: 14 });
    const q0R = lineOf('/in/name/', 453, 543, 741, { fontSize: 14 });
    const q1L = lineOf('050 5340625', 311, 407, 723, { fontSize: 14 });
    const q1R = lineOf('email addr', 437, 563, 723, { fontSize: 14 });
    const heading = lineOf('Core Skills', 311, 376, 701, { fontSize: 14 });

    it('peels a two-row contact quadrant and leaves the heading as rest', () => {
        const result = extractLeadingQuadrant([q0L, q0R, q1L, q1R, heading], 0, 0, cellCtx);
        expect(result).not.toBeNull();
        expect(result?.block.kind).toBe('columns');
        expect(result?.block.columns).toHaveLength(2);
        expect(result?.rest).toHaveLength(1);
        expect(result?.rest[0].words[0].text).toBe('Core Skills');
    });

    it('does not fire on a single quadrant row (below the minimum run)', () => {
        expect(extractLeadingQuadrant([q0L, q0R, heading], 0, 0, cellCtx)).toBeNull();
    });

    it('does not fire when nothing single-column follows the run', () => {
        expect(extractLeadingQuadrant([q0L, q0R, q1L, q1R], 0, 0, cellCtx)).toBeNull();
    });

    it('does not fire on a long run (a full two-column body)', () => {
        const q2L = lineOf('third left', 311, 407, 705, { fontSize: 14 });
        const q2R = lineOf('third right', 453, 543, 705, { fontSize: 14 });
        const q3L = lineOf('fourth left', 311, 407, 687, { fontSize: 14 });
        const q3R = lineOf('fourth right', 453, 543, 687, { fontSize: 14 });
        const tail = lineOf('Core Skills', 311, 376, 669, { fontSize: 14 });
        const col = [q0L, q0R, q1L, q1R, q2L, q2R, q3L, q3R, tail];
        expect(extractLeadingQuadrant(col, 0, 0, cellCtx)).toBeNull();
    });

    it('does not fire on a single-column cell (dense prose column)', () => {
        const prose = [
            lineOf('prose line one', 311, 540, 741, { fontSize: 14 }),
            lineOf('prose line two', 311, 540, 723, { fontSize: 14 }),
            lineOf('prose line three', 311, 540, 701, { fontSize: 14 }),
        ];
        expect(extractLeadingQuadrant(prose, 0, 0, cellCtx)).toBeNull();
    });

    it('does not fire when the far-x starts scatter across the run', () => {
        const scatterR = lineOf('email addr', 490, 563, 723, { fontSize: 14 });
        expect(extractLeadingQuadrant([q0L, q0R, q1L, scatterR, heading], 0, 0, cellCtx)).toBeNull();
    });
});

// Deliberate line breaks — the next line's first word would have fit.
describe('stacked paragraphs (intentional break preservation)', () => {
    const wideSibling = lineOf('A heading line that stretches the page measure wide', 36, 571, 400, { fontSize: 14 });

    function paragraphWith(text: string, blocks: readonly ReturnType<typeof buildPageBlocks>[number][]) {
        return blocks.find(b => b.kind === 'paragraph' &&
            b.lines.some(l => l.words.some(w => w.text.includes(text))));
    }

    it('marks two short entries stacked when the next entry would have fit', () => {
        const mba = lineOf('MBA, Strategy (2020-2023)', 36, 389, 194, { fontSize: 10 });
        const bsc: Line = {
            ...lineOf('B.Sc. Computer Science - College (2015-2018)', 36, 334, 173, { fontSize: 10 }),
            words: [
                wordAt('B.Sc. Computer Science', 36, 147, 173),
                wordAt('- College (2015-2018)', 149, 334, 173),
            ],
        };
        const blocks = buildPageBlocks([wideSibling, mba, bsc], pageExtractOf([wideSibling, mba, bsc]), true, ctx);
        const para = paragraphWith('MBA', blocks);
        expect(para?.kind).toBe('paragraph');
        expect(para && para.kind === 'paragraph' ? para.stacked : undefined).toBe(true);
    });

    it('leaves wrapped prose flowing (next word did not fit)', () => {
        const first: Line = {
            ...lineOf('This long prose line runs right up to the measure edge', 36, 566, 194, { fontSize: 10 }),
            words: [
                wordAt('This long prose line runs right up to the', 36, 420, 194),
                wordAt('measure edge', 422, 566, 194),
            ],
        };
        const second: Line = {
            ...lineOf('continuation of the sentence here', 36, 220, 182, { fontSize: 10 }),
            words: [
                wordAt('continuation', 36, 95, 182),
                wordAt('of the sentence here', 97, 220, 182),
            ],
        };
        const blocks = buildPageBlocks([wideSibling, first, second], pageExtractOf([wideSibling, first, second]), true, ctx);
        const para = paragraphWith('continuation', blocks);
        expect(para && para.kind === 'paragraph' ? para.stacked : undefined).toBe(false);
    });

    it('treats a hyphen-ended line as a wrap artifact even with room to spare', () => {
        const first = lineOf('Ce premier cha-', 36, 120, 194, { fontSize: 10 });
        const second = lineOf('pitre est fort', 36, 110, 182, { fontSize: 10 });
        const blocks = buildPageBlocks([wideSibling, first, second], pageExtractOf([wideSibling, first, second]), true, ctx);
        const para = paragraphWith('premier', blocks);
        expect(para && para.kind === 'paragraph' ? para.stacked : undefined).toBe(false);
    });

    it('marks an RTL stack via the left-edge room', () => {
        const title = lineOf('אישור מחלה', 420, 571, 194, { dir: 'rtl', fontSize: 12 });
        const name = lineOf('אברהם גיל', 460, 571, 179, { dir: 'rtl', fontSize: 12 });
        const wideRtl = lineOf('שורת פתיחה רחבה מאוד שמותחת את שולי העמוד לכל הרוחב', 36, 571, 400, { dir: 'rtl', fontSize: 12 });
        const blocks = buildPageBlocks([wideRtl, title, name], pageExtractOf([wideRtl, title, name]), true, ctx);
        const para = paragraphWith('אישור', blocks);
        expect(para && para.kind === 'paragraph' ? para.stacked : undefined).toBe(true);
    });
});

// Sub-detector C — interior key/value run inside a column cell.
describe('extractKeyValueRun', () => {
    const heading = lineOf('Order summary', 154, 256, 567, { fontSize: 13.5 });
    const amount1 = lineOf('$15.00 USD', 49, 120, 545, { fontSize: 13.5 });
    const label1 = lineOf('Purchase', 142, 201, 545, { fontSize: 13.5 });
    const wrap1 = lineOf('amount', 152, 201, 527, { fontSize: 13.5 });
    const amount2 = lineOf('$15.00 USD', 49, 123, 457, { fontSize: 13.5 });
    const label2 = lineOf('Total', 227, 256, 457, { fontSize: 13.5 });

    it('extracts an interior amount|label run with a wrapped label continuation', () => {
        const run = extractKeyValueRun([heading, amount1, label1, wrap1, amount2, label2], 0);
        expect(run).not.toBeNull();
        expect(run?.before.map(l => l.words[0].text)).toEqual(['Order summary']);
        expect(run?.block.rows).toHaveLength(2);
        expect(run?.block.rows[0][0].lines[0].words[0].text).toBe('$15.00 USD');
        expect(run?.block.rows[0][1].lines.map(l => l.words[0].text)).toEqual(['Purchase', 'amount']);
        expect(run?.block.rows[1][1].lines[0].words[0].text).toBe('Total');
        expect(run?.after).toHaveLength(0);
    });

    it('rejects a single pair (below the minimum run)', () => {
        expect(extractKeyValueRun([heading, amount1, label1], 0)).toBeNull();
    });

    it('rejects list-marker rows (key too narrow)', () => {
        const marker1 = lineOf('•', 49, 54, 545, { fontSize: 13.5 });
        const item1 = lineOf('First bullet item', 72, 200, 545, { fontSize: 13.5 });
        const marker2 = lineOf('•', 49, 54, 527, { fontSize: 13.5 });
        const item2 = lineOf('Second bullet item', 72, 205, 527, { fontSize: 13.5 });
        expect(extractKeyValueRun([marker1, item1, marker2, item2], 0)).toBeNull();
    });

    it('rejects single-segment prose rows', () => {
        const prose = [
            lineOf('a prose line', 49, 250, 545, { fontSize: 13.5 }),
            lineOf('another prose line', 49, 240, 527, { fontSize: 13.5 }),
        ];
        expect(extractKeyValueRun(prose, 0)).toBeNull();
    });

    it('rejects a narrow key-to-value gap (one flowed line, not two cells)', () => {
        const key = lineOf('$15.00 USD', 49, 120, 545, { fontSize: 13.5 });
        const near = lineOf('Purchase', 128, 190, 545, { fontSize: 13.5 });
        const key2 = lineOf('$15.00 USD', 49, 120, 527, { fontSize: 13.5 });
        const near2 = lineOf('Total', 128, 160, 527, { fontSize: 13.5 });
        expect(extractKeyValueRun([key, near, key2, near2], 0)).toBeNull();
    });

    it('rejects duplicated segments (rendered-twice visibility case)', () => {
        const dupL1 = lineOf('e cient', 49, 120, 545, { fontSize: 13.5 });
        const dupR1 = lineOf('e cient', 190, 260, 545, { fontSize: 13.5 });
        const dupL2 = lineOf('e cient', 49, 120, 527, { fontSize: 13.5 });
        const dupR2 = lineOf('e cient', 190, 260, 527, { fontSize: 13.5 });
        expect(extractKeyValueRun([dupL1, dupR1, dupL2, dupR2], 0)).toBeNull();
    });
});

// Inline images — badge adjacency and stacked-icon layer choice.
describe('attachInlineImages (via buildPageBlocks)', () => {
    function imageOf(x: number, y: number, w: number, h: number, overrides?: Partial<ImageItem>): ImageItem {
        return {
            dataUrl: `data:image/png;base64,${w}x${h}`, width: w, height: h,
            renderWidth: w, renderHeight: h, x, y, page: 0, ...overrides,
        };
    }

    function flattenBlocks(blocks: readonly DocBlock[]): DocBlock[] {
        return blocks.flatMap(b =>
            b.kind === 'columns' ? [b, ...b.columns.flatMap(c => flattenBlocks(c.blocks))] : [b]);
    }

    function inlineImagesOf(blocks: readonly DocBlock[]): ImageItem[] {
        return flattenBlocks(blocks)
            .flatMap(b => blockLines(b).flatMap(l => l.words))
            .map(w => w.image)
            .filter((img): img is ImageItem => img !== undefined);
    }

    it('attaches an adjacent badge hugging the line end and keeps the top-painted layer', () => {
        const header = lineOf('Lemon Squeezy LLC', 368, 500, 718, { fontSize: 13.5 });
        const circle = imageOf(510, 714, 38, 38);
        const ring = imageOf(510, 714, 38, 38, { svgStrokeColor: '#faf8f5', svgStrokeWidth: 1 });
        const glyph = imageOf(518, 714, 21, 19);
        const blocks = buildPageBlocks([header], pageExtractOf([header], { images: [circle, ring, glyph] }), true, ctx);
        const inline = inlineImagesOf(blocks);
        expect(inline).toHaveLength(1);
        expect(inline[0]).toBe(glyph);
        expect(blocks.some(b => b.kind === 'image')).toBe(false);
    });

    it('leaves a large image alone (not icon- or badge-sized)', () => {
        const header = lineOf('A heading line', 36, 200, 718, { fontSize: 12 });
        const big = imageOf(210, 700, 120, 90);
        const blocks = buildPageBlocks([header], pageExtractOf([header], { images: [big] }), true, ctx);
        expect(inlineImagesOf(blocks)).toHaveLength(0);
        expect(blocks.some(b => b.kind === 'image')).toBe(true);
    });

    it('leaves a distant small image alone (gap beyond the badge reach)', () => {
        const header = lineOf('A heading line', 36, 200, 718, { fontSize: 12 });
        const far = imageOf(260, 712, 12, 12);
        const blocks = buildPageBlocks([header], pageExtractOf([header], { images: [far] }), true, ctx);
        expect(inlineImagesOf(blocks)).toHaveLength(0);
    });
});

// Float criterion — a tall image beside a short block counts by the smaller band.
describe('float beside a short block', () => {
    it('floats a tall logo left of a two-line header block it fully spans', () => {
        const a = lineOf('לכבוד: 22/05/2026', 292, 548, 773, { dir: 'rtl', fontSize: 10 });
        const b = lineOf('גיל אברהם-אלפי', 452, 548, 759, { dir: 'rtl', fontSize: 10 });
        const logo: ImageItem = {
            dataUrl: 'data:image/png;base64,logo', width: 112, height: 112,
            renderWidth: 112, renderHeight: 112, x: 89, y: 690, page: 0,
        };
        const blocks = buildPageBlocks([a, b], pageExtractOf([a, b], { images: [logo] }), true, ctx);
        const float = blocks.find(bl => bl.kind === 'image' && bl.float !== '');
        expect(float).toBeDefined();
        expect(float?.kind === 'image' ? float.float : '').toBe('left');
    });
});

// Bold-to-plain line transitions split paragraph groups.
describe('bold-to-plain paragraph boundary', () => {
    it('splits a uniformly bold line from the plain line below it', () => {
        const question = lineOf('Que veut dire la mère de Mona quand elle dit', 50, 500, 700, { style: { bold: true } });
        const option = lineOf('a) Mona doit faire plus de recherche avant', 50, 480, 686);
        const blocks = buildPageBlocks([question, option], pageExtractOf([question, option]), true, ctx);
        const texts = blocks.map(b => blockLines(b).map(l => l.words[0].text).join(' | '));
        expect(texts.some(t => t.includes('Que veut') && t.includes('Mona doit'))).toBe(false);
    });

    it('keeps a plain label line with the bold line below it (one visual unit)', () => {
        const label = lineOf('לכבוד: 22/05/2026', 292, 548, 700, { dir: 'rtl', fontSize: 10 });
        const name = lineOf('גיל אברהם-אלפי', 452, 548, 688, { dir: 'rtl', fontSize: 10, style: { bold: true } });
        const blocks = buildPageBlocks([label, name], pageExtractOf([label, name]), true, ctx);
        const joined = blocks.some(b => blockLines(b).length === 2);
        expect(joined).toBe(true);
    });
});

describe('form field slots', () => {
    function slotRule(x: number, y: number, width: number): PathRect {
        return {
            x, y, width, height: 0.7, page: 0,
            stroked: false, filled: true,
            strokeColor: '#8e44ad', fillColor: '#8e44ad', lineWidth: 0,
        };
    }

    // Two field rows, each label over its own slot rule.
    const fieldLines = (): Line[] => [
        lineOf('FULL NAME', 45, 98.4, 677.1, { fontSize: 8 }),
        lineOf('DATE OF BIRTH', 310.1, 383, 677.1, { fontSize: 8 }),
        lineOf('EMAIL', 45, 73.5, 635.1, { fontSize: 8 }),
        lineOf('PHONE', 310.1, 345, 635.1, { fontSize: 8 }),
    ];
    const fieldRects = (): PathRect[] => [
        slotRule(45, 659.1, 241.5), slotRule(310.5, 659.1, 240.7),
        slotRule(45, 617.1, 241.5), slotRule(310.5, 617.1, 240.7),
    ];
    const withRules = (rects: PathRect[]): ClassifyContext => ({
        ...ctx, pageBounds: { x0: 45, x1: 551.2 }, fieldRules: rects, useRect: () => { },
    });

    it('splits two labels on one baseline into columns when each has its own rule', () => {
        const split = splitFieldRows(fieldLines(), 0, withRules(fieldRects()));
        expect(split).not.toBeNull();
        if (!split) return;
        expect(split.block.columns).toHaveLength(2);
        const textOf = (i: number) => split.block.columns[i].blocks
            .flatMap(b => blockLines(b)).map(l => l.words[0].text).join(' ');
        expect(textOf(0)).toBe('FULL NAME EMAIL');
        expect(textOf(1)).toBe('DATE OF BIRTH PHONE');
    });

    it('carries each slot rule onto its own label as a border', () => {
        const split = splitFieldRows(fieldLines(), 0, withRules(fieldRects()));
        const marked = split?.block.columns.flatMap(c => c.blocks).filter(b => b.style.ruleUnder);
        expect(marked).toHaveLength(4);
        expect(marked?.[0].style.ruleUnder?.color).toBe('#8e44ad');
    });

    it('leaves a label/value pair on one baseline joined when there is no rule', () => {
        const lines = [
            lineOf('Total', 45, 98.4, 677.1, { fontSize: 8 }),
            lineOf('42', 310.1, 345, 677.1, { fontSize: 8 }),
        ];
        expect(splitFieldRows(lines, 0, withRules([]))).toBeNull();
        const blocks = buildPageBlocks([...lines], pageExtractOf(lines, { rects: [] }), false, ctx);
        expect(blocks.some(b => b.kind === 'columns')).toBe(false);
    });

    it('does not pull a section heading below the last slot into the grid', () => {
        const lines = [
            ...fieldLines(),
            lineOf('Workshop selection', 45, 180, 595, { fontSize: 11 }),
        ];
        const split = splitFieldRows(lines, 0, withRules(fieldRects()));
        expect(split).not.toBeNull();
        const inGrid = split?.block.columns.flatMap(c => c.blocks)
            .flatMap(b => blockLines(b)).map(l => l.words[0].text) ?? [];
        expect(inGrid).not.toContain('Workshop selection');
    });

    it('turns drawn checkboxes into a task list carrying their ticked state', () => {
        const box = (y: number, filled: boolean): PathRect => ({
            x: 45.4, y, width: 9, height: 9, page: 0,
            stroked: true, filled, strokeColor: '#333333', fillColor: '#333333', lineWidth: 1,
        });
        const lines = [
            lineOf('Woodworking fundamentals', 62, 300, 560, { fontSize: 10 }),
            lineOf('Ceramics: wheel throwing', 62, 300, 540, { fontSize: 10 }),
            lineOf('Intro to letterpress', 62, 300, 520, { fontSize: 10 }),
        ];
        const rects = [box(559.8, false), box(539.5, true), box(519.9, false)];
        const blocks = buildPageBlocks([...lines], pageExtractOf(lines, { rects }), false, ctx);
        const list = blocks.find(b => b.kind === 'list');
        expect(list?.kind).toBe('list');
        if (list?.kind !== 'list') return;
        expect(list.task).toBe(true);
        expect(list.items.map(i => i.checked)).toEqual([false, true, false]);
    });

    // ~58pt of deliberate whitespace between the paragraph and the slots.
    it('keeps the whitespace the PDF left above a signature row', () => {
        const lines = [
            lineOf('I confirm the details above are correct.', 45, 400, 428.9, { fontSize: 10.5 }),
            lineOf('Participant signature', 45, 140, 360.6, { fontSize: 9 }),
            lineOf('Date', 227.2, 260, 360.6, { fontSize: 9 }),
            lineOf('Staff initials', 409.5, 480, 360.6, { fontSize: 9 }),
        ];
        const rects = [slotRule(45, 370.4, 141.7), slotRule(227.2, 370.4, 141.7),
            slotRule(409.5, 370.4, 141.7)];
        const blocks = buildPageBlocks([...lines], pageExtractOf(lines, { rects }), false, ctx);
        const row = blocks.find(b => b.kind === 'columns');
        expect(row?.kind).toBe('columns');
        expect(row?.style.marginTop).toBeGreaterThan(12);
    });

    it('does not make a task list from text that has no drawn boxes', () => {
        const lines = [
            lineOf('Woodworking fundamentals', 62, 300, 560, { fontSize: 10 }),
            lineOf('Ceramics: wheel throwing', 62, 300, 540, { fontSize: 10 }),
        ];
        const blocks = buildPageBlocks([...lines], pageExtractOf(lines, { rects: [] }), false, ctx);
        expect(blocks.some(b => b.kind === 'list' && b.task === true)).toBe(false);
    });
});

describe('first-line-indent paragraph boundary', () => {
    // 21.7pt gap on 15pt lines is under PARAGRAPH_GAP_FACTOR, so only the
    // 14pt indent marks these paragraphs.
    function column(): Line[] {
        return [
            lineOf('City ordinances vary, and most registrars ask', 323.1, 551.2, 585.6, { fontSize: 10 }),
            lineOf('that hives sit a polite distance from property', 309.1, 551.2, 570.6, { fontSize: 10 }),
            lineOf('Neighbours, in the keepers experience, come', 309.1, 551.2, 555.6, { fontSize: 10 }),
            lineOf('quickly usually at the first jar handed over', 309.1, 541.4, 540.6, { fontSize: 10 }),
            lineOf('What surprises newcomers most is the sound', 323.1, 551.2, 518.9, { fontSize: 10 }),
            lineOf('the buzz itself, but its weather: a contented', 309.1, 551.2, 503.9, { fontSize: 10 }),
        ];
    }

    it('splits at the indent even though the gap is under the threshold', () => {
        const lines = column();
        const blocks = buildPageBlocks(lines, pageExtractOf(lines), false, ctx);
        const texts = blocks.map(b => blockLines(b).map(l => l.words[0].text).join(' '));
        expect(texts.some(t => t.includes('City ordinances') && t.includes('What surprises'))).toBe(false);
        expect(texts.some(t => t.includes('What surprises') && t.includes('the buzz itself'))).toBe(true);
    });

    it('does not split a wrapped line that merely starts at the measure', () => {
        const lines = [0, 1, 2, 3].map(i =>
            lineOf(`flush line ${i} of one flowing paragraph`, 309.1, 551.2, 585.6 - i * 15, { fontSize: 10 }));
        const blocks = buildPageBlocks(lines, pageExtractOf(lines), false, ctx);
        expect(blocks.filter(b => b.kind === 'paragraph')).toHaveLength(1);
    });
});

// Shared-fill panel — stacked fill slices merge and wrap their blocks once.
describe('shared fill panel', () => {
    function fillRect(x: number, y: number, w: number, h: number): PathRect {
        return {
            x, y, width: w, height: h, page: 0,
            stroked: false, filled: true,
            strokeColor: '#5d93e5', fillColor: '#5d93e5', lineWidth: 0,
        };
    }

    it('wraps consecutive blocks on one sliced fill into a single anchored panel', () => {
        const vendor = lineOf('טיפול נמרץ וטרינרי', 36, 200, 600, { dir: 'rtl', fontSize: 10 });
        const a = lineOf('לכבוד: 22/05/2026', 292, 548, 770, { dir: 'rtl', fontSize: 10 });
        const b = lineOf('חשבונית מס / קבלה 162492', 358, 548, 700, { dir: 'rtl', fontSize: 18 });
        const c = lineOf('מקור', 527, 548, 660, { dir: 'rtl', fontSize: 11 });
        const lines = [a, b, c, vendor];
        const slices = [fillRect(265, 740, 309, 60), fillRect(265, 680, 309, 60), fillRect(265, 640, 309, 40)];
        const blocks = buildPageBlocks(lines, pageExtractOf(lines, { rects: slices }), true, ctx);
        const panels = blocks.filter(bl => bl.kind === 'columns' && bl.style.background === '#5d93e5');
        expect(panels).toHaveLength(1);
        const panel = panels[0];
        if (panel.kind !== 'columns') throw new Error('unreachable');
        expect(panel.columns[0].blocks.length).toBeGreaterThanOrEqual(2);
        expect(panel.panelRatio).toBeGreaterThan(0.3);
        expect(panel.panelSide).toBe('right');
        expect(panel.columns[0].blocks.every(bl => bl.style.background === '')).toBe(true);
    });

    it('leaves a single-block fill as a per-block background (no wrapper)', () => {
        const only = lineOf('סה"כ לתשלום 3,966', 300, 500, 700, { dir: 'rtl', fontSize: 10 });
        const blocks = buildPageBlocks([only], pageExtractOf([only], { rects: [fillRect(290, 690, 220, 20)] }), true, ctx);
        expect(blocks.some(bl => bl.kind === 'columns')).toBe(false);
        expect(blocks.some(bl => bl.style.background === '#5d93e5')).toBe(true);
    });
});

// Alignment-class boundary — edge-pinned vs centered lines split.
describe('alignment paragraph boundary', () => {
    it('splits a right-pinned title from the centered bold line below it', () => {
        const title = lineOf('תשלום חשבונית', 472, 584, 745, { dir: 'rtl', fontSize: 20.5 });
        const success = lineOf('תשלום בוצע בהצלחה!', 225, 388, 722, { dir: 'rtl', fontSize: 20.5, style: { bold: true } });
        const wide = lineOf('שורת גוף מלאה שנמתחת כמעט על כל רוחב האזור כאן', 44, 584, 698, { dir: 'rtl', fontSize: 20.5 });
        const blocks = buildPageBlocks([title, success, wide], pageExtractOf([title, success, wide]), true, ctx);
        const containing = blocks.filter(b => blockLines(b).some(l => l.words[0].text.includes('בוצע')));
        expect(containing).toHaveLength(1);
        expect(blockLines(containing[0])).toHaveLength(1);
    });

    it('keeps a full-width line joined with its centered wrap tail', () => {
        const full = lineOf('לידיעתכם התשלום ייקלט במהלך 24 השעות הקרובות בכפוף לאישור מחברת', 44, 584, 698, { dir: 'rtl', fontSize: 20.5 });
        const tail = lineOf('האשראי.', 276, 337, 675, { dir: 'rtl', fontSize: 20.5 });
        const blocks = buildPageBlocks([full, tail], pageExtractOf([full, tail]), true, ctx);
        const joined = blocks.some(b => blockLines(b).length === 2);
        expect(joined).toBe(true);
    });
});

// Footer band — a URL | page-number row is a genuine justified footer.
describe('footer-band justified rows', () => {
    const footCtx: ClassifyContext = {
        bodyFontSize: 20.5,
        bodyLeading: 24,
        structure: { mcidToType: new Map(), hasStructure: false },
        pageBounds: { x0: 27, x1: 584 },
        pageHeight: 792,
    };
    const url = lineOf('https://www.pazgas.co.il/he/services-pay-gas-bill/iv_step2', 27, 250, 37, { fontSize: 8 });
    const pageNo = lineOf('1/1', 570, 584, 37, { fontSize: 8 });

    it('accepts a footer URL | page-number row despite marker and sub-body font', () => {
        const bounds = { x0: 27, x1: 584 };
        const row = asJustifiedRow([url, pageNo], bounds, bounds.x1 - bounds.x0, footCtx);
        expect(row).not.toBeNull();
        expect(row?.right.words[0].text).toBe('1/1');
    });

    it('still rejects a marker row outside the footer band', () => {
        const bodyUrl = lineOf('https://www.pazgas.co.il/he/services-pay-gas-bill/iv_step2', 27, 250, 400, { fontSize: 8 });
        const bodyNo = lineOf('1/1', 570, 584, 400, { fontSize: 8 });
        const bounds = { x0: 27, x1: 584 };
        expect(asJustifiedRow([bodyUrl, bodyNo], bounds, bounds.x1 - bounds.x0, footCtx)).toBeNull();
    });

    it('rejects a footer row of two bare markers', () => {
        const m1 = lineOf('7', 27, 40, 37, { fontSize: 8 });
        const m2 = lineOf('1/1', 570, 584, 37, { fontSize: 8 });
        const bounds = { x0: 27, x1: 584 };
        expect(asJustifiedRow([m1, m2], bounds, bounds.x1 - bounds.x0, footCtx)).toBeNull();
    });
});

// Narrow blockquote keeps its own width so the browser re-wraps like the original.
describe('narrow blockquote width cap', () => {
    it('caps a narrow multi-line blockquote at its source extent', () => {
        const wide = lineOf('שורה רחבה שממלאת את רוב רוחב העמוד ומגדירה את המידה כאן בסדר', 42, 552, 700, { dir: 'rtl', fontSize: 10 });
        const v1 = lineOf('עוסק מורשה (ח.פ): 515766087', 87, 201, 635, { dir: 'rtl', fontSize: 10 });
        const v2 = lineOf('כפר הנוער בן שמן, בן שמן (כפר נוער)', 66, 201, 622, { dir: 'rtl', fontSize: 10 });
        const v3 = lineOf('טלפון 08-6280200', 129, 201, 609, { dir: 'rtl', fontSize: 10 });
        const blocks = buildPageBlocks([wide, v1, v2, v3], pageExtractOf([wide, v1, v2, v3]), true, ctx);
        const vendor = blocks.find(b => b.kind === 'blockquote' &&
            b.lines.some(l => l.words.some(w => w.text.includes('מורשה'))));
        expect(vendor?.kind).toBe('blockquote');
        const maxWidth = vendor && vendor.kind === 'blockquote' ? vendor.style.maxWidth : 0;
        expect(maxWidth).toBeGreaterThan(130);
        expect(maxWidth).toBeLessThan(160);
    });
});

// Break-fit room sits on the ragged edge, not the script-direction side.
describe('right-aligned LTR stack', () => {
    it('preserves breaks in a right-pinned LTR stack (room is on the left)', () => {
        const wide = lineOf('A full width heading stretching the measure here now', 36, 571, 700, { fontSize: 14 });
        const label = lineOf('rate of exchange', 436, 546, 457, { fontSize: 13.5 });
        const a = lineOf('46.30 ILS = 15.00 USD', 392, 546, 432, { fontSize: 13.5 });
        const b = lineOf('1 ILS = 0.324 USD', 430, 546, 414, { fontSize: 13.5 });
        const blocks = buildPageBlocks([wide, label, a, b], pageExtractOf([wide, label, a, b]), true, ctx);
        const stack = blocks.find(bl => (bl.kind === 'paragraph' || bl.kind === 'blockquote') &&
            bl.lines.some(l => l.words.some(w => w.text.includes('46.30'))));
        const stacked = stack && (stack.kind === 'paragraph' || stack.kind === 'blockquote')
            ? stack.stacked : undefined;
        expect(stacked).toBe(true);
    });
});

/**
 * An image that sits beside a multi-line block is a float in the original
 * layout, and reproducing that is what keeps the text wrapping around it
 * instead of being pushed below. An image that overlaps the text horizontally
 * is not a float at all — it belongs in the flow.
 */
describe('buildPageBlocks — image floats', () => {
    const imageAt = (x: number, y: number, w = 80, h = 60): ImageItem => ({
        dataUrl: 'data:image/png;base64,x',
        width: w, height: h, renderWidth: w, renderHeight: h,
        x, y, page: 0,
    });

    /** Three stacked lines occupying the right-hand side of the page. */
    const rightColumnLines = (): Line[] => [
        lineOf('The quick brown fox jumps', 200, 520, 700),
        lineOf('over the lazy dog and then', 200, 520, 686),
        lineOf('keeps running for a while', 200, 520, 672),
    ];

    function floatOf(blocks: readonly DocBlock[]): string | undefined {
        const image = blocks.find(b => b.kind === 'image');
        return image?.kind === 'image' ? image.float : undefined;
    }

    it('floats an image left of the paragraph it sits beside', () => {
        const page = pageExtractOf([], { images: [imageAt(40, 660)] });

        const blocks = buildPageBlocks(rightColumnLines(), page, true, ctx);

        expect(floatOf(blocks)).toBe('left');
        expect(blocks.some(b => b.kind === 'paragraph')).toBe(true);
    });

    it('floats an image right of the paragraph it sits beside', () => {
        const lines = [
            lineOf('The quick brown fox jumps', 40, 360, 700),
            lineOf('over the lazy dog and then', 40, 360, 686),
            lineOf('keeps running for a while', 40, 360, 672),
        ];
        const page = pageExtractOf([], { images: [imageAt(420, 660)] });

        const blocks = buildPageBlocks(lines, page, true, ctx);

        expect(floatOf(blocks)).toBe('right');
    });

    it('keeps an image that overlaps the text horizontally in the flow', () => {
        // Neither fully left nor fully right of the block, so it cannot float.
        const page = pageExtractOf([], { images: [imageAt(300, 660)] });

        const blocks = buildPageBlocks(rightColumnLines(), page, true, ctx);

        expect(floatOf(blocks)).toBe('');
    });

    it('does not float beside a single-line block', () => {
        // One line gives no band to wrap around, so the image stays in flow.
        const page = pageExtractOf([], { images: [imageAt(40, 690)] });

        const blocks = buildPageBlocks([lineOf('Only one line here', 200, 520, 700)], page, true, ctx);

        expect(floatOf(blocks)).toBe('');
    });

    it('anchors a centred standalone image to the centre on an RTL page', () => {
        // Side anchoring only applies on RTL pages, where the container would
        // otherwise right-anchor an image that was not on the right.
        const lines = [lineOf('שלום עולם זהו טקסט', 300, 560, 500, { dir: 'rtl' })];
        const page = pageExtractOf([], { images: [imageAt(266, 740)] });

        const blocks = buildPageBlocks(lines, page, true, ctx);

        const image = blocks.find(b => b.kind === 'image');
        expect(image?.kind).toBe('image');
        if (image?.kind === 'image') expect(image.style.align).toBe('center');
    });

    it('drops images entirely when they are not requested', () => {
        const page = pageExtractOf([], { images: [imageAt(40, 660)] });

        const blocks = buildPageBlocks(rightColumnLines(), page, false, ctx);

        expect(blocks.some(b => b.kind === 'image')).toBe(false);
        expect(blocks.some(b => b.kind === 'paragraph')).toBe(true);
    });
});
