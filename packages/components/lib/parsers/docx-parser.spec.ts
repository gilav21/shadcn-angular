import { describe, expect, it } from 'vitest';
import { parseDocx } from './docx-parser';
import type { DocxParagraph, DocxTable, DocxImage } from './docx-parser';

// --- STORED ZIP builder (no compression) with correct CRC32 ---

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[i] = c;
    }
    return table;
})();

function crc32(data: Uint8Array): number {
    let crc = 0xffffffff;
    for (const byte of data) {
        crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function u16(n: number): number[] {
    return [n & 0xff, (n >>> 8) & 0xff];
}

function u32(n: number): number[] {
    return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
}

interface ZipFile {
    readonly name: string;
    readonly data: Uint8Array;
}

function makeZip(files: ReadonlyArray<{ name: string; content: string | Uint8Array }>): Uint8Array {
    const enc = new TextEncoder();
    const entries: ZipFile[] = files.map(f => ({
        name: f.name,
        data: typeof f.content === 'string' ? enc.encode(f.content) : f.content,
    }));

    const localChunks: number[] = [];
    const central: number[] = [];
    const offsets: number[] = [];
    let offset = 0;

    for (const entry of entries) {
        const nameBytes = enc.encode(entry.name);
        const crc = crc32(entry.data);
        offsets.push(offset);

        const local = [
            ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0),
            ...u16(0), ...u16(0),
            ...u32(crc), ...u32(entry.data.length), ...u32(entry.data.length),
            ...u16(nameBytes.length), ...u16(0),
            ...nameBytes, ...entry.data,
        ];
        localChunks.push(...local);
        offset += local.length;
    }

    const centralStart = offset;
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const nameBytes = enc.encode(entry.name);
        const crc = crc32(entry.data);
        central.push(
            ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0),
            ...u16(0), ...u16(0),
            ...u32(crc), ...u32(entry.data.length), ...u32(entry.data.length),
            ...u16(nameBytes.length), ...u16(0), ...u16(0),
            ...u16(0), ...u16(0), ...u32(0),
            ...u32(offsets[i]),
            ...nameBytes,
        );
    }

    const eocd = [
        ...u32(0x06054b50), ...u16(0), ...u16(0),
        ...u16(entries.length), ...u16(entries.length),
        ...u32(central.length), ...u32(centralStart), ...u16(0),
    ];

    return new Uint8Array([...localChunks, ...central, ...eocd]);
}

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const R = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

function wDocument(bodyInner: string): string {
    return `<?xml version="1.0"?><w:document ${W} ${R}><w:body>${bodyInner}</w:body></w:document>`;
}

/** Build a docx from a document.xml body plus optional extra parts. */
function docx(bodyInner: string, extra: Array<{ name: string; content: string | Uint8Array }> = []): Uint8Array {
    return makeZip([
        { name: 'word/document.xml', content: wDocument(bodyInner) },
        ...extra,
    ]);
}

function paragraphs(result: { elements: ReadonlyArray<DocxParagraph | DocxTable | DocxImage> }): DocxParagraph[] {
    return result.elements.filter((e): e is DocxParagraph => e.type === 'paragraph');
}

// --- Tests ---

describe('parseDocx — structure & errors', () => {
    it('throws when document.xml is missing', () => {
        const zip = makeZip([{ name: 'word/other.xml', content: '<x/>' }]);
        expect(() => parseDocx(zip)).toThrow(/missing word\/document.xml/);
    });

    it('throws when the body element is missing', () => {
        const zip = makeZip([{ name: 'word/document.xml', content: `<?xml version="1.0"?><w:document ${W}></w:document>` }]);
        expect(() => parseDocx(zip)).toThrow(/missing document body/);
    });

    it('parses a single paragraph and exposes plainText', () => {
        const res = parseDocx(docx('<w:p><w:r><w:t>Hello World</w:t></w:r></w:p>'));
        const ps = paragraphs(res);
        expect(ps).toHaveLength(1);
        expect(ps[0].runs[0].text).toBe('Hello World');
        expect(res.plainText).toBe('Hello World');
        expect(res.footnotes).toEqual([]);
        expect(res.comments).toEqual([]);
    });
});

describe('parseDocx — run formatting', () => {
    it('parses bold, italic, underline, strike, double-strike, caps, smallCaps, vanish', () => {
        const rpr = '<w:rPr><w:b/><w:i/><w:u w:val="single"/><w:strike/><w:dstrike/><w:caps/><w:smallCaps/><w:vanish/></w:rPr>';
        const res = parseDocx(docx(`<w:p><w:r>${rpr}<w:t>fmt</w:t></w:r></w:p>`));
        const s = paragraphs(res)[0].runs[0].style;
        expect(s.bold).toBe(true);
        expect(s.italic).toBe(true);
        expect(s.underline).toBe(true);
        expect(s.strikethrough).toBe(true);
        expect(s.doubleStrikethrough).toBe(true);
        expect(s.caps).toBe(true);
        expect(s.smallCaps).toBe(true);
        expect(s.hidden).toBe(true);
    });

    it('treats b val="0" as not bold and i val="0" as not italic', () => {
        const res = parseDocx(docx('<w:p><w:r><w:rPr><w:b w:val="0"/><w:i w:val="0"/></w:rPr><w:t>x</w:t></w:r></w:p>'));
        const s = paragraphs(res)[0].runs[0].style;
        expect(s.bold).toBe(false);
        expect(s.italic).toBe(false);
    });

    it('parses font size (half-points), color, and font family', () => {
        const rpr = '<w:rPr><w:sz w:val="28"/><w:color w:val="FF0000"/><w:rFonts w:ascii="Calibri"/></w:rPr>';
        const res = parseDocx(docx(`<w:p><w:r>${rpr}<w:t>x</w:t></w:r></w:p>`));
        const s = paragraphs(res)[0].runs[0].style;
        expect(s.fontSize).toBe(14);
        expect(s.color).toBe('#FF0000');
        expect(s.fontFamily).toBe('Calibri');
    });

    it('ignores color val="auto"', () => {
        const res = parseDocx(docx('<w:p><w:r><w:rPr><w:color w:val="auto"/></w:rPr><w:t>x</w:t></w:r></w:p>'));
        expect(paragraphs(res)[0].runs[0].style.color).toBeUndefined();
    });

    it('parses highlight by name and by hex, and shading background', () => {
        const named = parseDocx(docx('<w:p><w:r><w:rPr><w:highlight w:val="yellow"/></w:rPr><w:t>x</w:t></w:r></w:p>'));
        expect(paragraphs(named)[0].runs[0].style.highlight).toBe('#FFFF00');
        const hex = parseDocx(docx('<w:p><w:r><w:rPr><w:highlight w:val="ABCDEF"/></w:rPr><w:t>x</w:t></w:r></w:p>'));
        expect(paragraphs(hex)[0].runs[0].style.highlight).toBe('#ABCDEF');
        const shd = parseDocx(docx('<w:p><w:r><w:rPr><w:shd w:fill="00FF00"/></w:rPr><w:t>x</w:t></w:r></w:p>'));
        expect(paragraphs(shd)[0].runs[0].style.backgroundColor).toBe('#00FF00');
    });

    it('parses vertAlign superscript/subscript, rtl, and char spacing', () => {
        const sup = parseDocx(docx('<w:p><w:r><w:rPr><w:vertAlign w:val="superscript"/></w:rPr><w:t>x</w:t></w:r></w:p>'));
        expect(paragraphs(sup)[0].runs[0].style.vertAlign).toBe('superscript');
        const rtl = parseDocx(docx('<w:p><w:r><w:rPr><w:rtl/><w:spacing w:val="40"/></w:rPr><w:t>x</w:t></w:r></w:p>'));
        const s = paragraphs(rtl)[0].runs[0].style;
        expect(s.rtl).toBe(true);
        expect(s.charSpacing).toBe(2);
    });

    it('parses special run children: tab, breaks, symbol, hyphens', () => {
        const body = '<w:p><w:r><w:tab/><w:noBreakHyphen/><w:softHyphen/>'
            + '<w:br w:type="page"/><w:br/><w:sym w:font="Wingdings" w:char="0041"/></w:r></w:p>';
        const runs = paragraphs(parseDocx(docx(body)))[0].runs;
        const texts = runs.map(r => r.text);
        expect(texts).toContain('\t');
        expect(texts).toContain('‑');
        expect(texts).toContain('­');
        const pageBreak = runs.find(r => r.breakType === 'page');
        expect(pageBreak).toBeDefined();
        const sym = runs.find(r => r.text === 'A');
        expect(sym?.style.fontFamily).toBe('Wingdings');
    });
});

describe('parseDocx — paragraph properties', () => {
    it('parses style id, alignment, bidi, spacing, line spacing, indents', () => {
        const ppr = '<w:pPr><w:pStyle w:val="MyStyle"/><w:jc w:val="center"/><w:bidi/>'
            + '<w:spacing w:before="240" w:after="120" w:line="360" w:lineRule="auto"/>'
            + '<w:ind w:left="720" w:right="360" w:hanging="180" w:firstLine="90"/></w:pPr>';
        const p = paragraphs(parseDocx(docx(`<w:p>${ppr}<w:r><w:t>x</w:t></w:r></w:p>`)))[0];
        expect(p.style).toBe('MyStyle');
        expect(p.alignment).toBe('center');
        expect(p.rtl).toBe(true);
        expect(p.spacingBefore).toBe(12);
        expect(p.spacingAfter).toBe(6);
        expect(p.lineSpacing).toBeCloseTo(1.5);
        expect(p.indentLeft).toBe(36);
        expect(p.indentRight).toBe(18);
        expect(p.indentHanging).toBe(9);
        expect(p.indentFirstLine).toBe(4.5);
    });

    it('parses exact line spacing as points', () => {
        const ppr = '<w:pPr><w:spacing w:line="480" w:lineRule="exact"/></w:pPr>';
        const p = paragraphs(parseDocx(docx(`<w:p>${ppr}<w:r><w:t>x</w:t></w:r></w:p>`)))[0];
        expect(p.lineSpacing).toBe(24);
    });

    it('parses paragraph shading and borders', () => {
        const ppr = '<w:pPr><w:shd w:fill="EEEEEE"/><w:pBdr>'
            + '<w:top w:val="single" w:color="123456" w:sz="16"/>'
            + '<w:bottom w:val="dashed"/></w:pBdr></w:pPr>';
        const p = paragraphs(parseDocx(docx(`<w:p>${ppr}<w:r><w:t>x</w:t></w:r></w:p>`)))[0];
        expect(p.shading).toBe('#EEEEEE');
        expect(p.borders?.top).toEqual({ style: 'single', color: '#123456', size: 2 });
        expect(p.borders?.bottom).toEqual({ style: 'dashed', color: '#000000', size: 1 });
    });
});

describe('parseDocx — lists & numbering', () => {
    const numbering = {
        name: 'word/numbering.xml',
        content: `<?xml version="1.0"?><w:numbering ${W}>`
            + '<w:abstractNum w:abstractNumId="0">'
            + '<w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/></w:lvl>'
            + '<w:lvl w:ilvl="1"><w:numFmt w:val="decimal"/></w:lvl>'
            + '</w:abstractNum>'
            + '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>'
            + '</w:numbering>',
    };

    it('resolves bullet vs numbered list type from numbering.xml', () => {
        const body = '<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>a</w:t></w:r></w:p>'
            + '<w:p><w:pPr><w:numPr><w:ilvl w:val="1"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>b</w:t></w:r></w:p>';
        const ps = paragraphs(parseDocx(docx(body, [numbering])));
        expect(ps[0].listType).toBe('bullet');
        expect(ps[0].listLevel).toBe(0);
        expect(ps[1].listType).toBe('numbered');
        expect(ps[1].listLevel).toBe(1);
    });

    it('numId=0 is treated as no list', () => {
        const body = '<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="0"/></w:numPr></w:pPr><w:r><w:t>a</w:t></w:r></w:p>';
        expect(paragraphs(parseDocx(docx(body, [numbering])))[0].listType).toBeUndefined();
    });

    it('falls back to bullet when numbering def is absent', () => {
        const body = '<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="9"/></w:numPr></w:pPr><w:r><w:t>a</w:t></w:r></w:p>';
        expect(paragraphs(parseDocx(docx(body, [numbering])))[0].listType).toBe('bullet');
    });
});

describe('parseDocx — hyperlinks, fields, bookmarks, track changes', () => {
    const rels = {
        name: 'word/_rels/document.xml.rels',
        content: '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            + '<Relationship Id="rId1" Type="x" Target="https://example.com/"/></Relationships>',
    };

    it('parses an external hyperlink applying underline and default color', () => {
        const body = '<w:p><w:hyperlink r:id="rId1"><w:r><w:t>click</w:t></w:r></w:hyperlink></w:p>';
        const runs = paragraphs(parseDocx(docx(body, [rels])))[0].runs;
        expect(runs[0].href).toBe('https://example.com/');
        expect(runs[0].style.underline).toBe(true);
        expect(runs[0].style.color).toBe('#0563C1');
    });

    it('parses an internal anchor hyperlink to a bookmark href', () => {
        const body = '<w:p><w:hyperlink w:anchor="sec1"><w:r><w:t>go</w:t></w:r></w:hyperlink></w:p>';
        expect(paragraphs(parseDocx(docx(body)))[0].runs[0].href).toBe('#bookmark-sec1');
    });

    it('parses bookmarkStart into an anchor run and ignores _GoBack', () => {
        const body = '<w:p><w:bookmarkStart w:name="here"/><w:bookmarkStart w:name="_GoBack"/><w:r><w:t>t</w:t></w:r></w:p>';
        const runs = paragraphs(parseDocx(docx(body)))[0].runs;
        expect(runs.some(r => r.anchorId === 'bookmark-here')).toBe(true);
        expect(runs.some(r => r.anchorId === 'bookmark-_GoBack')).toBe(false);
    });

    it('marks ins/del runs as inserted/deleted', () => {
        const body = '<w:p><w:ins><w:r><w:t>new</w:t></w:r></w:ins><w:del><w:r><w:delText>old</w:delText></w:r></w:del></w:p>';
        const runs = paragraphs(parseDocx(docx(body)))[0].runs;
        expect(runs.find(r => r.text === 'new')?.isInserted).toBe(true);
        expect(runs.find(r => r.text === 'old')?.isDeleted).toBe(true);
    });

    it('suppresses field instruction text between fldChar begin and separate', () => {
        const body = '<w:p>'
            + '<w:r><w:fldChar w:fldCharType="begin"/></w:r>'
            + '<w:r><w:instrText>PAGE</w:instrText></w:r>'
            + '<w:r><w:fldChar w:fldCharType="separate"/></w:r>'
            + '<w:r><w:t>5</w:t></w:r>'
            + '<w:r><w:fldChar w:fldCharType="end"/></w:r>'
            + '</w:p>';
        const runs = paragraphs(parseDocx(docx(body)))[0].runs;
        const texts = runs.map(r => r.text);
        expect(texts).toContain('5');
        expect(texts).not.toContain('PAGE');
    });

    it('unwraps sdt and fldSimple content', () => {
        const body = '<w:p><w:sdt><w:sdtContent><w:r><w:t>sdt</w:t></w:r></w:sdtContent></w:sdt>'
            + '<w:fldSimple w:instr="DATE"><w:r><w:t>2024</w:t></w:r></w:fldSimple></w:p>';
        const texts = paragraphs(parseDocx(docx(body)))[0].runs.map(r => r.text);
        expect(texts).toContain('sdt');
        expect(texts).toContain('2024');
    });
});

describe('parseDocx — notes & comments', () => {
    it('parses footnote references and footnotes.xml content', () => {
        const footnotes = {
            name: 'word/footnotes.xml',
            content: `<?xml version="1.0"?><w:footnotes ${W}>`
                + '<w:footnote w:id="-1" w:type="separator"><w:p/></w:footnote>'
                + '<w:footnote w:id="1"><w:p><w:r><w:t>note body</w:t></w:r></w:p></w:footnote>'
                + '</w:footnotes>',
        };
        const body = '<w:p><w:r><w:footnoteReference w:id="1"/></w:r></w:p>';
        const res = parseDocx(docx(body, [footnotes]));
        expect(res.footnotes).toHaveLength(1);
        expect(res.footnotes[0].id).toBe('1');
        expect(res.footnotes[0].paragraphs[0].runs[0].text).toBe('note body');
        const marker = paragraphs(res)[0].runs.find(r => r.text === '[1]');
        expect(marker?.style.vertAlign).toBe('superscript');
    });

    it('parses endnote references with brace markers', () => {
        const endnotes = {
            name: 'word/endnotes.xml',
            content: `<?xml version="1.0"?><w:endnotes ${W}>`
                + '<w:endnote w:id="2"><w:p><w:r><w:t>end body</w:t></w:r></w:p></w:endnote>'
                + '</w:endnotes>',
        };
        const body = '<w:p><w:r><w:endnoteReference w:id="2"/></w:r></w:p>';
        const res = parseDocx(docx(body, [endnotes]));
        expect(res.endnotes[0].paragraphs[0].runs[0].text).toBe('end body');
        expect(paragraphs(res)[0].runs.some(r => r.text === '{2}')).toBe(true);
    });

    it('parses comments.xml with author/date and a reference marker', () => {
        const comments = {
            name: 'word/comments.xml',
            content: `<?xml version="1.0"?><w:comments ${W}>`
                + '<w:comment w:id="0" w:author="Alice" w:date="2024-01-01"><w:p><w:r><w:t>nice</w:t></w:r></w:p></w:comment>'
                + '</w:comments>',
        };
        const body = '<w:p><w:r><w:commentReference w:id="0"/></w:r></w:p>';
        const res = parseDocx(docx(body, [comments]));
        expect(res.comments[0]).toMatchObject({ id: '0', author: 'Alice', date: '2024-01-01' });
        expect(res.comments[0].paragraphs[0].runs[0].text).toBe('nice');
        expect(paragraphs(res)[0].runs.some(r => r.text === '*0')).toBe(true);
    });
});

describe('parseDocx — tables', () => {
    it('parses a 2x2 grid with cell text and tab-joined plainText', () => {
        const td = (t: string) => `<w:tc><w:p><w:r><w:t>${t}</w:t></w:r></w:p></w:tc>`;
        const body = `<w:tbl><w:tr>${td('A')}${td('B')}</w:tr><w:tr>${td('C')}${td('D')}</w:tr></w:tbl>`;
        const res = parseDocx(docx(body));
        const table = res.elements.find((e): e is DocxTable => e.type === 'table')!;
        expect(table.rows).toHaveLength(2);
        expect(table.rows[0].cells).toHaveLength(2);
        const cellPara = table.rows[0].cells[0].elements[0] as DocxParagraph;
        expect(cellPara.runs[0].text).toBe('A');
        expect(res.plainText).toBe('A\tB\nC\tD');
    });

    it('parses table style (width, borders), cell style, gridSpan, header rows', () => {
        const tblPr = '<w:tblPr><w:tblW w:w="5000" w:type="pct"/>'
            + '<w:tblBorders><w:top w:val="single" w:sz="8" w:color="111111"/><w:insideH w:val="single"/></w:tblBorders></w:tblPr>';
        const tcPr = '<w:tcPr><w:gridSpan w:val="2"/><w:shd w:fill="DDDDDD"/><w:vAlign w:val="center"/>'
            + '<w:tcW w:w="2500" w:type="dxa"/>'
            + '<w:tcBorders><w:left w:val="single" w:color="222222" w:sz="4"/></w:tcBorders>'
            + '<w:tcMar><w:top w:w="100"/><w:start w:w="80"/></w:tcMar></w:tcPr>';
        const body = `<w:tbl>${tblPr}<w:tr><w:trPr><w:trHeight w:val="400"/><w:tblHeader/></w:trPr>`
            + `<w:tc>${tcPr}<w:p><w:r><w:t>H</w:t></w:r></w:p></w:tc></w:tr></w:tbl>`;
        const table = parseDocx(docx(body)).elements.find((e): e is DocxTable => e.type === 'table')!;
        expect(table.tableStyle?.width).toBe(5000);
        expect(table.tableStyle?.widthUnit).toBe('pct');
        expect(table.tableStyle?.borders?.top).toEqual({ style: 'single', color: '#111111', size: 1 });
        const cell = table.rows[0].cells[0];
        expect(cell.colSpan).toBe(2);
        expect(cell.cellStyle?.backgroundColor).toBe('#DDDDDD');
        expect(cell.cellStyle?.verticalAlign).toBe('center');
        expect(cell.cellStyle?.borders?.left?.color).toBe('#222222');
        expect(cell.cellStyle?.paddings?.top).toBe(5);
        expect(cell.cellStyle?.paddings?.left).toBe(4);
        expect(table.rows[0].rowStyle).toMatchObject({ height: 20, isHeader: true });
    });

    it('computes rowSpan from vMerge restart/continue', () => {
        const tc = (inner: string, body: string) => `<w:tc>${inner}<w:p><w:r><w:t>${body}</w:t></w:r></w:p></w:tc>`;
        const restart = '<w:tcPr><w:vMerge w:val="restart"/></w:tcPr>';
        const cont = '<w:tcPr><w:vMerge/></w:tcPr>';
        const body = '<w:tbl>'
            + `<w:tr>${tc(restart, 'M')}</w:tr>`
            + `<w:tr>${tc(cont, '')}</w:tr>`
            + '</w:tbl>';
        const table = parseDocx(docx(body)).elements.find((e): e is DocxTable => e.type === 'table')!;
        expect(table.rows[0].cells[0].rowSpan).toBe(2);
        expect(table.rows[1].cells[0].rowSpan).toBe(0);
    });
});

describe('parseDocx — images & theme colors', () => {
    function pngBytes(): Uint8Array {
        const png = new Uint8Array(20);
        const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
        for (let i = 0; i < sig.length; i++) png[i] = sig[i];
        return png;
    }

    it('extracts an embedded image with computed pixel size from EMU', () => {
        const rels = {
            name: 'word/_rels/document.xml.rels',
            content: '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                + '<Relationship Id="rIdImg" Type="x" Target="media/pic.png"/></Relationships>',
        };
        const drawing = '<w:drawing>'
            + '<wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">'
            + '<wp:extent cx="952500" cy="476250"/></wp:inline>'
            + '<a:blip xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
            + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rIdImg"/>'
            + '</w:drawing>';
        const body = `<w:p><w:r>${drawing}</w:r></w:p>`;
        const res = parseDocx(docx(body, [rels, { name: 'word/media/pic.png', content: pngBytes() }]));
        const img = res.elements.find((e): e is DocxImage => e.type === 'image')!;
        expect(img.type).toBe('image');
        expect(img.width).toBe(100);
        expect(img.height).toBe(50);
        expect(img.dataUrl.startsWith('data:image/png;base64,')).toBe(true);
    });

    it('resolves theme colors from sysClr lastClr and applies tint', () => {
        const theme = {
            name: 'word/theme/theme1.xml',
            content: '<?xml version="1.0"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
                + '<a:themeElements><a:clrScheme name="x">'
                + '<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>'
                + '</a:clrScheme></a:themeElements></a:theme>',
        };
        const body = '<w:p><w:r><w:rPr><w:color w:themeColor="tx1" w:themeTint="80"/></w:rPr><w:t>x</w:t></w:r></w:p>';
        const res = parseDocx(docx(body, [theme]));
        expect(paragraphs(res)[0].runs[0].style.color).toBe('#808080');
    });

    it('resolves theme colors for run color via themeColor', () => {
        const theme = {
            name: 'word/theme/theme1.xml',
            content: '<?xml version="1.0"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
                + '<a:themeElements><a:clrScheme name="x">'
                + '<a:dk1><a:srgbClr val="1A2B3C"/></a:dk1>'
                + '<a:accent1><a:srgbClr val="FF0000"/></a:accent1>'
                + '</a:clrScheme></a:themeElements></a:theme>',
        };
        const body = '<w:p><w:r><w:rPr><w:color w:themeColor="accent1"/></w:rPr><w:t>x</w:t></w:r></w:p>';
        const res = parseDocx(docx(body, [theme]));
        expect(paragraphs(res)[0].runs[0].style.color).toBe('#FF0000');
    });
});

describe('parseDocx — styles, inheritance, headers/footers', () => {
    it('applies run + paragraph properties from a referenced style', () => {
        const styles = {
            name: 'word/styles.xml',
            content: `<?xml version="1.0"?><w:styles ${W}>`
                + '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times"/></w:rPr></w:rPrDefault></w:docDefaults>'
                + '<w:style w:styleId="Base"><w:rPr><w:b/></w:rPr><w:pPr><w:jc w:val="right"/></w:pPr></w:style>'
                + '<w:style w:styleId="Derived"><w:basedOn w:val="Base"/><w:rPr><w:color w:val="0000FF"/></w:rPr>'
                + '<w:pPr><w:ind w:left="240"/></w:pPr></w:style>'
                + '</w:styles>',
        };
        const body = '<w:p><w:pPr><w:pStyle w:val="Derived"/></w:pPr><w:r><w:t>styled</w:t></w:r></w:p>';
        const p = paragraphs(parseDocx(docx(body, [styles])))[0];
        expect(p.alignment).toBe('right');
        expect(p.indentLeft).toBe(12);
        const s = p.runs[0].style;
        expect(s.bold).toBe(true);
        expect(s.color).toBe('#0000FF');
        expect(s.fontFamily).toBe('Times');
    });

    it('inherits paragraph spacing and right-indent from a style and applies style inside table cells', () => {
        const styles = {
            name: 'word/styles.xml',
            content: `<?xml version="1.0"?><w:styles ${W}>`
                + '<w:style w:styleId="Sp"><w:rPr><w:i/></w:rPr>'
                + '<w:pPr><w:spacing w:before="200" w:after="100"/><w:ind w:right="120"/></w:pPr></w:style>'
                + '</w:styles>',
        };
        const cellP = '<w:p><w:pPr><w:pStyle w:val="Sp"/></w:pPr><w:r><w:t>c</w:t></w:r></w:p>';
        const body = `<w:tbl><w:tr><w:tc>${cellP}</w:tc></w:tr></w:tbl>`;
        const table = parseDocx(docx(body, [styles])).elements.find((e): e is DocxTable => e.type === 'table')!;
        const p = table.rows[0].cells[0].elements[0] as DocxParagraph;
        expect(p.spacingBefore).toBe(10);
        expect(p.spacingAfter).toBe(5);
        expect(p.indentRight).toBe(6);
        expect(p.runs[0].style.italic).toBe(true);
    });

    it('applies style inheritance recursively into nested tables', () => {
        const styles = {
            name: 'word/styles.xml',
            content: `<?xml version="1.0"?><w:styles ${W}>`
                + '<w:style w:styleId="B"><w:rPr><w:b/></w:rPr></w:style></w:styles>',
        };
        const innerP = '<w:p><w:pPr><w:pStyle w:val="B"/></w:pPr><w:r><w:t>deep</w:t></w:r></w:p>';
        const innerTbl = `<w:tbl><w:tr><w:tc>${innerP}</w:tc></w:tr></w:tbl>`;
        const body = `<w:tbl><w:tr><w:tc>${innerTbl}</w:tc></w:tr></w:tbl>`;
        const outer = parseDocx(docx(body, [styles])).elements.find((e): e is DocxTable => e.type === 'table')!;
        const inner = outer.rows[0].cells[0].elements[0] as DocxTable;
        const p = inner.rows[0].cells[0].elements[0] as DocxParagraph;
        expect(p.runs[0].text).toBe('deep');
        expect(p.runs[0].style.bold).toBe(true);
    });

    it('parses headers and footers from relationships', () => {
        const rels = {
            name: 'word/_rels/document.xml.rels',
            content: '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                + '<Relationship Id="rIdH" Type="x" Target="header1.xml"/>'
                + '<Relationship Id="rIdF" Type="x" Target="footer1.xml"/></Relationships>',
        };
        const header = {
            name: 'word/header1.xml',
            content: `<?xml version="1.0"?><w:hdr ${W}><w:p><w:r><w:t>HEADER</w:t></w:r></w:p></w:hdr>`,
        };
        const footer = {
            name: 'word/footer1.xml',
            content: `<?xml version="1.0"?><w:ftr ${W}><w:p><w:r><w:t>FOOTER</w:t></w:r></w:p></w:ftr>`,
        };
        const res = parseDocx(docx('<w:p><w:r><w:t>body</w:t></w:r></w:p>', [rels, header, footer]));
        expect(res.headers).toHaveLength(1);
        expect((res.headers[0][0] as DocxParagraph).runs[0].text).toBe('HEADER');
        expect((res.footers[0][0] as DocxParagraph).runs[0].text).toBe('FOOTER');
    });
});
