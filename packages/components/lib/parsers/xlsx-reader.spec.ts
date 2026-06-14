import { describe, expect, it } from 'vitest';
import { parseXlsx, type XlsxSheet } from './xlsx-reader';

// ── Minimal STORED (uncompressed) ZIP builder ──────────────────────────
// Mirrors the on-disk format readZip expects: local file headers + central
// directory + EOCD, compression method 0, correct CRC32 per entry. This
// lets us hand-craft arbitrary OOXML parts to drive every reader branch.

const encoder = new TextEncoder();

function makeCrc32Table(): Uint32Array {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        t[i] = c;
    }
    return t;
}
const CRC = makeCrc32Table();
function crc32(data: Uint8Array): number {
    let crc = 0xffffffff;
    for (const byte of data) {
        crc = CRC[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function w16(buf: Uint8Array, o: number, v: number): void {
    buf[o] = v & 0xff;
    buf[o + 1] = (v >> 8) & 0xff;
}
function w32(buf: Uint8Array, o: number, v: number): void {
    buf[o] = v & 0xff;
    buf[o + 1] = (v >> 8) & 0xff;
    buf[o + 2] = (v >> 16) & 0xff;
    buf[o + 3] = (v >> 24) & 0xff;
}

interface Part {
    readonly path: string;
    readonly xml: string;
}

function zip(parts: Part[]): Uint8Array {
    const entries = parts.map(p => {
        const path = encoder.encode(p.path);
        const content = encoder.encode(p.xml);
        return { path, content, crc: crc32(content), offset: 0 };
    });

    let local = 0;
    for (const e of entries) local += 30 + e.path.length + e.content.length;
    const central = entries.reduce((s, e) => s + 46 + e.path.length, 0);
    const buf = new Uint8Array(local + central + 22);

    let pos = 0;
    for (const e of entries) {
        e.offset = pos;
        w32(buf, pos, 0x04034b50); pos += 4;
        w16(buf, pos, 20); pos += 2;
        w16(buf, pos, 0); pos += 2; // flags
        w16(buf, pos, 0); pos += 2; // method = 0 (STORED)
        w16(buf, pos, 0); pos += 2;
        w16(buf, pos, 0); pos += 2;
        w32(buf, pos, e.crc); pos += 4;
        w32(buf, pos, e.content.length); pos += 4;
        w32(buf, pos, e.content.length); pos += 4;
        w16(buf, pos, e.path.length); pos += 2;
        w16(buf, pos, 0); pos += 2;
        buf.set(e.path, pos); pos += e.path.length;
        buf.set(e.content, pos); pos += e.content.length;
    }

    const centralOffset = pos;
    for (const e of entries) {
        w32(buf, pos, 0x02014b50); pos += 4;
        w16(buf, pos, 20); pos += 2;
        w16(buf, pos, 20); pos += 2;
        w16(buf, pos, 0); pos += 2;
        w16(buf, pos, 0); pos += 2;
        w16(buf, pos, 0); pos += 2;
        w16(buf, pos, 0); pos += 2;
        w32(buf, pos, e.crc); pos += 4;
        w32(buf, pos, e.content.length); pos += 4;
        w32(buf, pos, e.content.length); pos += 4;
        w16(buf, pos, e.path.length); pos += 2;
        w16(buf, pos, 0); pos += 2;
        w16(buf, pos, 0); pos += 2;
        w16(buf, pos, 0); pos += 2;
        w16(buf, pos, 0); pos += 2;
        w32(buf, pos, 0); pos += 4;
        w32(buf, pos, e.offset); pos += 4;
        buf.set(e.path, pos); pos += e.path.length;
    }

    w32(buf, pos, 0x06054b50); pos += 4;
    w16(buf, pos, 0); pos += 2;
    w16(buf, pos, 0); pos += 2;
    w16(buf, pos, entries.length); pos += 2;
    w16(buf, pos, entries.length); pos += 2;
    w32(buf, pos, central); pos += 4;
    w32(buf, pos, centralOffset); pos += 4;
    w16(buf, pos, 0);

    return buf;
}

// ── XML part helpers ───────────────────────────────────────────────────

function workbook(sheets: ReadonlyArray<{ name: string; rId: string }>): string {
    const els = sheets
        .map(s => `<sheet name="${s.name}" sheetId="1" r:id="${s.rId}"/>`)
        .join('');
    return `<?xml version="1.0"?>
<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${els}</sheets></workbook>`;
}

function rels(items: ReadonlyArray<{ id: string; target: string; type: string }>): string {
    const els = items
        .map(r => `<Relationship Id="${r.id}" Type="${r.type}" Target="${r.target}"/>`)
        .join('');
    return `<?xml version="1.0"?><Relationships>${els}</Relationships>`;
}

const WORKSHEET_TYPE =
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet';

function sharedStrings(strings: ReadonlyArray<string>): string {
    const items = strings.map(s => `<si><t>${s}</t></si>`).join('');
    return `<?xml version="1.0"?><sst>${items}</sst>`;
}

function worksheet(inner: string): string {
    return `<?xml version="1.0"?><worksheet><sheetData>${inner}</sheetData>${''}</worksheet>`;
}

function findSheet(result: { sheets: XlsxSheet[] }, name: string): XlsxSheet {
    const sheet = result.sheets.find(s => s.name === name);
    if (!sheet) throw new Error(`sheet ${name} not found`);
    return sheet;
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('parseXlsx — cell types', () => {
    it('resolves shared-string cells via the sharedStrings index', () => {
        const bytes = zip([
            { path: 'xl/workbook.xml', xml: workbook([{ name: 'Data', rId: 'rId1' }]) },
            {
                path: 'xl/_rels/workbook.xml.rels',
                xml: rels([{ id: 'rId1', target: 'worksheets/sheet1.xml', type: WORKSHEET_TYPE }]),
            },
            { path: 'xl/sharedStrings.xml', xml: sharedStrings(['Hello', 'World']) },
            {
                path: 'xl/worksheets/sheet1.xml',
                xml: worksheet(
                    '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>',
                ),
            },
        ]);
        const result = parseXlsx(bytes);
        const sheet = findSheet(result, 'Data');
        expect(sheet.data).toEqual([['Hello', 'World']]);
        expect(sheet.columnCount).toBe(2);
        expect(sheet.rowCount).toBe(1);
    });

    it('falls back to empty string for an out-of-range shared-string index', () => {
        const bytes = zip([
            { path: 'xl/worksheets/sheet1.xml', xml: worksheet('<row r="1"><c r="A1" t="s"><v>99</v></c></row>') },
            { path: 'xl/sharedStrings.xml', xml: sharedStrings(['only']) },
        ]);
        expect(parseXlsx(bytes).sheets[0].data).toEqual([['']]);
    });

    it('parses numeric cells (no type attribute) as raw values', () => {
        const bytes = zip([
            { path: 'xl/worksheets/sheet1.xml', xml: worksheet('<row r="1"><c r="A1"><v>42</v></c><c r="B1"><v>3.14</v></c></row>') },
        ]);
        expect(parseXlsx(bytes).sheets[0].data).toEqual([['42', '3.14']]);
    });

    it('parses boolean cells as TRUE / FALSE', () => {
        const bytes = zip([
            { path: 'xl/worksheets/sheet1.xml', xml: worksheet('<row r="1"><c r="A1" t="b"><v>1</v></c><c r="B1" t="b"><v>0</v></c></row>') },
        ]);
        expect(parseXlsx(bytes).sheets[0].data).toEqual([['TRUE', 'FALSE']]);
    });

    it('parses inline-string cells', () => {
        const bytes = zip([
            { path: 'xl/worksheets/sheet1.xml', xml: worksheet('<row r="1"><c r="A1" t="inlineStr"><is><t>inline text</t></is></c></row>') },
        ]);
        expect(parseXlsx(bytes).sheets[0].data).toEqual([['inline text']]);
    });

    it('returns empty string for an inlineStr cell with no <is>', () => {
        const bytes = zip([
            { path: 'xl/worksheets/sheet1.xml', xml: worksheet('<row r="1"><c r="A1" t="inlineStr"></c></row>') },
        ]);
        expect(parseXlsx(bytes).sheets[0].data).toEqual([['']]);
    });

    it('parses str-typed (formula string result) cells', () => {
        const bytes = zip([
            { path: 'xl/worksheets/sheet1.xml', xml: worksheet('<row r="1"><c r="A1" t="str"><v>computed</v></c></row>') },
        ]);
        expect(parseXlsx(bytes).sheets[0].data).toEqual([['computed']]);
    });

    it('parses error cells, defaulting to #ERROR when value is empty', () => {
        const bytes = zip([
            { path: 'xl/worksheets/sheet1.xml', xml: worksheet('<row r="1"><c r="A1" t="e"><v>#DIV/0!</v></c><c r="B1" t="e"></c></row>') },
        ]);
        expect(parseXlsx(bytes).sheets[0].data).toEqual([['#DIV/0!', '#ERROR']]);
    });

    it('handles untyped formula cells: cached value, then empty', () => {
        const bytes = zip([
            {
                path: 'xl/worksheets/sheet1.xml',
                xml: worksheet(
                    '<row r="1">' +
                        '<c r="A1"><f>1+1</f><v>2</v></c>' +
                        '<c r="B1"><f>NA()</f></c>' +
                        '</row>',
                ),
            },
        ]);
        // A1 has formula + cached value -> "2"; B1 has formula, no value -> "".
        expect(parseXlsx(bytes).sheets[0].data).toEqual([['2', '']]);
    });

    it('falls through to raw value for an unknown cell type', () => {
        const bytes = zip([
            { path: 'xl/worksheets/sheet1.xml', xml: worksheet('<row r="1"><c r="A1" t="d"><v>2020-01-01</v></c></row>') },
        ]);
        expect(parseXlsx(bytes).sheets[0].data).toEqual([['2020-01-01']]);
    });
});

describe('parseXlsx — structure', () => {
    it('places cells by their column reference, padding gaps with empty strings', () => {
        const bytes = zip([
            { path: 'xl/worksheets/sheet1.xml', xml: worksheet('<row r="1"><c r="A1"><v>1</v></c><c r="C1"><v>3</v></c></row>') },
        ]);
        const sheet = parseXlsx(bytes).sheets[0];
        // B1 missing -> filled with ''.
        expect(sheet.data).toEqual([['1', '', '3']]);
        expect(sheet.columnCount).toBe(3);
    });

    it('places rows by their r index, leaving gaps as empty arrays', () => {
        const bytes = zip([
            { path: 'xl/worksheets/sheet1.xml', xml: worksheet('<row r="1"><c r="A1"><v>top</v></c></row><row r="3"><c r="A3"><v>bottom</v></c></row>') },
        ]);
        const sheet = parseXlsx(bytes).sheets[0];
        expect(sheet.data).toEqual([['top'], [], ['bottom']]);
        expect(sheet.rowCount).toBe(3);
    });

    it('skips cells without an r reference', () => {
        const bytes = zip([
            { path: 'xl/worksheets/sheet1.xml', xml: worksheet('<row r="1"><c><v>orphan</v></c><c r="A1"><v>kept</v></c></row>') },
        ]);
        expect(parseXlsx(bytes).sheets[0].data).toEqual([['kept']]);
    });

    it('parses merged cell ranges', () => {
        const bytes = zip([
            {
                path: 'xl/worksheets/sheet1.xml',
                xml: '<?xml version="1.0"?><worksheet><sheetData><row r="1"><c r="A1"><v>m</v></c></row></sheetData>' +
                    '<mergeCells count="2"><mergeCell ref="A1:B2"/><mergeCell ref="C1:D1"/><mergeCell/></mergeCells></worksheet>',
            },
        ]);
        const sheet = parseXlsx(bytes).sheets[0];
        // The <mergeCell> without a ref must be ignored.
        expect(sheet.mergedCells).toEqual([{ ref: 'A1:B2' }, { ref: 'C1:D1' }]);
    });

    it('parses multiple sheets, mapping each to its name and worksheet part', () => {
        const bytes = zip([
            {
                path: 'xl/workbook.xml',
                xml: workbook([
                    { name: 'Alpha', rId: 'rId1' },
                    { name: 'Beta', rId: 'rId2' },
                ]),
            },
            {
                path: 'xl/_rels/workbook.xml.rels',
                xml: rels([
                    { id: 'rId1', target: 'worksheets/sheet1.xml', type: WORKSHEET_TYPE },
                    { id: 'rId2', target: 'worksheets/sheet2.xml', type: WORKSHEET_TYPE },
                ]),
            },
            { path: 'xl/worksheets/sheet1.xml', xml: worksheet('<row r="1"><c r="A1"><v>a1</v></c></row>') },
            { path: 'xl/worksheets/sheet2.xml', xml: worksheet('<row r="1"><c r="A1"><v>b1</v></c></row>') },
        ]);
        const result = parseXlsx(bytes);
        expect(result.sheets.map(s => s.name)).toEqual(['Alpha', 'Beta']);
        expect(findSheet(result, 'Alpha').data).toEqual([['a1']]);
        expect(findSheet(result, 'Beta').data).toEqual([['b1']]);
    });

    it('resolves a sheet relationship with an absolute (/-prefixed) target', () => {
        const bytes = zip([
            { path: 'xl/workbook.xml', xml: workbook([{ name: 'Abs', rId: 'rId7' }]) },
            {
                path: 'xl/_rels/workbook.xml.rels',
                xml: rels([{ id: 'rId7', target: '/xl/worksheets/data.xml', type: WORKSHEET_TYPE }]),
            },
            { path: 'xl/worksheets/data.xml', xml: worksheet('<row r="1"><c r="A1"><v>abs</v></c></row>') },
        ]);
        expect(findSheet(parseXlsx(bytes), 'Abs').data).toEqual([['abs']]);
    });
});

describe('parseXlsx — fallbacks and limits', () => {
    it('defaults to a single Sheet1 when workbook.xml is absent', () => {
        const bytes = zip([
            { path: 'xl/worksheets/sheet1.xml', xml: worksheet('<row r="1"><c r="A1"><v>x</v></c></row>') },
        ]);
        const result = parseXlsx(bytes);
        expect(result.sheets).toHaveLength(1);
        expect(result.sheets[0].name).toBe('Sheet1');
        expect(result.sheets[0].data).toEqual([['x']]);
    });

    it('discovers worksheet parts by scanning when relationships are missing', () => {
        // workbook lists two sheets but there are no rels -> direct-path lookup
        // (sheet1/sheet2) is used.
        const bytes = zip([
            {
                path: 'xl/workbook.xml',
                xml: workbook([
                    { name: 'One', rId: 'rId1' },
                    { name: 'Two', rId: 'rId2' },
                ]),
            },
            { path: 'xl/worksheets/sheet1.xml', xml: worksheet('<row r="1"><c r="A1"><v>one</v></c></row>') },
            { path: 'xl/worksheets/sheet2.xml', xml: worksheet('<row r="1"><c r="A1"><v>two</v></c></row>') },
        ]);
        const result = parseXlsx(bytes);
        expect(findSheet(result, 'One').data).toEqual([['one']]);
        expect(findSheet(result, 'Two').data).toEqual([['two']]);
    });

    it('scans for worksheet parts when no sheet matches by rId or direct path', () => {
        // workbook references rId1 but rels point elsewhere and the direct
        // path sheet1.xml does not exist -> the final scan branch fires.
        const bytes = zip([
            { path: 'xl/workbook.xml', xml: workbook([{ name: 'Scan', rId: 'rId1' }]) },
            {
                path: 'xl/_rels/workbook.xml.rels',
                xml: rels([{ id: 'rId99', target: 'worksheets/nope.xml', type: WORKSHEET_TYPE }]),
            },
            { path: 'xl/worksheets/sheetX.xml', xml: worksheet('<row r="1"><c r="A1"><v>scanned</v></c></row>') },
        ]);
        const result = parseXlsx(bytes);
        expect(result.sheets[0].data).toEqual([['scanned']]);
    });

    it('names a sheet by its index when the name attribute is absent', () => {
        const bytes = zip([
            {
                path: 'xl/workbook.xml',
                xml: '<?xml version="1.0"?><workbook><sheets><sheet sheetId="1"/></sheets></workbook>',
            },
            { path: 'xl/worksheets/sheet1.xml', xml: worksheet('<row r="1"><c r="A1"><v>v</v></c></row>') },
        ]);
        const result = parseXlsx(bytes);
        expect(result.sheets[0].name).toBe('Sheet1');
        expect(result.sheets[0].data).toEqual([['v']]);
    });

    it('honors maxColumns by dropping out-of-range columns', () => {
        const bytes = zip([
            { path: 'xl/worksheets/sheet1.xml', xml: worksheet('<row r="1"><c r="A1"><v>a</v></c><c r="B1"><v>b</v></c><c r="C1"><v>c</v></c></row>') },
        ]);
        const sheet = parseXlsx(bytes, { maxColumns: 2 }).sheets[0];
        expect(sheet.data).toEqual([['a', 'b']]);
        expect(sheet.columnCount).toBe(2);
    });

    it('honors maxRows and flags truncation when the row count hits the limit', () => {
        const bytes = zip([
            { path: 'xl/worksheets/sheet1.xml', xml: worksheet('<row r="1"><c r="A1"><v>1</v></c></row><row r="2"><c r="A2"><v>2</v></c></row><row r="3"><c r="A3"><v>3</v></c></row>') },
        ]);
        const result = parseXlsx(bytes, { maxRows: 2 });
        expect(result.sheets[0].rowCount).toBe(2);
        expect(result.sheets[0].data).toEqual([['1'], ['2']]);
        expect(result.truncated).toBe(true);
    });

    it('parses multi-letter column references (AA) to the correct index', () => {
        // 26 single-letter cols A..Z then AA = index 26 (27th column).
        const bytes = zip([
            { path: 'xl/worksheets/sheet1.xml', xml: worksheet('<row r="1"><c r="A1"><v>first</v></c><c r="AA1"><v>last</v></c></row>') },
        ]);
        const sheet = parseXlsx(bytes).sheets[0];
        expect(sheet.data[0]).toHaveLength(27);
        expect(sheet.data[0][0]).toBe('first');
        expect(sheet.data[0][26]).toBe('last');
    });

    it('concatenates rich-text runs in a shared string', () => {
        const bytes = zip([
            { path: 'xl/sharedStrings.xml', xml: '<?xml version="1.0"?><sst><si><r><t>Hello </t></r><r><t>World</t></r></si></sst>' },
            { path: 'xl/worksheets/sheet1.xml', xml: worksheet('<row r="1"><c r="A1" t="s"><v>0</v></c></row>') },
        ]);
        expect(parseXlsx(bytes).sheets[0].data).toEqual([['Hello World']]);
    });
});
