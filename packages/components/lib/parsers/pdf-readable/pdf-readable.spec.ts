import { describe, expect, it } from 'vitest';
import { PdfBuilder } from '../pdf-test-fixtures';
import { parsePdfReadable } from './pdf-readable';

describe('parsePdfReadable', () => {
    describe('input validation', () => {
        it('rejects a non-PDF buffer', async () => {
            const buffer = new TextEncoder().encode('const x = 1;').buffer;
            await expect(parsePdfReadable(buffer)).rejects.toThrow('Not a valid PDF file.');
        });

        it('rejects a corrupted PDF body', async () => {
            const buffer = new TextEncoder().encode('%PDF-1.7\nnot really a pdf').buffer;
            await expect(parsePdfReadable(buffer)).rejects.toThrow(
                'Unable to read this PDF. It may be corrupted or use an unsupported format.');
        });
    });

    describe('paragraph structure', () => {
        it('emits a single paragraph for one text line', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 100 700 Td (Hello World) Tj ET')
                .build();
            const result = await parsePdfReadable(pdf);
            expect(result.html).toContain('<p');
            expect(result.html).toContain('Hello World');
            expect(result.text).toBe('Hello World');
            expect(result.imageOnly).toBe(false);
            expect(result.pageCount).toBe(1);
        });

        it('keeps consecutive lines with normal leading in one paragraph', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent(
                    'BT /F1 12 Tf 100 700 Td (First line of text) Tj ' +
                    '0 -14 Td (second line continues) Tj ' +
                    '0 -14 Td (third line ends here.) Tj ET')
                .build();
            const result = await parsePdfReadable(pdf);
            const paragraphs = result.html.match(/<p[\s>]/g) ?? [];
            expect(paragraphs).toHaveLength(1);
            expect(result.text).toBe('First line of text second line continues third line ends here.');
        });

        it('splits paragraphs at a vertical gap much larger than the leading', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent(
                    'BT /F1 12 Tf 100 700 Td (Paragraph one line one) Tj ' +
                    '0 -14 Td (paragraph one line two) Tj ' +
                    '0 -50 Td (Paragraph two starts here) Tj ' +
                    '0 -14 Td (and continues on) Tj ET')
                .build();
            const result = await parsePdfReadable(pdf);
            const paragraphs = result.html.match(/<p[\s>]/g) ?? [];
            expect(paragraphs).toHaveLength(2);
        });

        it('separates words shown as split Tj fragments with a space-sized gap', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent(
                    'BT /F1 12 Tf 100 700 Td (Alpha) Tj 40 0 Td (Beta) Tj ET')
                .build();
            const result = await parsePdfReadable(pdf);
            expect(result.text).toBe('Alpha Beta');
        });
    });

    describe('styling fidelity', () => {
        it('carries non-black fill color into the output styles', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 1 0 0 rg 100 700 Td (Red text) Tj ET')
                .build();
            const result = await parsePdfReadable(pdf);
            expect(result.html).toContain('color:#ff0000');
        });

        it('emits font-size from the PDF text state', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 24 Tf 100 700 Td (Big text) Tj ET')
                .build();
            const result = await parsePdfReadable(pdf);
            expect(result.html).toContain('font-size:24pt');
        });

        it('marks bold text from a bold base font', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica-Bold', { fontWeight: 700 })
                .setContent('BT /F1 12 Tf 100 700 Td (Bold words) Tj ET')
                .build();
            const result = await parsePdfReadable(pdf);
            expect(result.html).toContain('<strong>');
        });

        it('escapes HTML-special characters in text content', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 100 700 Td (a<b&c>d) Tj ET')
                .build();
            const result = await parsePdfReadable(pdf);
            expect(result.html).toContain('a&lt;b&amp;c&gt;d');
            expect(result.html).not.toContain('a<b');
        });
    });

    describe('links', () => {
        it('wraps text covered by a URI link annotation in an anchor', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 100 700 Td (Visit site) Tj ET')
                .addLinkAnnotation(0, [95, 695, 200, 715], 'https://example.com')
                .build();
            const result = await parsePdfReadable(pdf);
            expect(result.html).toContain('<a href="https://example.com"');
            expect(result.html).toContain('Visit site</');
        });
    });

    describe('multi-page documents', () => {
        it('emits pages in order with pageCount', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 100 700 Td (Page one content) Tj ET')
                .addPage('BT /F1 12 Tf 100 700 Td (Page two content) Tj ET')
                .build();
            const result = await parsePdfReadable(pdf);
            expect(result.pageCount).toBe(2);
            expect(result.text.indexOf('Page one content'))
                .toBeLessThan(result.text.indexOf('Page two content'));
        });

        it('wraps pages and separates them with hr when pageWrappers is on', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 100 700 Td (One) Tj ET')
                .addPage('BT /F1 12 Tf 100 700 Td (Two) Tj ET')
                .build();
            const result = await parsePdfReadable(pdf, { pageWrappers: true });
            expect(result.html).toContain('max-width:612pt');
            expect(result.html).toContain('<hr>');
        });
    });

    describe('options', () => {
        it('returns empty fontFaceCss when embedFonts is off', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 100 700 Td (Plain) Tj ET')
                .build();
            const result = await parsePdfReadable(pdf, { embedFonts: false });
            expect(result.fontFaceCss).toBe('');
        });

        it('produces sanitizer-safe markup: no style tags and no class attributes', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 100 700 Td (Safe output) Tj ET')
                .build();
            const result = await parsePdfReadable(pdf);
            expect(result.html).not.toContain('<style');
            expect(result.html).not.toContain('class=');
        });
    });
});
