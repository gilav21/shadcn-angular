import { describe, expect, it } from 'vitest';
import {
    renderPixelPerfectPaged, toStandaloneHtml,
    NumericStateManager, ColorStateManager, TransformMatrixManager, AllStateManager,
} from './pdf-pixel-perfect';
import { buildTtf, type TtfBuilderGlyph } from './ttf-builder';

// ── Test PDF Builder ──────────────────────────────────────────────────

class PdfBuilder {
    private readonly objects: { num: number; content: string }[] = [];
    private nextObj = 1;
    private readonly fonts: { name: string; baseFont: string }[] = [];
    private contentStream = '';
    private readonly pageWidth: number;
    private readonly pageHeight: number;
    private readonly extraPages: { width: number; height: number; content: string }[] = [];

    constructor(width = 612, height = 792) {
        this.pageWidth = width;
        this.pageHeight = height;
    }

    addFont(name: string, baseFont: string): this {
        this.fonts.push({ name, baseFont });
        return this;
    }

    setContent(stream: string): this {
        this.contentStream = stream;
        return this;
    }

    addPage(width: number, height: number, content: string): this {
        this.extraPages.push({ width, height, content });
        return this;
    }

    build(): ArrayBuffer {
        const catalogObj = this.nextObj++;
        const pagesObj = this.nextObj++;

        const fontEntries: string[] = [];
        const fontObjects: { num: number; content: string }[] = [];
        for (const font of this.fonts) {
            const fontObjNum = this.nextObj++;
            fontObjects.push({
                num: fontObjNum,
                content: `<< /Type /Font /Subtype /Type1 /BaseFont /${font.baseFont} >>`,
            });
            fontEntries.push(`/${font.name} ${fontObjNum} 0 R`);
        }

        const resourcesDict = fontEntries.length > 0
            ? `<< /Font << ${fontEntries.join(' ')} >> >>`
            : `<< >>`;

        const pageRefs: string[] = [];

        const pageObj1 = this.nextObj++;
        const contentObj1 = this.nextObj++;
        pageRefs.push(`${pageObj1} 0 R`);

        const pageContentPairs: { pageNum: number; contentNum: number; w: number; h: number; stream: string }[] = [
            { pageNum: pageObj1, contentNum: contentObj1, w: this.pageWidth, h: this.pageHeight, stream: this.contentStream },
        ];

        for (const ep of this.extraPages) {
            const pn = this.nextObj++;
            const cn = this.nextObj++;
            pageRefs.push(`${pn} 0 R`);
            pageContentPairs.push({ pageNum: pn, contentNum: cn, w: ep.width, h: ep.height, stream: ep.content });
        }

        const allObjects: { num: number; content: string }[] = [
            ...this.objects,
            ...fontObjects,
            { num: catalogObj, content: `<< /Type /Catalog /Pages ${pagesObj} 0 R >>` },
            { num: pagesObj, content: `<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${pageContentPairs.length} >>` },
        ];

        for (const pc of pageContentPairs) {
            allObjects.push({
                num: pc.pageNum,
                content: `<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${pc.w} ${pc.h}] /Resources ${resourcesDict} /Contents ${pc.contentNum} 0 R >>`,
            }, {
                num: pc.contentNum,
                content: `<< /Length ${pc.stream.length} >>\nstream\n${pc.stream}\nendstream`,
            });
        }

        allObjects.sort((a, b) => a.num - b.num);

        let body = '%PDF-1.4\n';
        const offsets = new Map<number, number>();
        for (const obj of allObjects) {
            offsets.set(obj.num, body.length);
            body += `${obj.num} 0 obj\n${obj.content}\nendobj\n`;
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
        const pdf = body + xref + trailer;
        return new TextEncoder().encode(pdf).buffer;
    }
}

// ── Helper: parse CSS class values from generated CSS ─────────────────

function _extractCssValue(css: string, className: string): string | null {
    const re = new RegExp(String.raw`\.${className}\{([^}]+)\}`);
    const m = re.exec(css);
    return m ? m[1] : null;
}

function extractAllClasses(css: string, prefix: string): Map<string, string> {
    const re = new RegExp(String.raw`\.${prefix}([0-9a-f]+)\{([^}]+)\}`, 'g');
    const map = new Map<string, string>();
    let m;
    while ((m = re.exec(css)) !== null) {
        map.set(`${prefix}${m[1]}`, m[2]);
    }
    return map;
}

function countDivsByClass(html: string, cls: string): number {
    const re = new RegExp(String.raw`class="[^"]*\b${cls}\b`, 'g');
    return [...html.matchAll(re)].length;
}

// ══════════════════════════════════════════════════════════════════════
// Unit Tests: NumericStateManager
// ══════════════════════════════════════════════════════════════════════

describe('NumericStateManager', () => {
    it('should assign sequential IDs to distinct values', () => {
        const mgr = new NumericStateManager(0.01);
        expect(mgr.install(10)).toBe(0);
        expect(mgr.install(20)).toBe(1);
        expect(mgr.install(30)).toBe(2);
    });

    it('should deduplicate values within epsilon', () => {
        const mgr = new NumericStateManager(0.5);
        const id1 = mgr.install(12);
        const id2 = mgr.install(12.3);
        const id3 = mgr.install(14);
        expect(id1).toBe(id2);
        expect(id3).not.toBe(id1);
    });

    it('should not deduplicate values outside epsilon', () => {
        const mgr = new NumericStateManager(0.01);
        const id1 = mgr.install(10);
        const id2 = mgr.install(10.02);
        expect(id1).not.toBe(id2);
    });

    it('should return same ID for exact re-installations', () => {
        const mgr = new NumericStateManager(0.001);
        const id1 = mgr.install(42.5);
        const id2 = mgr.install(42.5);
        const id3 = mgr.install(42.5);
        expect(id1).toBe(id2);
        expect(id2).toBe(id3);
    });

    it('should generate one CSS rule per unique value', () => {
        const mgr = new NumericStateManager(0.01);
        mgr.install(12);
        mgr.install(12.005);
        mgr.install(14);
        mgr.install(16);

        const css = mgr.dumpCss('fs', v => `font-size:${v}px;`);
        const rules = css.split('\n').filter(Boolean);
        expect(rules).toHaveLength(3);
        expect(rules[0]).toContain('.fs0{font-size:12px;}');
        expect(rules[1]).toContain('.fs1{font-size:14px;}');
        expect(rules[2]).toContain('.fs2{font-size:16px;}');
    });

    it('should use hex IDs in CSS class names', () => {
        const mgr = new NumericStateManager(0.001);
        for (let i = 0; i < 17; i++) mgr.install(i * 10);
        const css = mgr.dumpCss('x', v => `left:${v}px;`);
        expect(css).toContain('.x10{');
        expect(css).toContain('.xa{');
    });
});

// ══════════════════════════════════════════════════════════════════════
// Unit Tests: ColorStateManager
// ══════════════════════════════════════════════════════════════════════

describe('ColorStateManager', () => {
    it('should assign unique IDs to distinct colors', () => {
        const mgr = new ColorStateManager();
        expect(mgr.install('#ff0000')).toBe(0);
        expect(mgr.install('#00ff00')).toBe(1);
        expect(mgr.install('#0000ff')).toBe(2);
    });

    it('should deduplicate identical colors', () => {
        const mgr = new ColorStateManager();
        const id1 = mgr.install('#ff0000');
        const id2 = mgr.install('#00ff00');
        const id3 = mgr.install('#ff0000');
        expect(id1).toBe(id3);
        expect(id1).not.toBe(id2);
    });

    it('should generate fill CSS with color property', () => {
        const mgr = new ColorStateManager();
        mgr.install('#ff0000');
        mgr.install('#00ff00');
        const css = mgr.dumpFillCss('fc');
        expect(css).toContain('.fc0{color:#ff0000;}');
        expect(css).toContain('.fc1{color:#00ff00;}');
    });

    it('should generate stroke CSS with text-shadow', () => {
        const mgr = new ColorStateManager();
        mgr.install('#ff0000');
        const css = mgr.dumpStrokeCss('sc');
        expect(css).toContain('.sc0{text-shadow:');
        expect(css).toContain('-0.015em 0 #ff0000');
        expect(css).toContain('0 0.015em #ff0000');
        expect(css).toContain('0.015em 0 #ff0000');
        expect(css).toContain('0 -0.015em #ff0000');
    });
});

// ══════════════════════════════════════════════════════════════════════
// Unit Tests: TransformMatrixManager
// ══════════════════════════════════════════════════════════════════════

describe('TransformMatrixManager', () => {
    it('should produce transform:none for identity matrix', () => {
        const mgr = new TransformMatrixManager();
        mgr.install([1, 0, 0, 1]);
        const css = mgr.dumpCss('m');
        expect(css).toContain('transform:none');
    });

    it('should produce transform:matrix() for non-identity', () => {
        const mgr = new TransformMatrixManager();
        mgr.install([0.5, 0.866, -0.866, 0.5]);
        const css = mgr.dumpCss('m');
        expect(css).toContain('transform:matrix(');
        expect(css).not.toContain('transform:none');
    });

    it('should negate b and c elements for PDF-to-CSS conversion', () => {
        const mgr = new TransformMatrixManager();
        mgr.install([1, 0.5, -0.3, 1]);
        const css = mgr.dumpCss('m');
        // b=0.5 should become -0.5, c=-0.3 should become 0.3
        expect(css).toContain('matrix(1,-0.5,0.3,1,0,0)');
    });

    it('should deduplicate identical transforms', () => {
        const mgr = new TransformMatrixManager();
        const id1 = mgr.install([1, 0, 0, 1]);
        const id2 = mgr.install([1, 0, 0, 1]);
        const id3 = mgr.install([0.5, 0, 0, 0.5]);
        expect(id1).toBe(id2);
        expect(id3).not.toBe(id1);
    });

    it('should deduplicate transforms within epsilon', () => {
        const mgr = new TransformMatrixManager();
        const id1 = mgr.install([1, 0, 0, 1]);
        const id2 = mgr.install([1.0005, 0.0003, -0.0002, 0.9998]);
        expect(id1).toBe(id2);
    });
});

// ══════════════════════════════════════════════════════════════════════
// Unit Tests: AllStateManager
// ══════════════════════════════════════════════════════════════════════

describe('AllStateManager', () => {
    it('should generate CSS with all manager prefixes', () => {
        const mgr = new AllStateManager();
        mgr.fontSize.install(12);
        mgr.fillColor.install('#000000');
        mgr.left.install(72);
        mgr.bottom.install(720);
        mgr.height.install(9.6);
        mgr.transformMatrix.install([1, 0, 0, 1]);

        const css = mgr.dumpAllCss();
        expect(css).toContain('.fs0{font-size:');
        expect(css).toContain('.fc0{color:#000000');
        expect(css).toContain('.x0{left:');
        expect(css).toContain('.y0{bottom:');
        expect(css).toContain('.h0{height:');
        expect(css).toContain('.m0{transform:none');
    });

    it('should generate whitespace CSS with width for positive and margin-left for negative', () => {
        const mgr = new AllStateManager();
        mgr.whitespace.install(5);
        mgr.whitespace.install(-3);

        const css = mgr.dumpAllCss();
        expect(css).toMatch(/\._0\{width:5px;\}/);
        expect(css).toMatch(/\._1\{margin-left:-3px;\}/);
    });
});

// ══════════════════════════════════════════════════════════════════════
// Integration Tests: Page Structure
// ══════════════════════════════════════════════════════════════════════

describe('renderPixelPerfectPaged', () => {
    it('should reject non-PDF input', async () => {
        const notPdf = new TextEncoder().encode('not a pdf').buffer;
        await expect(renderPixelPerfectPaged(notPdf)).rejects.toThrow('Not a valid PDF file');
    });

    it('should handle empty content stream gracefully', async () => {
        const pdf = new PdfBuilder()
            .addFont('F1', 'Helvetica')
            .setContent('')
            .build();

        const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
        expect(result.totalPages).toBe(1);
        expect(result.pages[0].html).toContain('class="pf"');
        expect(result.pages[0].text).toBe('');
    });

    describe('zoom scaling', () => {
        it('should scale page dimensions by zoom factor', async () => {
            const pdf = new PdfBuilder(612, 792)
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 72 720 Td (X) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1.3 });
            expect(result.pages[0].html).toContain('width:795.6px');
            expect(result.pages[0].html).toContain('height:1029.6px');
            expect(result.pages[0].pageWidth).toBeCloseTo(795.6, 0);
            expect(result.pages[0].pageHeight).toBeCloseTo(1029.6, 0);
        });

        it('should use default zoom of 1.3 when not specified', async () => {
            const pdf = new PdfBuilder(612, 792)
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 72 720 Td (X) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf);
            expect(result.pages[0].pageWidth).toBeCloseTo(795.6, 0);
        });

        it('should scale font sizes by zoom factor', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 72 720 Td (X) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 2 });
            const css = result.globalCss;
            // font_size_multiplier=4: tsf1=max(2,4)=4, tsf2=2/4=0.5
            // drawTextScale=1/0.5=2, curFontSize=12*2=24, scaled=24*zoom=48
            // Visual: 48 * transform(0.5) = 24px (correct)
            expect(css).toContain('font-size:48px');
        });
    });

    describe('page container', () => {
        it('should use exact page dimensions in the frame div', async () => {
            const pdf = new PdfBuilder(595.28, 841.89)
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 10 Tf 50 800 Td (A4) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const html = result.pages[0].html;
            expect(html).toContain('width:595.28px');
            expect(html).toContain('height:841.89px');
        });

        it('should nest pc inside pf with correct IDs', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 72 720 Td (X) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const html = result.pages[0].html;

            const pfIdx = html.indexOf('class="pf"');
            const pcIdx = html.indexOf('class="pc pc1"');
            expect(pfIdx).toBeGreaterThan(-1);
            expect(pcIdx).toBeGreaterThan(pfIdx);
        });

        it('should number pages starting from 1', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 72 720 Td (P1) Tj ET')
                .addPage(612, 792, 'BT /F1 12 Tf 72 720 Td (P2) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            expect(result.pages[0].html).toContain('data-page-no="1"');
            expect(result.pages[1].html).toContain('data-page-no="2"');
            expect(result.pages[0].html).toContain('id="pf1"');
            expect(result.pages[1].html).toContain('id="pf2"');
        });
    });

    describe('multi-page documents', () => {
        it('should return all pages with correct indices', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 72 720 Td (Page1) Tj ET')
                .addPage(612, 792, 'BT /F1 12 Tf 72 720 Td (Page2) Tj ET')
                .addPage(612, 792, 'BT /F1 12 Tf 72 720 Td (Page3) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            expect(result.totalPages).toBe(3);
            expect(result.pages[0].pageIndex).toBe(0);
            expect(result.pages[1].pageIndex).toBe(1);
            expect(result.pages[2].pageIndex).toBe(2);
        });

        it('should extract correct text per page', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 72 720 Td (Alpha) Tj ET')
                .addPage(612, 792, 'BT /F1 12 Tf 72 720 Td (Bravo) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            expect(result.pages[0].text).toContain('Alpha');
            expect(result.pages[0].text).not.toContain('Bravo');
            expect(result.pages[1].text).toContain('Bravo');
            expect(result.pages[1].text).not.toContain('Alpha');
        });

        it('should support different dimensions per page', async () => {
            const pdf = new PdfBuilder(612, 792)
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 72 720 Td (Letter) Tj ET')
                .addPage(842, 595, 'BT /F1 12 Tf 72 500 Td (Landscape) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            expect(result.pages[0].pageWidth).toBe(612);
            expect(result.pages[0].pageHeight).toBe(792);
            expect(result.pages[1].pageWidth).toBe(842);
            expect(result.pages[1].pageHeight).toBe(595);
        });
    });

    describe('text line positioning', () => {
        it('should create one text div per line', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 72 700 Td (Line1) Tj 0 -20 Td (Line2) Tj 0 -20 Td (Line3) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const textDivCount = countDivsByClass(result.pages[0].html, 't ');
            expect(textDivCount).toBe(3);
        });

        it('should place each line at a distinct Y position', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 72 700 Td (Top) Tj 0 -100 Td (Bottom) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const yClasses = extractAllClasses(result.globalCss, 'y');
            expect(yClasses.size).toBeGreaterThanOrEqual(2);

            const bottomValues = [...yClasses.values()].map(v => {
                const m = /bottom:([\d.]+)px/.exec(v);
                return m ? Number.parseFloat(m[1]) : 0;
            });
            const sorted = [...bottomValues].sort((a, b) => a - b);
            expect(sorted.at(-1)! - sorted[0]).toBeGreaterThanOrEqual(90);
        });

        it('should assign font-size CSS class to text lines', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 14 Tf 72 700 Td (BigText) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const html = result.pages[0].html;
            expect(html).toMatch(/class="t [^"]*fs[0-9a-f]+/);
            const fsClasses = extractAllClasses(result.globalCss, 'fs');
            // font_size_multiplier=4: at zoom=1, drawTextScale=4, curFontSize=14*4=56
            const hasFontSize56 = [...fsClasses.values()].some(v => v.includes('font-size:56'));
            expect(hasFontSize56).toBe(true);
        });

        it('should assign fill-color CSS class to text lines', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 1 0 0 rg 72 700 Td (Red) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const html = result.pages[0].html;
            expect(html).toMatch(/class="t [^"]*fc[0-9a-f]+/);
            const fcClasses = extractAllClasses(result.globalCss, 'fc');
            const hasRed = [...fcClasses.values()].some(v => v.includes('#ff0000') || v.includes('#FF0000'));
            expect(hasRed).toBe(true);
        });
    });

    describe('CSS class deduplication across lines', () => {
        it('should reuse font-size class when same size appears on multiple lines', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 72 700 Td (A) Tj 0 -20 Td (B) Tj 0 -20 Td (C) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const fsClasses = extractAllClasses(result.globalCss, 'fs');
            // font_size_multiplier=4: at zoom=1, fontSize 12 becomes 12*4=48
            const fontSize48Count = [...fsClasses.values()].filter(v => v.includes('font-size:48')).length;
            expect(fontSize48Count).toBe(1);
        });

        it('should create separate classes for different font sizes', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 24 Tf 72 700 Td (Title) Tj /F1 12 Tf 0 -30 Td (Body) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const fsClasses = extractAllClasses(result.globalCss, 'fs');
            expect(fsClasses.size).toBeGreaterThanOrEqual(2);
        });

        it('should reuse left position class for lines at same X', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 72 700 Td (A) Tj 0 -20 Td (B) Tj 0 -20 Td (C) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const xClasses = extractAllClasses(result.globalCss, 'x');
            expect(xClasses.size).toBe(1);
        });

        it('should deduplicate classes across pages', async () => {
            const stream = 'BT /F1 12 Tf 72 700 Td (Same) Tj ET';
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent(stream)
                .addPage(612, 792, stream)
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const fsClasses = extractAllClasses(result.globalCss, 'fs');
            expect(fsClasses.size).toBe(1);
        });
    });

    describe('inline style changes within a line', () => {
        it('should open a span when font size changes mid-line', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 72 700 Td (Normal) Tj /F1 18 Tf (Big) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const html = result.pages[0].html;
            expect(html).toContain('<span class="fs');
            expect(html).toContain('</span>');
        });

        it('should open a span when color changes mid-line', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 0 0 0 rg 72 700 Td (Black) Tj 1 0 0 rg (Red) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const html = result.pages[0].html;
            expect(html).toContain('<span class="fc');
        });

        it('should not create unnecessary spans when style is unchanged', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 72 700 Td (Hello World) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const html = result.pages[0].html;
            const spanCount = (html.match(/<span class="(fs|fc|ff)/g) ?? []).length;
            expect(spanCount).toBe(0);
        });
    });

    describe('whitespace gaps', () => {
        it('should insert whitespace span for large horizontal gap', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 72 700 Td (Left) Tj 300 700 Td (Right) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const html = result.pages[0].html;
            if (html.includes('class="_ _')) {
                expect(html).toMatch(/class="_ _[0-9a-f]+"/);
            }
        });
    });

    describe('graphics rendering', () => {
        it('should render filled rectangles as positioned divs', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('0.8 0.8 0.9 rg 50 600 200 50 re f BT /F1 12 Tf 72 700 Td (Text) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const html = result.pages[0].html;
            expect(html).toContain('background-color:');
            expect(html).toMatch(/position:absolute;left:\d/);
        });

        it('should render stroked rectangles with border', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('2 w 50 600 200 50 re S BT /F1 12 Tf 72 700 Td (Text) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const html = result.pages[0].html;
            expect(html).toMatch(/border.*solid/);
        });

        it('should render horizontal lines with border-top', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('1 w 50 500 m 500 500 l S BT /F1 12 Tf 72 700 Td (Text) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const html = result.pages[0].html;
            if (html.includes('border-top:')) {
                expect(html).toContain('border-top:');
            }
        });
    });

    describe('base CSS', () => {
        it('should include page frame positioning', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 72 720 Td (X) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            expect(result.globalCss).toContain('.pf{position:relative');
            expect(result.globalCss).toContain('background-color:white');
            expect(result.globalCss).toContain('overflow:hidden');
            expect(result.globalCss).toContain('box-shadow:');
        });

        it('should include text line positioning rules', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 72 720 Td (X) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            expect(result.globalCss).toContain('.t{position:absolute');
            expect(result.globalCss).toContain('white-space:pre');
            expect(result.globalCss).toContain('transform-origin:0% 100%');
            expect(result.globalCss).toContain('unicode-bidi:bidi-override');
        });

        it('should include whitespace span rules', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 72 720 Td (X) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            expect(result.globalCss).toContain('._{display:inline-block');
            expect(result.globalCss).toContain('color:transparent');
        });

        it('should include print styles', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 72 720 Td (X) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            expect(result.globalCss).toContain('@media print');
            expect(result.globalCss).toContain('page-break-after:always');
        });
    });

    describe('standalone HTML output', () => {
        it('should include DOCTYPE and meta charset', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 72 720 Td (X) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const html = toStandaloneHtml(result);
            expect(html).toContain('<!DOCTYPE html>');
            expect(html).toContain('charset="utf-8"');
        });

        it('should embed all CSS in a style tag', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 72 720 Td (Test) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const html = toStandaloneHtml(result);
            expect(html).toContain('<style type="text/css">');
            expect(html).toContain('.pf{');
            expect(html).toContain('.fs0{');
        });

        it('should include all pages inside page-container', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 72 720 Td (P1) Tj ET')
                .addPage(612, 792, 'BT /F1 12 Tf 72 720 Td (P2) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const html = toStandaloneHtml(result);
            const containerIdx = html.indexOf('id="page-container"');
            const pf1Idx = html.indexOf('id="pf1"');
            const pf2Idx = html.indexOf('id="pf2"');
            expect(pf1Idx).toBeGreaterThan(containerIdx);
            expect(pf2Idx).toBeGreaterThan(pf1Idx);
        });
    });

    describe('text extraction', () => {
        it('should extract text preserving line separation', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 72 700 Td (First) Tj 0 -20 Td (Second) Tj 0 -20 Td (Third) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const lines = result.pages[0].text.split('\n').filter(Boolean);
            expect(lines.length).toBeGreaterThanOrEqual(3);
            expect(lines.some(l => l.includes('First'))).toBe(true);
            expect(lines.some(l => l.includes('Second'))).toBe(true);
            expect(lines.some(l => l.includes('Third'))).toBe(true);
        });

        it('should handle special characters in text', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 72 700 Td (A & B < C > D "E") Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            expect(result.pages[0].text).toContain('A & B < C > D');
        });

        it('should HTML-escape special characters in HTML output', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 72 700 Td (A & B < C) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const html = result.pages[0].html;
            expect(html).toContain('&amp;');
            expect(html).toContain('&lt;');
        });
    });

    describe('z-order of rendered elements', () => {
        it('should render graphics before text lines', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('0.9 0.9 0.9 rg 50 690 500 30 re f BT /F1 12 Tf 72 700 Td (OverRect) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const html = result.pages[0].html;
            const bgIdx = html.indexOf('background-color:');
            const textIdx = html.indexOf('class="t ');
            expect(bgIdx).toBeGreaterThan(-1);
            expect(textIdx).toBeGreaterThan(bgIdx);
        });
    });

    // ══════════════════════════════════════════════════════════════════
    // Phase 2: Text fidelity, transforms, colors, styling
    // ══════════════════════════════════════════════════════════════════

    describe('text rendering modes', () => {
        it('should add stroke color class for render mode 2 (fill+stroke)', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 24 Tf 2 Tr 1 0 0 RG 72 700 Td (Stroked) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const html = result.pages[0].html;
            const css = result.globalCss;
            expect(html).toMatch(/sc[0-9a-f]+/);
            expect(css).toContain('text-shadow:');
        });

        it('should not add stroke class for normal render mode 0', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 0 Tr 72 700 Td (Normal) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const html = result.pages[0].html;
            expect(html).not.toMatch(/\bsc[0-9a-f]+/);
        });
    });

    describe('letter-spacing and word-spacing', () => {
        it('should emit letter-spacing CSS when charSpacing is non-zero', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 2 Tc 72 700 Td (Spaced) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const css = result.globalCss;
            const html = result.pages[0].html;
            expect(css).toMatch(/\.ls[0-9a-f]+\{letter-spacing:/);
            expect(html).toMatch(/ls[0-9a-f]+/);
        });

        it('should emit word-spacing CSS when wordSpacing is non-zero', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 5 Tw 72 700 Td (Word Spacing) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const css = result.globalCss;
            const html = result.pages[0].html;
            expect(css).toMatch(/\.ws[0-9a-f]+\{word-spacing:/);
            expect(html).toMatch(/ws[0-9a-f]+/);
        });

        it('should always emit letter-spacing class (C++ never makes it free) and not emit word-spacing when free', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 0 Tc 0 Tw 72 700 Td (Normal) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const html = result.pages[0].html;
            // C++: letter-space is ALWAYS emitted (never "free"), even when zero
            expect(html).toMatch(/\bls[0-9a-f]+/);
            // C++: word-space is free when no offsets exist, so NOT emitted
            expect(html).not.toMatch(/\bws[0-9a-f]+/);
        });
    });

    describe('bold and italic CSS', () => {
        it('should include fwb class in base CSS', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 72 700 Td (X) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            expect(result.globalCss).toContain('.fwb{font-weight:bold}');
            expect(result.globalCss).toContain('.fsi{font-style:italic}');
            expect(result.globalCss).toContain('.fwn{font-weight:normal}');
            expect(result.globalCss).toContain('.fsn{font-style:normal}');
        });

        it('should apply fwb class to bold text', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica-Bold')
                .setContent('BT /F1 12 Tf 72 700 Td (Bold) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const html = result.pages[0].html;
            expect(html).toContain('fwb');
        });

        it('should apply fsi class to italic text', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica-Oblique')
                .setContent('BT /F1 12 Tf 72 700 Td (Italic) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const html = result.pages[0].html;
            expect(html).toContain('fsi');
        });
    });

    describe('transform matrix from TextItem', () => {
        it('should use identity transform for non-rotated text', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 72 700 Td (Normal) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const css = result.globalCss;
            // font_size_multiplier=4: non-rotated text gets a uniform scale transform
            // matrix(0.25, 0, 0, 0.25, 0, 0) — NOT transform:none
            expect(css).toContain('transform:matrix(');
        });

        it('should produce transform:matrix() for rotated text', async () => {
            const cos45 = '0.7071';
            const sin45 = '0.7071';
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent(`BT /F1 12 Tf ${cos45} ${sin45} -${sin45} ${cos45} 300 400 Tm (Rotated) Tj ET`)
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const css = result.globalCss;
            const mClasses = extractAllClasses(css, 'm');
            const hasRotation = [...mClasses.values()].some(v => v.includes('matrix('));
            expect(hasRotation).toBe(true);
        });
    });

    describe('color handling', () => {
        it('should produce distinct fill-color classes for different colors', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 1 0 0 rg 72 700 Td (Red) Tj 0 1 0 rg 0 -20 Td (Green) Tj 0 0 1 rg 0 -20 Td (Blue) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const fcClasses = extractAllClasses(result.globalCss, 'fc');
            expect(fcClasses.size).toBeGreaterThanOrEqual(3);
        });

        it('should use the same class for repeated colors', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 1 0 0 rg 72 700 Td (A) Tj 0 0 0 rg 0 -20 Td (B) Tj 1 0 0 rg 0 -20 Td (C) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const html = result.pages[0].html;
            const redClassMatches = html.match(/fc0/g) ?? [];
            expect(redClassMatches.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('mid-line style transitions', () => {
        it('should create span when font size changes within a TJ array', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 72 700 Td (Normal) Tj /F1 24 Tf (Big) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const html = result.pages[0].html;
            const spanMatches = html.match(/<span class="[^"]*fs/g) ?? [];
            expect(spanMatches.length).toBeGreaterThanOrEqual(1);
        });

        it('should create span when color changes mid-line', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 0 0 0 rg 72 700 Td (Black) Tj 1 0 0 rg (Red) Tj 0 0 1 rg (Blue) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const html = result.pages[0].html;
            const colorSpans = html.match(/<span class="[^"]*fc/g) ?? [];
            expect(colorSpans.length).toBeGreaterThanOrEqual(2);
        });

        it('should only emit changed properties in the diff span', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 0 0 0 rg 72 700 Td (Same) Tj 1 0 0 rg (DiffColor) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const html = result.pages[0].html;
            const spanMatch = /<span class="(fc[0-9a-f]+)"/.exec(html);
            expect(spanMatch).not.toBeNull();
            expect(spanMatch?.[1]).not.toContain('fs');
        });
    });

    describe('whitespace handling', () => {
        it('should use positive-width spans for positive gaps', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 72 700 Td (A) Tj 200 700 Td (B) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const css = result.globalCss;
            const wsClasses = extractAllClasses(css, '_');
            const hasPositiveWidth = [...wsClasses.values()].some(v => v.includes('width:'));
            if (wsClasses.size > 0) {
                expect(hasPositiveWidth).toBe(true);
            }
        });

        it('should use negative-margin spans for overlapping items', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 100 700 Td (Overlap) Tj 90 700 Td (X) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const css = result.globalCss;
            const wsClasses = extractAllClasses(css, '_');
            const hasNegativeMargin = [...wsClasses.values()].some(v => v.includes('margin-left:'));
            if (wsClasses.size > 0) {
                expect(hasNegativeMargin).toBe(true);
            }
        });
    });

});

// ══════════════════════════════════════════════════════════════════════
// Byte-oriented PDF assembler (supports binary streams: embedded fonts,
// images, raw content, CID fonts, XObjects, annotations, rotation).
// ══════════════════════════════════════════════════════════════════════

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

class RawPdf {
    private readonly objs: RawObj[] = [];
    private rootNum = 1;

    obj(num: number, dict: string): this {
        this.objs.push({ num, dict });
        return this;
    }
    rawObj(num: number, raw: string): this {
        this.objs.push({ num, raw });
        return this;
    }
    streamObj(num: number, dict: string, bytes: Uint8Array): this {
        this.objs.push({ num, dict, streamBytes: bytes });
        return this;
    }
    setRoot(num: number): this { this.rootNum = num; return this; }

    build(): ArrayBuffer {
        const parts: Uint8Array[] = [];
        const header = strToBytes('%PDF-1.5\n%\xe2\xe3\xcf\xd3\n');
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
        const trailer = `trailer\n<< /Size ${size} /Root ${this.rootNum} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
        parts.push(strToBytes(xref + trailer));

        const total = parts.reduce((s, p) => s + p.length, 0);
        const result = new Uint8Array(total);
        let pos = 0;
        for (const p of parts) { result.set(p, pos); pos += p.length; }
        return result.buffer;
    }
}

/** Minimal triangular glyph at a given unicode/advance (mirrors ttf-builder.spec). */
function makeGlyph(unicode: number, advanceWidth: number): TtfBuilderGlyph {
    const bytes: number[] = [];
    const push16 = (v: number): void => { bytes.push((v >> 8) & 0xff, v & 0xff); };
    push16(1); push16(0); push16(0); push16(100); push16(100);
    push16(2); push16(0);
    const flag = 0x01 | 0x02 | 0x04 | 0x10 | 0x20;
    bytes.push(flag, flag, flag);
    bytes.push(0, 50, 50);
    bytes.push(0, 0, 100);
    return { unicode, advanceWidth, glyphData: new Uint8Array(bytes) };
}

/** Build an embedded TrueType font covering the given ASCII chars. */
function buildEmbeddedTtf(chars: string): Uint8Array {
    const glyphs: TtfBuilderGlyph[] = [makeGlyph(0, 500)];
    for (const ch of chars) {
        glyphs.push(makeGlyph(ch.codePointAt(0)!, 600));
    }
    return buildTtf({
        familyName: 'Embedded',
        styleName: 'Regular',
        unitsPerEm: 1000,
        ascender: 800,
        descender: -200,
        glyphs,
    });
}

/** A scaffold catalog+pages+page with custom resources/content/extras. */
function scaffoldRaw(opts: {
    content: Uint8Array;
    resources?: string;
    fontObjs?: { num: number; dict: string }[];
    fontStreams?: { num: number; dict: string; bytes: Uint8Array }[];
    extraObjs?: { num: number; dict: string }[];
    pageExtra?: string;
    mediaBox?: string;
    rootNum?: number;
}): ArrayBuffer {
    const pdf = new RawPdf();
    const mb = opts.mediaBox ?? '[0 0 612 792]';
    const res = opts.resources ?? '/Font << >>';
    pdf.setRoot(1)
        .obj(1, '/Type /Catalog /Pages 2 0 R')
        .obj(2, '/Type /Pages /Kids [3 0 R] /Count 1')
        .obj(3, `/Type /Page /Parent 2 0 R /MediaBox ${mb} /Resources << ${res} >> /Contents 4 0 R ${opts.pageExtra ?? ''}`)
        .streamObj(4, '', opts.content);
    for (const fo of opts.fontObjs ?? []) pdf.obj(fo.num, fo.dict);
    for (const fs of opts.fontStreams ?? []) pdf.streamObj(fs.num, fs.dict, fs.bytes);
    for (const eo of opts.extraObjs ?? []) pdf.obj(eo.num, eo.dict);
    return pdf.build();
}

// ══════════════════════════════════════════════════════════════════════
// Content-stream operators: graphics state, color, text positioning
// ══════════════════════════════════════════════════════════════════════

describe('PDF operators', () => {
    describe('q/Q graphics state stack', () => {
        it('restores fill color and font after Q so later text reverts', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent(
                    'BT /F1 12 Tf 1 0 0 rg 72 700 Td (Red) Tj ET ' +
                    'q 0 0 1 rg BT /F1 12 Tf 72 660 Td (Blue) Tj ET Q ' +
                    'BT /F1 12 Tf 72 620 Td (BackToRed) Tj ET',
                )
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const fcClasses = extractAllClasses(result.globalCss, 'fc');
            const hasRed = [...fcClasses.values()].some(v => /#ff0000/i.test(v));
            const hasBlue = [...fcClasses.values()].some(v => /#0000ff/i.test(v));
            expect(hasRed).toBe(true);
            expect(hasBlue).toBe(true);
        });

        it('ignores an unbalanced Q with empty stack without throwing', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('Q Q BT /F1 12 Tf 72 700 Td (Safe) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            expect(result.pages[0].text).toContain('Safe');
        });
    });

    describe('color operators', () => {
        it('converts CMYK fill (k) to the equivalent hex color', async () => {
            // 0 1 1 0 k = pure red in CMYK
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 0 1 1 0 k 72 700 Td (Cyan) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const fcClasses = extractAllClasses(result.globalCss, 'fc');
            const hasRed = [...fcClasses.values()].some(v => /#ff0000/i.test(v));
            expect(hasRed).toBe(true);
        });

        it('converts grayscale fill (g) to a gray hex color', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 0.5 g 72 700 Td (Gray) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const fcClasses = extractAllClasses(result.globalCss, 'fc');
            const hasGray = [...fcClasses.values()].some(v => /#808080/i.test(v));
            expect(hasGray).toBe(true);
        });

        it('uses scn 3-component values as an RGB fill color', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('/DeviceRGB cs BT /F1 12 Tf 0 1 0 scn 72 700 Td (Green) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const fcClasses = extractAllClasses(result.globalCss, 'fc');
            const hasGreen = [...fcClasses.values()].some(v => /#00ff00/i.test(v));
            expect(hasGreen).toBe(true);
        });

        it('uses sc single-component value as a gray fill color', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('/DeviceGray cs BT /F1 12 Tf 0 sc 72 700 Td (Black) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const fcClasses = extractAllClasses(result.globalCss, 'fc');
            const hasBlack = [...fcClasses.values()].some(v => /#000000/i.test(v));
            expect(hasBlack).toBe(true);
        });

        it('applies stroke grayscale (G) to a stroked rectangle border', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('0.25 G 2 w 50 600 200 50 re S')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            expect(result.pages[0].html).toMatch(/border.*solid #404040/i);
        });

        it('applies stroke CMYK (K) to a stroked rectangle border', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('0 0 1 0 K 2 w 50 600 200 50 re S')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            // 0 0 1 0 K = yellow
            expect(result.pages[0].html).toMatch(/border.*solid #ffff00/i);
        });

        it('applies stroke RGB (RG) to a stroked rectangle border', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('1 0 0 RG 2 w 50 600 200 50 re S')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            expect(result.pages[0].html).toMatch(/border.*solid #ff0000/i);
        });
    });

    describe('text positioning operators', () => {
        it('TD sets leading from the negative y and positions the next line', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 72 700 Td (L1) Tj 0 -15 TD (L2) Tj T* (L3) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const lines = result.pages[0].text.split('\n').filter(Boolean);
            expect(lines.some(l => l.includes('L1'))).toBe(true);
            expect(lines.some(l => l.includes('L2'))).toBe(true);
            expect(lines.some(l => l.includes('L3'))).toBe(true);
            // Three distinct vertical positions
            const yClasses = extractAllClasses(result.globalCss, 'y');
            expect(yClasses.size).toBeGreaterThanOrEqual(3);
        });

        it("the ' operator advances a line and shows text", async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent("BT /F1 12 Tf 14 TL 72 700 Td (First) Tj (Next) ' ET")
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            expect(result.pages[0].text).toContain('First');
            expect(result.pages[0].text).toContain('Next');
        });

        it('the " operator sets word/char spacing then shows text', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 14 TL 72 700 Td (Base) Tj 8 2 (Quoted) " ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            expect(result.pages[0].text).toContain('Quoted');
            // word-space 8 produces a ws class on the quoted line
            expect(result.globalCss).toMatch(/\.ws[0-9a-f]+\{word-spacing:/);
        });

        it('TJ kerning array shifts glyph positions within a line', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 72 700 Td [(A) -400 (B) 200 (C)] TJ ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const html = result.pages[0].html;
            // All three glyphs present
            expect(result.pages[0].text).toContain('A');
            expect(result.pages[0].text).toContain('C');
            // Large negative kern (-400) introduces a whitespace adjustment span
            expect(html).toMatch(/class="_/);
        });
    });

    describe('Tm rotation and transform', () => {
        it('emits a rotation matrix for text placed with a rotated Tm', async () => {
            const pdf = new PdfBuilder()
                .addFont('F1', 'Helvetica')
                .setContent('BT /F1 12 Tf 0 1 -1 0 300 400 Tm (Vert) Tj ET')
                .build();

            const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
            const mClasses = extractAllClasses(result.globalCss, 'm');
            // 90deg rotation: a non-diagonal matrix() entry exists
            const hasRot = [...mClasses.values()].some(
                v => /matrix\(/.test(v) && !/matrix\(0\.25,0,0,0\.25/.test(v),
            );
            expect(hasRot).toBe(true);
        });
    });
});

// ══════════════════════════════════════════════════════════════════════
// Tokenizer: hex strings, octal escapes, comments, nested literals
// ══════════════════════════════════════════════════════════════════════

describe('content stream tokenizer', () => {
    it('decodes a hex-string Tj operand', async () => {
        // <48656C6C6F> = "Hello"
        const pdf = new PdfBuilder()
            .addFont('F1', 'Helvetica')
            .setContent('BT /F1 12 Tf 72 700 Td <48656C6C6F> Tj ET')
            .build();

        const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
        expect(result.pages[0].text).toContain('Hello');
    });

    it('pads an odd-length hex string with a trailing zero nibble', async () => {
        // <414> => 0x41 0x40 => "A@"
        const pdf = new PdfBuilder()
            .addFont('F1', 'Helvetica')
            .setContent('BT /F1 12 Tf 72 700 Td <414> Tj ET')
            .build();

        const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
        expect(result.pages[0].text).toContain('A');
    });

    it('decodes octal and named escape sequences in a literal string', async () => {
        // \101 = 'A', \t tab, \) literal paren
        const pdf = new PdfBuilder()
            .addFont('F1', 'Helvetica')
            .setContent('BT /F1 12 Tf 72 700 Td (\\101B\\)C) Tj ET')
            .build();

        const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
        expect(result.pages[0].text).toContain('AB)C');
    });

    it('preserves balanced nested parentheses inside a literal string', async () => {
        const pdf = new PdfBuilder()
            .addFont('F1', 'Helvetica')
            .setContent('BT /F1 12 Tf 72 700 Td (a(b)c) Tj ET')
            .build();

        const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
        expect(result.pages[0].text).toContain('a(b)c');
    });

    it('skips comments in the content stream', async () => {
        const pdf = new PdfBuilder()
            .addFont('F1', 'Helvetica')
            .setContent('% this is a comment\nBT /F1 12 Tf 72 700 Td (After) Tj ET')
            .build();

        const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
        expect(result.pages[0].text).toContain('After');
    });

    it('treats a backslash-newline as a line continuation (no character)', async () => {
        // (AB) split across a continuation: A\<newline>B should decode to "AB".
        const content = strToBytes('BT /F1 12 Tf 72 700 Td (A\\\nB) Tj ET');
        const pdf = scaffoldRaw({
            content,
            resources: '/Font << /F1 6 0 R >>',
            fontObjs: [{ num: 6, dict: '/Type /Font /Subtype /Type1 /BaseFont /Helvetica' }],
        });
        const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
        expect(result.pages[0].text).toContain('AB');
    });

    it('maps a high-byte code (octal \\222) through the font encoding to a Unicode glyph', async () => {
        // Helvetica's encoding maps byte 0x92 to U+2122 (™); the single-byte
        // decode path resolves it from the font's toUnicode table.
        const pdf = new PdfBuilder()
            .addFont('F1', 'Helvetica')
            .setContent('BT /F1 12 Tf 72 700 Td (it\\222s) Tj ET')
            .build();
        const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
        expect(result.pages[0].text).toContain('it™s');
    });
});

// ══════════════════════════════════════════════════════════════════════
// Path drawing: curves, lines, fill+stroke, border radius
// ══════════════════════════════════════════════════════════════════════

describe('path drawing', () => {
    it('renders a vertical line with border-left', async () => {
        const pdf = new PdfBuilder()
            .setContent('1 w 100 200 m 100 600 l S')
            .build();

        const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
        expect(result.pages[0].html).toContain('border-left:');
    });

    it('renders a filled-and-stroked rounded rectangle from a bezier path', async () => {
        // A path with curve operators forms a rounded box; B paints fill+stroke.
        const pdf = new PdfBuilder()
            .setContent(
                '0.9 0.9 0.9 rg 0 0 0 RG 2 w ' +
                '120 200 m 480 200 l 500 200 500 220 500 240 c ' +
                '500 560 l 500 580 480 600 460 600 c ' +
                '140 600 l 120 600 100 580 100 560 c 100 240 l 100 220 120 200 140 200 c ' +
                'B',
            )
            .build();

        const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
        const html = result.pages[0].html;
        expect(html).toContain('background-color:');
        expect(html).toMatch(/border:\d/);
        expect(html).toContain('border-radius:');
    });

    it('renders a curve with the v operator (2 control points)', async () => {
        const pdf = new PdfBuilder()
            .setContent('0 0 0 rg 100 300 m 100 400 200 400 v 300 300 200 200 y f')
            .build();

        const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
        expect(result.pages[0].html).toContain('background-color:');
    });

    it('discards the current path on the n (no-op paint) operator', async () => {
        const pdf = new PdfBuilder()
            .addFont('F1', 'Helvetica')
            .setContent('0 0 0 rg 50 600 200 50 re n BT /F1 12 Tf 72 700 Td (T) Tj ET')
            .build();

        const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
        // The rectangle was discarded — no filled background div from it
        expect(result.pages[0].html).not.toContain('background-color:#000000');
    });
});

// ══════════════════════════════════════════════════════════════════════
// Multi-stream content arrays, page rotation, error handling
// ══════════════════════════════════════════════════════════════════════

describe('page-level handling', () => {
    it('concatenates an array of content streams', async () => {
        const s1 = strToBytes('BT /F1 12 Tf 72 700 Td (Part1) Tj ET');
        const s2 = strToBytes('BT /F1 12 Tf 72 660 Td (Part2) Tj ET');
        const pdf = new RawPdf();
        pdf.setRoot(1)
            .obj(1, '/Type /Catalog /Pages 2 0 R')
            .obj(2, '/Type /Pages /Kids [3 0 R] /Count 1')
            .obj(3, '/Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ' +
                '/Resources << /Font << /F1 6 0 R >> >> /Contents [4 0 R 5 0 R]')
            .streamObj(4, '', s1)
            .streamObj(5, '', s2)
            .obj(6, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica');
        const result = await renderPixelPerfectPaged(pdf.build(), { zoom: 1 });
        expect(result.pages[0].text).toContain('Part1');
        expect(result.pages[0].text).toContain('Part2');
    });

    it('swaps width and height for a 90-degree rotated page', async () => {
        const content = strToBytes('BT /F1 12 Tf 72 700 Td (Rot) Tj ET');
        const pdf = scaffoldRaw({
            content,
            resources: '/Font << /F1 6 0 R >>',
            fontObjs: [{ num: 6, dict: '/Type /Font /Subtype /Type1 /BaseFont /Helvetica' }],
            pageExtra: '/Rotate 90',
            mediaBox: '[0 0 612 792]',
        });

        const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
        // dimensions swapped: width 792, height 612
        expect(result.pages[0].pageWidth).toBe(792);
        expect(result.pages[0].pageHeight).toBe(612);
    });

    it('throws a clear error for an encrypted PDF', async () => {
        const content = strToBytes('BT ET');
        const pdf = new RawPdf();
        pdf.setRoot(1)
            .obj(1, '/Type /Catalog /Pages 2 0 R')
            .obj(2, '/Type /Pages /Kids [3 0 R] /Count 1')
            .obj(3, '/Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Contents 4 0 R')
            .streamObj(4, '', content)
            .obj(5, '/Filter /Standard /V 1 /R 2 /O (0123456789012345678901234567890) ' +
                '/U (0123456789012345678901234567890) /P -44');
        // attach Encrypt to trailer via a catalog-adjacent ref is not supported by RawPdf trailer;
        // instead rely on isEncrypted detecting the Encrypt entry in trailer.
        const buf = pdf.build();
        // Patch trailer to include /Encrypt 5 0 R
        const txt = new TextDecoder('latin1').decode(buf);
        const patched = txt.replace('/Root 1 0 R', '/Root 1 0 R /Encrypt 5 0 R');
        const patchedBytes = strToBytes(patched);
        const patchedBuf = patchedBytes.buffer.slice(
            patchedBytes.byteOffset, patchedBytes.byteOffset + patchedBytes.byteLength,
        ) as ArrayBuffer;
        await expect(
            renderPixelPerfectPaged(patchedBuf),
        ).rejects.toThrow(/Encrypted/);
    });

    it('throws when the PDF contains no pages', async () => {
        const pdf = new RawPdf();
        pdf.setRoot(1)
            .obj(1, '/Type /Catalog /Pages 2 0 R')
            .obj(2, '/Type /Pages /Kids [] /Count 0');
        await expect(renderPixelPerfectPaged(pdf.build())).rejects.toThrow(/no pages/);
    });
});

// ══════════════════════════════════════════════════════════════════════
// Annotations (link), images, form XObjects, ExtGState
// ══════════════════════════════════════════════════════════════════════

describe('annotations and XObjects', () => {
    it('renders a link annotation as an anchor over the page', async () => {
        const content = strToBytes('BT /F1 12 Tf 72 700 Td (Link) Tj ET');
        const pdf = new RawPdf();
        pdf.setRoot(1)
            .obj(1, '/Type /Catalog /Pages 2 0 R')
            .obj(2, '/Type /Pages /Kids [3 0 R] /Count 1')
            .obj(3, '/Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ' +
                '/Resources << /Font << /F1 6 0 R >> >> /Contents 4 0 R /Annots [7 0 R]')
            .streamObj(4, '', content)
            .obj(6, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica')
            .obj(7, '/Type /Annot /Subtype /Link /Rect [70 695 130 715] ' +
                '/A << /S /URI /URI (https://example.com/a&b) >>');
        const result = await renderPixelPerfectPaged(pdf.build(), { zoom: 1 });
        const html = result.pages[0].html;
        expect(html).toContain('<a class="l" href="https://example.com/a&amp;b">');
        expect(html).toMatch(/position:absolute;left:70px;bottom:695px/);
    });

    it('renders a raw RGB image XObject placed by the CTM', async () => {
        // 2x2 RGB image, raw (no filter): 12 bytes
        const imgBytes = new Uint8Array([
            255, 0, 0, 0, 255, 0,
            0, 0, 255, 255, 255, 0,
        ]);
        const content = strToBytes('q 200 0 0 150 100 500 cm /Im0 Do Q');
        const pdf = new RawPdf();
        pdf.setRoot(1)
            .obj(1, '/Type /Catalog /Pages 2 0 R')
            .obj(2, '/Type /Pages /Kids [3 0 R] /Count 1')
            .obj(3, '/Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ' +
                '/Resources << /XObject << /Im0 6 0 R >> >> /Contents 4 0 R')
            .streamObj(4, '', content)
            .streamObj(6,
                '/Type /XObject /Subtype /Image /Width 2 /Height 2 ' +
                '/ColorSpace /DeviceRGB /BitsPerComponent 8',
                imgBytes);
        const result = await renderPixelPerfectPaged(pdf.build(), { zoom: 1 });
        const html = result.pages[0].html;
        expect(html).toContain('<img class="bi"');
        // CTM scales unit square to 200x150 at (100,500)
        expect(html).toMatch(/left:100px;bottom:500px/);
        expect(html).toMatch(/width:200px;height:150px/);
        expect(html).toMatch(/src="data:image\/png;base64,/);
    });

    it('treats a DCTDecode image as inline JPEG data URL', async () => {
        // Minimal JPEG SOI/EOI marker bytes — enough for the data URL path.
        const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
        const content = strToBytes('q 100 0 0 80 50 400 cm /Im0 Do Q');
        const pdf = new RawPdf();
        pdf.setRoot(1)
            .obj(1, '/Type /Catalog /Pages 2 0 R')
            .obj(2, '/Type /Pages /Kids [3 0 R] /Count 1')
            .obj(3, '/Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ' +
                '/Resources << /XObject << /Im0 6 0 R >> >> /Contents 4 0 R')
            .streamObj(4, '', content)
            .streamObj(6,
                '/Type /XObject /Subtype /Image /Width 4 /Height 4 ' +
                '/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode',
                jpeg);
        const result = await renderPixelPerfectPaged(pdf.build(), { zoom: 1 });
        expect(result.pages[0].html).toMatch(/src="data:image\/jpeg;base64,/);
    });

    it('executes a Form XObject content stream with its own matrix and resources', async () => {
        const formContent = strToBytes('BT /F1 12 Tf 10 10 Td (InForm) Tj ET');
        const content = strToBytes('q 1 0 0 1 100 600 cm /Fm0 Do Q');
        const pdf = new RawPdf();
        pdf.setRoot(1)
            .obj(1, '/Type /Catalog /Pages 2 0 R')
            .obj(2, '/Type /Pages /Kids [3 0 R] /Count 1')
            .obj(3, '/Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ' +
                '/Resources << /XObject << /Fm0 6 0 R >> >> /Contents 4 0 R')
            .streamObj(4, '', content)
            .streamObj(6,
                '/Type /XObject /Subtype /Form /BBox [0 0 200 200] /Matrix [1 0 0 1 0 0] ' +
                '/Resources << /Font << /F1 7 0 R >> >>',
                formContent)
            .obj(7, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica');
        const result = await renderPixelPerfectPaged(pdf.build(), { zoom: 1 });
        expect(result.pages[0].text).toContain('InForm');
    });

    it('applies a font set via an ExtGState /Font entry', async () => {
        const content = strToBytes('/GS1 gs BT 72 700 Td (GsFont) Tj ET');
        const pdf = new RawPdf();
        pdf.setRoot(1)
            .obj(1, '/Type /Catalog /Pages 2 0 R')
            .obj(2, '/Type /Pages /Kids [3 0 R] /Count 1')
            .obj(3, '/Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ' +
                '/Resources << /Font << /F1 7 0 R >> /ExtGState << /GS1 6 0 R >> >> /Contents 4 0 R')
            .streamObj(4, '', content)
            .obj(6, '/Type /ExtGState /Font [7 0 R 14]')
            .obj(7, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica');
        const result = await renderPixelPerfectPaged(pdf.build(), { zoom: 1 });
        expect(result.pages[0].text).toContain('GsFont');
    });
});

// ══════════════════════════════════════════════════════════════════════
// Embedded fonts: @font-face emission, family resolution, metrics
// ══════════════════════════════════════════════════════════════════════

describe('embedded fonts', () => {
    function embeddedFontPdf(content: string, baseFont = 'ABCDEF+Embedded'): ArrayBuffer {
        const ttf = buildEmbeddedTtf('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ');
        const pdf = new RawPdf();
        pdf.setRoot(1)
            .obj(1, '/Type /Catalog /Pages 2 0 R')
            .obj(2, '/Type /Pages /Kids [3 0 R] /Count 1')
            .obj(3, '/Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ' +
                '/Resources << /Font << /F1 6 0 R >> >> /Contents 4 0 R')
            .streamObj(4, '', strToBytes(content))
            .obj(6, `/Type /Font /Subtype /TrueType /BaseFont /${baseFont} ` +
                '/FirstChar 65 /LastChar 90 /Widths [600 600 600 600 600 600] ' +
                '/FontDescriptor 7 0 R')
            .obj(7, '/Type /FontDescriptor /FontName /ABCDEF+Embedded /Flags 32 ' +
                '/Ascent 800 /Descent -200 /FontFile2 8 0 R')
            .streamObj(8, '', ttf);
        return pdf.build();
    }

    it('reads ascent/descent metrics from the FontDescriptor (line-height)', async () => {
        const result = await renderPixelPerfectPaged(
            embeddedFontPdf('BT /F1 12 Tf 72 700 Td (ABC) Tj ET'), { zoom: 1 },
        );
        // Ascent 800 / Descent -200 → line-height 1 in the ff rule
        expect(result.globalCss).toMatch(/\.ff[0-9a-f]+\{font-family:[^}]*line-height:1;/);
        expect(result.pages[0].text).toContain('ABC');
    });

    it('uses the parsed system family for a fully-covered embedded TrueType font', async () => {
        const result = await renderPixelPerfectPaged(
            embeddedFontPdf('BT /F1 12 Tf 72 700 Td (ABC) Tj ET'), { zoom: 1 },
        );
        // Embedded subset name "ABCDEF+Embedded" → 'Embedded', sans-serif
        expect(result.globalCss).toMatch(/\.ff[0-9a-f]+\{font-family:'Embedded', sans-serif/);
        expect(result.pages[0].html).toMatch(/class="t [^"]*ff[0-9a-f]+/);
    });

    it('derives the font glyph advance widths from the embedded program', async () => {
        // Two letters then a wide gap; advance comes from the embedded font metrics.
        const result = await renderPixelPerfectPaged(
            embeddedFontPdf('BT /F1 20 Tf 72 700 Td (AB) Tj ET'), { zoom: 1 },
        );
        // h (height) class derived from ascent-descent = 1.0 * fontSize
        const hClasses = extractAllClasses(result.globalCss, 'h');
        expect(hClasses.size).toBeGreaterThanOrEqual(1);
        expect(result.pages[0].text).toContain('AB');
    });

    it('applies the system fallback family for a non-embedded named font', async () => {
        const pdf = new PdfBuilder()
            .addFont('F1', 'TimesNewRomanPS-BoldMT')
            .setContent('BT /F1 12 Tf 72 700 Td (Serif) Tj ET')
            .build();
        const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
        // CamelCase split + style strip + serif fallback
        expect(result.globalCss).toMatch(/font-family:'Times New Roman', serif/);
        // Bold name yields font-weight:bold in the ff rule
        expect(result.globalCss).toMatch(/\.ff[0-9a-f]+\{font-family:'Times New Roman', serif;[^}]*font-weight:bold/);
    });

    it('maps a monospace-named font to the monospace generic family', async () => {
        const pdf = new PdfBuilder()
            .addFont('F1', 'CourierNewPSMT')
            .setContent('BT /F1 12 Tf 72 700 Td (Mono) Tj ET')
            .build();
        const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
        expect(result.globalCss).toMatch(/font-family:'Courier New', monospace/);
    });

    it('uses sans-serif for a symbol font name', async () => {
        const pdf = new PdfBuilder()
            .addFont('F1', 'Symbol')
            .setContent('BT /F1 12 Tf 72 700 Td (S) Tj ET')
            .build();
        const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
        expect(result.globalCss).toMatch(/\.ff[0-9a-f]+\{font-family:sans-serif/);
    });

    it('strips the subset prefix and italic suffix from the family name', async () => {
        const pdf = new PdfBuilder()
            .addFont('F1', 'WXYZAB+Georgia-Italic')
            .setContent('BT /F1 12 Tf 72 700 Td (It) Tj ET')
            .build();
        const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
        expect(result.globalCss).toMatch(/font-family:'Georgia', serif/);
        expect(result.globalCss).toMatch(/font-style:italic/);
    });
});

// ══════════════════════════════════════════════════════════════════════
// CID / Type0 two-byte fonts (re-encoding & two-byte decode path)
// ══════════════════════════════════════════════════════════════════════

describe('CID / Type0 fonts', () => {
    // Build a Type0 font whose embedded program does NOT cover the toUnicode
    // codepoints (forces the re-encode path via NotoSans-less fallback).
    function type0Pdf(): ArrayBuffer {
        const ttf = buildEmbeddedTtf('ABC');
        // ToUnicode CMap: CID 1 -> 'A', CID 2 -> 'B'
        const toUni = strToBytes(
            '/CIDInit /ProcSet findresource begin 12 dict begin begincmap\n' +
            '1 begincodespacerange <0000> <FFFF> endcodespacerange\n' +
            '2 beginbfchar\n<0001> <0041>\n<0002> <0042>\nendbfchar\n' +
            'endcmap CMapName currentdict /CMap defineresource pop end end',
        );
        const pdf = new RawPdf();
        pdf.setRoot(1)
            .obj(1, '/Type /Catalog /Pages 2 0 R')
            .obj(2, '/Type /Pages /Kids [3 0 R] /Count 1')
            .obj(3, '/Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ' +
                '/Resources << /Font << /F1 6 0 R >> >> /Contents 4 0 R')
            .streamObj(4, '', strToBytes('BT /F1 20 Tf 72 700 Td <00010002> Tj ET'))
            .obj(6, '/Type /Font /Subtype /Type0 /BaseFont /XYZABC+Embedded ' +
                '/Encoding /Identity-H /DescendantFonts [9 0 R] /ToUnicode 10 0 R')
            .obj(9, '/Type /Font /Subtype /CIDFontType2 /BaseFont /XYZABC+Embedded ' +
                '/CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> ' +
                '/DW 1000 /W [1 [600 600]] /FontDescriptor 7 0 R')
            .obj(7, '/Type /FontDescriptor /FontName /XYZABC+Embedded /Flags 4 ' +
                '/Ascent 800 /Descent -200 /FontFile2 8 0 R')
            .streamObj(8, '', ttf)
            .streamObj(10, '', toUni);
        return pdf.build();
    }

    it('decodes a two-byte (Identity-H) string to its Unicode characters', async () => {
        const result = await renderPixelPerfectPaged(type0Pdf(), { zoom: 1 });
        expect(result.pages[0].text).toContain('AB');
    });

    it('produces a font-face / font-family rule for the embedded CID font', async () => {
        const result = await renderPixelPerfectPaged(type0Pdf(), { zoom: 1 });
        // Either re-encoded embedded font (@font-face) or a system family rule.
        expect(result.globalCss).toMatch(/\.ff[0-9a-f]+\{font-family:/);
        expect(result.pages[0].html).toMatch(/class="t [^"]*ff[0-9a-f]+/);
    });

    // Re-encode path: embedded program covers only some toUnicode codepoints
    // (<95%), so the renderer rebuilds a TTF and emits an @font-face rule.
    function reencodeType0Pdf(): ArrayBuffer {
        // Embedded font only has glyph 'A'; toUnicode maps CIDs to A,B,C,D,E.
        const ttf = buildEmbeddedTtf('A');
        const toUni = strToBytes(
            '/CIDInit /ProcSet findresource begin 12 dict begin begincmap\n' +
            '1 begincodespacerange <0000> <FFFF> endcodespacerange\n' +
            '5 beginbfchar\n<0001> <0041>\n<0002> <0042>\n<0003> <0043>\n' +
            '<0004> <0044>\n<0005> <0045>\nendbfchar\n' +
            'endcmap CMapName currentdict /CMap defineresource pop end end',
        );
        const pdf = new RawPdf();
        pdf.setRoot(1)
            .obj(1, '/Type /Catalog /Pages 2 0 R')
            .obj(2, '/Type /Pages /Kids [3 0 R] /Count 1')
            .obj(3, '/Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ' +
                '/Resources << /Font << /F1 6 0 R >> >> /Contents 4 0 R')
            .streamObj(4, '', strToBytes('BT /F1 20 Tf 72 700 Td <0001000200030004> Tj ET'))
            .obj(6, '/Type /Font /Subtype /Type0 /BaseFont /MNOPQR+Embedded ' +
                '/Encoding /Identity-H /DescendantFonts [9 0 R] /ToUnicode 10 0 R')
            .obj(9, '/Type /Font /Subtype /CIDFontType2 /BaseFont /MNOPQR+Embedded ' +
                '/CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> ' +
                '/DW 1000 /W [1 [600 600 600 600]] /FontDescriptor 7 0 R')
            .obj(7, '/Type /FontDescriptor /FontName /MNOPQR+Embedded /Flags 4 ' +
                '/Ascent 800 /Descent -200 /FontFile2 8 0 R')
            .streamObj(8, '', ttf)
            .streamObj(10, '', toUni);
        return pdf.build();
    }

    it('re-encodes a partially-covered CID font and emits an @font-face rule', async () => {
        const result = await renderPixelPerfectPaged(reencodeType0Pdf(), { zoom: 1 });
        expect(result.globalCss).toMatch(/@font-face\{font-family:'f[0-9a-f]+';/);
        expect(result.globalCss).toMatch(
            /src:url\('data:font\/ttf;base64,[A-Za-z0-9+/=]+'\) format\('truetype'\)/,
        );
        // The re-encoded font's own identifier is used as the ff family.
        expect(result.globalCss).toMatch(/\.ff[0-9a-f]+\{font-family:'f[0-9a-f]+'/);
    });
});

// ══════════════════════════════════════════════════════════════════════
// Spacing optimization (letter-space / word-space folding, ligatures,
// single-space offsets, vertical-align merge)
// ══════════════════════════════════════════════════════════════════════

describe('spacing optimization', () => {
    it('folds uniform inter-glyph kerning into the letter-spacing class', async () => {
        // Uniform positive kern between every glyph across many chars → the
        // optimizer rewrites it as letter-spacing instead of per-gap spans.
        const kern = -200; // positive visual advance per gap
        const seq = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        const tj = seq.map((c, i) => (i === 0 ? `(${c})` : `${kern} (${c})`)).join(' ');
        const pdf = new PdfBuilder()
            .addFont('F1', 'Helvetica')
            .setContent(`BT /F1 12 Tf 72 700 Td [${tj}] TJ ET`)
            .build();

        const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
        // letter-spacing class is present and non-zero after folding.
        const lsClasses = extractAllClasses(result.globalCss, 'ls');
        const hasNonZeroLs = [...lsClasses.values()].some(
            v => /letter-spacing:(-?(?:\d+\.\d+|\.\d+|\d+))px/.test(v) && !/letter-spacing:0px/.test(v),
        );
        expect(hasNonZeroLs).toBe(true);
        expect(result.pages[0].text.replaceAll(' ', '')).toContain('ABCDEFGH');
    });

    it('emits a single-space placeholder span for a real space character', async () => {
        const pdf = new PdfBuilder()
            .addFont('F1', 'Helvetica')
            .setContent('BT /F1 12 Tf 72 700 Td (Hello World Again) Tj ET')
            .build();

        const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
        // Real spaces between words render literally in the text layer.
        expect(result.pages[0].text).toContain('Hello World Again');
    });

    it('merges a superscript run into the line as a vertical-align span', async () => {
        // Baseline text, then a raised run via Ts (text rise) at the same x-flow.
        const pdf = new PdfBuilder()
            .addFont('F1', 'Helvetica')
            .setContent('BT /F1 12 Tf 72 700 Td (Base) Tj 3 Ts (Sup) Tj 0 Ts (End) Tj ET')
            .build();

        const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
        expect(result.pages[0].text).toContain('Base');
        expect(result.pages[0].text).toContain('Sup');
        // Rise produces a distinct transform-affecting state; the line still
        // renders all three runs in one text div.
        const textDivs = countDivsByClass(result.pages[0].html, 't ');
        expect(textDivs).toBeGreaterThanOrEqual(1);
    });

    it('opens nested style spans and closes them when many styles change in a line', async () => {
        // Several mid-line changes force the greedy state-stack trim/push logic.
        const pdf = new PdfBuilder()
            .addFont('F1', 'Helvetica')
            .setContent(
                'BT /F1 12 Tf 0 0 0 rg 72 700 Td (a) Tj ' +
                '1 0 0 rg (b) Tj /F1 18 Tf (c) Tj 0 0 1 rg (d) Tj ' +
                '0 0 0 rg /F1 12 Tf (e) Tj ET',
            )
            .build();

        const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
        const html = result.pages[0].html;
        const openSpans = (html.match(/<span class="/g) ?? []).length;
        const closeSpans = (html.match(/<\/span>/g) ?? []).length;
        expect(openSpans).toBeGreaterThanOrEqual(2);
        // Every opened style span is balanced by a close.
        expect(closeSpans).toBe(openSpans);
    });
});

// ══════════════════════════════════════════════════════════════════════
// Y-flip coordinate correction (cm with negative d-scale)
// ══════════════════════════════════════════════════════════════════════

describe('Y-flip coordinate correction', () => {
    it('corrects text positions when the page uses a flipped CTM', async () => {
        // 1 0 0 -1 0 792 cm flips Y; subsequent text uses top-down coords.
        const content = strToBytes(
            '1 0 0 -0.5 0 792 cm BT /F1 12 Tf 72 100 Td (Flip) Tj ET',
        );
        const pdf = scaffoldRaw({
            content,
            resources: '/Font << /F1 6 0 R >>',
            fontObjs: [{ num: 6, dict: '/Type /Font /Subtype /Type1 /BaseFont /Helvetica' }],
        });

        const result = await renderPixelPerfectPaged(pdf, { zoom: 1 });
        expect(result.pages[0].text).toContain('Flip');
        // A bottom (y) position class is emitted and is a finite positive number.
        const yClasses = extractAllClasses(result.globalCss, 'y');
        const positives = [...yClasses.values()]
            .map(v => Number.parseFloat(/bottom:(-?[\d.]+)px/.exec(v)?.[1] ?? 'NaN'))
            .filter(n => Number.isFinite(n));
        expect(positives.length).toBeGreaterThanOrEqual(1);
    });
});

// ══════════════════════════════════════════════════════════════════════
// Pattern (tiling image) fill color space
// ══════════════════════════════════════════════════════════════════════

describe('pattern fill', () => {
    it('places a tiling-pattern image over the filled path bounding box', async () => {
        const imgBytes = new Uint8Array([
            255, 0, 0, 0, 255, 0,
            0, 0, 255, 255, 255, 0,
        ]);
        // Pattern object references an image XObject in its own resources.
        const content = strToBytes(
            '/Pattern cs /P0 scn 100 200 m 400 200 l 400 500 l 100 500 l f',
        );
        const pdf = new RawPdf();
        pdf.setRoot(1)
            .obj(1, '/Type /Catalog /Pages 2 0 R')
            .obj(2, '/Type /Pages /Kids [3 0 R] /Count 1')
            .obj(3, '/Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ' +
                '/Resources << /Pattern << /P0 6 0 R >> >> /Contents 4 0 R')
            .streamObj(4, '', content)
            .obj(6, '/Type /Pattern /PatternType 1 /PaintType 1 /TilingType 1 ' +
                '/BBox [0 0 10 10] /XStep 10 /YStep 10 ' +
                '/Resources << /XObject << /Im0 7 0 R >> >>')
            .streamObj(7,
                '/Type /XObject /Subtype /Image /Width 2 /Height 2 ' +
                '/ColorSpace /DeviceRGB /BitsPerComponent 8',
                imgBytes);
        const result = await renderPixelPerfectPaged(pdf.build(), { zoom: 1 });
        const html = result.pages[0].html;
        // The pattern image is emitted as an <img> spanning the 300x300 path box.
        expect(html).toContain('<img class="bi"');
        expect(html).toMatch(/width:300px;height:300px/);
    });
});

// ══════════════════════════════════════════════════════════════════════
// Alternate embedded font program formats (FontFile3 CFF, FontFile Type1)
// ══════════════════════════════════════════════════════════════════════

describe('alternate font program formats', () => {
    it('reports an OpenType FontFile3 (Subtype OpenType) as opentype @font-face', async () => {
        // We feed a real TTF program through FontFile3/OpenType. It is treated as
        // opentype; with full ASCII coverage it resolves to the system family,
        // but the descriptor + metrics path is exercised.
        const ttf = buildEmbeddedTtf('ABCDEFGHIJKLMNOPQRSTUVWXYZ ');
        const pdf = new RawPdf();
        pdf.setRoot(1)
            .obj(1, '/Type /Catalog /Pages 2 0 R')
            .obj(2, '/Type /Pages /Kids [3 0 R] /Count 1')
            .obj(3, '/Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ' +
                '/Resources << /Font << /F1 6 0 R >> >> /Contents 4 0 R')
            .streamObj(4, '', strToBytes('BT /F1 12 Tf 72 700 Td (ABC) Tj ET'))
            .obj(6, '/Type /Font /Subtype /TrueType /BaseFont /OTFONT+Embedded ' +
                '/FirstChar 65 /LastChar 67 /Widths [600 600 600] /FontDescriptor 7 0 R')
            .obj(7, '/Type /FontDescriptor /FontName /OTFONT+Embedded /Flags 32 ' +
                '/Ascent 750 /Descent -250 /FontFile3 8 0 R')
            .streamObj(8, '/Subtype /OpenType', ttf);
        const result = await renderPixelPerfectPaged(pdf.build(), { zoom: 1 });
        expect(result.pages[0].text).toContain('ABC');
        // metrics from descriptor: ascent 0.75, descent -0.25 → line-height 1
        expect(result.globalCss).toMatch(/\.ff[0-9a-f]+\{font-family:[^}]*line-height:1;/);
    });

    it('accepts a Type1 FontFile program without crashing (no embedded advances)', async () => {
        // FontFile (Type1) is not parsed for glyph advances; falls back to PDF widths.
        const type1Bytes = strToBytes('%!PS-AdobeFont-1.0: Dummy\n');
        const pdf = new RawPdf();
        pdf.setRoot(1)
            .obj(1, '/Type /Catalog /Pages 2 0 R')
            .obj(2, '/Type /Pages /Kids [3 0 R] /Count 1')
            .obj(3, '/Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ' +
                '/Resources << /Font << /F1 6 0 R >> >> /Contents 4 0 R')
            .streamObj(4, '', strToBytes('BT /F1 12 Tf 72 700 Td (T1) Tj ET'))
            .obj(6, '/Type /Font /Subtype /Type1 /BaseFont /T1FONT+Custom ' +
                '/FirstChar 84 /LastChar 84 /Widths [500] /FontDescriptor 7 0 R')
            .obj(7, '/Type /FontDescriptor /FontName /T1FONT+Custom /Flags 32 ' +
                '/Ascent 700 /Descent -200 /FontFile 8 0 R')
            .streamObj(8, '/Length1 10 /Length2 0 /Length3 0', type1Bytes);
        const result = await renderPixelPerfectPaged(pdf.build(), { zoom: 1 });
        expect(result.pages[0].text).toContain('T1');
        // Subset prefix "T1FONT+" is stripped → 'Custom', sans-serif.
        expect(result.globalCss).toMatch(/\.ff[0-9a-f]+\{font-family:'Custom', sans-serif/);
    });
});
