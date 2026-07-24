import { describe, expect, it } from 'vitest';
import type { PathRect } from '../pdf-parser';
import type { ClassifyContext } from './readable-classify';
import { lineOf } from './readable-spec-helpers';
import { findTableInBand } from './readable-tables';
import type { Line } from './readable-types';

const ctx: ClassifyContext = {
    bodyFontSize: 12,
    bodyLeading: 14.4,
    structure: { mcidToType: new Map(), hasStructure: false },
    pageBounds: { x0: 50, x1: 550 },
};

function separatorRect(x: number, y: number, width: number, height: number): PathRect {
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

function unruledRows(): Line[] {
    const rows: Line[] = [];
    const ys = [700, 680, 660];
    for (const y of ys) {
        rows.push(
            lineOf('Name', 50, 100, y),
            lineOf('Qty', 250, 290, y),
            lineOf('Price', 450, 500, y),
        );
    }
    return rows;
}

describe('findTableInBand — unruled', () => {
    it('reconstructs aligned multi-segment rows into a table', () => {
        const split = findTableInBand(unruledRows(), [], 0, ctx);
        expect(split).not.toBeNull();
        expect(split?.table.ruled).toBe(false);
        expect(split?.table.rows).toHaveLength(3);
        expect(split?.table.rows[0]).toHaveLength(3);
        expect(split?.before).toHaveLength(0);
        expect(split?.after).toHaveLength(0);
    });

    it('keeps preceding and following single-segment lines out of the table', () => {
        const band = [
            lineOf('Intro paragraph line', 50, 400, 730),
            ...unruledRows(),
            lineOf('Closing paragraph line', 50, 400, 630),
        ];
        const split = findTableInBand(band, [], 0, ctx);
        expect(split).not.toBeNull();
        expect(split?.before).toHaveLength(1);
        expect(split?.after).toHaveLength(1);
    });

    it('rejects two wide prose columns as a table', () => {
        const band: Line[] = [];
        for (const y of [700, 686, 672, 658]) {
            band.push(
                lineOf('A long flowing prose line here', 50, 260, y),
                lineOf('Another long flowing prose line', 300, 510, y),
            );
        }
        expect(findTableInBand(band, [], 0, ctx)).toBeNull();
    });

    it('rejects rows whose edges do not snap to shared columns', () => {
        const band = [
            lineOf('a', 50, 70, 700), lineOf('b', 200, 220, 700),
            lineOf('c', 120, 140, 680), lineOf('d', 320, 340, 680),
            lineOf('e', 80, 100, 660), lineOf('f', 260, 280, 660),
        ];
        expect(findTableInBand(band, [], 0, ctx)).toBeNull();
    });

    it('clusters RTL tables on right edges and keeps logical column order', () => {
        const band: Line[] = [];
        for (const y of [700, 680, 660]) {
            band.push(
                lineOf('פריט', 450, 500, y, { dir: 'rtl' }),
                lineOf('כמות', 250, 300, y, { dir: 'rtl' }),
                lineOf('מחיר', 50, 100, y, { dir: 'rtl' }),
            );
        }
        const split = findTableInBand(band, [], 0, ctx);
        expect(split).not.toBeNull();
        expect(split?.table.rows).toHaveLength(3);
        expect(split?.table.rows[0]).toHaveLength(3);
        expect(split?.table.style.dir).toBe('rtl');
        expect(split?.table.rows[0][0].lines[0].words[0].text).toBe('פריט');
    });

    it('rejects a run where edges align in only one row', () => {
        const band = [
            lineOf('a', 50, 70, 700), lineOf('b', 250, 270, 700),
            lineOf('c', 90, 110, 680), lineOf('d', 300, 320, 680),
        ];
        expect(findTableInBand(band, [], 0, ctx)).toBeNull();
    });

    it('marks an all-bold first row as the header row', () => {
        const band = [
            lineOf('Name', 50, 100, 700, { style: { bold: true } }),
            lineOf('Qty', 250, 290, 700, { style: { bold: true } }),
            lineOf('Ada', 50, 90, 680),
            lineOf('3', 250, 260, 680),
        ];
        const split = findTableInBand(band, [], 0, ctx);
        expect(split?.table.headerRow).toBe(true);
    });
});

describe('findTableInBand — ruled', () => {
    it('builds cells from a drawn separator grid', () => {
        const rects = [
            separatorRect(50, 710, 400, 1),
            separatorRect(50, 670, 400, 1),
            separatorRect(50, 630, 400, 1),
            separatorRect(50, 630, 1, 81),
            separatorRect(250, 630, 1, 81),
            separatorRect(450, 630, 1, 81),
        ];
        const band = [
            lineOf('TL', 60, 90, 690),
            lineOf('TR', 260, 290, 690),
            lineOf('BL', 60, 90, 650),
            lineOf('BR', 260, 290, 650),
        ];
        const split = findTableInBand(band, rects, 0, ctx);
        expect(split).not.toBeNull();
        expect(split?.table.ruled).toBe(true);
        expect(split?.table.rows).toHaveLength(2);
        expect(split?.table.rows[0]).toHaveLength(2);
        expect(split?.table.rows[0][0].lines[0].words[0].text).toBe('TL');
        expect(split?.table.rows[1][1].lines[0].words[0].text).toBe('BR');
    });

    it('supports multi-line cells inside one ruled row', () => {
        const rects = [
            separatorRect(50, 710, 400, 1),
            separatorRect(50, 670, 400, 1),
            separatorRect(50, 630, 400, 1),
            separatorRect(50, 630, 1, 81),
            separatorRect(250, 630, 1, 81),
            separatorRect(450, 630, 1, 81),
        ];
        const band = [
            lineOf('First line', 60, 150, 700),
            lineOf('second line', 60, 160, 686),
            lineOf('Sibling cell', 260, 350, 700),
            lineOf('Bottom left', 60, 150, 650),
            lineOf('Bottom right', 260, 360, 650),
        ];
        const split = findTableInBand(band, rects, 0, ctx);
        expect(split).not.toBeNull();
        expect(split?.table.rows[0][0].lines).toHaveLength(2);
        expect(split?.table.rows[1][0].lines[0].words[0].text).toBe('Bottom left');
    });

    it('preserves text beside the grid instead of dropping it', () => {
        const rects = [
            separatorRect(50, 710, 300, 1),
            separatorRect(50, 670, 300, 1),
            separatorRect(50, 630, 300, 1),
            separatorRect(50, 630, 1, 81),
            separatorRect(200, 630, 1, 81),
            separatorRect(350, 630, 1, 81),
        ];
        const band = [
            lineOf('TL', 60, 90, 690),
            lineOf('TR', 210, 240, 690),
            lineOf('BL', 60, 90, 650),
            lineOf('BR', 210, 240, 650),
            lineOf('Side note', 400, 480, 690),
        ];
        const split = findTableInBand(band, rects, 0, ctx);
        expect(split).not.toBeNull();
        const remaining = [...(split?.before ?? []), ...(split?.after ?? [])];
        expect(remaining.some(l => l.words[0].text === 'Side note')).toBe(true);
    });

    it('returns null when no grid and no aligned rows exist', () => {
        const band = [
            lineOf('Just a paragraph line', 50, 400, 700),
            lineOf('and another one', 50, 300, 686),
        ];
        expect(findTableInBand(band, [], 0, ctx)).toBeNull();
    });

    it('keeps two disjoint grids separate instead of fusing them', () => {
        const upper = [
            separatorRect(50, 710, 400, 1),
            separatorRect(50, 670, 400, 1),
            separatorRect(50, 630, 400, 1),
            separatorRect(50, 630, 1, 81),
            separatorRect(250, 630, 1, 81),
            separatorRect(450, 630, 1, 81),
        ];
        const lower = [
            separatorRect(50, 560, 400, 1),
            separatorRect(50, 520, 400, 1),
            separatorRect(50, 480, 400, 1),
            separatorRect(50, 480, 1, 81),
            separatorRect(250, 480, 1, 81),
            separatorRect(450, 480, 1, 81),
        ];
        const band = [
            lineOf('TL', 60, 90, 690), lineOf('TR', 260, 290, 690),
            lineOf('BL', 60, 90, 650), lineOf('BR', 260, 290, 650),
            lineOf('Between paragraph text', 50, 400, 595),
            lineOf('UL', 60, 90, 540), lineOf('UR', 260, 290, 540),
            lineOf('DL', 60, 90, 500), lineOf('DR', 260, 290, 500),
        ];
        const split = findTableInBand(band, [...upper, ...lower], 0, ctx);
        expect(split).not.toBeNull();
        expect(split?.table.rows).toHaveLength(2);
        const inTable = split!.table.rows.flat()
            .flatMap(cell => cell.lines.flatMap(l => l.words.map(w => w.text)));
        expect(inTable).toContain('TL');
        expect(inTable).not.toContain('UL');
        expect(inTable).not.toContain('Between');
        const afterText = split!.after.flatMap(l => l.words.map(w => w.text));
        expect(afterText).toContain('UL');
    });
});
