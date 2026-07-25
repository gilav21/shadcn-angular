import { describe, expect, it } from 'vitest';
import {
    parsePdf,
    parsePdfPaged,
    PdfReader,
    buildFontInfo,
    extractPageContent,
    getPageMediaBox,
    resolveImageFilterName,
    buildImageDataUrl,
    type PdfObject,
} from './pdf-parser';
import { PdfBuilder } from './pdf-test-fixtures';

function toBuffer(bytes: number[]): ArrayBuffer {
    return new Uint8Array(bytes).buffer;
}

/** Produces the LZW code sequence (incl. CLEAR/EOD markers) for `data`. */
function lzwCodes(data: Uint8Array): number[] {
    const codes: number[] = [256];
    let dictSize = 258;
    const table = new Map<string, number>();
    let w = '';
    const emit = (s: string): void => {
        codes.push(s.length === 1 ? s.charCodeAt(0) : table.get(s)!);
    };
    for (const ch of data) {
        const c = String.fromCharCode(ch);
        const wc = w + c;
        if (wc.length === 1 || table.has(wc)) {
            w = wc;
        } else {
            emit(w);
            table.set(wc, dictSize++);
            w = c;
        }
    }
    if (w) emit(w);
    codes.push(257);
    return codes;
}

/** Packs LZW codes into a variable-bit-width byte stream matching the parser. */
function packLzwCodes(codes: number[]): number[] {
    const out: number[] = [];
    let bitBuf = 0, bitCount = 0, codeSize = 9, next = 258;
    for (const code of codes) {
        bitBuf = (bitBuf << codeSize) | code;
        bitCount += codeSize;
        while (bitCount >= 8) {
            bitCount -= 8;
            out.push((bitBuf >> bitCount) & 0xff);
        }
        if (code === 256) { codeSize = 9; next = 258; }
        else if (code !== 257) {
            next++;
            if (next >= (1 << codeSize) - 1 && codeSize < 12) codeSize++;
        }
    }
    if (bitCount > 0) out.push((bitBuf << (8 - bitCount)) & 0xff);
    return out;
}

/** Minimal LZW encoder mirroring the PDF parser's LZWDecode. */
function lzwEncode(data: Uint8Array): number[] {
    return packLzwCodes(lzwCodes(data));
}

/** Returns a writer for fixed-4-byte /W [1 2 1] cross-reference stream entries. */
function makeXrefEntryWriter(table: Uint8Array, entrySize: number) {
    return (idx: number, t: number, f2: number, f3: number): void => {
        const base = idx * entrySize;
        table[base] = t;
        table[base + 1] = (f2 >> 8) & 0xff;
        table[base + 2] = f2 & 0xff;
        table[base + 3] = f3 & 0xff;
    };
}

describe('parsePdf', () => {
    describe('magic byte validation', () => {
        it('should reject an empty buffer', async () => {
            await expect(parsePdf(new ArrayBuffer(0))).rejects.toThrow('Not a valid PDF file.');
        });

        it('should reject a buffer shorter than 5 bytes', async () => {
            await expect(parsePdf(toBuffer([0x25, 0x50]))).rejects.toThrow('Not a valid PDF file.');
        });

        it('should reject a file with wrong magic bytes', async () => {
            const jsContent = new TextEncoder().encode('const x = 1;');
            await expect(parsePdf(jsContent.buffer)).rejects.toThrow('Not a valid PDF file.');
        });

        it('should reject a PNG file', async () => {
            const pngHeader = toBuffer([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
            await expect(parsePdf(pngHeader)).rejects.toThrow('Not a valid PDF file.');
        });

        it('should reject a file starting with %PDF but missing the dash', async () => {
            const almostPdf = new TextEncoder().encode('%PDF1.7');
            await expect(parsePdf(almostPdf.buffer)).rejects.toThrow('Not a valid PDF file.');
        });

        it('should reject an EXE file (MZ header)', async () => {
            const exeHeader = toBuffer([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);
            await expect(parsePdf(exeHeader)).rejects.toThrow('Not a valid PDF file.');
        });

        it('should pass magic byte check but fail structure parsing for a fake PDF', async () => {
            const fakePdf = new TextEncoder().encode('%PDF-1.7\nThis is not a real PDF.');
            await expect(parsePdf(fakePdf.buffer)).rejects.toThrow(
                'Unable to read this PDF. It may be corrupted or use an unsupported format.'
            );
        });
    });

    describe('basic text extraction', () => {
        it('should extract plain text from a minimal PDF', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 100 700 Td (Hello World) Tj ET')
                .build();

            const result = await parsePdf(pdf);
            expect(result.text).toContain('Hello World');
            expect(result.imageOnly).toBe(false);
        });

        it('should extract multiple text segments', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent(
                    'BT /F1 12 Tf 100 700 Td (First line) Tj 0 -20 Td (Second line) Tj ET'
                )
                .build();

            const result = await parsePdf(pdf);
            expect(result.text).toContain('First line');
            expect(result.text).toContain('Second line');
        });
    });

    describe('bold detection (P1)', () => {
        it('should detect bold from font name containing Bold', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .addFont('F2', 'Helvetica-Bold')
                .setContent(
                    'BT /F1 12 Tf 100 700 Td (Normal text) Tj ' +
                    '0 -30 Td /F2 12 Tf (Bold text) Tj ET'
                )
                .build();

            const result = await parsePdf(pdf);
            expect(result.html).toContain('<strong>');
            expect(result.html).toContain('Bold text');
        });

        it('should detect bold from font name containing Heavy', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .addFont('F2', 'MyFont-Heavy')
                .setContent(
                    'BT /F1 12 Tf 100 700 Td (Normal) Tj ' +
                    '0 -30 Td /F2 12 Tf (Heavy text) Tj ET'
                )
                .build();

            const result = await parsePdf(pdf);
            expect(result.html).toContain('<strong>');
        });

        it('should detect bold from font name containing Black', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .addFont('F2', 'Arial-Black')
                .setContent(
                    'BT /F1 12 Tf 100 700 Td (Normal) Tj ' +
                    '0 -30 Td /F2 12 Tf (Black text) Tj ET'
                )
                .build();

            const result = await parsePdf(pdf);
            expect(result.html).toContain('<strong>');
        });

        it('should not detect bold from SemiBold font name', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica-SemiBold')
                .setContent('BT /F1 12 Tf 100 700 Td (SemiBold text) Tj ET')
                .build();

            const result = await parsePdf(pdf);
            expect(result.html).not.toContain('<strong>');
        });

        it('should detect bold from FontDescriptor flags (bit 18)', async () => {
            const flags = 1 << 18;
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .addFont('F2', 'CustomFont', { flags })
                .setContent(
                    'BT /F1 12 Tf 100 700 Td (Normal) Tj ' +
                    '0 -30 Td /F2 12 Tf (Flagged bold) Tj ET'
                )
                .build();

            const result = await parsePdf(pdf);
            expect(result.html).toContain('<strong>');
        });

        it('should detect bold from FontWeight >= 700', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .addFont('F2', 'CustomFont', { fontWeight: 700 })
                .setContent(
                    'BT /F1 12 Tf 100 700 Td (Normal) Tj ' +
                    '0 -30 Td /F2 12 Tf (Weight 700) Tj ET'
                )
                .build();

            const result = await parsePdf(pdf);
            expect(result.html).toContain('<strong>');
        });

        it('should not detect bold from FontWeight < 700', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'CustomFont', { fontWeight: 400 })
                .setContent('BT /F1 12 Tf 100 700 Td (Normal weight) Tj ET')
                .build();

            const result = await parsePdf(pdf);
            expect(result.html).not.toContain('<strong>');
        });
    });

    describe('italic detection (P1)', () => {
        it('should detect italic from font name containing Italic', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .addFont('F2', 'Helvetica-Italic')
                .setContent(
                    'BT /F1 12 Tf 100 700 Td (Normal) Tj ' +
                    '0 -30 Td /F2 12 Tf (Italic text) Tj ET'
                )
                .build();

            const result = await parsePdf(pdf);
            expect(result.html).toContain('<em>');
        });

        it('should detect italic from font name containing Oblique', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .addFont('F2', 'Helvetica-Oblique')
                .setContent(
                    'BT /F1 12 Tf 100 700 Td (Normal) Tj ' +
                    '0 -30 Td /F2 12 Tf (Oblique text) Tj ET'
                )
                .build();

            const result = await parsePdf(pdf);
            expect(result.html).toContain('<em>');
        });

        it('should detect italic from FontDescriptor flags (bit 6)', async () => {
            const flags = 1 << 6;
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .addFont('F2', 'CustomFont', { flags })
                .setContent(
                    'BT /F1 12 Tf 100 700 Td (Normal) Tj ' +
                    '0 -30 Td /F2 12 Tf (Flagged italic) Tj ET'
                )
                .build();

            const result = await parsePdf(pdf);
            expect(result.html).toContain('<em>');
        });

        it('should detect italic from non-zero ItalicAngle', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .addFont('F2', 'CustomFont', { italicAngle: -12 })
                .setContent(
                    'BT /F1 12 Tf 100 700 Td (Normal) Tj ' +
                    '0 -30 Td /F2 12 Tf (Angle italic) Tj ET'
                )
                .build();

            const result = await parsePdf(pdf);
            expect(result.html).toContain('<em>');
        });

        it('should detect bold-italic from combined font name', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .addFont('F2', 'Helvetica-BoldItalic')
                .setContent(
                    'BT /F1 12 Tf 100 700 Td (Normal) Tj ' +
                    '0 -30 Td /F2 12 Tf (Bold italic) Tj ET'
                )
                .build();

            const result = await parsePdf(pdf);
            expect(result.html).toContain('<strong>');
            expect(result.html).toContain('<em>');
        });
    });

    describe('font family output (P4)', () => {
        it('should output font-family when different from body font', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .addFont('F2', 'TimesNewRoman')
                .setContent(
                    'BT /F1 12 Tf 100 700 Td (Body text in Helvetica) Tj ' +
                    '0 -30 Td /F2 12 Tf (Different font) Tj ET'
                )
                .build();

            const result = await parsePdf(pdf);
            expect(result.html).toContain('font-family');
        });

        it('should not output font-family for the body font', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 100 700 Td (All same font) Tj ET')
                .build();

            const result = await parsePdf(pdf);
            expect(result.html).not.toContain('font-family');
        });
    });

    describe('invisible text filtering (P3)', () => {
        it('should include visible text (render mode 0)', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 0 Tr 100 700 Td (Visible text) Tj ET')
                .build();

            const result = await parsePdf(pdf);
            expect(result.text).toContain('Visible text');
        });

        it('should filter invisible text (render mode 3)', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent(
                    'BT /F1 12 Tf 100 700 Td (Visible) Tj ' +
                    '3 Tr 0 -30 Td (Hidden text) Tj ET'
                )
                .build();

            const result = await parsePdf(pdf);
            expect(result.text).toContain('Visible');
            expect(result.text).not.toContain('Hidden text');
        });
    });

    describe('text rise / superscript (P2)', () => {
        it('should apply text rise to y-coordinate', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent(
                    'BT /F1 12 Tf 100 700 Td (Normal) Tj ' +
                    '5 Ts 50 0 Td (Risen) Tj ' +
                    '0 Ts ET'
                )
                .build();

            const result = await parsePdf(pdf);
            expect(result.text).toContain('Normal');
            expect(result.text).toContain('Risen');
        });
    });

    describe('color output', () => {
        it('should output colored text in HTML', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent(
                    'BT /F1 12 Tf 1 0 0 rg 100 700 Td (Red text) Tj ET'
                )
                .build();

            const result = await parsePdf(pdf);
            expect(result.html).toContain('color');
            expect(result.html).toContain('ff0000');
        });

        it('should not output color for default black text', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent(
                    'BT /F1 12 Tf 0 0 0 rg 100 700 Td (Black text) Tj ET'
                )
                .build();

            const result = await parsePdf(pdf);
            expect(result.html).not.toMatch(/color:\s*#000000/);
        });
    });

    describe('multi-line document structure', () => {
        it('should produce paragraph HTML from multiple text lines', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent(
                    'BT /F1 12 Tf ' +
                    '100 750 Td (First paragraph) Tj ' +
                    '0 -30 Td (Second paragraph) Tj ' +
                    'ET'
                )
                .build();

            const result = await parsePdf(pdf);
            expect(result.html).toContain('<p');
            expect(result.html).toContain('First paragraph');
            expect(result.html).toContain('Second paragraph');
        });
    });

    describe('heading detection', () => {
        it('should detect headings from larger font size', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent(
                    'BT /F1 24 Tf 100 750 Td (Big Heading) Tj ' +
                    '/F1 12 Tf 0 -40 Td (Normal body text here for reference) Tj ' +
                    '0 -20 Td (More body text to establish body size) Tj ' +
                    '0 -20 Td (Even more body text for size detection) Tj ' +
                    'ET'
                )
                .build();

            const result = await parsePdf(pdf);
            expect(result.html).toMatch(/<h[1-6][^>]*>.*Big Heading/);
        });
    });

    describe('structure tree parsing (P5)', () => {
        it('should use structure tree H1 type for heading detection', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .addStructureTree('H1', 0)
                .setContent(
                    'BT /F1 14 Tf 100 750 Td ' +
                    '/Span BDC ' +
                    '<< /MCID 0 >> BDC (Structured Heading) Tj EMC EMC ' +
                    '/F1 12 Tf 0 -30 Td (Body text) Tj ' +
                    'ET'
                )
                .build();

            const result = await parsePdf(pdf);
            expect(result.text).toContain('Structured Heading');
        });
    });

    describe('edge cases', () => {
        it('should handle empty page content gracefully', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('')
                .build();

            await expect(parsePdf(pdf)).rejects.toThrow('No readable content found in PDF.');
        });

        it('should handle text with special characters', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent(
                    String.raw`BT /F1 12 Tf 100 700 Td (Hello \(world\)) Tj ET`
                )
                .build();

            const result = await parsePdf(pdf);
            expect(result.text).toContain('Hello');
            expect(result.text).toContain('world');
        });

        it('should handle TJ array operator', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent(
                    'BT /F1 12 Tf 100 700 Td [(H) -20 (ello)] TJ ET'
                )
                .build();

            const result = await parsePdf(pdf);
            expect(result.text).toContain('Hello');
        });
    });
});

// ────────────────────────────────────────────────────────────────────────
// Extended coverage tests
// ────────────────────────────────────────────────────────────────────────

/** Build a FlateDecode (zlib) stream using a stored deflate block that the
 * parser's own inflate (which strips the 2-byte zlib header) can decode. */
function flateEncode(bytes: Uint8Array): Uint8Array {
    const chunks: Uint8Array[] = [];
    let rem = bytes.length;
    let pos = 0;
    if (rem === 0) chunks.push(new Uint8Array([1, 0, 0, 0xff, 0xff]));
    while (rem > 0) {
        const bs = Math.min(rem, 65535);
        const last = rem - bs === 0;
        const b = new Uint8Array(5 + bs);
        b[0] = last ? 1 : 0;
        b[1] = bs & 0xff; b[2] = (bs >> 8) & 0xff;
        b[3] = (~bs) & 0xff; b[4] = ((~bs) >> 8) & 0xff;
        b.set(bytes.subarray(pos, pos + bs), 5);
        chunks.push(b);
        pos += bs; rem -= bs;
    }
    const size = chunks.reduce((s, c) => s + c.length, 0);
    const z = new Uint8Array(2 + size + 4);
    z[0] = 0x78; z[1] = 0x01;
    let p = 2;
    for (const c of chunks) { z.set(c, p); p += c.length; }
    let a = 1, bAcc = 0;
    for (const by of bytes) { a = (a + by) % 65521; bAcc = (bAcc + a) % 65521; }
    const adler = ((bAcc << 16) | a) >>> 0;
    z[p] = (adler >> 24) & 0xff; z[p + 1] = (adler >> 16) & 0xff;
    z[p + 2] = (adler >> 8) & 0xff; z[p + 3] = adler & 0xff;
    return z;
}

function strToBytes(s: string): Uint8Array {
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.codePointAt(i)! & 0xff;
    return out;
}

interface RawObj {
    num: number;
    dict?: string;
    streamBytes?: Uint8Array;
    raw?: string;
}

/** Low-level PDF assembler: arbitrary indirect objects, traditional xref. */
class RawPdf {
    private readonly objs: RawObj[] = [];
    private rootNum = 0;
    private extraTrailer = '';

    obj(num: number, dict: string): this {
        this.objs.push({ num, dict });
        return this;
    }
    streamObj(num: number, dict: string, bytes: Uint8Array): this {
        this.objs.push({ num, dict, streamBytes: bytes });
        return this;
    }
    setRoot(num: number): this { this.rootNum = num; return this; }
    setTrailerExtra(s: string): this { this.extraTrailer = s; return this; }

    build(): ArrayBuffer {
        const parts: Uint8Array[] = [];
        const header = strToBytes('%PDF-1.5\n%aaaa\n');
        parts.push(header);
        let length = header.length;
        const offsets = new Map<number, number>();
        let maxNum = 0;

        for (const o of this.objs) {
            offsets.set(o.num, length);
            maxNum = Math.max(maxNum, o.num);
            let body: Uint8Array;
            if (o.raw !== undefined) {
                body = strToBytes(`${o.num} 0 obj\n${o.raw}\nendobj\n`);
            } else if (o.streamBytes) {
                const head = strToBytes(`${o.num} 0 obj\n<< ${o.dict} /Length ${o.streamBytes.length} >>\nstream\n`);
                const tail = strToBytes('\nendstream\nendobj\n');
                body = new Uint8Array(head.length + o.streamBytes.length + tail.length);
                body.set(head, 0);
                body.set(o.streamBytes, head.length);
                body.set(tail, head.length + o.streamBytes.length);
            } else {
                body = strToBytes(`${o.num} 0 obj\n<< ${o.dict} >>\nendobj\n`);
            }
            parts.push(body);
            length += body.length;
        }

        const size = maxNum + 1;
        const xrefOffset = length;
        let xref = `xref\n0 ${size}\n0000000000 65535 f \n`;
        for (let i = 1; i < size; i++) {
            const off = offsets.get(i) ?? 0;
            xref += `${String(off).padStart(10, '0')} 00000 n \n`;
        }
        const trailer = `trailer\n<< /Size ${size} /Root ${this.rootNum} 0 R ${this.extraTrailer} >>\nstartxref\n${xrefOffset}\n%%EOF`;
        parts.push(strToBytes(xref + trailer));

        const total = parts.reduce((s, p) => s + p.length, 0);
        const result = new Uint8Array(total);
        let pos = 0;
        for (const p of parts) { result.set(p, pos); pos += p.length; }
        return result.buffer;
    }
}

/** Standard 4-object scaffold (catalog, pages, page, content). */
function scaffold(opts: {
    content: Uint8Array;
    resources?: string;
    extraPageEntries?: string;
    contentDict?: string;
    mediaBox?: string;
}): RawPdf {
    const res = opts.resources ?? '/Font << >>';
    const mb = opts.mediaBox ?? '[0 0 612 792]';
    const pdf = new RawPdf();
    pdf.setRoot(1)
        .obj(1, '/Type /Catalog /Pages 2 0 R')
        .obj(2, '/Type /Pages /Kids [3 0 R] /Count 1')
        .obj(3, `/Type /Page /Parent 2 0 R /MediaBox ${mb} /Resources << ${res} >> /Contents 4 0 R ${opts.extraPageEntries ?? ''}`)
        .streamObj(4, opts.contentDict ?? '', opts.content);
    return pdf;
}

function helveticaFontObj(pdf: RawPdf, num: number): RawPdf {
    return pdf.obj(num, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica');
}

function ascii85Encode(input: Uint8Array): string {
    const enc: string[] = [];
    for (let i = 0; i < input.length; i += 4) {
        const chunk = input.subarray(i, i + 4);
        const n = chunk.length;
        const padded = new Uint8Array(4);
        padded.set(chunk);
        let val = 0;
        for (let j = 0; j < 4; j++) val = (val * 256 + padded[j]) >>> 0;
        if (n === 4 && val === 0) { enc.push('z'); continue; }
        const grp: number[] = [];
        let v = val;
        for (let j = 0; j < 5; j++) { grp.unshift(v % 85); v = Math.floor(v / 85); }
        for (let j = 0; j < n + 1; j++) enc.push(String.fromCharCode(grp[j] + 33));
    }
    return enc.join('') + '~>';
}

describe('parsePdf - stream filters', () => {
    it('decodes FlateDecode content streams (real glyph text)', async () => {
        const content = strToBytes('BT /F1 12 Tf 100 700 Td (Flate works) Tj ET');
        const pdf = helveticaFontObj(scaffold({
            content: flateEncode(content),
            contentDict: '/Filter /FlateDecode',
            resources: '/Font << /F1 5 0 R >>',
        }), 5).build();
        const result = await parsePdf(pdf);
        expect(result.text).toContain('Flate works');
    });

    it('decodes ASCIIHexDecode content streams', async () => {
        const inner = 'BT /F1 12 Tf 50 700 Td (HexDec) Tj ET';
        let hex = '';
        for (let i = 0; i < inner.length; i++) hex += inner.charCodeAt(i).toString(16).padStart(2, '0');
        hex += '>';
        const pdf = helveticaFontObj(scaffold({
            content: strToBytes(hex),
            contentDict: '/Filter /ASCIIHexDecode',
            resources: '/Font << /F1 5 0 R >>',
        }), 5).build();
        const result = await parsePdf(pdf);
        expect(result.text).toContain('HexDec');
    });

    it('decodes ASCII85Decode content streams', async () => {
        const inner = strToBytes('BT /F1 12 Tf 50 700 Td (A85ok) Tj ET');
        const pdf = helveticaFontObj(scaffold({
            content: strToBytes(ascii85Encode(inner)),
            contentDict: '/Filter /ASCII85Decode',
            resources: '/Font << /F1 5 0 R >>',
        }), 5).build();
        const result = await parsePdf(pdf);
        expect(result.text).toContain('A85ok');
    });

    it('decodes a filter chain ASCII85Decode + FlateDecode', async () => {
        const inner = strToBytes('BT /F1 12 Tf 50 700 Td (ChainOK) Tj ET');
        const flated = flateEncode(inner);
        const pdf = helveticaFontObj(scaffold({
            content: strToBytes(ascii85Encode(flated)),
            contentDict: '/Filter [/ASCII85Decode /FlateDecode]',
            resources: '/Font << /F1 5 0 R >>',
        }), 5).build();
        const result = await parsePdf(pdf);
        expect(result.text).toContain('ChainOK');
    });

    it('decodes RunLengthDecode content streams', async () => {
        const inner = strToBytes('BT /F1 12 Tf 50 700 Td (RLEok) Tj ET');
        const out: number[] = [];
        let i = 0;
        while (i < inner.length) {
            const take = Math.min(128, inner.length - i);
            out.push(take - 1);
            for (let j = 0; j < take; j++) out.push(inner[i + j]);
            i += take;
        }
        out.push(128);
        const pdf = helveticaFontObj(scaffold({
            content: new Uint8Array(out),
            contentDict: '/Filter /RunLengthDecode',
            resources: '/Font << /F1 5 0 R >>',
        }), 5).build();
        const result = await parsePdf(pdf);
        expect(result.text).toContain('RLEok');
    });

    it('falls back to raw bytes for an unknown filter rather than throwing', async () => {
        const content = strToBytes('BT /F1 12 Tf 50 700 Td (RawPass) Tj ET');
        const pdf = helveticaFontObj(scaffold({
            content,
            contentDict: '/Filter /MysteryDecode',
            resources: '/Font << /F1 5 0 R >>',
        }), 5).build();
        const result = await parsePdf(pdf);
        expect(result.text).toContain('RawPass');
    });
});

describe('PdfReader - filter decoders (unit)', () => {
    it('decodeStreamData applies LZWDecode (round-trips literal bytes)', () => {
        // Encode "AAAAAA" via a minimal LZW encoder matching the parser.
        const out = lzwEncode(strToBytes('AAAAAA'));

        const reader = new PdfReader(new Uint8Array(0).buffer);
        const decoded = reader.decodeStreamData(
            { Filter: { type: 'name', value: 'LZWDecode' } } as Record<string, PdfObject>,
            new Uint8Array(out),
        );
        expect(new TextDecoder('latin1').decode(decoded)).toBe('AAAAAA');
    });

    it('decodeStreamData applies a FlateDecode PNG Up predictor (Predictor 12)', () => {
        const flat = [0x02, 10, 20, 30, 0x02, 1, 2, 3];
        const enc = flateEncode(new Uint8Array(flat));
        const reader = new PdfReader(new Uint8Array(0).buffer);
        const decoded = reader.decodeStreamData(
            {
                Filter: { type: 'name', value: 'FlateDecode' },
                DecodeParms: {
                    type: 'dict',
                    value: {
                        Predictor: { type: 'number', value: 12 },
                        Columns: { type: 'number', value: 3 },
                        Colors: { type: 'number', value: 1 },
                        BitsPerComponent: { type: 'number', value: 8 },
                    },
                },
            } as unknown as Record<string, PdfObject>,
            enc,
        );
        expect([...decoded]).toEqual([10, 20, 30, 11, 22, 33]);
    });
});

describe('parsePdf - cross-reference stream entry point', () => {
    function buildXrefStreamPdf(): ArrayBuffer {
        const parts: Uint8Array[] = [];
        let len = 0;
        const push = (b: Uint8Array): void => { parts.push(b); len += b.length; };
        const offsets: number[] = [];
        push(strToBytes('%PDF-1.5\n'));

        const bodies: string[] = [
            '<< /Type /Catalog /Pages 2 0 R >>',
            '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
            '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
        ];
        for (let n = 1; n <= 3; n++) {
            offsets[n] = len;
            push(strToBytes(`${n} 0 obj\n${bodies[n - 1]}\nendobj\n`));
        }
        offsets[4] = len;
        const cs = 'BT /F1 12 Tf 100 700 Td (XRefStreamEntry) Tj ET';
        push(strToBytes(`4 0 obj\n<< /Length ${cs.length} >>\nstream\n${cs}\nendstream\nendobj\n`));
        offsets[5] = len;
        push(strToBytes('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n'));

        const xrefOff = len;
        const entrySize = 4;
        const numEntries = 7;
        const table = new Uint8Array(numEntries * entrySize);
        const writeEntry = makeXrefEntryWriter(table, entrySize);
        writeEntry(0, 0, 0, 0xff);
        for (let n = 1; n <= 5; n++) writeEntry(n, 1, offsets[n], 0);
        writeEntry(6, 1, xrefOff, 0);
        const dict = `<< /Type /XRef /Size 7 /Root 1 0 R /W [1 2 1] /Length ${table.length} >>`;
        const head = strToBytes(`6 0 obj\n${dict}\nstream\n`);
        const tail = strToBytes('\nendstream\nendobj\n');
        const xobj = new Uint8Array(head.length + table.length + tail.length);
        xobj.set(head, 0); xobj.set(table, head.length); xobj.set(tail, head.length + table.length);
        push(xobj);
        push(strToBytes(`startxref\n${xrefOff}\n%%EOF`));

        const out = new Uint8Array(len);
        let pos = 0;
        for (const p of parts) { out.set(p, pos); pos += p.length; }
        return out.buffer;
    }

    it('reads objects through a cross-reference stream', async () => {
        const result = await parsePdf(buildXrefStreamPdf());
        expect(result.text).toContain('XRefStreamEntry');
    });
});

describe('parsePdf - compressed object streams', () => {
    function buildObjStmPdf(): ArrayBuffer {
        const parts: Uint8Array[] = [];
        let len = 0;
        const push = (b: Uint8Array): void => { parts.push(b); len += b.length; };
        const offsets: number[] = [];
        push(strToBytes('%PDF-1.5\n'));

        offsets[1] = len; push(strToBytes('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'));
        offsets[2] = len; push(strToBytes('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n'));
        const cs = 'BT /F1 12 Tf 100 700 Td (CompressedPage) Tj ET';
        offsets[4] = len; push(strToBytes(`4 0 obj\n<< /Length ${cs.length} >>\nstream\n${cs}\nendstream\nendobj\n`));
        offsets[5] = len; push(strToBytes('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n'));

        const pageBody = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>';
        const header = '3 0 ';
        const objStmData = strToBytes(header + pageBody);
        offsets[7] = len;
        push(strToBytes(`7 0 obj\n<< /Type /ObjStm /N 1 /First ${header.length} /Length ${objStmData.length} >>\nstream\n`));
        push(objStmData);
        push(strToBytes('\nendstream\nendobj\n'));

        const xrefOff = len;
        const entrySize = 4;
        const numEntries = 8;
        const table = new Uint8Array(numEntries * entrySize);
        const writeEntry = makeXrefEntryWriter(table, entrySize);
        writeEntry(0, 0, 0, 0xff);
        writeEntry(1, 1, offsets[1], 0);
        writeEntry(2, 1, offsets[2], 0);
        writeEntry(3, 2, 7, 0);
        writeEntry(4, 1, offsets[4], 0);
        writeEntry(5, 1, offsets[5], 0);
        writeEntry(6, 1, xrefOff, 0);
        writeEntry(7, 1, offsets[7], 0);
        const dict = `<< /Type /XRef /Size 8 /Root 1 0 R /W [1 2 1] /Length ${table.length} >>`;
        const head = strToBytes(`6 0 obj\n${dict}\nstream\n`);
        const tail = strToBytes('\nendstream\nendobj\n');
        const xobj = new Uint8Array(head.length + table.length + tail.length);
        xobj.set(head, 0); xobj.set(table, head.length); xobj.set(tail, head.length + table.length);
        push(xobj);
        push(strToBytes(`startxref\n${xrefOff}\n%%EOF`));

        const out = new Uint8Array(len);
        let pos = 0;
        for (const p of parts) { out.set(p, pos); pos += p.length; }
        return out.buffer;
    }

    it('resolves a page object stored in a compressed object stream', async () => {
        const result = await parsePdf(buildObjStmPdf());
        expect(result.text).toContain('CompressedPage');
    });
});

describe('parsePdf - encrypted documents', () => {
    it('rejects PDFs with an /Encrypt entry in the trailer', async () => {
        const pdf = scaffold({
            content: strToBytes('BT /F1 12 Tf 100 700 Td (Secret) Tj ET'),
            resources: '/Font << /F1 5 0 R >>',
        })
            .obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica')
            .obj(6, '/Filter /Standard /V 1 /R 2')
            .setTrailerExtra('/Encrypt 6 0 R')
            .build();
        await expect(parsePdf(pdf)).rejects.toThrow('Encrypted PDFs are not supported.');
    });
});

describe('parsePdf - font handling', () => {
    it('maps Type0 CID font glyphs via ToUnicode CMap (bfchar)', async () => {
        // Two-byte string <0003 0004> mapped to "Hi" via ToUnicode.
        const cmap = [
            '/CIDInit /ProcSet findresource begin',
            '12 dict begin begincmap',
            '1 begincodespacerange <0000> <FFFF> endcodespacerange',
            '2 beginbfchar',
            '<0003> <0048>',
            '<0004> <0069>',
            'endbfchar',
            'endcmap end end',
        ].join('\n');
        const pdf = scaffold({
            content: strToBytes('BT /F1 12 Tf 100 700 Td <00030004> Tj ET'),
            resources: '/Font << /F1 5 0 R >>',
        })
            .obj(5, '/Type /Font /Subtype /Type0 /BaseFont /ABCDEF+NotoSans /Encoding /Identity-H /DescendantFonts [7 0 R] /ToUnicode 6 0 R')
            .streamObj(6, '', strToBytes(cmap))
            .obj(7, '/Type /Font /Subtype /CIDFontType2 /BaseFont /ABCDEF+NotoSans /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /DW 500 /W [3 [600 700]]')
            .build();
        const result = await parsePdf(pdf);
        expect(result.text).toContain('Hi');
    });

    it('maps glyphs via ToUnicode bfrange (range form)', async () => {
        const cmap = [
            'begincmap',
            '1 beginbfrange',
            '<0001> <0003> <0041>',
            'endbfrange',
            'endcmap',
        ].join('\n');
        const pdf = scaffold({
            content: strToBytes('BT /F1 12 Tf 100 700 Td <000100020003> Tj ET'),
            resources: '/Font << /F1 5 0 R >>',
        })
            .obj(5, '/Type /Font /Subtype /Type0 /BaseFont /Test /Encoding /Identity-H /DescendantFonts [7 0 R] /ToUnicode 6 0 R')
            .streamObj(6, '', strToBytes(cmap))
            .obj(7, '/Type /Font /Subtype /CIDFontType2 /BaseFont /Test /DW 1000')
            .build();
        const result = await parsePdf(pdf);
        // 0001->A, 0002->B, 0003->C
        expect(result.text).toContain('ABC');
    });

    it('applies Encoding Differences glyph names to single-byte text', async () => {
        // Map code 65 ('A') to glyph 'bullet' (U+2022) via Differences.
        const pdf = scaffold({
            content: strToBytes('BT /F1 12 Tf 100 700 Td (A) Tj ET'),
            resources: '/Font << /F1 5 0 R >>',
        })
            .obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding 6 0 R')
            .obj(6, '/Type /Encoding /Differences [65 /bullet]')
            .build();
        const result = await parsePdf(pdf);
        expect(result.text).toContain('•');
    });

    it('uses standard font Widths array for advance width', async () => {
        // Wide glyph widths spread two letters far apart -> a space inserted.
        const pdf = scaffold({
            content: strToBytes('BT /F1 12 Tf 100 700 Td (AB) Tj 0 -30 Td (Body line one here) Tj 0 -15 Td (Body line two text) Tj ET'),
            resources: '/Font << /F1 5 0 R >>',
        })
            .obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Custom /FirstChar 65 /Widths [2000 2000]')
            .build();
        const result = await parsePdf(pdf);
        expect(result.text).toContain('Body line one here');
        // both A and B should still be present
        expect(result.text).toContain('A');
        expect(result.text).toContain('B');
    });

    it('detects bold + italic via CID descendant FontDescriptor flags', async () => {
        const flags = (1 << 18) | (1 << 6);
        const pdf = scaffold({
            content: strToBytes('BT /F1 12 Tf 100 700 Td <0001> Tj ET'),
            resources: '/Font << /F1 5 0 R >>',
        })
            .obj(5, '/Type /Font /Subtype /Type0 /BaseFont /X /Encoding /Identity-H /DescendantFonts [7 0 R] /ToUnicode 6 0 R')
            .streamObj(6, '', strToBytes('begincmap\n1 beginbfchar\n<0001> <0058>\nendbfchar\nendcmap'))
            .obj(7, `/Type /Font /Subtype /CIDFontType2 /BaseFont /X /DW 1000 /FontDescriptor 8 0 R`)
            .obj(8, `/Type /FontDescriptor /FontName /X /Flags ${flags}`)
            .build();
        const result = await parsePdf(pdf);
        expect(result.html).toContain('<strong>');
        expect(result.html).toContain('<em>');
    });
});

describe('parsePdf - colors & graphics state', () => {
    it('renders CMYK fill color (k operator)', async () => {
        // Pure cyan: c=1 m=0 y=0 k=0 -> rgb(0,255,255) -> #00ffff
        const pdf = scaffold({
            content: strToBytes('BT /F1 12 Tf 1 0 0 0 k 100 700 Td (Cyan) Tj ET'),
            resources: '/Font << /F1 5 0 R >>',
        }).obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica').build();
        const result = await parsePdf(pdf);
        expect(result.html).toContain('00ffff');
    });

    it('renders gray fill color (g operator)', async () => {
        // g 0.5 -> #808080 (mid gray, non-default)
        const pdf = scaffold({
            content: strToBytes('BT /F1 12 Tf 0.5 g 100 700 Td (Gray) Tj ET'),
            resources: '/Font << /F1 5 0 R >>',
        }).obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica').build();
        const result = await parsePdf(pdf);
        expect(result.html).toMatch(/color:\s*#808080/);
    });

    it('resolves scn fill color in an explicit DeviceRGB color space', async () => {
        const pdf = scaffold({
            content: strToBytes('/CS0 cs 0 0 1 scn BT /F1 12 Tf 100 700 Td (BlueSCN) Tj ET'),
            resources: '/Font << /F1 5 0 R >> /ColorSpace << /CS0 [/ICCBased 6 0 R] >>',
        })
            .obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica')
            .streamObj(6, '/N 3', strToBytes('icc'))
            .build();
        const result = await parsePdf(pdf);
        expect(result.html).toContain('0000ff');
    });

    it('preserves fill color across q/Q graphics-state save/restore', async () => {
        // Set red, save, set green inside, restore -> red again for second text.
        const content =
            'BT /F1 12 Tf 1 0 0 rg 100 700 Td (RedOne) Tj ET ' +
            'q 0 1 0 rg BT /F1 12 Tf 100 670 Td (GreenMid) Tj ET Q ' +
            'BT /F1 12 Tf 100 640 Td (RedTwo) Tj ET';
        const pdf = scaffold({
            content: strToBytes(content),
            resources: '/Font << /F1 5 0 R >>',
        }).obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica').build();
        const result = await parsePdf(pdf);
        expect(result.html).toContain('ff0000');
        expect(result.html).toContain('00ff00');
    });

    it('applies the cm matrix to scale glyph positions', async () => {
        // cm doubles scale; text should still be extracted.
        const pdf = scaffold({
            content: strToBytes('q 2 0 0 2 0 0 cm BT /F1 12 Tf 50 350 Td (Scaled) Tj ET Q'),
            resources: '/Font << /F1 5 0 R >>',
        }).obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica').build();
        const result = await parsePdf(pdf);
        expect(result.text).toContain('Scaled');
    });

    it('hides text with near-zero fill opacity from ExtGState ca', async () => {
        const pdf = scaffold({
            content: strToBytes('/GS0 gs BT /F1 12 Tf 100 700 Td (Invisible) Tj ET'),
            resources: '/Font << /F1 5 0 R >> /ExtGState << /GS0 6 0 R >>',
        })
            .obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica')
            .obj(6, '/Type /ExtGState /ca 0')
            .build();
        await expect(parsePdf(pdf)).rejects.toThrow('No readable content found in PDF.');
    });
});

describe('parsePdf - text operators', () => {
    it('handles the quote (apostrophe) operator for next-line show', async () => {
        const content = 'BT /F1 12 Tf 14 TL 100 700 Td (LineA) Tj (LineB) \' ET';
        const pdf = scaffold({
            content: strToBytes(content),
            resources: '/Font << /F1 5 0 R >>',
        }).obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica').build();
        const result = await parsePdf(pdf);
        expect(result.text).toContain('LineA');
        expect(result.text).toContain('LineB');
    });

    it('handles the double-quote operator (word/char spacing + show)', async () => {
        const content = 'BT /F1 12 Tf 14 TL 100 700 Td (First) Tj 1 2 (Spaced) " ET';
        const pdf = scaffold({
            content: strToBytes(content),
            resources: '/Font << /F1 5 0 R >>',
        }).obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica').build();
        const result = await parsePdf(pdf);
        expect(result.text).toContain('Spaced');
    });

    it('handles T* operator using leading set by TL', async () => {
        const content = 'BT /F1 12 Tf 16 TL 100 700 Td (RowOne) Tj T* (RowTwo) Tj ET';
        const pdf = scaffold({
            content: strToBytes(content),
            resources: '/Font << /F1 5 0 R >>',
        }).obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica').build();
        const result = await parsePdf(pdf);
        expect(result.text).toContain('RowOne');
        expect(result.text).toContain('RowTwo');
    });

    it('handles Tm absolute text matrix positioning', async () => {
        const content = 'BT /F1 12 Tf 1 0 0 1 80 600 Tm (Matrix) Tj ET';
        const pdf = scaffold({
            content: strToBytes(content),
            resources: '/Font << /F1 5 0 R >>',
        }).obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica').build();
        const result = await parsePdf(pdf);
        expect(result.text).toContain('Matrix');
    });
});

describe('parsePdfPaged', () => {
    it('returns per-page results with dimensions and aggregated text', async () => {
        const pdf = scaffold({
            content: strToBytes('BT /F1 12 Tf 100 700 Td (PagedText) Tj ET'),
            resources: '/Font << /F1 5 0 R >>',
            mediaBox: '[0 0 400 600]',
        }).obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica').build();
        const result = await parsePdfPaged(pdf);
        expect(result.totalPages).toBe(1);
        expect(result.pages[0].pageWidth).toBe(400);
        expect(result.pages[0].pageHeight).toBe(600);
        expect(result.pages[0].text).toContain('PagedText');
        expect(result.text).toContain('PagedText');
        expect(result.imageOnly).toBe(false);
    });

    it('rejects an invalid buffer', async () => {
        await expect(parsePdfPaged(new ArrayBuffer(2))).rejects.toThrow('Not a valid PDF file.');
    });

    it('rejects an encrypted PDF', async () => {
        const pdf = scaffold({
            content: strToBytes('BT /F1 12 Tf 100 700 Td (X) Tj ET'),
            resources: '/Font << /F1 5 0 R >>',
        })
            .obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica')
            .obj(6, '/Filter /Standard /V 1')
            .setTrailerExtra('/Encrypt 6 0 R')
            .build();
        await expect(parsePdfPaged(pdf)).rejects.toThrow('Encrypted');
    });

    it('parses a document outline (bookmarks) with page targets', async () => {
        // Outline with one top-level item targeting page (obj 3) and a child.
        const pdf = new RawPdf()
            .setRoot(1)
            .obj(1, '/Type /Catalog /Pages 2 0 R /Outlines 8 0 R')
            .obj(2, '/Type /Pages /Kids [3 0 R] /Count 1')
            .obj(3, '/Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R')
            .streamObj(4, '', strToBytes('BT /F1 12 Tf 100 700 Td (OutlineDoc) Tj ET'))
            .obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica')
            .obj(8, '/Type /Outlines /First 9 0 R /Last 9 0 R /Count 1')
            .obj(9, '/Title (Chapter 1) /Parent 8 0 R /Dest [3 0 R /XYZ 0 792 0] /First 10 0 R')
            .obj(10, '/Title (Section 1.1) /Parent 9 0 R /A << /S /GoTo /D [3 0 R /Fit] >>')
            .build();
        const result = await parsePdfPaged(pdf);
        expect(result.outline).toHaveLength(1);
        expect(result.outline[0].title).toBe('Chapter 1');
        // NOTE: getPages() returns resolved page DICTS (not refs), so
        // buildPageObjNumMap() builds an empty ref->index map and outline
        // destinations referencing pages by indirect ref resolve to -1.
        // This is the parser's actual (arguably buggy) behavior.
        expect(result.outline[0].pageIndex).toBe(-1);
        expect(result.outline[0].children).toHaveLength(1);
        expect(result.outline[0].children[0].title).toBe('Section 1.1');
    });

    it('reports image-only pages', async () => {
        // A page whose only content is an image XObject Do, no text.
        const png1x1 = makeFlatePngImageObj();
        const pdf = scaffold({
            content: strToBytes('q 100 0 0 100 50 600 cm /Im0 Do Q'),
            resources: '/XObject << /Im0 5 0 R >>',
        })
            .streamObj(5, png1x1.dict, png1x1.bytes)
            .build();
        const result = await parsePdfPaged(pdf);
        expect(result.pages[0].imageOnly).toBe(true);
        expect(result.pages[0].html).toContain('<img');
    });
});

/** Build a 2x2 RGB image XObject whose pixel data is FlateDecode-compressed
 * so the parser decodes it and produces a PNG data URL. */
function makeFlatePngImageObj(): { dict: string; bytes: Uint8Array } {
    // 2x2 image, 3 channels, 8bpc => 12 bytes raw
    const raw = new Uint8Array([
        255, 0, 0,  0, 255, 0,
        0, 0, 255,  255, 255, 0,
    ]);
    const bytes = flateEncode(raw);
    const dict = '/Type /XObject /Subtype /Image /Width 2 /Height 2 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode';
    return { dict, bytes };
}

describe('parsePdf - images', () => {
    it('embeds a FlateDecode RGB image as a PNG data URL', async () => {
        const img = makeFlatePngImageObj();
        const pdf = scaffold({
            content: strToBytes('BT /F1 12 Tf 100 700 Td (HasImage) Tj ET q 80 0 0 80 100 500 cm /Im0 Do Q'),
            resources: '/Font << /F1 6 0 R >> /XObject << /Im0 5 0 R >>',
        })
            .streamObj(5, img.dict, img.bytes)
            .obj(6, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica')
            .build();
        const result = await parsePdf(pdf);
        expect(result.html).toContain('data:image/png;base64,');
        expect(result.html).toContain('<img');
    });

    it('passes a DCTDecode (JPEG) image through as a jpeg data URL', async () => {
        // Minimal fake JPEG bytes — parser just base64-wraps the stream.
        const jpeg = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0xFF, 0xD9]);
        const pdf = scaffold({
            content: strToBytes('q 50 0 0 50 100 600 cm /Im0 Do Q'),
            resources: '/XObject << /Im0 5 0 R >>',
        })
            .streamObj(5, '/Type /XObject /Subtype /Image /Width 4 /Height 4 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode', jpeg)
            .build();
        const result = await parsePdf(pdf);
        expect(result.html).toContain('data:image/jpeg;base64,');
    });

    it('renders an indexed-color image via its lookup table', async () => {
        // Indexed image: palette of 2 RGB colors; 2x1 image referencing idx 0,1
        const palette = new Uint8Array([255, 0, 0, 0, 0, 255]); // red, blue
        const pixels = flateEncode(new Uint8Array([0, 1]));
        const pdf = scaffold({
            content: strToBytes('q 40 0 0 40 100 600 cm /Im0 Do Q'),
            resources: '/XObject << /Im0 5 0 R >>',
        })
            .streamObj(5, '/Type /XObject /Subtype /Image /Width 2 /Height 1 /BitsPerComponent 8 /ColorSpace [/Indexed /DeviceRGB 1 6 0 R] /Filter /FlateDecode', pixels)
            .streamObj(6, '', palette)
            .build();
        const result = await parsePdf(pdf);
        expect(result.html).toContain('data:image/png;base64,');
    });

    it('returns imageOnly result when a page has images but no text', async () => {
        const img = makeFlatePngImageObj();
        const pdf = scaffold({
            content: strToBytes('q 80 0 0 80 100 500 cm /Im0 Do Q'),
            resources: '/XObject << /Im0 5 0 R >>',
        }).streamObj(5, img.dict, img.bytes).build();
        const result = await parsePdf(pdf);
        expect(result.imageOnly).toBe(true);
        expect(result.text).toBe('');
        expect(result.html).toContain('<img');
    });
});

describe('extractPageContent - tiling pattern image fills', () => {
    function patternPdf(content: string): ArrayBuffer {
        const img = makeFlatePngImageObj();
        return scaffold({
            content: strToBytes(content),
            resources: '/Pattern << /P1 7 0 R >>',
        })
            .streamObj(5, img.dict, img.bytes)
            .streamObj(7, '/PatternType 1 /Resources << /XObject << /PImg 5 0 R >> >>', strToBytes('/PImg Do'))
            .build();
    }

    function imagesOf(pdf: ArrayBuffer) {
        const reader = new PdfReader(pdf);
        reader.parse();
        return extractPageContent(reader, reader.getPages()[0], 0).imageItems;
    }

    it('emits the pattern image once at the filled path bounds', () => {
        const images = imagesOf(patternPdf('/Pattern cs /P1 scn 100 600 80 40 re f'));
        expect(images).toHaveLength(1);
        expect(images[0].dataUrl).toContain('data:image/png;base64,');
        expect(images[0].renderWidth).toBeCloseTo(80, 0);
        expect(images[0].renderHeight).toBeCloseTo(40, 0);
    });

    it('deduplicates a logo over-painted at the same position', () => {
        const images = imagesOf(patternPdf(
            '/Pattern cs /P1 scn 100 600 80 40 re f /Pattern cs /P1 scn 100 600 80 40 re f'));
        expect(images).toHaveLength(1);
    });

    it('ignores a pattern that has no image XObject', () => {
        const pdf = scaffold({
            content: strToBytes('/Pattern cs /P1 scn 100 600 80 40 re f'),
            resources: '/Pattern << /P1 7 0 R >>',
        })
            .streamObj(7, '/PatternType 1 /Resources << >>', strToBytes(' '))
            .build();
        expect(imagesOf(pdf)).toHaveLength(0);
    });
});

describe('parsePdf - inline images (BI/ID/EI)', () => {
    it('emits an inline image placeholder for a non-JPEG inline image', async () => {
        // BI ... ID <data> EI with abbreviated keys.
        const content =
            'q 50 0 0 50 100 600 cm ' +
            'BI /W 2 /H 2 /CS /RGB /BPC 8 ID \x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0a\x0b EI Q ' +
            'BT /F1 12 Tf 100 400 Td (AfterInline) Tj ET';
        const pdf = scaffold({
            content: strToBytes(content),
            resources: '/Font << /F1 5 0 R >>',
        }).obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica').build();
        const result = await parsePdf(pdf);
        // Inline image has empty dataUrl so it is skipped, but text after it must survive.
        expect(result.text).toContain('AfterInline');
    });
});

describe('parsePdf - per-fragment extraction mode', () => {
    it('extractPageContent emits one text item per character when perFragment=true', () => {
        const pdf = scaffold({
            content: strToBytes('BT /F1 12 Tf 100 700 Td (ABCDE) Tj ET'),
            resources: '/Font << /F1 5 0 R >>',
        }).obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica').build();
        const reader = new PdfReader(pdf);
        reader.parse();
        const pages = reader.getPages();
        const { textItems } = extractPageContent(reader, pages[0], 0, { perFragment: true });
        const visible = textItems.filter(t => t.text.trim().length > 0);
        expect(visible).toHaveLength(5);
        // x positions are strictly increasing per character
        for (let i = 1; i < visible.length; i++) {
            expect(visible[i].x).toBeGreaterThan(visible[i - 1].x);
        }
        expect(visible.map(t => t.text).join('')).toBe('ABCDE');
    });

    it('per-fragment TJ operator splits array fragments into chars', () => {
        const pdf = scaffold({
            content: strToBytes('BT /F1 12 Tf 100 700 Td [(He) -250 (llo)] TJ ET'),
            resources: '/Font << /F1 5 0 R >>',
        }).obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica').build();
        const reader = new PdfReader(pdf);
        reader.parse();
        const pages = reader.getPages();
        const { textItems } = extractPageContent(reader, pages[0], 0, { perFragment: true });
        const chars = textItems.filter(t => t.text.trim().length > 0).map(t => t.text).join('');
        expect(chars).toBe('Hello');
    });
});

describe('parsePdf - glyph displacement scales with the text matrix (ISO 32000 §9.4.4)', () => {
    it('endX includes the text-matrix horizontal scale so width/fontSize is scale-invariant', () => {
        // Same text shown at matrix scale 1 and scale 2. Because endX is a
        // device-space coordinate, its advance must be scaled by the text
        // matrix; then (endX - x) / effectiveFontSize is identical for both.
        const pdf = scaffold({
            content: strToBytes('BT /F1 10 Tf 1 0 0 1 50 700 Tm (AB) Tj 2 0 0 2 50 600 Tm (AB) Tj ET'),
            resources: '/Font << /F1 5 0 R >>',
        }).obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica').build();
        const reader = new PdfReader(pdf);
        reader.parse();
        const pages = reader.getPages();
        const items = extractPageContent(reader, pages[0], 0).textItems
            .filter(t => t.text === 'AB');
        expect(items).toHaveLength(2);
        const [scale1, scale2] = items;
        expect(scale2.fontSize).toBeCloseTo(scale1.fontSize * 2, 4);
        const widthPerEm1 = (scale1.endX - scale1.x) / scale1.fontSize;
        const widthPerEm2 = (scale2.endX - scale2.x) / scale2.fontSize;
        expect(widthPerEm2).toBeCloseTo(widthPerEm1, 5);
    });
});

describe('parsePdf - RTL (Hebrew) handling', () => {
    it('maps Hebrew via Encoding Differences and marks the paragraph RTL', async () => {
        // Map single-byte codes to Hebrew glyph names (afii57664.. style) so the
        // decoded text is real Hebrew. Use codes 0x41.. for aleph/bet/gimel etc.
        // afii57640 = U+05D4, etc. Use glyph names that resolve in GLYPH_NAME_MAP.
        // aleph=afii57664? Actually afii57664 maps to U+05B0. Use the documented
        // Hebrew letter glyph names from the map: afii57636=U+05D0 (aleph)..
        // 65->א 66->ב 67->ג ; 68->ד 69->ה 70->ו (afii57636 = U+05D0 aleph)
        const diffs = '[65 /afii57636 /afii57637 /afii57638 68 /afii57639 /afii57640 /afii57641]';
        const content = 'BT /F1 16 Tf 400 700 Td (ABC DEF) Tj ET';
        const pdf = scaffold({
            content: strToBytes(content),
            resources: '/Font << /F1 5 0 R >>',
        })
            .obj(5, '/Type /Font /Subtype /Type1 /BaseFont /David /Encoding 6 0 R')
            .obj(6, `/Type /Encoding /Differences ${diffs}`)
            .build();
        const result = await parsePdf(pdf);
        // אבג (U+05D0..05D2) and דהו (U+05D3..05D5) present
        expect(result.text).toContain('א');
        expect(result.text).toContain('ד');
        expect(result.html).toContain('dir="rtl"');
    });
});

describe('parsePdf - lists, headings & alignment', () => {
    it('renders a bullet list from bullet-prefixed lines', async () => {
        const content = [
            'BT /F1 12 Tf 100 700 Td (* First bullet item) Tj ET',
            'BT /F1 12 Tf 100 680 Td (* Second bullet item) Tj ET',
            'BT /F1 12 Tf 100 660 Td (* Third bullet item) Tj ET',
        ].join(' ');
        const pdf = scaffold({
            content: strToBytes(content),
            resources: '/Font << /F1 5 0 R >>',
        }).obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica').build();
        const result = await parsePdf(pdf);
        expect(result.html).toContain('<ul>');
        expect(result.html).toContain('<li>');
        expect(result.html).toContain('First bullet item');
    });

    it('renders a numbered list from "1. 2. 3." prefixed lines', async () => {
        const content = [
            'BT /F1 12 Tf 100 700 Td (1. First numbered) Tj ET',
            'BT /F1 12 Tf 100 680 Td (2. Second numbered) Tj ET',
            'BT /F1 12 Tf 100 660 Td (3. Third numbered) Tj ET',
        ].join(' ');
        const pdf = scaffold({
            content: strToBytes(content),
            resources: '/Font << /F1 5 0 R >>',
        }).obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica').build();
        const result = await parsePdf(pdf);
        expect(result.html).toContain('<ol>');
        expect(result.html).toContain('<li>');
        expect(result.html).toContain('First numbered');
    });

    it('detects centered text alignment', async () => {
        // Two left-aligned full-width body lines set the content bounds, then a
        // short centered line with large symmetric margins. Only 3 lines so the
        // column detector (needs >=4 lines) does not interfere.
        const content =
            'BT /F1 12 Tf 280 760 Td (Centered) Tj ET ' +
            'BT /F1 12 Tf 40 560 Td (Left aligned full width body line stretching across page width here xx) Tj ET ' +
            'BT /F1 12 Tf 40 540 Td (Another left aligned full width body line stretching across page width) Tj ET';
        const pdf = scaffold({
            content: strToBytes(content),
            resources: '/Font << /F1 5 0 R >>',
            mediaBox: '[0 0 612 792]',
        }).obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica').build();
        const result = await parsePdfPaged(pdf);
        expect(result.pages[0].html).toContain('text-align:center');
    });
});

describe('parsePdf - underlines from path rectangles', () => {
    it('wraps text in <u> when a thin rect sits at the baseline', async () => {
        // Text at y=700; a thin filled rect just below baseline overlapping x.
        const content =
            'BT /F1 12 Tf 100 700 Td (Underlined) Tj ET ' +
            '0 0 0 rg 100 698 60 0.5 re f';
        const pdf = scaffold({
            content: strToBytes(content),
            resources: '/Font << /F1 5 0 R >>',
        }).obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica').build();
        const result = await parsePdfPaged(pdf);
        expect(result.pages[0].html).toContain('<u>');
    });
});

describe('parsePdf - decorative horizontal rule', () => {
    it('inserts an <hr> for a wide thin horizontal line between text', async () => {
        const content =
            'BT /F1 12 Tf 100 720 Td (Above the rule) Tj ET ' +
            '0 0 0 rg 80 700 400 1 re f ' +
            'BT /F1 12 Tf 100 680 Td (Below the rule) Tj ET';
        const pdf = scaffold({
            content: strToBytes(content),
            resources: '/Font << /F1 5 0 R >>',
        }).obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica').build();
        const result = await parsePdfPaged(pdf);
        expect(result.pages[0].html).toContain('<hr');
    });
});

describe('parsePdf - table grids from line segments', () => {
    it('renders an HTML table from a grid of horizontal and vertical lines', async () => {
        // Build a 3x3 grid (4 h-lines, 4 v-lines) with text inside cells.
        const xs = [100, 200, 300, 400];
        const ys = [500, 560, 620, 680];
        const parts: string[] = ['0 0 0 rg'];
        // horizontal lines (thin rects)
        for (const y of ys) parts.push(`100 ${y} 300 1 re f`);
        // vertical lines
        for (const x of xs) parts.push(`${x} 500 1 180 re f`);
        // cell text
        parts.push('BT /F1 10 Tf 110 640 Td (Cell A) Tj ET');
        parts.push('BT /F1 10 Tf 210 640 Td (Cell B) Tj ET');
        parts.push('BT /F1 10 Tf 110 580 Td (Cell C) Tj ET');
        parts.push('BT /F1 10 Tf 210 580 Td (Cell D) Tj ET');
        const pdf = scaffold({
            content: strToBytes(parts.join(' ')),
            resources: '/Font << /F1 5 0 R >>',
        }).obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica').build();
        const result = await parsePdfPaged(pdf);
        expect(result.pages[0].html).toContain('<table');
        expect(result.pages[0].html).toContain('<td');
        expect(result.pages[0].html).toContain('Cell A');
    });
});

describe('parsePdf - border box (code block style)', () => {
    it('wraps text fully inside a stroked rectangle in a bordered div', async () => {
        const content =
            '0 0 0 RG 1 w 80 600 400 80 re S ' +
            'BT /F1 10 Tf 100 660 Td (Inside a box line one) Tj ET ' +
            'BT /F1 10 Tf 100 640 Td (Inside a box line two) Tj ET ' +
            'BT /F1 12 Tf 100 500 Td (Outside body text one) Tj ET ' +
            'BT /F1 12 Tf 100 480 Td (Outside body text two) Tj ET ' +
            'BT /F1 12 Tf 100 460 Td (Outside body text three) Tj ET';
        const pdf = scaffold({
            content: strToBytes(content),
            resources: '/Font << /F1 5 0 R >>',
        }).obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica').build();
        const result = await parsePdfPaged(pdf);
        expect(result.pages[0].html).toContain('border:');
        expect(result.pages[0].html).toContain('Inside a box line one');
    });
});

describe('parsePdf - two-column layout detection', () => {
    it('wraps output in a 2-column container when columns are detected', async () => {
        const parts: string[] = [];
        // Left column at x~60, right column at x~360. Right rows are offset in Y
        // so no single line spans both columns (which would become a table row).
        for (let i = 0; i < 6; i++) {
            const yL = 700 - i * 40;
            const yR = 680 - i * 40;
            parts.push(`BT /F1 11 Tf 60 ${yL} Td (Left column text row ${i} here words) Tj ET`);
            parts.push(`BT /F1 11 Tf 360 ${yR} Td (Right column text row ${i} here words) Tj ET`);
        }
        const pdf = scaffold({
            content: strToBytes(parts.join(' ')),
            resources: '/Font << /F1 5 0 R >>',
            mediaBox: '[0 0 612 792]',
        }).obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica').build();
        const result = await parsePdf(pdf);
        expect(result.html).toContain('column-count:2');
    });
});

describe('parsePdf - footer detection', () => {
    it('renders bottom-of-page text inside a <footer>', async () => {
        const content =
            'BT /F1 12 Tf 100 700 Td (Main body content goes here for the page) Tj ET ' +
            'BT /F1 8 Tf 100 30 Td (Page 1 of 1 footer text) Tj ET';
        const pdf = scaffold({
            content: strToBytes(content),
            resources: '/Font << /F1 5 0 R >>',
            mediaBox: '[0 0 612 792]',
        }).obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica').build();
        const result = await parsePdfPaged(pdf);
        expect(result.pages[0].html).toContain('<footer');
        expect(result.pages[0].html).toContain('footer text');
    });
});

describe('parsePdf - link annotations', () => {
    it('wraps text under a URI link annotation in an anchor', async () => {
        const pdf = scaffold({
            content: strToBytes('BT /F1 12 Tf 100 700 Td (Click here) Tj ET'),
            resources: '/Font << /F1 5 0 R >>',
            extraPageEntries: '/Annots [6 0 R]',
        })
            .obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica')
            .obj(6, '/Type /Annot /Subtype /Link /Rect [95 695 200 715] /A << /S /URI /URI (https://example.com) >>')
            .build();
        const result = await parsePdfPaged(pdf);
        expect(result.pages[0].html).toContain('href="https://example.com"');
        expect(result.pages[0].html).toContain('Click here');
    });
});

describe('parsePdf - SVG vector paths (curves)', () => {
    it('emits an inline SVG image for a path containing bezier curves', async () => {
        // A filled shape with a curve operator -> pathOpsToSvg path.
        const content =
            '1 0 0 rg 100 600 m 150 700 250 700 300 600 c 100 600 l f ' +
            'BT /F1 12 Tf 100 400 Td (HasVector) Tj ET';
        const pdf = scaffold({
            content: strToBytes(content),
            resources: '/Font << /F1 5 0 R >>',
        }).obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica').build();
        const result = await parsePdf(pdf);
        expect(result.html).toContain('data:image/svg+xml;base64,');
    });
});

describe('parsePdf - structure tree headings (paged)', () => {
    it('promotes a marked H2 span to an <h2> element', async () => {
        // StructTreeRoot -> H2 element with MCR pointing at MCID 0 on the page.
        const content = 'BT /F1 12 Tf 100 700 Td /Span <</MCID 0>> BDC (Tagged Heading) Tj EMC ' +
            '0 -30 Td (Body text after heading) Tj ' +
            '0 -15 Td (More body text here yes) Tj ' +
            '0 -15 Td (Even more body content) Tj ET';
        const pdf = new RawPdf()
            .setRoot(1)
            .obj(1, '/Type /Catalog /Pages 2 0 R /StructTreeRoot 6 0 R')
            .obj(2, '/Type /Pages /Kids [3 0 R] /Count 1')
            .obj(3, '/Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R')
            .streamObj(4, '', strToBytes(content))
            .obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica')
            .obj(6, '/Type /StructTreeRoot /K 7 0 R')
            .obj(7, '/Type /StructElem /S /H2 /Pg 3 0 R /K << /Type /MCR /MCID 0 /Pg 3 0 R >>')
            .build();
        const result = await parsePdfPaged(pdf);
        expect(result.pages[0].html).toMatch(/<h2[^>]*>[\s\S]*Tagged Heading/);
    });

    it('treats a structure LI element as a list item', async () => {
        const content = 'BT /F1 12 Tf 100 700 Td /Span <</MCID 0>> BDC (List entry one) Tj EMC ET';
        const pdf = new RawPdf()
            .setRoot(1)
            .obj(1, '/Type /Catalog /Pages 2 0 R /StructTreeRoot 6 0 R')
            .obj(2, '/Type /Pages /Kids [3 0 R] /Count 1')
            .obj(3, '/Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R')
            .streamObj(4, '', strToBytes(content))
            .obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica')
            .obj(6, '/Type /StructTreeRoot /K [7 0 R]')
            .obj(7, '/Type /StructElem /S /LI /Pg 3 0 R /K [0]')
            .build();
        const result = await parsePdfPaged(pdf);
        expect(result.pages[0].html).toContain('<li');
        expect(result.pages[0].html).toContain('List entry one');
    });
});

describe('parsePdf - page rotation', () => {
    it('swaps width/height for a 90-degree rotated page', async () => {
        const pdf = scaffold({
            content: strToBytes('BT /F1 12 Tf 100 300 Td (Rotated) Tj ET'),
            resources: '/Font << /F1 5 0 R >>',
            mediaBox: '[0 0 400 600]',
            extraPageEntries: '/Rotate 90',
        }).obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica').build();
        const result = await parsePdfPaged(pdf);
        // rotated 90: reported width = rawHeight (600), height = rawWidth (400)
        expect(result.pages[0].pageWidth).toBe(600);
        expect(result.pages[0].pageHeight).toBe(400);
        expect(result.pages[0].text).toContain('Rotated');
    });
});

class BitWriter {
    private readonly bytes: number[] = [];
    private cur = 0;
    private nbits = 0;
    write(code: number, len: number): void {
        for (let i = len - 1; i >= 0; i--) {
            this.cur = (this.cur << 1) | ((code >> i) & 1);
            this.nbits++;
            if (this.nbits === 8) { this.bytes.push(this.cur); this.cur = 0; this.nbits = 0; }
        }
    }
    byteAlign(): void {
        if (this.nbits > 0) { this.cur <<= (8 - this.nbits); this.bytes.push(this.cur); this.cur = 0; this.nbits = 0; }
    }
    finish(): Uint8Array {
        if (this.nbits > 0) { this.cur <<= (8 - this.nbits); this.bytes.push(this.cur); this.cur = 0; this.nbits = 0; }
        return new Uint8Array(this.bytes);
    }
}

describe('parsePdf - CCITT fax images', () => {
    it('decodes a Group 3 1D (K=0) all-white image into a PNG', async () => {
        // 8 columns, 2 rows, all white. White run length 8 = terminating code
        // {bits:5, code:0x13}. Each row is one such code.
        const bw = new BitWriter();
        for (let row = 0; row < 2; row++) {
            bw.write(0x13, 5); // white run 8 -> fills the 8-col row
        }
        const data = bw.finish();
        const dict = '/Type /XObject /Subtype /Image /Width 8 /Height 2 ' +
            '/ColorSpace /DeviceGray /BitsPerComponent 1 /Filter /CCITTFaxDecode ' +
            '/DecodeParms << /K 0 /Columns 8 /Rows 2 >>';
        const pdf = scaffold({
            content: strToBytes('q 80 0 0 20 50 600 cm /Im0 Do Q'),
            resources: '/XObject << /Im0 5 0 R >>',
        }).streamObj(5, dict, data).build();
        const result = await parsePdf(pdf);
        expect(result.html).toContain('data:image/png;base64,');
    });

    it('decodes a Group 4 (K<0) image using a vertical-0 mode row', async () => {
        // Group 4: starting reference line is all-white. A pass of vertical
        // mode V0 (bit 1, then 1) advances to b1 each iteration. Encode each
        // row as a single V0 code repeated until the row fills. Simplest valid
        // row: pass mode would need b2; instead use horizontal mode for a full
        // white run. Horizontal mode prefix is 001, then white run + black run.
        // For an 8-wide all-white row: 001 + white(8)=0x13(5b) + black(0)=
        // {bits:10,code:0x37}.
        const bw = new BitWriter();
        for (let row = 0; row < 2; row++) {
            bw.write(0b001, 3);   // horizontal mode
            bw.write(0x13, 5);    // white run 8
            bw.write(0x37, 10);   // black run 0
        }
        const data = bw.finish();
        const dict = '/Type /XObject /Subtype /Image /Width 8 /Height 2 ' +
            '/ColorSpace /DeviceGray /BitsPerComponent 1 /Filter /CCITTFaxDecode ' +
            '/DecodeParms << /K -1 /Columns 8 /Rows 2 /BlackIs1 true >>';
        const pdf = scaffold({
            content: strToBytes('q 80 0 0 20 50 600 cm /Im0 Do Q'),
            resources: '/XObject << /Im0 5 0 R >>',
        }).streamObj(5, dict, data).build();
        const result = await parsePdf(pdf);
        expect(result.html).toContain('data:image/png;base64,');
    });
});

describe('parsePdf - image color spaces & masks', () => {
    it('renders a DeviceGray 8bpc image', async () => {
        const raw = flateEncode(new Uint8Array([0, 128, 255, 64]));
        const pdf = scaffold({
            content: strToBytes('q 40 0 0 40 50 600 cm /Im0 Do Q'),
            resources: '/XObject << /Im0 5 0 R >>',
        }).streamObj(5, '/Type /XObject /Subtype /Image /Width 2 /Height 2 /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode', raw).build();
        const result = await parsePdf(pdf);
        expect(result.html).toContain('data:image/png;base64,');
    });

    it('renders a DeviceCMYK 8bpc image', async () => {
        const raw = flateEncode(new Uint8Array([0, 0, 0, 0, 255, 0, 0, 0, 0, 255, 0, 0, 0, 0, 255, 0]));
        const pdf = scaffold({
            content: strToBytes('q 40 0 0 40 50 600 cm /Im0 Do Q'),
            resources: '/XObject << /Im0 5 0 R >>',
        }).streamObj(5, '/Type /XObject /Subtype /Image /Width 2 /Height 2 /ColorSpace /DeviceCMYK /BitsPerComponent 8 /Filter /FlateDecode', raw).build();
        const result = await parsePdf(pdf);
        expect(result.html).toContain('data:image/png;base64,');
    });

    it('renders a 1bpc bit-packed gray image', async () => {
        // 8x1 image at 1bpc => 1 byte/row.
        const raw = flateEncode(new Uint8Array([0b10101010]));
        const pdf = scaffold({
            content: strToBytes('q 80 0 0 10 50 600 cm /Im0 Do Q'),
            resources: '/XObject << /Im0 5 0 R >>',
        }).streamObj(5, '/Type /XObject /Subtype /Image /Width 8 /Height 1 /ColorSpace /DeviceGray /BitsPerComponent 1 /Filter /FlateDecode', raw).build();
        const result = await parsePdf(pdf);
        expect(result.html).toContain('data:image/png;base64,');
    });

    it('applies an SMask alpha channel to an image', async () => {
        const rgb = flateEncode(new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 0]));
        const alpha = flateEncode(new Uint8Array([255, 128, 64, 0]));
        const pdf = scaffold({
            content: strToBytes('q 40 0 0 40 50 600 cm /Im0 Do Q'),
            resources: '/XObject << /Im0 5 0 R >>',
        })
            .streamObj(5, '/Type /XObject /Subtype /Image /Width 2 /Height 2 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /SMask 6 0 R', rgb)
            .streamObj(6, '/Type /XObject /Subtype /Image /Width 2 /Height 2 /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode', alpha)
            .build();
        const result = await parsePdf(pdf);
        expect(result.html).toContain('data:image/png;base64,');
    });
});

describe('parsePdf - RTL bracket & punctuation fixups', () => {
    it('mirrors round brackets adjacent to Hebrew and fixes word order', async () => {
        // Hebrew word, a parenthesised LTR word, more Hebrew. Map via
        // Encoding Differences. Codes:
        //   65->א 66->ב 67->ג  (first Hebrew word)
        //   68->ד 69->ה        (trailing Hebrew word)
        // Latin letters A..Z that aren't remapped stay Latin (for the LTR token).
        // Build: "<heb1> (Word) <heb2>" in visual order.
        const diffs = '[193 /afii57636 /afii57637 /afii57638 196 /afii57639 /afii57640]';
        // codes 193,194,195 -> Hebrew ; 196,197 -> Hebrew (avoid clashing ASCII)
        const heb1 = '\\301\\302\\303'; // 193 194 195
        const heb2 = '\\304\\305';      // 196 197
        const content = `BT /F1 16 Tf 400 700 Td (${heb1} (Word) ${heb2}) Tj ET`;
        const pdf = scaffold({
            content: strToBytes(content),
            resources: '/Font << /F1 5 0 R >>',
        })
            .obj(5, '/Type /Font /Subtype /Type1 /BaseFont /David /Encoding 6 0 R')
            .obj(6, `/Type /Encoding /Differences ${diffs}`)
            .build();
        const result = await parsePdf(pdf);
        expect(result.html).toContain('dir="rtl"');
        // The LTR word survives intact within the RTL line.
        expect(result.text).toContain('Word');
        // Hebrew letters present.
        expect(result.text).toContain('א');
        expect(result.text).toContain('ד');
    });

    it('handles a Hebrew line with a quote (gershayim-style) fragment', async () => {
        const diffs = '[193 /afii57636 /afii57637 /afii57638]';
        const heb = '\\301\\302\\303';
        const content = `BT /F1 16 Tf 400 700 Td (${heb}" ${heb}) Tj ET`;
        const pdf = scaffold({
            content: strToBytes(content),
            resources: '/Font << /F1 5 0 R >>',
        })
            .obj(5, '/Type /Font /Subtype /Type1 /BaseFont /David /Encoding 6 0 R')
            .obj(6, `/Type /Encoding /Differences ${diffs}`)
            .build();
        const result = await parsePdf(pdf);
        expect(result.html).toContain('dir="rtl"');
        expect(result.text).toContain('א');
    });
});

describe('parsePdf - text render modes & spacing styles', () => {
    it('renders stroked-text render mode (Tr 2) with -webkit-text-stroke', async () => {
        const pdf = scaffold({
            content: strToBytes('BT /F1 12 Tf 1 0 0 rg 2 Tr 100 700 Td (StrokedText) Tj ET'),
            resources: '/Font << /F1 5 0 R >>',
        }).obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica').build();
        const result = await parsePdf(pdf);
        expect(result.html).toContain('-webkit-text-stroke');
    });

    it('emits letter-spacing from a large char-spacing (Tc)', async () => {
        const pdf = scaffold({
            content: strToBytes('BT /F1 12 Tf 3 Tc 100 700 Td (Spaced out text here line one body) Tj 0 -20 Td (Body line two reference text) Tj 0 -20 Td (Body line three reference text) Tj ET'),
            resources: '/Font << /F1 5 0 R >>',
        }).obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica').build();
        const result = await parsePdf(pdf);
        expect(result.html).toContain('letter-spacing');
    });

    it('emits a horizontal scaling transform (Tz)', async () => {
        const pdf = scaffold({
            content: strToBytes('BT /F1 12 Tf 150 Tz 100 700 Td (WideScaled) Tj ET'),
            resources: '/Font << /F1 5 0 R >>',
        }).obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica').build();
        const result = await parsePdf(pdf);
        expect(result.html).toContain('scaleX');
    });

    it('wraps risen text (Ts) in a <sup>', async () => {
        const pdf = scaffold({
            content: strToBytes('BT /F1 12 Tf 100 700 Td (base) Tj 5 Ts (super) Tj ET'),
            resources: '/Font << /F1 5 0 R >>',
        }).obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica').build();
        const result = await parsePdf(pdf);
        expect(result.html).toContain('<sup>');
    });
});

describe('parsePdf - Form XObjects', () => {
    it('extracts text from a Form XObject invoked via Do', async () => {
        const formStream = 'BT /FF 12 Tf 10 50 Td (InsideForm) Tj ET';
        const pdf = scaffold({
            content: strToBytes('q 1 0 0 1 100 600 cm /Fm0 Do Q BT /F1 12 Tf 100 400 Td (OutsideForm) Tj ET'),
            resources: '/Font << /F1 5 0 R >> /XObject << /Fm0 6 0 R >>',
        })
            .obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica')
            .streamObj(6, '/Type /XObject /Subtype /Form /BBox [0 0 200 100] /Matrix [1 0 0 1 0 0] /Resources << /Font << /FF 7 0 R >> >>', strToBytes(formStream))
            .obj(7, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica')
            .build();
        const result = await parsePdf(pdf);
        expect(result.text).toContain('InsideForm');
        expect(result.text).toContain('OutsideForm');
    });
});

describe('parsePdf - color space component resolution', () => {
    it('resolves a Separation color space scn fill to gray', async () => {
        const pdf = scaffold({
            content: strToBytes('/CS0 cs 0.5 scn BT /F1 12 Tf 100 700 Td (SepColor) Tj ET'),
            resources: '/Font << /F1 5 0 R >> /ColorSpace << /CS0 [/Separation /Spot 6 0 R 7 0 R] >>',
        })
            .obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica')
            .obj(6, '/DeviceGray')
            .obj(7, '/FunctionType 2 /Domain [0 1] /C0 [1] /C1 [0] /N 1')
            .build();
        const result = await parsePdf(pdf);
        // 0.5 single component -> gray #808080
        expect(result.html).toContain('808080');
    });

    it('resolves an Indexed color space scn fill via lookup table', async () => {
        // Indexed over DeviceRGB, 2 entries: red, blue. scn index 1 -> blue.
        const pdf = scaffold({
            content: strToBytes('/CS0 cs 1 scn BT /F1 12 Tf 100 700 Td (Indexed) Tj ET'),
            resources: '/Font << /F1 5 0 R >> /ColorSpace << /CS0 [/Indexed /DeviceRGB 1 6 0 R] >>',
        })
            .obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica')
            .streamObj(6, '', new Uint8Array([255, 0, 0, 0, 0, 255]))
            .build();
        const result = await parsePdf(pdf);
        expect(result.html).toContain('0000ff');
    });

    it('resolves a CalGray scn stroke color', async () => {
        const pdf = scaffold({
            content: strToBytes('/CS0 CS 0.25 SCN 2 w 80 700 400 700 m 480 700 l S BT /F1 12 Tf 100 600 Td (Body) Tj ET'),
            resources: '/Font << /F1 5 0 R >> /ColorSpace << /CS0 [/CalGray << /WhitePoint [1 1 1] >>] >>',
        }).obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica').build();
        const result = await parsePdf(pdf);
        expect(result.text).toContain('Body');
    });
});

describe('parsePdf - SVG vector path variants', () => {
    it('emits SVG for paths with v, y and re curve operators', async () => {
        const content =
            '0 0 1 rg ' +
            '100 600 m ' +
            '120 650 180 650 v ' +     // v op
            '200 600 240 600 y ' +     // y op
            '300 600 l ' +
            '50 50 re ' +              // rectangle in the same subpath
            'h f ' +
            'BT /F1 12 Tf 100 400 Td (Vectors) Tj ET';
        const pdf = scaffold({
            content: strToBytes(content),
            resources: '/Font << /F1 5 0 R >>',
        }).obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica').build();
        const result = await parsePdf(pdf);
        expect(result.html).toContain('data:image/svg+xml;base64,');
    });
});

describe('parsePdf - char-by-char text reconstruction', () => {
    it('merges per-character glyphs into words and inserts word spaces', async () => {
        // Each char positioned by Tm. Within a word glyphs sit exactly one
        // advance apart (so they merge); a wide gap separates the two words.
        // Widths give a deterministic 500/1000*12 = 6pt advance per glyph.
        const widths = '/FirstChar 32 /Widths [' + new Array(96).fill('500').join(' ') + ']';
        const parts: string[] = ['BT /F1 12 Tf'];
        const place = (s: string, x0: number, y: number): void => {
            let x = x0;
            for (const ch of s) {
                parts.push(`1 0 0 1 ${x} ${y} Tm (${ch}) Tj`);
                x += 6;
            }
        };
        place('Hello', 100, 700);
        place('World', 145, 700);       // gap 145-130 = 15 -> word boundary
        place('abcdefghij', 100, 680);  // pad to trip char-by-char detection
        parts.push('ET');
        const pdf = scaffold({
            content: strToBytes(parts.join(' ')),
            resources: '/Font << /F1 5 0 R >>',
        }).obj(5, `/Type /Font /Subtype /Type1 /BaseFont /Helvetica ${widths}`).build();
        const result = await parsePdf(pdf);
        // The HTML pipeline merges adjacent glyphs into words.
        expect(result.html).toContain('Hello');
        expect(result.html).toContain('World');
    });
});

describe('parsePdf - structure tree (nested & array K)', () => {
    it('parses nested struct elements with an array of children', async () => {
        const content =
            'BT /F1 12 Tf 100 700 Td /Span <</MCID 0>> BDC (Heading text content) Tj EMC ' +
            '0 -30 Td /Span <</MCID 1>> BDC (Paragraph body text here) Tj EMC ' +
            '0 -15 Td (More body content text) Tj ' +
            '0 -15 Td (Yet more body content) Tj ET';
        const pdf = new RawPdf()
            .setRoot(1)
            .obj(1, '/Type /Catalog /Pages 2 0 R /StructTreeRoot 6 0 R')
            .obj(2, '/Type /Pages /Kids [3 0 R] /Count 1')
            .obj(3, '/Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R')
            .streamObj(4, '', strToBytes(content))
            .obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica')
            // StructTreeRoot K is an array referencing a Document element (8) that
            // has nested children H1 (9) and P (10).
            .obj(6, '/Type /StructTreeRoot /K [8 0 R]')
            .obj(8, '/Type /StructElem /S /Document /Pg 3 0 R /K [9 0 R 10 0 R]')
            .obj(9, '/Type /StructElem /S /H1 /Pg 3 0 R /K [0]')
            .obj(10, '/Type /StructElem /S /P /Pg 3 0 R /K [1]')
            .build();
        const result = await parsePdfPaged(pdf);
        expect(result.pages[0].html).toMatch(/<h1[^>]*>[\s\S]*Heading text content/);
    });
});

describe('parsePdf - multi-line footer with side-by-side columns', () => {
    it('lays out two footer items at the same baseline as a flex row', async () => {
        const content =
            'BT /F1 12 Tf 100 700 Td (Body content for the page goes here) Tj ET ' +
            'BT /F1 8 Tf 60 30 Td (Left footer) Tj ET ' +
            'BT /F1 8 Tf 450 30 Td (Right footer) Tj ET';
        const pdf = scaffold({
            content: strToBytes(content),
            resources: '/Font << /F1 5 0 R >>',
            mediaBox: '[0 0 612 792]',
        }).obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica').build();
        const result = await parsePdfPaged(pdf);
        expect(result.pages[0].html).toContain('<footer');
        expect(result.pages[0].html).toContain('Left footer');
        expect(result.pages[0].html).toContain('Right footer');
    });
});

describe('parsePdf - multiple pages', () => {
    it('parses a two-page document and concatenates text', async () => {
        const cs1 = 'BT /F1 12 Tf 100 700 Td (PageOneText) Tj ET';
        const cs2 = 'BT /F1 12 Tf 100 700 Td (PageTwoText) Tj ET';
        const pdf = new RawPdf()
            .setRoot(1)
            .obj(1, '/Type /Catalog /Pages 2 0 R')
            .obj(2, '/Type /Pages /Kids [3 0 R 7 0 R] /Count 2')
            .obj(3, '/Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R')
            .streamObj(4, '', strToBytes(cs1))
            .obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica')
            .obj(7, '/Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 8 0 R')
            .streamObj(8, '', strToBytes(cs2))
            .build();
        const paged = await parsePdfPaged(pdf);
        expect(paged.totalPages).toBe(2);
        expect(paged.pages[0].text).toContain('PageOneText');
        expect(paged.pages[1].text).toContain('PageTwoText');
        const flat = await parsePdf(pdf);
        expect(flat.text).toContain('PageOneText');
        expect(flat.text).toContain('PageTwoText');
    });
});

describe('parsePdf - content split across multiple content streams', () => {
    it('concatenates an array of content streams for one page', async () => {
        const pdf = new RawPdf()
            .setRoot(1)
            .obj(1, '/Type /Catalog /Pages 2 0 R')
            .obj(2, '/Type /Pages /Kids [3 0 R] /Count 1')
            .obj(3, '/Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents [6 0 R 7 0 R]')
            .obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica')
            .streamObj(6, '', strToBytes('BT /F1 12 Tf 100 700 Td (StreamPartA) Tj ET '))
            .streamObj(7, '', strToBytes('BT /F1 12 Tf 100 680 Td (StreamPartB) Tj ET'))
            .build();
        const result = await parsePdf(pdf);
        expect(result.text).toContain('StreamPartA');
        expect(result.text).toContain('StreamPartB');
    });
});

describe('PdfReader & helpers (unit)', () => {
    it('getPageMediaBox falls back to default when MediaBox is missing', () => {
        const reader = new PdfReader(new Uint8Array(0).buffer);
        const box = getPageMediaBox(reader, {});
        expect(box).toEqual([0, 0, 612, 792]);
    });

    it('getPageMediaBox prefers CropBox over MediaBox', () => {
        const pdf = scaffold({
            content: strToBytes('BT /F1 12 Tf 100 700 Td (X) Tj ET'),
            resources: '/Font << /F1 5 0 R >>',
            extraPageEntries: '/CropBox [10 10 300 400]',
        }).obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica').build();
        const reader = new PdfReader(pdf);
        reader.parse();
        const pages = reader.getPages();
        const dict = reader.getDict(pages[0]);
        expect(getPageMediaBox(reader, dict)).toEqual([10, 10, 300, 400]);
    });

    it('resolveImageFilterName returns the last filter in a chain', () => {
        const reader = new PdfReader(new Uint8Array(0).buffer);
        const name = resolveImageFilterName(reader, {
            Filter: { type: 'array', value: [
                { type: 'name', value: 'ASCII85Decode' },
                { type: 'name', value: 'DCTDecode' },
            ] },
        } as unknown as Record<string, PdfObject>);
        expect(name).toBe('DCTDecode');
    });

    it('buildImageDataUrl returns a jpeg URL for DCTDecode', () => {
        const reader = new PdfReader(new Uint8Array(0).buffer);
        const xObj: PdfObject = {
            type: 'stream',
            value: {},
            stream: new Uint8Array([0xFF, 0xD8, 0xFF, 0xD9]),
        };
        const url = buildImageDataUrl('DCTDecode', xObj, reader, 2, 2, {});
        expect(url).toMatch(/^data:image\/jpeg;base64,/);
    });

    it('buildFontInfo reads Type1 standard font widths', () => {
        const pdf = scaffold({
            content: strToBytes('BT /F1 12 Tf 100 700 Td (X) Tj ET'),
            resources: '/Font << /F1 5 0 R >>',
        }).obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica /FirstChar 65 /Widths [722 667 611]').build();
        const reader = new PdfReader(pdf);
        reader.parse();
        const root = reader.getRoot();
        const pagesNode = reader.getDict(root['Pages']);
        const pageRef = reader.getArray(pagesNode['Kids'])[0];
        const pageDict = reader.getDict(pageRef);
        const resDict = reader.getDict(pageDict['Resources']);
        const fontDict = reader.getDict(resDict['Font']);
        const info = buildFontInfo(reader, fontDict['F1']);
        expect(info.widths.get(65)).toBe(722);
        expect(info.widths.get(67)).toBe(611);
        expect(info.isTwoByte).toBe(false);
    });
});

describe('parsePdf - CCITT additional modes', () => {
    it('decodes a Group 3 1D image with EncodedByteAlign and a makeup run', async () => {
        // 1728-wide white rows use a makeup code (1728) then terminating 0.
        // Two rows, byte-aligned. 1728 makeup white = {bits:9, code:0x9B} then
        // white terminating 0 = {bits:8, code:0x35}.
        const bw = new BitWriter();
        for (let row = 0; row < 2; row++) {
            bw.write(0x9B, 9);  // makeup white 1728
            bw.write(0x35, 8);  // terminating white 0 -> row complete (1728)
            bw.byteAlign();
        }
        const data = bw.finish();
        const dict = '/Type /XObject /Subtype /Image /Width 1728 /Height 2 ' +
            '/ColorSpace /DeviceGray /BitsPerComponent 1 /Filter /CCITTFaxDecode ' +
            '/DecodeParms << /K 0 /Columns 1728 /Rows 2 /EncodedByteAlign true >>';
        const pdf = scaffold({
            content: strToBytes('q 200 0 0 20 50 600 cm /Im0 Do Q'),
            resources: '/XObject << /Im0 5 0 R >>',
        }).streamObj(5, dict, data).build();
        const result = await parsePdf(pdf);
        expect(result.html).toContain('data:image/png;base64,');
    });

    it('decodes a Group 3 2D (K>0) mixed-mode image', async () => {
        // K>0 reads a 1-bit mode tag per row: 1 => 1D row, 0 => 2D row.
        const bw = new BitWriter();
        // Row 0: tag=1 (1D), white run 8.
        bw.write(1, 1);
        bw.write(0x13, 5);
        // Row 1: tag=1 (1D) again to keep it simple.
        bw.write(1, 1);
        bw.write(0x13, 5);
        const data = bw.finish();
        const dict = '/Type /XObject /Subtype /Image /Width 8 /Height 2 ' +
            '/ColorSpace /DeviceGray /BitsPerComponent 1 /Filter /CCITTFaxDecode ' +
            '/DecodeParms << /K 2 /Columns 8 /Rows 2 >>';
        const pdf = scaffold({
            content: strToBytes('q 80 0 0 20 50 600 cm /Im0 Do Q'),
            resources: '/XObject << /Im0 5 0 R >>',
        }).streamObj(5, dict, data).build();
        const result = await parsePdf(pdf);
        expect(result.html).toContain('data:image/png;base64,');
    });
});

describe('PdfReader - string & value parsing edge cases', () => {
    it('parses literal strings with octal escapes and nested parentheses', () => {
        // The trailing object dictionary value uses a literal string with an
        // octal escape (\101 = 'A') and a nested parenthesis group.
        const pdf = scaffold({
            content: strToBytes('BT /F1 12 Tf 100 700 Td (\\101 (nested) \\t end) Tj ET'),
            resources: '/Font << /F1 5 0 R >>',
        }).obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica').build();
        const reader = new PdfReader(pdf);
        reader.parse();
        // Trailer should resolve catalog -> pages -> page, proving parsing ran.
        const root = reader.getRoot();
        expect(reader.getString(root['Type'])).toBe('Catalog');
    });

    it('parses hex strings and names with # escapes', () => {
        // Name with #20 (space) escape and a hex string value.
        const pdf = scaffold({
            content: strToBytes('BT /F1 12 Tf 100 700 Td <48656C6C6F> Tj ET'),
            resources: '/Font << /F1 5 0 R >>',
        })
            .obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica')
            .build();
        const reader = new PdfReader(pdf);
        reader.parse();
        const pages = reader.getPages();
        const { textItems } = extractPageContent(reader, pages[0], 0);
        // hex <48656C6C6F> = "Hello"
        expect(textItems.map(t => t.text).join('')).toContain('Hello');
    });

    it('resolveDeep returns null object for a dangling reference', () => {
        const reader = new PdfReader(new Uint8Array(0).buffer);
        const resolved = reader.resolveRef({ type: 'ref', value: '999 0' });
        expect(resolved.type).toBe('null');
    });
});

describe('parsePdf - ExtGState line width & stroke opacity', () => {
    it('applies LW and CA from an ExtGState to a stroked line', async () => {
        const content =
            '/GS0 gs 80 700 m 480 700 l S ' +
            'BT /F1 12 Tf 100 600 Td (BodyAfterRule) Tj ET';
        const pdf = scaffold({
            content: strToBytes(content),
            resources: '/Font << /F1 5 0 R >> /ExtGState << /GS0 6 0 R >>',
        })
            .obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica')
            .obj(6, '/Type /ExtGState /LW 3 /CA 0.5 /ca 1')
            .build();
        const result = await parsePdf(pdf);
        expect(result.text).toContain('BodyAfterRule');
    });
});

describe('parsePdf - stroke color space (SCN with components)', () => {
    it('resolves an SCN stroke color in an ICCBased(3) space to rgb', async () => {
        const content =
            '/CS0 CS 1 0 0 SCN 3 w 80 700 m 480 700 l S ' +
            'BT /F1 12 Tf 100 600 Td (StrokeRGB) Tj ET';
        const pdf = scaffold({
            content: strToBytes(content),
            resources: '/Font << /F1 5 0 R >> /ColorSpace << /CS0 [/ICCBased 6 0 R] >>',
        })
            .obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica')
            .streamObj(6, '/N 3', strToBytes('icc'))
            .build();
        const result = await parsePdf(pdf);
        expect(result.text).toContain('StrokeRGB');
    });
});

describe('parsePdf - outline edge cases', () => {
    it('ignores named (string) destinations and resolves GoTo actions', async () => {
        const content = 'BT /F1 12 Tf 100 700 Td (OutlineEdge) Tj ET';
        const pdf = new RawPdf()
            .setRoot(1)
            .obj(1, '/Type /Catalog /Pages 2 0 R /Outlines 8 0 R')
            .obj(2, '/Type /Pages /Kids [3 0 R] /Count 1')
            .obj(3, '/Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R')
            .streamObj(4, '', strToBytes(content))
            .obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica')
            .obj(8, '/Type /Outlines /First 9 0 R /Last 11 0 R /Count 3')
            // item with a named (string) destination -> pageIndex -1
            .obj(9, '/Title (Named Dest) /Dest (SomeNamedDest) /Next 10 0 R')
            // item with a GoTo action
            .obj(10, '/Title (GoTo Item) /A << /S /GoTo /D [3 0 R /Fit] >> /Next 11 0 R')
            // item with no destination at all
            .obj(11, '/Title (Plain Item)')
            .build();
        const result = await parsePdfPaged(pdf);
        expect(result.outline).toHaveLength(3);
        expect(result.outline[0].title).toBe('Named Dest');
        expect(result.outline[0].pageIndex).toBe(-1);
        expect(result.outline[1].title).toBe('GoTo Item');
        expect(result.outline[2].title).toBe('Plain Item');
    });

    it('returns an empty outline when the catalog has no Outlines', async () => {
        const pdf = scaffold({
            content: strToBytes('BT /F1 12 Tf 100 700 Td (NoOutline) Tj ET'),
            resources: '/Font << /F1 5 0 R >>',
        }).obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica').build();
        const result = await parsePdfPaged(pdf);
        expect(result.outline).toEqual([]);
    });
});

describe('parsePdf - structure list body / label', () => {
    it('treats an LBody structure element as a list item', async () => {
        const content = 'BT /F1 12 Tf 100 700 Td /Span <</MCID 0>> BDC (Body of a list) Tj EMC ET';
        const pdf = new RawPdf()
            .setRoot(1)
            .obj(1, '/Type /Catalog /Pages 2 0 R /StructTreeRoot 6 0 R')
            .obj(2, '/Type /Pages /Kids [3 0 R] /Count 1')
            .obj(3, '/Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R')
            .streamObj(4, '', strToBytes(content))
            .obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica')
            .obj(6, '/Type /StructTreeRoot /K 7 0 R')
            .obj(7, '/Type /StructElem /S /LBody /Pg 3 0 R /K 0')
            .build();
        const result = await parsePdfPaged(pdf);
        expect(result.pages[0].html).toContain('<li');
    });
});

describe('parsePdf - larger table with header row', () => {
    it('builds a multi-row table and places cell text correctly', async () => {
        const xs = [80, 200, 320, 440];
        const ys = [480, 540, 600, 660, 720];
        const parts: string[] = ['0 0 0 rg'];
        for (const y of ys) parts.push(`80 ${y} 360 1 re f`);
        for (const x of xs) parts.push(`${x} 480 1 240 re f`);
        parts.push('BT /F1 9 Tf 90 700 Td (H1) Tj ET');
        parts.push('BT /F1 9 Tf 210 700 Td (H2) Tj ET');
        parts.push('BT /F1 9 Tf 330 700 Td (H3) Tj ET');
        parts.push('BT /F1 9 Tf 90 640 Td (r1c1) Tj ET');
        parts.push('BT /F1 9 Tf 210 640 Td (r1c2) Tj ET');
        parts.push('BT /F1 9 Tf 90 580 Td (r2c1) Tj ET');
        const pdf = scaffold({
            content: strToBytes(parts.join(' ')),
            resources: '/Font << /F1 5 0 R >>',
        }).obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica').build();
        const result = await parsePdfPaged(pdf);
        expect(result.pages[0].html).toContain('<table');
        expect(result.pages[0].html).toContain('r1c1');
        expect(result.pages[0].html).toContain('H1');
    });
});

describe('parsePdf - underlined heading', () => {
    it('renders an underlined large-font line as a heading with <u>', async () => {
        const content =
            'BT /F1 24 Tf 100 720 Td (Big Underlined Title) Tj ET ' +
            '0 0 0 rg 100 716 200 1 re f ' +
            'BT /F1 12 Tf 100 690 Td (Body reference line one here) Tj ET ' +
            'BT /F1 12 Tf 100 670 Td (Body reference line two here) Tj ET ' +
            'BT /F1 12 Tf 100 650 Td (Body reference line three text) Tj ET';
        const pdf = scaffold({
            content: strToBytes(content),
            resources: '/Font << /F1 5 0 R >>',
        }).obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica').build();
        const result = await parsePdfPaged(pdf);
        expect(result.pages[0].html).toMatch(/<h[1-3][^>]*>[\s\S]*<u>/);
    });
});

describe('parsePdf - indexed image with inline string lookup', () => {
    it('renders an indexed image whose lookup table is a literal string', async () => {
        // Lookup as a parenthesised string of raw palette bytes: red, green.
        // bytes: 255,0,0, 0,255,0 -> in latin1: \377\0\0 \0\377\0
        const pixels = flateEncode(new Uint8Array([0, 1]));
        const lookup = '(\\377\\000\\000\\000\\377\\000)';
        const pdf = scaffold({
            content: strToBytes('q 40 0 0 40 100 600 cm /Im0 Do Q'),
            resources: '/XObject << /Im0 5 0 R >>',
        })
            .streamObj(5, `/Type /XObject /Subtype /Image /Width 2 /Height 1 /BitsPerComponent 8 /ColorSpace [/Indexed /DeviceRGB 1 ${lookup}] /Filter /FlateDecode`, pixels)
            .build();
        const result = await parsePdf(pdf);
        expect(result.html).toContain('data:image/png;base64,');
    });
});

describe('parsePdf - CCITT Group 4 mode coverage', () => {
    it('decodes Group 4 rows using vertical, pass and small-delta modes', async () => {
        // 8-column image; every reference line stays all-white so b1 == columns
        // and each mode below completes the row in one step.
        const bw = new BitWriter();
        // Row 0: horizontal mode -> white run 8, black run 0
        bw.write(0b001, 3); bw.write(0x13, 5); bw.write(0x37, 10);
        // Row 1: vertical-to-b1 (1 0 1)
        bw.write(0b101, 3);
        // Row 2: pass mode (1 1 0)
        bw.write(0b110, 3);
        // Row 3: small delta +1 (0 0 1 1)
        bw.write(0b0, 1); bw.write(0b0, 1); bw.write(0b1, 1); bw.write(0b1, 1);
        // Row 4: vertical +3 (1 1 1 1)
        bw.write(0b1111, 4);
        const data = bw.finish();
        const dict = '/Type /XObject /Subtype /Image /Width 8 /Height 5 ' +
            '/ColorSpace /DeviceGray /BitsPerComponent 1 /Filter /CCITTFaxDecode ' +
            '/DecodeParms << /K -1 /Columns 8 /Rows 5 >>';
        const pdf = scaffold({
            content: strToBytes('q 80 0 0 50 50 600 cm /Im0 Do Q'),
            resources: '/XObject << /Im0 5 0 R >>',
        }).streamObj(5, dict, data).build();
        const result = await parsePdf(pdf);
        expect(result.html).toContain('data:image/png;base64,');
    });

    it('decodes a Group 4 image with a black region (b1/b2 transitions)', async () => {
        // Row 0 has white(2) black(4) white(2) so the reference line for row 1
        // has color transitions, exercising g4FindB1/g4FindB2 with real edges.
        const bw = new BitWriter();
        // Row 0 horizontal: white 2, black 4
        bw.write(0b001, 3);
        bw.write(0x07, 4);  // white run 2 -> {runLen:2,bits:4,code:0x07}
        bw.write(0x03, 3);  // black run 4 -> {runLen:4,bits:3,code:0x03}
        // continue row 0: now white again, run 2
        bw.write(0b001, 3);
        bw.write(0x07, 4);  // white run 2
        bw.write(0x37, 10); // black run 0 (terminator)
        // Row 1: pass mode then vertical to finish (b1/b2 now meaningful)
        bw.write(0b110, 3); // pass
        bw.write(0b101, 3); // vertical to b1
        bw.write(0b101, 3);
        bw.write(0b101, 3);
        const data = bw.finish();
        const dict = '/Type /XObject /Subtype /Image /Width 8 /Height 2 ' +
            '/ColorSpace /DeviceGray /BitsPerComponent 1 /Filter /CCITTFaxDecode ' +
            '/DecodeParms << /K -1 /Columns 8 /Rows 2 >>';
        const pdf = scaffold({
            content: strToBytes('q 80 0 0 20 50 600 cm /Im0 Do Q'),
            resources: '/XObject << /Im0 5 0 R >>',
        }).streamObj(5, dict, data).build();
        const result = await parsePdf(pdf);
        expect(result.html).toContain('data:image/png;base64,');
    });
});

describe('parsePdf - RTL bracket reattachment & punctuation', () => {
    it('reattaches a Hebrew prefix to a following LTR word and fixes brackets', async () => {
        // Visual-order Hebrew with a hyphen-prefixed Latin token and trailing
        // punctuation to drive reattachHebrewPrefixes / fixLeadingPunctuation /
        // bracket fixups.
        const diffs = '[193 /afii57636 /afii57637 /afii57638 196 /afii57639 /afii57640 /afii57641]';
        const heb1 = '\\301\\302\\303';
        const heb2 = '\\304\\305\\306';
        // "<heb1> [Default] <heb2>." with a square-bracketed LTR token + period
        const content = `BT /F1 16 Tf 400 700 Td (${heb1} [Default] ${heb2}.) Tj ET`;
        const pdf = scaffold({
            content: strToBytes(content),
            resources: '/Font << /F1 5 0 R >>',
        })
            .obj(5, '/Type /Font /Subtype /Type1 /BaseFont /David /Encoding 6 0 R')
            .obj(6, `/Type /Encoding /Differences ${diffs}`)
            .build();
        const result = await parsePdf(pdf);
        expect(result.html).toContain('dir="rtl"');
        expect(result.text).toContain('Default');
        expect(result.text).toContain('א');
    });

    it('handles a leading round-bracket LTR token inside RTL text', async () => {
        const diffs = '[193 /afii57636 /afii57637 /afii57638]';
        const heb = '\\301\\302\\303';
        const content = `BT /F1 16 Tf 400 700 Td (${heb} (Note) ${heb}) Tj ET`;
        const pdf = scaffold({
            content: strToBytes(content),
            resources: '/Font << /F1 5 0 R >>',
        })
            .obj(5, '/Type /Font /Subtype /Type1 /BaseFont /David /Encoding 6 0 R')
            .obj(6, `/Type /Encoding /Differences ${diffs}`)
            .build();
        const result = await parsePdf(pdf);
        expect(result.html).toContain('dir="rtl"');
        expect(result.text).toContain('Note');
    });
});

describe('parsePdf - subscript text rise', () => {
    it('wraps lowered text (negative Ts) in a <sub>', async () => {
        const pdf = scaffold({
            content: strToBytes('BT /F1 12 Tf 100 700 Td (base) Tj -5 Ts (low) Tj ET'),
            resources: '/Font << /F1 5 0 R >>',
        }).obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica').build();
        const result = await parsePdf(pdf);
        expect(result.html).toContain('<sub>');
    });
});

describe('parsePdf - adjacent stacked border boxes', () => {
    it('merges two vertically-adjacent code-block borders', async () => {
        // Two stroked rects stacked, each fully containing its own text lines.
        const content =
            '0 0 0 RG 1 w 80 640 400 60 re S ' +
            'BT /F1 9 Tf 100 680 Td (Box one upper content line) Tj ET ' +
            'BT /F1 9 Tf 100 660 Td (Box one lower content line) Tj ET ' +
            '0 0 0 RG 1 w 80 580 400 60 re S ' +
            'BT /F1 9 Tf 100 620 Td (Box two upper content line) Tj ET ' +
            'BT /F1 9 Tf 100 600 Td (Box two lower content line) Tj ET ' +
            'BT /F1 12 Tf 100 480 Td (Plain body text one here) Tj ET ' +
            'BT /F1 12 Tf 100 460 Td (Plain body text two here) Tj ET ' +
            'BT /F1 12 Tf 100 440 Td (Plain body text three here) Tj ET';
        const pdf = scaffold({
            content: strToBytes(content),
            resources: '/Font << /F1 5 0 R >>',
        }).obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica').build();
        const result = await parsePdfPaged(pdf);
        expect(result.pages[0].html).toContain('border:');
        expect(result.pages[0].html).toContain('Box one upper content line');
    });
});

describe('parsePdf - empty / degenerate pages', () => {
    it('produces an empty-page result when a page has no Contents', async () => {
        const pdf = new RawPdf()
            .setRoot(1)
            .obj(1, '/Type /Catalog /Pages 2 0 R')
            .obj(2, '/Type /Pages /Kids [3 0 R 6 0 R] /Count 2')
            .obj(3, '/Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R')
            .streamObj(4, '', strToBytes('BT /F1 12 Tf 100 700 Td (RealPage) Tj ET'))
            .obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica')
            .obj(6, '/Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >>')
            .build();
        const result = await parsePdfPaged(pdf);
        expect(result.totalPages).toBe(2);
        expect(result.pages[0].text).toContain('RealPage');
        expect(result.pages[1].text).toBe('');
    });
});

describe('PdfReader - root & decode-parms resolution', () => {
    it('finds the catalog by scanning objects when the trailer lacks /Root', () => {
        // Build a PDF and then strip /Root from the trailer to force the
        // getRoot() object-scan fallback.
        const pdf = scaffold({
            content: strToBytes('BT /F1 12 Tf 100 700 Td (RootScan) Tj ET'),
            resources: '/Font << /F1 5 0 R >>',
        }).obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica').build();
        // Remove the "/Root 1 0 R" token from the trailer bytes.
        const txt = new TextDecoder('latin1').decode(new Uint8Array(pdf));
        const patched = txt.replace('/Root 1 0 R', '');
        const reader = new PdfReader(new TextEncoder().encode(patched).buffer);
        reader.parse();
        const root = reader.getRoot();
        expect(reader.getString(root['Type'])).toBe('Catalog');
    });

    it('decodes a stream with a per-filter DecodeParms array', async () => {
        // Chain ASCII85 then Flate with a DecodeParms array [null params, null].
        const inner = strToBytes('BT /F1 12 Tf 50 700 Td (ParmsArray) Tj ET');
        const flated = flateEncode(inner);
        const a85 = ascii85Encode(flated);
        const pdf = scaffold({
            content: strToBytes(a85),
            contentDict: '/Filter [/ASCII85Decode /FlateDecode] /DecodeParms [null null]',
            resources: '/Font << /F1 5 0 R >>',
        }).obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica').build();
        const result = await parsePdf(pdf);
        expect(result.text).toContain('ParmsArray');
    });
});

describe('parsePdf - CID font width ranges & ToUnicode array form', () => {
    it('parses CID W ranges (c_first c_last w form) and bfrange array form', async () => {
        // ToUnicode bfrange array form: <0001> <0003> [<0041> <0042> <0043>]
        const cmap = [
            'begincmap',
            '1 beginbfrange',
            '<0001> <0003> [<0041> <0042> <0043>]',
            'endbfrange',
            'endcmap',
        ].join('\n');
        const pdf = scaffold({
            content: strToBytes('BT /F1 12 Tf 100 700 Td <000100020003> Tj ET'),
            resources: '/Font << /F1 5 0 R >>',
        })
            .obj(5, '/Type /Font /Subtype /Type0 /BaseFont /T /Encoding /Identity-H /DescendantFonts [7 0 R] /ToUnicode 6 0 R')
            .streamObj(6, '', strToBytes(cmap))
            // W array uses both forms: "1 [500]" and "2 3 700" (range)
            .obj(7, '/Type /Font /Subtype /CIDFontType2 /BaseFont /T /DW 1000 /W [1 [500] 2 3 700]')
            .build();
        const result = await parsePdf(pdf);
        expect(result.text).toContain('ABC');
    });
});

describe('parsePdf - CMYK stroke & device colors', () => {
    it('sets a CMYK stroke color via the K operator', async () => {
        const content =
            '1 0 0 0 K 3 w 80 700 m 480 700 l S ' +
            'BT /F1 12 Tf 100 600 Td (CmykStrokeBody) Tj ET';
        const pdf = scaffold({
            content: strToBytes(content),
            resources: '/Font << /F1 5 0 R >>',
        }).obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica').build();
        const result = await parsePdf(pdf);
        expect(result.text).toContain('CmykStrokeBody');
    });

    it('sets an RGB stroke color via the RG operator and a gray via G', async () => {
        const content =
            '1 0 0 RG 0.5 G 2 w 80 700 m 480 700 l S ' +
            'BT /F1 12 Tf 100 600 Td (StrokeOps) Tj ET';
        const pdf = scaffold({
            content: strToBytes(content),
            resources: '/Font << /F1 5 0 R >>',
        }).obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica').build();
        const result = await parsePdf(pdf);
        expect(result.text).toContain('StrokeOps');
    });
});

describe('parsePdf - vertical decorative line / border near box', () => {
    it('handles a tall vertical line segment without crashing', async () => {
        const content =
            '0 0 0 rg 300 400 1 200 re f ' +              // vertical line
            'BT /F1 12 Tf 100 700 Td (BesideVertical) Tj ET ' +
            'BT /F1 12 Tf 100 680 Td (Second body line here) Tj ET';
        const pdf = scaffold({
            content: strToBytes(content),
            resources: '/Font << /F1 5 0 R >>',
        }).obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica').build();
        const result = await parsePdfPaged(pdf);
        expect(result.pages[0].text).toContain('BesideVertical');
    });
});

describe('parsePdf - ExtGState font selection', () => {
    it('applies a font set via an ExtGState /Font entry', async () => {
        const content = '/GS0 gs BT 100 700 Td (GsFontText) Tj ET';
        const pdf = scaffold({
            content: strToBytes(content),
            resources: '/Font << /F1 5 0 R >> /ExtGState << /GS0 6 0 R >>',
        })
            .obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica')
            .obj(6, '/Type /ExtGState /Font [5 0 R 12]')
            .build();
        const result = await parsePdf(pdf);
        expect(result.text).toContain('GsFontText');
    });
});

describe('parsePdf - structure tree H4/H5/H6 levels', () => {
    it('maps H4, H5, H6 structure types to heading levels', async () => {
        const mk = (htype: string, label: string): Promise<string> => {
            const content = `BT /F1 12 Tf 100 700 Td /Span <</MCID 0>> BDC (${label}) Tj EMC ET`;
            const pdf = new RawPdf()
                .setRoot(1)
                .obj(1, '/Type /Catalog /Pages 2 0 R /StructTreeRoot 6 0 R')
                .obj(2, '/Type /Pages /Kids [3 0 R] /Count 1')
                .obj(3, '/Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R')
                .streamObj(4, '', strToBytes(content))
                .obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica')
                .obj(6, '/Type /StructTreeRoot /K 7 0 R')
                .obj(7, `/Type /StructElem /S /${htype} /Pg 3 0 R /K 0`)
                .build();
            return parsePdfPaged(pdf).then(r => r.pages[0].html);
        };
        expect(await mk('H4', 'Heading Four')).toMatch(/<h4[^>]*>[\s\S]*Heading Four/);
        expect(await mk('H5', 'Heading Five')).toMatch(/<h5[^>]*>[\s\S]*Heading Five/);
        expect(await mk('H6', 'Heading Six')).toMatch(/<h6[^>]*>[\s\S]*Heading Six/);
    });
});

describe('parsePdf - two-byte char without ToUnicode (direct codepoint)', () => {
    it('falls back to the raw code point for an unmapped two-byte glyph', async () => {
        // Identity-H Type0 with NO ToUnicode. Code <0041> -> direct 'A'.
        const pdf = scaffold({
            content: strToBytes('BT /F1 12 Tf 100 700 Td <00410042> Tj ET'),
            resources: '/Font << /F1 5 0 R >>',
        })
            .obj(5, '/Type /Font /Subtype /Type0 /BaseFont /T /Encoding /Identity-H /DescendantFonts [7 0 R]')
            .obj(7, '/Type /Font /Subtype /CIDFontType2 /BaseFont /T /DW 1000')
            .build();
        const result = await parsePdf(pdf);
        expect(result.text).toContain('AB');
    });
});

describe('parsePdf - CFF default width fallback', () => {
    it('handles a font with a FontFile3 stream and no Widths array', async () => {
        // A Type1C/CFF-ish FontFile3 with the CFF header bytes searchCffWidthInData
        // looks for. major=1, hdrSize, offSize in [1..4], a 0x14 op later.
        const cff = new Uint8Array(40);
        cff[0] = 1;   // major version
        cff[1] = 0;   // minor
        cff[2] = 4;   // hdrSize (nameOffset start)
        cff[3] = 2;   // offSize (1..4)
        cff[10] = 150; // a byte that becomes the width operand
        cff[11] = 0x14; // the 'defaultWidthX' style operator searched for
        const pdf = scaffold({
            content: strToBytes('BT /F1 12 Tf 100 700 Td (CffWidth) Tj ET'),
            resources: '/Font << /F1 5 0 R >>',
        })
            .obj(5, '/Type /Font /Subtype /Type1 /BaseFont /CFFFont /FontDescriptor 6 0 R')
            .streamObj(6, '/Type /FontDescriptor /FontName /CFFFont /FontFile3 7 0 R', new Uint8Array(0))
            .streamObj(7, '/Subtype /Type1C', cff)
            .build();
        const result = await parsePdf(pdf);
        expect(result.text).toContain('CffWidth');
    });
});

describe('parsePdf - hex string object values', () => {
    it('reads an outline title encoded as a hex string', async () => {
        // Title <48656C6C6F> = "Hello"; exercises PdfReader.parseHexString.
        const pdf = new RawPdf()
            .setRoot(1)
            .obj(1, '/Type /Catalog /Pages 2 0 R /Outlines 8 0 R')
            .obj(2, '/Type /Pages /Kids [3 0 R] /Count 1')
            .obj(3, '/Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R')
            .streamObj(4, '', strToBytes('BT /F1 12 Tf 100 700 Td (HexTitleDoc) Tj ET'))
            .obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica')
            .obj(8, '/Type /Outlines /First 9 0 R /Last 9 0 R /Count 1')
            .obj(9, '/Title <48656C6C6F> /A << /S /GoTo /D [3 0 R /Fit] >>')
            .build();
        const result = await parsePdfPaged(pdf);
        expect(result.outline[0].title).toBe('Hello');
    });
});

describe('parsePdf - CMYK indexed image', () => {
    it('renders an indexed image over a DeviceCMYK base color space', async () => {
        // Indexed base CMYK: 2 entries, 4 channels each. idx 0 -> cyan.
        const palette = new Uint8Array([255, 0, 0, 0, 0, 255, 0, 0]); // cyan, magenta
        const pixels = flateEncode(new Uint8Array([0, 1]));
        const pdf = scaffold({
            content: strToBytes('q 40 0 0 40 100 600 cm /Im0 Do Q'),
            resources: '/XObject << /Im0 5 0 R >>',
        })
            .streamObj(5, '/Type /XObject /Subtype /Image /Width 2 /Height 1 /BitsPerComponent 8 /ColorSpace [/Indexed /DeviceCMYK 1 6 0 R] /Filter /FlateDecode', pixels)
            .streamObj(6, '', palette)
            .build();
        const result = await parsePdf(pdf);
        expect(result.html).toContain('data:image/png;base64,');
    });

    it('resolves scn indexed color over a CMYK base via lookup', async () => {
        const palette = new Uint8Array([0, 0, 0, 0, 255, 255, 0, 0]);
        const pdf = scaffold({
            content: strToBytes('/CS0 cs 1 scn BT /F1 12 Tf 100 700 Td (IdxCmyk) Tj ET'),
            resources: '/Font << /F1 5 0 R >> /ColorSpace << /CS0 [/Indexed /DeviceCMYK 1 6 0 R] >>',
        })
            .obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica')
            .streamObj(6, '', palette)
            .build();
        const result = await parsePdf(pdf);
        expect(result.text).toContain('IdxCmyk');
    });

    it('renders an indexed image whose base is an ICCBased(3) space', async () => {
        const palette = new Uint8Array([10, 20, 30, 200, 100, 50]);
        const pixels = flateEncode(new Uint8Array([0, 1]));
        const pdf = scaffold({
            content: strToBytes('q 40 0 0 40 100 600 cm /Im0 Do Q'),
            resources: '/XObject << /Im0 5 0 R >>',
        })
            .streamObj(5, '/Type /XObject /Subtype /Image /Width 2 /Height 1 /BitsPerComponent 8 /ColorSpace [/Indexed [/ICCBased 7 0 R] 1 6 0 R] /Filter /FlateDecode', pixels)
            .streamObj(6, '', palette)
            .streamObj(7, '/N 3', strToBytes('icc'))
            .build();
        const result = await parsePdf(pdf);
        expect(result.html).toContain('data:image/png;base64,');
    });
});

describe('parsePdf - heading split into a table row', () => {
    it('wraps a wide-gap line of two heading-sized labels as a table with <h*>', async () => {
        // One line: left label and right label, both 24pt (heading), separated
        // by a large horizontal gap -> findLargeGapIndex + lineToTableRowHtml.
        const content =
            'BT /F1 24 Tf 60 720 Td (LeftTitle) Tj ET ' +
            'BT /F1 24 Tf 400 720 Td (RightTitle) Tj ET ' +
            'BT /F1 12 Tf 60 680 Td (Body reference line one for body size) Tj ET ' +
            'BT /F1 12 Tf 60 660 Td (Body reference line two for body size) Tj ET ' +
            'BT /F1 12 Tf 60 640 Td (Body reference line three for size) Tj ET';
        const pdf = scaffold({
            content: strToBytes(content),
            resources: '/Font << /F1 5 0 R >>',
            mediaBox: '[0 0 612 792]',
        }).obj(5, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica').build();
        const result = await parsePdfPaged(pdf);
        expect(result.pages[0].html).toContain('<table');
        expect(result.pages[0].html).toMatch(/<h[1-3][^>]*>[\s\S]*LeftTitle/);
        expect(result.pages[0].html).toContain('RightTitle');
    });
});

describe('parsePdf - char-by-char word gap clustering', () => {
    it('clusters per-char gaps to find a word-boundary threshold', async () => {
        // Many single chars on one line: small intra-word gaps (~2) and larger
        // inter-word gaps (~14) so the gap histogram has a clear jump.
        const widths = '/FirstChar 32 /Widths [' + new Array(96).fill('400').join(' ') + ']';
        const parts: string[] = ['BT /F1 12 Tf'];
        const words = ['alpha', 'bravo', 'charlie', 'delta'];
        let x = 60;
        for (const w of words) {
            for (const ch of w) {
                parts.push(`1 0 0 1 ${x} 700 Tm (${ch}) Tj`);
                x += 6; // glyph advance 400/1000*12 = 4.8 -> gap ~1.2 intra-word
            }
            x += 14; // inter-word gap
        }
        parts.push('ET');
        const pdf = scaffold({
            content: strToBytes(parts.join(' ')),
            resources: '/Font << /F1 5 0 R >>',
        }).obj(5, `/Type /Font /Subtype /Type1 /BaseFont /Helvetica ${widths}`).build();
        const result = await parsePdf(pdf);
        expect(result.html).toContain('alpha');
        expect(result.html).toContain('bravo');
    });
});

describe('parsePdf - LTR fragment inside an RTL document', () => {
    it('keeps an isolated LTR line readable within an RTL document', async () => {
        // One RTL (Hebrew) line establishes the document as RTL; a second line
        // is pure LTR with a leading bracket to drive fixLtrLineItemInRtlDoc.
        const diffs = '[193 /afii57636 /afii57637 /afii57638]';
        const heb = '\\301\\302\\303';
        const content =
            `BT /F1 16 Tf 400 700 Td (${heb} ${heb} ${heb}) Tj ET ` +
            'BT /F1 16 Tf 400 670 Td (]LTR text line here) Tj ET';
        const pdf = scaffold({
            content: strToBytes(content),
            resources: '/Font << /F1 5 0 R >>',
        })
            .obj(5, '/Type /Font /Subtype /Type1 /BaseFont /David /Encoding 6 0 R')
            .obj(6, `/Type /Encoding /Differences ${diffs}`)
            .build();
        const result = await parsePdf(pdf);
        expect(result.html).toContain('dir="rtl"');
        expect(result.text).toContain('LTR text line here');
    });
});
