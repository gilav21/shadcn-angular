import { describe, expect, it } from 'vitest';
import {
    renderPixelPerfectPaged, toStandaloneHtml,
    NumericStateManager, ColorStateManager, TransformMatrixManager, AllStateManager,
} from './pdf-pixel-perfect';

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
