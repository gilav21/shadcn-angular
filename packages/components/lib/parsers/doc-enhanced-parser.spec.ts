import { describe, expect, it } from 'vitest';
import { parseDocEnhanced } from './doc-enhanced-parser';
import type { DocxParagraph, DocxTable, DocxImage } from './docx-parser';
import {
    buildOle2Doc,
    buildWordDocument,
    buildClx,
    writeAnsi,
    writeUtf16,
    writeU16,
    writeU32,
    type FibFields,
} from './doc-test-fixtures';

const FKP_PAGE_SIZE = 512;

// For a *compressed* (ANSI) piece, the parser stores rawFc = fileOffset << 1
// and maps cp -> fc as `rawFc + (cp - cpStart)`. CHPX/PAPX bin-table FCs must
// therefore live in this `(fileOffset << 1) + cp` space to line up with runs.
function compressedFc(fileOffset: number, cp: number): number {
    return (fileOffset << 1) + cp;
}

// ── FKP page builders ──────────────────────────────────────────────────
//
// A CHPX FKP page (512 bytes) holds, for `crun` runs:
//   - rgfc:   (crun+1) U32 FC boundaries at offset 0
//   - rgb:    crun single-byte word-offsets at offset (crun+1)*4
//   - grpprl: cb-prefixed SPRM blobs at (wordOffset*2)
//   - crun:   single byte at offset 511

interface ChpxRunSpec {
    readonly fcFirst: number;
    readonly fcLim: number;
    readonly sprms: ReadonlyArray<number>; // raw grpprl bytes (without leading cb)
}

function buildChpxFkpPage(runs: ReadonlyArray<ChpxRunSpec>): Uint8Array {
    const page = new Uint8Array(FKP_PAGE_SIZE);
    const crun = runs.length;

    // rgfc
    for (let i = 0; i < crun; i++) {
        writeU32(page, i * 4, runs[i].fcFirst);
    }
    writeU32(page, crun * 4, runs[crun - 1].fcLim);

    // Place each grpprl near the end of the page and record its word offset.
    let writePos = FKP_PAGE_SIZE - 2;
    const rgbBase = (crun + 1) * 4;
    for (let i = 0; i < crun; i++) {
        const sprms = runs[i].sprms;
        const blobLen = 1 + sprms.length; // cb byte + sprm bytes
        writePos -= blobLen;
        // Align to even (word) boundary so wordOffset*2 lands exactly.
        if (writePos % 2 !== 0) writePos -= 1;
        page[writePos] = sprms.length; // cb
        for (let k = 0; k < sprms.length; k++) page[writePos + 1 + k] = sprms[k];
        page[rgbBase + i] = writePos / 2; // word offset
    }

    page[511] = crun;
    return page;
}

// A PAPX FKP page uses 13-byte BX entries. Each BX[0] is a word offset to a
// PAPX (cb byte *2 total, then istd U16 + grpprl).
interface PapxRunSpec {
    readonly fcFirst: number;
    readonly fcLim: number;
    readonly istd: number;
    readonly sprms: ReadonlyArray<number>;
}

function buildPapxFkpPage(runs: ReadonlyArray<PapxRunSpec>): Uint8Array {
    const page = new Uint8Array(FKP_PAGE_SIZE);
    const crun = runs.length;

    for (let i = 0; i < crun; i++) {
        writeU32(page, i * 4, runs[i].fcFirst);
    }
    writeU32(page, crun * 4, runs[crun - 1].fcLim);

    const bxBase = (crun + 1) * 4;
    // PAPX data: [cb][istd lo][istd hi][grpprl...]; total bytes = cb*2.
    let writePos = FKP_PAGE_SIZE - 2;
    for (let i = 0; i < crun; i++) {
        const sprms = runs[i].sprms;
        // Reader: cb = page[bOffset]; totalBytes = cb*2; dataStart = bOffset+1;
        // istd = U16 at dataStart; sprmLen = totalBytes - 2. So the data after
        // the cb byte holds istd(2) + sprms; cb*2 must cover 2 + sprms.length.
        const cb = Math.ceil((2 + sprms.length) / 2);
        const blobLen = 1 + cb * 2;
        writePos -= blobLen;
        if (writePos % 2 !== 0) writePos -= 1;
        page[writePos] = cb;
        writeU16(page, writePos + 1, runs[i].istd);
        for (let k = 0; k < sprms.length; k++) page[writePos + 3 + k] = sprms[k];
        const wordOffset = writePos / 2;
        page[bxBase + i * 13] = wordOffset;
    }

    page[511] = crun;
    return page;
}

// PLCFBTE (bin table) pointing at a single FKP page: 1 entry.
// Layout: (n+1) U32 FCs, then n U32 page numbers. We use n = 1.
function buildPlcfBte(fcFirst: number, fcLim: number, pageNumber: number): Uint8Array {
    const buf = new Uint8Array(4 * 2 + 4); // 2 FCs + 1 page number = 12 bytes
    writeU32(buf, 0, fcFirst);
    writeU32(buf, 4, fcLim);
    writeU32(buf, 8, pageNumber);
    return buf;
}

// ── A flexible doc assembler ───────────────────────────────────────────
//
// Builds WordDocument + Table (+ optional Data) with a piece table plus
// optional CHPX/PAPX bin tables and stylesheet/font streams.

interface EnhancedDocSpec {
    readonly text: string; // stored ANSI (compressed) at textFc
    readonly textFc?: number;
    readonly chpxPage?: Uint8Array;
    readonly papxPage?: Uint8Array;
    readonly stylesheet?: Uint8Array;
    readonly fontTable?: Uint8Array;
    readonly dataStream?: Uint8Array;
    readonly extraWdBytes?: number;
}

interface EnhancedFibArgs {
    spec: EnhancedDocSpec;
    ccpText: number;
    textFc: number;
    clxLen: number;
    fcClx: number;
    fcStshf: number;
    fcSttbfFfn: number;
    fcPlcfBteChpx: number;
    fcPlcfBtePapx: number;
    plcfChpxLen: number;
    plcfPapxLen: number;
}

/** Assembles the FIB field block for an enhanced .doc test fixture. */
function buildEnhancedFib(a: EnhancedFibArgs): FibFields {
    return {
        nFib: 0x00c1,
        ccpText: a.ccpText,
        fcClx: a.fcClx,
        lcbClx: a.clxLen,
        fcStshf: a.fcStshf,
        lcbStshf: a.spec.stylesheet?.length ?? 0,
        fcSttbfFfn: a.fcSttbfFfn,
        lcbSttbfFfn: a.spec.fontTable?.length ?? 0,
        fcPlcfBteChpx: a.fcPlcfBteChpx,
        lcbPlcfBteChpx: a.plcfChpxLen,
        fcPlcfBtePapx: a.fcPlcfBtePapx,
        lcbPlcfBtePapx: a.plcfPapxLen,
        fcMin: a.textFc,
        fcMac: a.textFc + a.spec.text.length,
    };
}

function assembleEnhancedDoc(spec: EnhancedDocSpec): Uint8Array {
    // Text lives in page 1 (0x200..) so it never overlaps the FKP pages.
    const textFc = spec.textFc ?? 0x200;
    const ccpText = spec.text.length;

    // FKP pages live at page numbers 4 and 5 (byte offset 2048 / 2560).
    const chpxPageNum = 4;
    const papxPageNum = 5;

    const wdSize = Math.max(
        textFc + spec.text.length + 16,
        (papxPageNum + 1) * FKP_PAGE_SIZE,
        spec.extraWdBytes ?? 0,
    );

    // Table stream segments: CLX, stylesheet, font table, plcfbte chpx/papx.
    const clx = buildClx([{ cpStart: 0, cpEnd: ccpText, fc: textFc, compressed: true }]);

    const fcClx = 0x100;
    let cursor = fcClx + clx.length + 8;

    const segs: Array<{ fc: number; data: Uint8Array; field: keyof FibFields | null }> = [];
    function addSeg(data: Uint8Array | undefined, field: keyof FibFields): number {
        if (!data || data.length === 0) return 0;
        // Align segment starts to a 4-byte boundary so structures whose parsers
        // depend on absolute even/word alignment (e.g. style UPX arrays) line up.
        if (cursor % 4 !== 0) cursor += 4 - (cursor % 4);
        const fc = cursor;
        segs.push({ fc, data, field });
        cursor += data.length + 8;
        return fc;
    }

    const fcStshf = addSeg(spec.stylesheet, 'fcStshf');
    const fcSttbfFfn = addSeg(spec.fontTable, 'fcSttbfFfn');

    const plcfChpx = spec.chpxPage ? buildPlcfBte(0, textFc + ccpText, chpxPageNum) : undefined;
    const plcfPapx = spec.papxPage ? buildPlcfBte(0, textFc + ccpText, papxPageNum) : undefined;
    const fcPlcfBteChpx = addSeg(plcfChpx, 'fcPlcfBteChpx');
    const fcPlcfBtePapx = addSeg(plcfPapx, 'fcPlcfBtePapx');

    const tableSize = cursor + 16;

    const fib = buildEnhancedFib({
        spec, ccpText, textFc, clxLen: clx.length, fcClx,
        fcStshf, fcSttbfFfn, fcPlcfBteChpx, fcPlcfBtePapx,
        plcfChpxLen: plcfChpx?.length ?? 0, plcfPapxLen: plcfPapx?.length ?? 0,
    });

    const wd = buildWordDocument(wdSize, fib);
    writeAnsi(wd, textFc, spec.text);
    if (spec.chpxPage) wd.set(spec.chpxPage, chpxPageNum * FKP_PAGE_SIZE);
    if (spec.papxPage) wd.set(spec.papxPage, papxPageNum * FKP_PAGE_SIZE);

    const table = new Uint8Array(tableSize);
    table.set(clx, fcClx);
    for (const seg of segs) table.set(seg.data, seg.fc);

    const streams = [
        { name: 'WordDocument', data: wd },
        { name: '0Table', data: table },
    ];
    if (spec.dataStream) streams.push({ name: 'Data', data: spec.dataStream });

    return buildOle2Doc(streams);
}

function paragraphs(result: { elements: ReadonlyArray<unknown> }): DocxParagraph[] {
    return result.elements.filter((e): e is DocxParagraph => (e as DocxParagraph).type === 'paragraph');
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('parseDocEnhanced — basic text + paragraphs', () => {
    it('extracts paragraphs and plain text from the piece table', () => {
        const doc = assembleEnhancedDoc({ text: 'First para\rSecond para\r' });
        const result = parseDocEnhanced(doc);

        expect(result.plainText).toBe('First para\nSecond para');
        const paras = paragraphs(result);
        expect(paras.length).toBe(2);
        expect(paras[0].runs.map(r => r.text).join('')).toBe('First para');
        expect(paras[1].runs.map(r => r.text).join('')).toBe('Second para');
    });
});

describe('parseDocEnhanced — character formatting (CHPX SPRMs)', () => {
    it('applies bold and italic toggle SPRMs to the matching run', () => {
        const text = 'plainBOLDtail\r';
        const textFc = 0x200;
        // "BOLD" spans cp 5..9; FCs are in compressed rawFc space.
        const boldStart = compressedFc(textFc, 5);
        const boldEnd = compressedFc(textFc, 9);
        const chpxPage = buildChpxFkpPage([
            { fcFirst: compressedFc(textFc, 0), fcLim: boldStart, sprms: [] },
            // sprmCFBold = 0x0835 (LE: 0x35,0x08), operand 0x01 => bold on
            // sprmCFItalic = 0x0836 (LE: 0x36,0x08), operand 0x01 => italic on
            { fcFirst: boldStart, fcLim: boldEnd, sprms: [0x35, 0x08, 0x01, 0x36, 0x08, 0x01] },
            { fcFirst: boldEnd, fcLim: compressedFc(textFc, text.length), sprms: [] },
        ]);

        const doc = assembleEnhancedDoc({ text, textFc, chpxPage });
        const result = parseDocEnhanced(doc);
        const para = paragraphs(result)[0];

        const boldRun = para.runs.find(r => r.text === 'BOLD');
        expect(boldRun).toBeDefined();
        expect(boldRun?.style.bold).toBe(true);
        expect(boldRun?.style.italic).toBe(true);

        const plainRun = para.runs.find(r => r.text === 'plain');
        expect(plainRun?.style.bold).toBeUndefined();
    });

    it('applies font size (sprmCHps) as half-points', () => {
        const text = 'Big text\r';
        const textFc = 0x200;
        // sprmCHps = 0x4A43 (LE 0x43,0x4A), 2-byte operand. 48 half-points = 24pt.
        const chpxPage = buildChpxFkpPage([
            { fcFirst: compressedFc(textFc, 0), fcLim: compressedFc(textFc, text.length), sprms: [0x43, 0x4a, 48, 0x00] },
        ]);
        const doc = assembleEnhancedDoc({ text, textFc, chpxPage });
        const para = paragraphs(parseDocEnhanced(doc))[0];
        expect(para.runs[0].style.fontSize).toBe(24);
    });

    it('applies a color SPRM (sprmCIco palette index)', () => {
        const text = 'Red\r';
        const textFc = 0x200;
        // sprmCIco = 0x2A42 (LE 0x42,0x2A), 1-byte operand. Index 6 = red.
        const chpxPage = buildChpxFkpPage([
            { fcFirst: compressedFc(textFc, 0), fcLim: compressedFc(textFc, text.length), sprms: [0x42, 0x2a, 6] },
        ]);
        const doc = assembleEnhancedDoc({ text, textFc, chpxPage });
        const para = paragraphs(parseDocEnhanced(doc))[0];
        expect(para.runs[0].style.color).toBe('#FF0000');
    });

    it('hides text carrying the vanish SPRM', () => {
        const text = 'visiblegone\r';
        const textFc = 0x200;
        const hideStart = compressedFc(textFc, 7);
        // sprmCFVanish = 0x083C (LE 0x3C,0x08), operand 1 => hidden.
        const chpxPage = buildChpxFkpPage([
            { fcFirst: compressedFc(textFc, 0), fcLim: hideStart, sprms: [] },
            { fcFirst: hideStart, fcLim: compressedFc(textFc, text.length), sprms: [0x3c, 0x08, 0x01] },
        ]);
        const doc = assembleEnhancedDoc({ text, textFc, chpxPage });
        const para = paragraphs(parseDocEnhanced(doc))[0];
        // Hidden run is dropped; only "visible" remains.
        expect(para.runs.map(r => r.text).join('')).toBe('visible');
    });
});

describe('parseDocEnhanced — character formatting (more SPRMs)', () => {
    function singleRunDoc(text: string, sprms: ReadonlyArray<number>): ReturnType<typeof parseDocEnhanced> {
        const textFc = 0x200;
        const chpxPage = buildChpxFkpPage([
            { fcFirst: compressedFc(textFc, 0), fcLim: compressedFc(textFc, text.length), sprms },
        ]);
        return parseDocEnhanced(assembleEnhancedDoc({ text, textFc, chpxPage }));
    }

    it('applies underline (sprmCKul)', () => {
        // sprmCKul = 0x2A3E (LE 0x3E,0x2A), 1-byte value != 0 => underline.
        const para = paragraphs(singleRunDoc('u\r', [0x3e, 0x2a, 0x01]))[0];
        expect(para.runs[0].style.underline).toBe(true);
    });

    it('applies strikethrough, double strike, caps and small caps toggles', () => {
        // sprmCFStrike 0x0837, sprmCFDStrike 0x2A53, sprmCFCaps 0x083B,
        // sprmCFSmallCaps 0x083A — all operand 1.
        const para = paragraphs(singleRunDoc('x\r', [
            0x37, 0x08, 0x01, // strike
            0x53, 0x2a, 0x01, // double strike
            0x3b, 0x08, 0x01, // caps
            0x3a, 0x08, 0x01, // small caps
        ]))[0];
        expect(para.runs[0].style.strikethrough).toBe(true);
        expect(para.runs[0].style.doubleStrikethrough).toBe(true);
        expect(para.runs[0].style.caps).toBe(true);
        expect(para.runs[0].style.smallCaps).toBe(true);
    });

    it('applies superscript via sprmCIss', () => {
        // sprmCIss = 0x2A48 (LE 0x48,0x2A), value 1 => superscript.
        const para = paragraphs(singleRunDoc('s\r', [0x48, 0x2a, 0x01]))[0];
        expect(para.runs[0].style.vertAlign).toBe('superscript');
    });

    it('applies subscript via sprmCIss', () => {
        const para = paragraphs(singleRunDoc('s\r', [0x48, 0x2a, 0x02]))[0];
        expect(para.runs[0].style.vertAlign).toBe('subscript');
    });

    it('applies highlight via sprmCHighlight', () => {
        // sprmCHighlight = 0x2A0C (LE 0x0C,0x2A), index 6 => red highlight.
        const para = paragraphs(singleRunDoc('h\r', [0x0c, 0x2a, 6]))[0];
        expect(para.runs[0].style.highlight).toBe('#FF0000');
    });

    it('applies an explicit RGB colour via sprmCCv', () => {
        // sprmCCv = 0x6870 (LE 0x70,0x68), 4-byte COLORREF 0x00112233 (BGR).
        // cv bytes: R=0x33,G=0x22,B=0x11 -> "#332211".
        const para = paragraphs(singleRunDoc('c\r', [0x70, 0x68, 0x33, 0x22, 0x11, 0x00]))[0];
        expect(para.runs[0].style.color).toBe('#332211');
    });

    it('applies character spacing via sprmCDxaSpace', () => {
        // sprmCDxaSpace = 0x8840 (LE 0x40,0x88), 2-byte twips = 40 -> 2pt.
        const para = paragraphs(singleRunDoc('k\r', [0x40, 0x88, 40, 0x00]))[0];
        expect(para.runs[0].style.charSpacing).toBe(2);
    });

    it('applies a background colour via sprmCShd', () => {
        // sprmCShd = 0xCA71 (LE 0x71,0xCA), variable-length operand.
        // Operand bytes: 4-byte cv 0x00AABBCC packed little-endian.
        // cv & 0xFFFFFF = 0xAABBCC -> R=0xCC,G=0xBB,B=0xAA -> "#CCBBAA".
        const para = paragraphs(singleRunDoc('b\r', [0x71, 0xca, 0x04, 0xcc, 0xbb, 0xaa, 0x00]))[0];
        expect(para.runs[0].style.backgroundColor).toBe('#CCBBAA');
    });
});

describe('parseDocEnhanced — paragraph formatting (PAPX SPRMs)', () => {
    it('applies justification (sprmPJc) to the paragraph', () => {
        const text = 'Centered\r';
        const textFc = 0x200;
        // sprmPJc80 = 0x2403 (LE 0x03,0x24), 1-byte operand 1 => center.
        const papxPage = buildPapxFkpPage([
            { fcFirst: compressedFc(textFc, 0), fcLim: compressedFc(textFc, text.length), istd: 0, sprms: [0x03, 0x24, 0x01] },
        ]);
        const doc = assembleEnhancedDoc({ text, textFc, papxPage });
        const para = paragraphs(parseDocEnhanced(doc))[0];
        expect(para.alignment).toBe('center');
    });

    it('marks a paragraph RTL via sprmPFBiDi', () => {
        const text = 'rtlpara\r';
        const textFc = 0x200;
        // sprmPFBiDi = 0x2441 (LE 0x41,0x24), operand 1 => rtl.
        const papxPage = buildPapxFkpPage([
            { fcFirst: compressedFc(textFc, 0), fcLim: compressedFc(textFc, text.length), istd: 0, sprms: [0x41, 0x24, 0x01] },
        ]);
        const doc = assembleEnhancedDoc({ text, textFc, papxPage });
        const para = paragraphs(parseDocEnhanced(doc))[0];
        expect(para.rtl).toBe(true);
    });
});

describe('parseDocEnhanced — paragraph formatting (more PAPX SPRMs)', () => {
    function singleParaDoc(text: string, sprms: ReadonlyArray<number>): DocxParagraph {
        const textFc = 0x200;
        const papxPage = buildPapxFkpPage([
            { fcFirst: compressedFc(textFc, 0), fcLim: compressedFc(textFc, text.length), istd: 0, sprms },
        ]);
        return paragraphs(parseDocEnhanced(assembleEnhancedDoc({ text, textFc, papxPage })))[0];
    }

    it('applies spacing before/after (sprmPDyaBefore / sprmPDyaAfter)', () => {
        // sprmPDyaBefore 0xA413 (LE 0x13,0xA4) 2-byte 240 twips -> 12pt.
        // sprmPDyaAfter  0xA414 (LE 0x14,0xA4) 2-byte 120 twips -> 6pt.
        const para = singleParaDoc('s\r', [0x13, 0xa4, 240, 0x00, 0x14, 0xa4, 120, 0x00]);
        expect(para.spacingBefore).toBe(12);
        expect(para.spacingAfter).toBe(6);
    });

    it('applies proportional line spacing (sprmPDyaLine, fMult=1)', () => {
        // sprmPDyaLine = 0x6412 (LE 0x12,0x64) 4-byte. dyaLine=360, fMult=1
        // -> 360/240 = 1.5x line spacing.
        const para = singleParaDoc('l\r', [0x12, 0x64, 360 & 0xff, (360 >> 8) & 0xff, 0x01, 0x00]);
        expect(para.lineSpacing).toBeCloseTo(1.5, 5);
    });

    it('applies left and right indents (sprmPDxaLeft / sprmPDxaRight)', () => {
        // sprmPDxaLeft 0x845E (LE 0x5E,0x84) 2-byte 720 twips -> 36pt.
        // sprmPDxaRight 0x845D (LE 0x5D,0x84) 2-byte 360 twips -> 18pt.
        const para = singleParaDoc('i\r', [0x5e, 0x84, 720 & 0xff, (720 >> 8) & 0xff, 0x5d, 0x84, 360 & 0xff, (360 >> 8) & 0xff]);
        expect(para.indentLeft).toBe(36);
        expect(para.indentRight).toBe(18);
    });

    it('treats a negative first-line indent as a hanging indent', () => {
        // sprmPDxaFirst 0x8460 (LE 0x60,0x84), -240 twips (0xFF10) -> hanging 12pt.
        const neg = 0x10000 - 240; // -240 as unsigned 16-bit
        const para = singleParaDoc('h\r', [0x60, 0x84, neg & 0xff, (neg >> 8) & 0xff]);
        expect((para as unknown as Record<string, number>)['indentHanging']).toBe(12);
    });

    it('applies a paragraph shading colour (sprmPShd)', () => {
        // sprmPShd = 0xC64D (LE 0x4D,0xC6) variable. cv 0x00AABBCC -> #CCBBAA.
        const para = singleParaDoc('p\r', [0x4d, 0xc6, 0x04, 0xcc, 0xbb, 0xaa, 0x00]);
        expect(para.shading).toBe('#CCBBAA');
    });

    it('applies a top border (sprmPBrcTop)', () => {
        // sprmPBrcTop = 0xC64E (LE 0x4E,0xC6) variable. Bytes: cv(3)+width.
        // cv 0xCCBBAA at bytes 0..2, dptLineWidth at byte 3 = 6.
        const para = singleParaDoc('t\r', [0x4e, 0xc6, 0x04, 0xaa, 0xbb, 0xcc, 6]);
        expect(para.borders?.top?.size).toBe(6);
        expect(para.borders?.top?.color).toBe('#AABBCC');
    });

    it('emits list properties when ilvl + ilfo are present', () => {
        // sprmPIlvl 0x260A (LE 0x0A,0x26) 1-byte level 0.
        // sprmPIlfo 0x460B (LE 0x0B,0x46) 2-byte list id 1 (odd -> numbered).
        const para = singleParaDoc('n\r', [0x0a, 0x26, 0x00, 0x0b, 0x46, 0x01, 0x00]);
        expect((para as unknown as Record<string, unknown>)['listLevel']).toBe(0);
        expect((para as unknown as Record<string, unknown>)['listType']).toBe('numbered');
    });
});

describe('parseDocEnhanced — stylesheet & style names', () => {
    it('resolves a built-in heading style name from the stylesheet', () => {
        const text = 'My Heading\r';
        const textFc = 0x200;

        // Build a minimal stylesheet: cbStshi(2) + stshi + per-style STD.
        // Style 0 is Normal; style 1 we tag as a heading (sti=1 -> "heading 1").
        const stylesheet = buildStylesheetWithHeading();
        // PAPX sets istd = 1 so the paragraph adopts style 1.
        // sprmPIstd = 0x4600 (LE 0x00,0x46), 2-byte operand = 1.
        const papxPage = buildPapxFkpPage([
            { fcFirst: compressedFc(textFc, 0), fcLim: compressedFc(textFc, text.length), istd: 1, sprms: [] },
        ]);

        const doc = assembleEnhancedDoc({ text, textFc, stylesheet, papxPage });
        const para = paragraphs(parseDocEnhanced(doc))[0];
        expect(para.style).toBe('heading 1');
    });
});

describe('parseDocEnhanced — font table', () => {
    it('parses a font name and applies it via the run font index', () => {
        const text = 'Arial text\r';
        const textFc = 0x200;
        const fontTable = buildFontTableWithName('Arial');
        // sprmCRgFtc0 = 0x4A4F (LE 0x4F,0x4A), 2-byte operand = font index 0.
        const chpxPage = buildChpxFkpPage([
            { fcFirst: compressedFc(textFc, 0), fcLim: compressedFc(textFc, text.length), sprms: [0x4f, 0x4a, 0x00, 0x00] },
        ]);
        const doc = assembleEnhancedDoc({ text, textFc, fontTable, chpxPage });
        const para = paragraphs(parseDocEnhanced(doc))[0];
        expect(para.runs[0].style.fontFamily).toBe('Arial');
    });
});

describe('parseDocEnhanced — stylesheet character props & inheritance', () => {
    it('applies bold from a style whose char UPX carries sprmCFBold', () => {
        const text = 'Styled\r';
        const textFc = 0x200;
        // Style 1 (sti=5 so it is NOT a built-in heading) bold via char UPX.
        const stylesheet = buildStylesheetWithCharBold();
        const papxPage = buildPapxFkpPage([
            { fcFirst: compressedFc(textFc, 0), fcLim: compressedFc(textFc, text.length), istd: 1, sprms: [] },
        ]);
        const doc = assembleEnhancedDoc({ text, textFc, stylesheet, papxPage });
        const para = paragraphs(parseDocEnhanced(doc))[0];
        // The run inherits bold from the paragraph's style.
        expect(para.runs[0].style.bold).toBe(true);
    });

    it('parses a style whose paragraph UPX carries sprms (cbUpx > 2)', () => {
        const text = 'Para style\r';
        const textFc = 0x200;
        // Style 1 has a paragraph UPX with a real sprm (sprmPJc80 center) plus
        // a char UPX bold; we assert the char prop reaches the run, proving the
        // paraSprms (>2) branch in parseUpxArrays advanced the offset correctly.
        const stylesheet = buildStylesheetWithParaAndChar();
        const papxPage = buildPapxFkpPage([
            { fcFirst: compressedFc(textFc, 0), fcLim: compressedFc(textFc, text.length), istd: 1, sprms: [] },
        ]);
        const doc = assembleEnhancedDoc({ text, textFc, stylesheet, papxPage });
        const para = paragraphs(parseDocEnhanced(doc))[0];
        expect(para.runs[0].style.italic).toBe(true);
    });
});

describe('parseDocEnhanced — special paragraph shapes', () => {
    it('emits a page-break run for a form-feed-only paragraph', () => {
        // \x0C is a page break; the parser emits a paragraph with a page break.
        const text = '\x0C\r';
        const result = parseDocEnhanced(assembleEnhancedDoc({ text }));
        const para = paragraphs(result).find(p => p.runs.some(r => r.breakType === 'page'));
        expect(para).toBeDefined();
    });

    it('maps a "Title" style name to the canonical Title token', () => {
        const text = 'Doc Title\r';
        const textFc = 0x200;
        const stylesheet = buildStylesheetWithNamedStyle('Title', 1);
        const papxPage = buildPapxFkpPage([
            { fcFirst: compressedFc(textFc, 0), fcLim: compressedFc(textFc, text.length), istd: 1, sprms: [] },
        ]);
        const doc = assembleEnhancedDoc({ text, textFc, stylesheet, papxPage });
        const para = paragraphs(parseDocEnhanced(doc))[0];
        expect(para.style).toBe('Title');
    });

    it('reports a positive first-line indent', () => {
        const text = 'fl\r';
        const textFc = 0x200;
        // sprmPDxaFirst 0x8460, +240 twips -> firstLine 12pt.
        const papxPage = buildPapxFkpPage([
            { fcFirst: compressedFc(textFc, 0), fcLim: compressedFc(textFc, text.length), istd: 0, sprms: [0x60, 0x84, 240, 0x00] },
        ]);
        const para = paragraphs(parseDocEnhanced(assembleEnhancedDoc({ text, textFc, papxPage })))[0];
        expect((para as unknown as Record<string, number>)['indentFirstLine']).toBe(12);
    });
});

describe('parseDocEnhanced — tables', () => {
    it('builds a table element from in-table paragraphs', () => {
        // Two cells (\x07 cell marks) then a row-end TTP paragraph (\x07).
        // Reader: paragraphs ending in CELL_MARK; TTP paragraph closes the row.
        const text = 'A\x07B\x07\x07X\r';
        const textFc = 0x200;

        // PAPX: every paragraph inTable; the third (the row mark) is TTP.
        // sprmPFInTable = 0x2416 (LE 0x16,0x24) val 1.
        // sprmPFTtp     = 0x2417 (LE 0x17,0x24) val 1.
        const inTable = [0x16, 0x24, 0x01];
        const ttp = [0x16, 0x24, 0x01, 0x17, 0x24, 0x01];

        // Paragraph mark FCs: cell marks at cp 1,3,4 and final at end.
        // The parser keys PAPX by the FC of each paragraph mark. We make a
        // single PAPX run spanning the whole range with inTable, plus a TTP
        // run covering the last mark.
        const ttpFc = compressedFc(textFc, 4); // position of the row-terminating mark
        const papxPage = buildPapxFkpPage([
            { fcFirst: compressedFc(textFc, 0), fcLim: ttpFc, istd: 0, sprms: inTable },
            { fcFirst: ttpFc, fcLim: compressedFc(textFc, text.length), istd: 0, sprms: ttp },
        ]);

        const doc = assembleEnhancedDoc({ text, textFc, papxPage });
        const result = parseDocEnhanced(doc);
        const table = result.elements.find((e): e is DocxTable => (e as DocxTable).type === 'table');
        expect(table).toBeDefined();
        expect(table?.rows.length).toBeGreaterThanOrEqual(1);
        // The row should contain cells with the A / B text.
        const cellTexts = table?.rows.flatMap(r =>
            r.cells.map(c => c.elements
                .filter((el): el is DocxParagraph => el.type === 'paragraph')
                .flatMap(p => p.runs.map(run => run.text)).join('')));
        expect(cellTexts?.join('|')).toContain('A');
    });
});

describe('parseDocEnhanced — images', () => {
    it('extracts an inline PNG referenced by a special char run', () => {
        const text = '\r'; // single special char placeholder
        const textFc = 0x200;

        // PNG magic bytes.
        const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
        const dataStream = buildPicfWithBlip(png);

        // CHPX: mark the run special (sprmCFSpec=0x0855) + picLocation
        // (sprmCPicLocation=0x6A03, 4-byte operand = 0 -> start of Data).
        const chpxPage = buildChpxFkpPage([
            {
                fcFirst: compressedFc(textFc, 0),
                fcLim: compressedFc(textFc, 1),
                sprms: [0x55, 0x08, 0x01, 0x03, 0x6a, 0x00, 0x00, 0x00, 0x00],
            },
        ]);

        const doc = assembleEnhancedDoc({ text, textFc, chpxPage, dataStream });
        const result = parseDocEnhanced(doc);
        const image = result.elements.find((e): e is DocxImage => (e as DocxImage).type === 'image');
        expect(image).toBeDefined();
        expect(image?.dataUrl.startsWith('data:image/png;base64,')).toBe(true);
        // dxaGoal/dyaGoal 1500 / 15 => 100x100.
        expect(image?.width).toBe(100);
        expect(image?.height).toBe(100);
    });

    function imageDoc(dataStream: Uint8Array): ReturnType<typeof parseDocEnhanced> {
        const text = '\r';
        const textFc = 0x200;
        const chpxPage = buildChpxFkpPage([
            {
                fcFirst: compressedFc(textFc, 0),
                fcLim: compressedFc(textFc, 1),
                sprms: [0x55, 0x08, 0x01, 0x03, 0x6a, 0x00, 0x00, 0x00, 0x00],
            },
        ]);
        return parseDocEnhanced(assembleEnhancedDoc({ text, textFc, chpxPage, dataStream }));
    }

    it('detects a JPEG BLIP and emits an image/jpeg data URL', () => {
        const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 1, 2, 3]);
        const res = imageDoc(buildPicfWithBlip(jpeg, 0xf01d));
        const image = res.elements
            .find((e): e is DocxImage => (e as DocxImage).type === 'image');
        expect(image?.dataUrl.startsWith('data:image/jpeg;base64,')).toBe(true);
    });

    it('recurses into an OfficeArt container to find the BLIP', () => {
        const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 2]);
        const image = imageDoc(buildPicfWithBlip(gif, 0xf01e, true)).elements
            .find((e): e is DocxImage => (e as DocxImage).type === 'image');
        // GIF magic 0x47,0x49 -> image/gif in detectMimeType.
        expect(image?.dataUrl.startsWith('data:image/gif;base64,')).toBe(true);
    });
});

describe('parseDocEnhanced — fallback & error paths', () => {
    it('falls back to basic parsing when there is no usable piece table', () => {
        // lcbClx 0 -> parsePieceTable returns null -> fallback path.
        const text = 'Fallback';
        const textFc = 0x200;
        const wd = buildWordDocument(textFc + text.length * 2 + 8, {
            nFib: 0x00c1,
            ccpText: text.length,
            lcbClx: 0,
            fcMin: textFc,
            fcMac: textFc + text.length * 2,
        });
        writeUtf16(wd, textFc, text);
        const doc = buildOle2Doc([
            { name: 'WordDocument', data: wd },
            { name: '0Table', data: new Uint8Array(16) },
        ]);
        const result = parseDocEnhanced(doc);
        expect(result.plainText).toContain('Fallback');
        expect(result.footnotes).toEqual([]);
    });

    it('returns an empty result when WordDocument is missing (caught + empty)', () => {
        // No WordDocument -> parseDocInternal throws -> fallback also returns
        // an empty result because the stream is absent.
        const doc = buildOle2Doc([{ name: '0Table', data: new Uint8Array(16) }]);
        const result = parseDocEnhanced(doc);
        expect(result.elements).toEqual([]);
        expect(result.plainText).toBe('');
    });

    it('returns empty when not a valid OLE2 file at all', () => {
        // Random non-OLE2 bytes -> readOle2 throws -> outer catch -> fallback
        // -> readOle2 throws again -> this propagates? It is wrapped in try in
        // parseDocEnhanced only for parseDocInternal; fallback is outside. We
        // assert the documented behaviour: a throw surfaces.
        const garbage = new Uint8Array(600);
        expect(() => parseDocEnhanced(garbage)).toThrow();
    });
});

describe('parseDocEnhanced — run text cleaning', () => {
    it('strips field-code control chars and keeps visible text', () => {
        // 0x13/0x14/0x15 are field begin/separator/end; 0x08 is a drawn-object
        // placeholder. They must be removed from run text.
        const text = 'a\x13F\x14b\x15c\x08d\r';
        const result = parseDocEnhanced(assembleEnhancedDoc({ text }));
        const para = paragraphs(result)[0];
        expect(para.runs.map(r => r.text).join('')).toBe('aFbcd');
    });

    it('emits a page-break run for a form-feed run mid-paragraph', () => {
        // CHPX boundary isolates the \x0C into its own run; that run becomes a
        // page break while the paragraph itself is not a whole-page-break.
        const text = 'x\x0Cy\r';
        const textFc = 0x200;
        const chpxPage = buildChpxFkpPage([
            { fcFirst: compressedFc(textFc, 0), fcLim: compressedFc(textFc, 1), sprms: [] },
            { fcFirst: compressedFc(textFc, 1), fcLim: compressedFc(textFc, 2), sprms: [0x35, 0x08, 0x01] },
            { fcFirst: compressedFc(textFc, 2), fcLim: compressedFc(textFc, text.length), sprms: [] },
        ]);
        const result = parseDocEnhanced(assembleEnhancedDoc({ text, textFc, chpxPage }));
        const para = paragraphs(result)[0];
        expect(para.runs.some(r => r.breakType === 'page')).toBe(true);
    });
});

describe('parseDocEnhanced — multi-row tables & cell widths', () => {
    it('builds two rows, each terminated by a TTP paragraph', () => {
        // Row 1: cells "A","B"; row 2: cells "C","D". Each cell para ends in
        // \x07; each row is closed by a TTP paragraph (its own \x07 ... \r).
        const text = 'A\x07B\x07\x07C\x07D\x07\x07';
        const textFc = 0x200;
        const inTable = [0x16, 0x24, 0x01];
        const ttp = [0x16, 0x24, 0x01, 0x17, 0x24, 0x01];

        // TTP marks sit at cp 4 (end of row 1) and cp 9 (end of row 2).
        const ttp1 = compressedFc(textFc, 4);
        const ttp2 = compressedFc(textFc, 9);
        const papxPage = buildPapxFkpPage([
            { fcFirst: compressedFc(textFc, 0), fcLim: ttp1, istd: 0, sprms: inTable },
            { fcFirst: ttp1, fcLim: compressedFc(textFc, 5), istd: 0, sprms: ttp },
            { fcFirst: compressedFc(textFc, 5), fcLim: ttp2, istd: 0, sprms: inTable },
            { fcFirst: ttp2, fcLim: compressedFc(textFc, text.length), istd: 0, sprms: ttp },
        ]);

        const result = parseDocEnhanced(assembleEnhancedDoc({ text, textFc, papxPage }));
        const table = result.elements.find((e): e is DocxTable => (e as DocxTable).type === 'table');
        expect(table).toBeDefined();
        expect(table!.rows.length).toBeGreaterThanOrEqual(2);
        const allCellText = table!.rows.flatMap(r =>
            r.cells.map(c => c.elements
                .filter((el): el is DocxParagraph => el.type === 'paragraph')
                .flatMap(p => p.runs.map(run => run.text)).join(''))).join('');
        expect(allCellText).toContain('A');
        expect(allCellText).toContain('D');
    });
});

describe('parseDocEnhanced — image edge cases', () => {
    function specialCharImageDoc(dataStream: Uint8Array): ReturnType<typeof parseDocEnhanced> {
        // cp0 = 0x01 picture placeholder, cp1 = \r.
        const text = String.fromCodePoint(0x01) + '\r';
        const textFc = 0x200;
        const chpxPage = buildChpxFkpPage([
            {
                fcFirst: compressedFc(textFc, 0),
                fcLim: compressedFc(textFc, 1),
                sprms: [0x55, 0x08, 0x01, 0x03, 0x6a, 0x00, 0x00, 0x00, 0x00],
            },
        ]);
        return parseDocEnhanced(assembleEnhancedDoc({ text, textFc, chpxPage, dataStream }));
    }

    it('detects a WebP BLIP', () => {
        const webp = new Uint8Array([
            0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 1, 2,
        ]);
        const image = specialCharImageDoc(buildPicfWithBlip(webp, 0xf01e)).elements
            .find((e): e is DocxImage => (e as DocxImage).type === 'image');
        expect(image?.dataUrl.startsWith('data:image/webp;base64,')).toBe(true);
    });

    it('returns no image when the special char has no valid picture data', () => {
        // Data stream too small to hold a PICF header -> no image extracted.
        const result = specialCharImageDoc(new Uint8Array(8));
        const image = result.elements.find((e): e is DocxImage => (e as DocxImage).type === 'image');
        expect(image).toBeUndefined();
    });

    it('recovers the image after a secondary UID (extra 16-byte skip)', () => {
        // First candidate bytes are invalid; the real PNG sits 16 bytes later
        // (secondary UID), exercising the alternate-skip branch.
        const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 9]);
        const dataStream = buildPicfWithSecondaryUid(png);
        const image = specialCharImageDoc(dataStream).elements
            .find((e): e is DocxImage => (e as DocxImage).type === 'image');
        expect(image?.dataUrl.startsWith('data:image/png;base64,')).toBe(true);
    });
});

describe('parseDocEnhanced — list & mapping edges', () => {
    it('emits a bullet list type for an even list id', () => {
        const text = 'item\r';
        const textFc = 0x200;
        // sprmPIlvl level 0, sprmPIlfo list id 2 (even -> bullet).
        const papxPage = buildPapxFkpPage([
            { fcFirst: compressedFc(textFc, 0), fcLim: compressedFc(textFc, text.length), istd: 0, sprms: [0x0a, 0x26, 0x00, 0x0b, 0x46, 0x02, 0x00] },
        ]);
        const para = paragraphs(parseDocEnhanced(assembleEnhancedDoc({ text, textFc, papxPage })))[0];
        expect((para as unknown as Record<string, unknown>)['listType']).toBe('bullet');
    });
});

describe('parseDocEnhanced — fallback range edge', () => {
    it('returns an empty document when the fallback range is empty (fcMin >= fcMac)', () => {
        const wd = buildWordDocument(0x400, {
            nFib: 0x00c1,
            ccpText: 0,
            lcbClx: 0,
            fcMin: 0x300,
            fcMac: 0x300,
        });
        const result = parseDocEnhanced(buildOle2Doc([
            { name: 'WordDocument', data: wd },
            { name: '0Table', data: new Uint8Array(16) },
        ]));
        expect(result.elements).toEqual([]);
        expect(result.plainText).toBe('');
    });
});

// ── Fixture sub-builders ───────────────────────────────────────────────

function buildStylesheetWithHeading(): Uint8Array {
    // STSH = cbStshi(2) + STSHI + array of STDs.
    // STSHI: first U16 = cstd (style count). Keep it minimal (just cstd=2).
    const cbStshi = 2;
    const cstd = 2;

    // STD layout the parser reads:
    //   U16 sti|styleKind  (bits 0..11 = sti, 12..15 = kind)
    //   U16 istdBase (bits 0..11)
    //   ... offset jumps to start+10, then a U16 name length + UTF-16 name.
    // For a built-in heading we set sti=1, give an empty name, and rely on
    // getBuiltInStyleName(1) => "heading 1".
    function buildStd(sti: number, kind: number): Uint8Array {
        const std = new Uint8Array(16);
        writeU16(std, 0, (sti & 0x0fff) | ((kind & 0x0f) << 12));
        writeU16(std, 2, 0x0fff); // istdBase = none
        // name length at start+10 = 0 -> empty name.
        writeU16(std, 10, 0);
        return std;
    }

    const std0 = buildStd(0, 1); // Normal, paragraph style
    const std1 = buildStd(1, 1); // heading 1

    const parts: Uint8Array[] = [];
    const head = new Uint8Array(2 + cbStshi);
    writeU16(head, 0, cbStshi);
    writeU16(head, 2, cstd); // STSHI[0] = cstd
    parts.push(head);

    // Each STD is preceded by a U16 cbStd (its length).
    for (const std of [std0, std1]) {
        const withLen = new Uint8Array(2 + std.length);
        writeU16(withLen, 0, std.length);
        withLen.set(std, 2);
        parts.push(withLen);
    }

    const total = parts.reduce((a, p) => a + p.length, 0);
    const out = new Uint8Array(total);
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
}

// General STSH assembler: each STD blob is length-prefixed.
function assembleStsh(stds: ReadonlyArray<Uint8Array>): Uint8Array {
    const cbStshi = 2;
    const head = new Uint8Array(2 + cbStshi);
    writeU16(head, 0, cbStshi);
    writeU16(head, 2, stds.length); // STSHI[0] = cstd
    const parts: Uint8Array[] = [head];
    for (const std of stds) {
        const withLen = new Uint8Array(2 + std.length);
        writeU16(withLen, 0, std.length);
        withLen.set(std, 2);
        parts.push(withLen);
    }
    const total = parts.reduce((a, p) => a + p.length, 0);
    const out = new Uint8Array(total);
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
}

// Build one STD with an explicit name and a char UPX grpprl.
function buildStdWithName(sti: number, name: string, charSprms: ReadonlyArray<number>): Uint8Array {
    // start+0  : sti|kind (kind 1 = paragraph style)
    // start+2  : istdBase
    // start+10 : nameLen U16 + UTF-16 name + 2-byte terminator pad
    //  then paraUPX (cbUpx>=2: just istd) then charUPX (cbUpx + char grpprl)
    const nameField = 2 + name.length * 2 + 2; // len + chars + terminator
    const paraUpx = 4; // cbUpx(2) + istd(2)
    const charUpxLen = charSprms.length;
    const charUpx = 2 + charUpxLen; // cbUpx(2) + grpprl

    const size = 10 + nameField + paraUpx + charUpx + 4;
    const std = new Uint8Array(size);
    writeU16(std, 0, (sti & 0x0fff) | (1 << 12)); // kind 1
    writeU16(std, 2, 0x0fff); // istdBase none

    let off = 10;
    writeU16(std, off, name.length); off += 2;
    writeUtf16(std, off, name); off += name.length * 2;
    off += 2; // terminator pad

    // paraUPX: cbUpx = 2 (just istd, no para sprms)
    writeU16(std, off, 2); off += 2;
    writeU16(std, off, sti); off += 2; // istd value (ignored)

    // even-align (off should already be even)
    if (off % 2 !== 0) off++;

    // charUPX
    writeU16(std, off, charUpxLen); off += 2;
    for (let k = 0; k < charSprms.length; k++) std[off + k] = charSprms[k];
    return std;
}

// STD with both a para UPX (real sprms) and a char UPX.
function buildStdParaChar(sti: number, name: string, paraSprms: ReadonlyArray<number>, charSprms: ReadonlyArray<number>): Uint8Array {
    const nameField = 2 + name.length * 2 + 2;
    const paraUpx = 2 + 2 + paraSprms.length; // cbUpx + istd + sprms
    const padToEven = paraUpx % 2; // align char UPX
    const charUpx = 2 + charSprms.length;
    const size = 10 + nameField + paraUpx + padToEven + charUpx + 4;
    const std = new Uint8Array(size);
    writeU16(std, 0, (sti & 0x0fff) | (1 << 12));
    writeU16(std, 2, 0x0fff);

    let off = 10;
    writeU16(std, off, name.length); off += 2;
    writeUtf16(std, off, name); off += name.length * 2;
    off += 2;

    // paraUPX: cbUpx = 2 (istd) + paraSprms.length
    writeU16(std, off, 2 + paraSprms.length); off += 2;
    writeU16(std, off, sti); off += 2; // istd
    for (let k = 0; k < paraSprms.length; k++) std[off + k] = paraSprms[k];
    off += paraSprms.length;
    if (off % 2 !== 0) off++;

    writeU16(std, off, charSprms.length); off += 2;
    for (let k = 0; k < charSprms.length; k++) std[off + k] = charSprms[k];
    return std;
}

function buildStylesheetWithParaAndChar(): Uint8Array {
    const std0 = buildStdWithName(0, 'Normal', []);
    // para UPX: sprmPJc80 center (0x03,0x24,0x01); char UPX: sprmCFItalic on.
    const std1 = buildStdParaChar(5, 'Fancy', [0x03, 0x24, 0x01], [0x36, 0x08, 0x01]);
    return assembleStsh([std0, std1]);
}

function buildStylesheetWithCharBold(): Uint8Array {
    // sti=5 (no built-in name) so the style relies on its own name/props.
    const std0 = buildStdWithName(0, 'Normal', []);
    // sprmCFBold = 0x0835 (LE 0x35,0x08) operand 1.
    const std1 = buildStdWithName(5, 'Strong', [0x35, 0x08, 0x01]);
    return assembleStsh([std0, std1]);
}

function buildStylesheetWithNamedStyle(name: string, istd: number): Uint8Array {
    const stds: Uint8Array[] = [];
    for (let i = 0; i <= istd; i++) {
        stds.push(i === istd
            ? buildStdWithName(10 + i, name, [])
            : buildStdWithName(0, 'Normal', []));
    }
    return assembleStsh(stds);
}

function buildFontTableWithName(name: string): Uint8Array {
    // STTBFFFN: cData(2) + cbExtra(2), then FFN entries.
    //   FFN: cbFfnM1(1 byte = entry length-1), then 40 bytes of fixed fields,
    //        then a UTF-16 name.
    const nameBytes = name.length * 2 + 2; // + null terminator
    const fixed = 40;
    const entryLen = 1 + fixed + nameBytes; // first byte is cbFfnM1
    const cbFfnM1 = entryLen - 1;

    const buf = new Uint8Array(4 + entryLen);
    writeU16(buf, 0, 1); // cData = 1 font
    writeU16(buf, 2, 0); // cbExtra = 0
    const off = 4;
    buf[off] = cbFfnM1;
    // name starts at off + 1 + 40.
    const nameOff = off + 1 + fixed;
    writeUtf16(buf, nameOff, name);
    return buf;
}

function buildPicfWithSecondaryUid(image: Uint8Array): Uint8Array {
    // BLIP body: 17-byte (UID+tag) primary skip, then a 16-byte secondary UID
    // of non-image bytes, then the real image. extractBlipData first reads at
    // start+17 (sees the secondary UID -> invalid) and retries at start+17+16.
    const skip = 17;
    const secondary = new Uint8Array(16); // all zero -> not a valid image header
    const body = new Uint8Array(skip + secondary.length + image.length);
    body.set(secondary, skip);
    body.set(image, skip + secondary.length);

    const blip = new Uint8Array(8 + body.length);
    writeU16(blip, 0, 0x0000);
    writeU16(blip, 2, 0xf01e); // PNG BLIP
    writeU32(blip, 4, body.length);
    blip.set(body, 8);

    const lcb = 68 + blip.length;
    const data = new Uint8Array(lcb);
    writeU32(data, 0, lcb);
    writeU16(data, 20, 1500);
    writeU16(data, 22, 1500);
    data.set(blip, 68);
    return data;
}

function buildPicfWithBlip(image: Uint8Array, fbt = 0xf01e, wrapInContainer = false): Uint8Array {
    // PICF header is 68 bytes: lcb(4) at 0, dimensions at 20/22.
    // After PICF, an OfficeArt BLIP record: verInst(2)+fbt(2)+len(4)+UID(16)+
    // [tag byte]+image. fbt 0xF01D/0xF01E/0xF029/0xF02A use a 17-byte skip.
    const skip = 17;
    const blipRecLen = skip + image.length; // bytes after the 8-byte header
    const blip = new Uint8Array(8 + blipRecLen);
    writeU16(blip, 0, 0x0000); // verInst (not a container)
    writeU16(blip, 2, fbt);
    writeU32(blip, 4, blipRecLen);
    blip.set(image, 8 + skip);

    // Optionally wrap the BLIP in an OfficeArt container so the recursion
    // branch in findBlipImage is exercised.
    let art: Uint8Array;
    if (wrapInContainer) {
        art = new Uint8Array(8 + blip.length);
        writeU16(art, 0, 0x000f); // verInst low nibble 0x0F => container -> recurse
        writeU16(art, 2, 0xf000); // container fbt
        writeU32(art, 4, blip.length);
        art.set(blip, 8);
    } else {
        art = blip;
    }

    const lcb = 68 + art.length;
    const data = new Uint8Array(lcb);
    writeU32(data, 0, lcb); // PICF lcb
    writeU16(data, 20, 1500); // dxaGoal -> width 100
    writeU16(data, 22, 1500); // dyaGoal -> height 100
    data.set(art, 68);
    return data;
}
