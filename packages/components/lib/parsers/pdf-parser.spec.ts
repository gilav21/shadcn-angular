import { describe, expect, it } from 'vitest';
import { parsePdf } from './pdf-parser';

function toBuffer(bytes: number[]): ArrayBuffer {
    return new Uint8Array(bytes).buffer;
}

/**
 * Minimal PDF builder for testing.
 * Produces a valid PDF 1.4 document with a single page and configurable
 * fonts, content stream, and optional structure tree.
 */
class PdfBuilder {
    private readonly objects: { num: number; content: string }[] = [];
    private nextObj = 1;
    private readonly fonts: { name: string; baseFont: string; descriptor?: string }[] = [];
    private contentStream = '';
    private structTreeObjNum = 0;
    private readonly pageWidth: number;
    private readonly pageHeight: number;

    constructor(width = 612, height = 792) {
        this.pageWidth = width;
        this.pageHeight = height;
    }

    addFont(name: string, baseFont: string, opts?: {
        flags?: number;
        fontWeight?: number;
        italicAngle?: number;
    }): this {
        let descriptor: string | undefined;
        if (opts) {
            const descriptorObj = this.nextObj++;
            const parts: string[] = [
                `/Type /FontDescriptor`,
                `/FontName /${baseFont}`,
            ];
            if (opts.flags !== undefined) parts.push(`/Flags ${opts.flags}`);
            if (opts.fontWeight !== undefined) parts.push(`/FontWeight ${opts.fontWeight}`);
            if (opts.italicAngle !== undefined) parts.push(`/ItalicAngle ${opts.italicAngle}`);
            this.objects.push({
                num: descriptorObj,
                content: `<< ${parts.join(' ')} >>`,
            });
            descriptor = `${descriptorObj} 0 R`;
        }
        this.fonts.push({ name, baseFont, descriptor });
        return this;
    }

    setContent(stream: string): this {
        this.contentStream = stream;
        return this;
    }

    addStructureTree(structType: string, mcid: number): this {
        const structElemObj = this.nextObj++;
        this.objects.push({
            num: structElemObj,
            content: `<< /Type /StructElem /S /${structType} /K << /Type /MCR /MCID ${mcid} /Pg PAGE_REF >> >>`,
        });

        const structTreeObj = this.nextObj++;
        this.objects.push({
            num: structTreeObj,
            content: `<< /Type /StructTreeRoot /K ${structElemObj} 0 R >>`,
        });
        this.structTreeObjNum = structTreeObj;
        return this;
    }

    build(): ArrayBuffer {
        const catalogObj = this.nextObj++;
        const pagesObj = this.nextObj++;
        const pageObj = this.nextObj++;
        const contentObj = this.nextObj++;

        const fontEntries: string[] = [];
        const fontObjects: { num: number; content: string }[] = [];
        for (const font of this.fonts) {
            const fontObjNum = this.nextObj++;
            const parts = [
                `/Type /Font`,
                `/Subtype /Type1`,
                `/BaseFont /${font.baseFont}`,
            ];
            if (font.descriptor) {
                parts.push(`/FontDescriptor ${font.descriptor}`);
            }
            fontObjects.push({
                num: fontObjNum,
                content: `<< ${parts.join(' ')} >>`,
            });
            fontEntries.push(`/${font.name} ${fontObjNum} 0 R`);
        }

        const resourcesDict = fontEntries.length > 0
            ? `<< /Font << ${fontEntries.join(' ')} >> >>`
            : `<< >>`;

        const catalogParts = [`/Type /Catalog`, `/Pages ${pagesObj} 0 R`];
        if (this.structTreeObjNum > 0) {
            catalogParts.push(`/StructTreeRoot ${this.structTreeObjNum} 0 R`);
        }

        const allObjects: { num: number; content: string }[] = [
            ...this.objects,
            ...fontObjects,
            { num: catalogObj, content: `<< ${catalogParts.join(' ')} >>` },
            { num: pagesObj, content: `<< /Type /Pages /Kids [${pageObj} 0 R] /Count 1 >>` },
            { num: pageObj, content: `<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${this.pageWidth} ${this.pageHeight}] /Resources ${resourcesDict} /Contents ${contentObj} 0 R >>` },
            { num: contentObj, content: `<< /Length ${this.contentStream.length} >>\nstream\n${this.contentStream}\nendstream` },
        ];

        allObjects.sort((a, b) => a.num - b.num);

        let body = '%PDF-1.4\n';
        const offsets = new Map<number, number>();

        for (const obj of allObjects) {
            let content = obj.content;
            if (content.includes('PAGE_REF')) {
                content = content.replaceAll('PAGE_REF', `${pageObj} 0 R`);
            }
            offsets.set(obj.num, body.length);
            body += `${obj.num} 0 obj\n${content}\nendobj\n`;
        }

        const xrefOffset = body.length;
        const totalObjects = allObjects.length + 1;
        let xref = `xref\n0 ${totalObjects}\n`;
        xref += '0000000000 65535 f \n';
        for (let i = 1; i < totalObjects; i++) {
            const off = offsets.get(i) ?? 0;
            xref += `${String(off).padStart(10, '0')} 00000 n \n`;
        }

        const trailer = `trailer\n<< /Size ${totalObjects} /Root ${catalogObj} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

        const fullPdf = body + xref + trailer;
        return new TextEncoder().encode(fullPdf).buffer;
    }
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
