import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { vi } from 'vitest';
import { FileViewerComponent, FileViewerToolbarDirective, FileViewerContentDirective } from './file-viewer.component';

function createTextBlob(content: string): File {
    return new File([content], 'test.txt', { type: 'text/plain' });
}

@Component({
    template: `
        <ui-file-viewer [file]="file">
            <ui-file-viewer-toolbar>Custom toolbar</ui-file-viewer-toolbar>
            <ui-file-viewer-content />
        </ui-file-viewer>
    `,
    imports: [FileViewerComponent, FileViewerToolbarDirective, FileViewerContentDirective],
})
class CustomModeHostComponent {
    file: File | null = null;
}

describe('FileViewerComponent', () => {
    let fixture: ComponentFixture<FileViewerComponent>;
    let component: FileViewerComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [FileViewerComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(FileViewerComponent);
        component = fixture.componentInstance;
    });

    it('should create the component', () => {
        fixture.detectChanges();
        expect(component).toBeTruthy();
    });

    it('should start in idle state', () => {
        fixture.detectChanges();
        expect(component.state()).toBe('idle');
    });

    it('should show correct default height', () => {
        fixture.detectChanges();
        const el = fixture.nativeElement.querySelector('[data-slot="file-viewer"]');
        expect(el.style.height).toBe('600px');
    });

    it('should have data-slot attribute', () => {
        fixture.detectChanges();
        const el = fixture.nativeElement.querySelector('[data-slot="file-viewer"]');
        expect(el).toBeTruthy();
    });

    it('should display filename from File object', () => {
        const file = createTextBlob('hello');
        fixture.componentRef.setInput('file', file);
        fixture.detectChanges();
        expect(component.displayFilename()).toBe('test.txt');
    });

    it('should use provided filename over File name', () => {
        fixture.componentRef.setInput('filename', 'custom-name.txt');
        fixture.componentRef.setInput('file', createTextBlob('hello'));
        fixture.detectChanges();
        expect(component.displayFilename()).toBe('custom-name.txt');
    });

    it('should set loading state when processing file', () => {
        fixture.componentRef.setInput('file', createTextBlob('hello'));
        fixture.detectChanges();
        expect(component.state()).toBe('loading');
    });

    describe('zoom controls', () => {
        beforeEach(() => {
            fixture.detectChanges();
        });

        it('should zoom in', () => {
            component.zoomIn();
            expect(component.currentZoom()).toBe(1.25);
        });

        it('should zoom out', () => {
            component.zoomOut();
            expect(component.currentZoom()).toBe(0.75);
        });

        it('should not zoom below 0.25', () => {
            component.currentZoom.set(0.25);
            component.zoomOut();
            expect(component.currentZoom()).toBe(0.25);
        });

        it('should not zoom above 3', () => {
            component.currentZoom.set(3);
            component.zoomIn();
            expect(component.currentZoom()).toBe(3);
        });

        it('should calculate correct zoom percent', () => {
            component.currentZoom.set(1.5);
            expect(component.zoomPercent()).toBe(150);
        });
    });

    describe('page navigation', () => {
        beforeEach(() => {
            fixture.detectChanges();
            component.totalPages.set(5);
        });

        it('should go to next page', () => {
            component.nextPage();
            expect(component.currentPage()).toBe(2);
        });

        it('should go to previous page', () => {
            component.currentPage.set(3);
            component.prevPage();
            expect(component.currentPage()).toBe(2);
        });

        it('should not go below page 1', () => {
            component.prevPage();
            expect(component.currentPage()).toBe(1);
        });

        it('should not go beyond total pages', () => {
            component.currentPage.set(5);
            component.nextPage();
            expect(component.currentPage()).toBe(5);
        });
    });

    describe('isPaginated', () => {
        beforeEach(() => {
            fixture.detectChanges();
        });

        it('should be true for PDF (paginated rendering)', () => {
            component.detectedType.set('pdf');
            expect(component.isPaginated()).toBe(true);
        });

        it('should be true for PPTX', () => {
            component.detectedType.set('pptx');
            expect(component.isPaginated()).toBe(true);
        });

        it('should be false for image', () => {
            component.detectedType.set('image');
            expect(component.isPaginated()).toBe(false);
        });
    });

    describe('isZoomable', () => {
        beforeEach(() => {
            fixture.detectChanges();
        });

        it('should be true for image', () => {
            component.detectedType.set('image');
            expect(component.isZoomable()).toBe(true);
        });

        it('should be true for PDF (paginated rendering)', () => {
            component.detectedType.set('pdf');
            expect(component.isZoomable()).toBe(true);
        });

        it('should be false for audio', () => {
            component.detectedType.set('audio');
            expect(component.isZoomable()).toBe(false);
        });
    });

    describe('sheet tabs', () => {
        beforeEach(() => {
            fixture.detectChanges();
        });

        it('should switch active sheet', () => {
            component.setActiveSheet(2);
            expect(component.activeSheetIndex()).toBe(2);
        });
    });

    describe('custom mode (content projection)', () => {
        let customFixture: ComponentFixture<CustomModeHostComponent>;

        beforeEach(async () => {
            customFixture = TestBed.createComponent(CustomModeHostComponent);
            customFixture.detectChanges();
        });

        it('should detect custom content', () => {
            const viewer = customFixture.debugElement.children[0].componentInstance as FileViewerComponent;
            expect(viewer.hasCustomContent()).toBe(true);
        });
    });

    describe('cleanup', () => {
        it('should revoke blob URLs on destroy', () => {
            const spy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
            fixture.detectChanges();
            (component as unknown as { blobUrls: string[] }).blobUrls.push('blob:test1', 'blob:test2');
            fixture.destroy();
            expect(spy).toHaveBeenCalledTimes(2);
            spy.mockRestore();
        });
    });
});

interface FileViewerInternals {
    loadFile(file: File | Blob): Promise<void>;
    loadFromUrl(url: string): Promise<void>;
    extractFilename(url: string): string;
    processText(bytes: Uint8Array): void;
    processMedia(bytes: Uint8Array, mimeType?: string): void;
    processImage(bytes: Uint8Array, file: File | Blob): Promise<void>;
    checkIfSvg(bytes: Uint8Array): boolean;
    handleError(message: string): void;
    escapeHtml(str: string): string;
    detectDocumentRtl(elements: ReadonlyArray<{ type: string }>): boolean;
    renderDocxToHtml(elements: ReadonlyArray<unknown>): string;
    renderDocxParagraph(el: unknown): string;
    renderDocxTable(el: unknown): string;
    renderDocxImage(el: unknown): string;
    renderDocxFootnotes(fn: ReadonlyArray<unknown>, en: ReadonlyArray<unknown>): string;
    renderDocxComments(c: ReadonlyArray<unknown>): string;
    renderDocxHeadersFooters(s: ReadonlyArray<ReadonlyArray<unknown>>, t: 'header' | 'footer'): string;
    mapDocxAlignment(a: string): string;
    mapVerticalAlign(v: string): string;
    buildTableWidth(s?: unknown): string;
    renderSlideToHtml(slide: unknown): string;
    renderSlideElement(el: unknown): string;
    renderSlideTextFrame(tf: unknown): string;
    renderSlideParagraph(p: unknown, n: number): string;
    renderSlideRun(run: unknown): string;
    renderSlideShape(s: unknown): string;
    renderSlideConnector(c: unknown): string;
    renderSlideTable(t: unknown): string;
    renderBulletPrefix(b: unknown, n: number): string;
    formatAutoNumber(scheme: string, counter: number, startAt: number): string;
    toRoman(n: number): string;
    toAlpha(n: number): string;
    buildGradientCss(g: unknown): string;
    buildPatternCss(p: unknown): string;
    buildEffectsCss(e: unknown, ctx: 'text' | 'shape'): string[];
    buildUnderlineCss(u: unknown): string[];
    mapDashStyleToCss(d?: string): string;
    mapDashToDecorationStyle(d: string): string;
    getShapeBorderRadius(t: string): string;
    getShapeClipPath(t: string): string;
    getConnectorDashAttr(d?: string): string;
    buildConnectorPath(t: string | undefined, w: number, h: number, fH?: boolean, fV?: boolean, pad?: number): string;
    renderTabContent(text: string, tabs?: unknown, def?: number): string;
    mapSlideAlignment(a: string): string;
    blobUrls: string[];
    xlsxData: { set(v: unknown): void };
    pdfPages: { set(v: unknown): void };
    pdfGlobalCss: { set(v: unknown): void };
    pptxSlides: { set(v: unknown): void };
    docxRenderedHtml: { set(v: unknown): void };
}

function internals(c: FileViewerComponent): FileViewerInternals {
    return c as unknown as FileViewerInternals;
}

async function flush(): Promise<void> {
    await new Promise(r => setTimeout(r, 0));
    await new Promise(r => setTimeout(r, 0));
}

describe('FileViewerComponent rendering internals', () => {
    let fixture: ComponentFixture<FileViewerComponent>;
    let component: FileViewerComponent;
    let api: FileViewerInternals;

    beforeEach(() => {
        fixture = TestBed.createComponent(FileViewerComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        api = internals(component);
    });

    describe('text / media processing', () => {
        it('decodes text bytes into textContent', () => {
            api.processText(new TextEncoder().encode('hello world'));
            expect(component.textContent()).toBe('hello world');
        });

        it('creates a media blob url and tracks it', () => {
            const before = api.blobUrls.length;
            api.processMedia(new Uint8Array([1, 2, 3]), 'audio/mpeg');
            expect(api.blobUrls).toHaveLength(before + 1);
            expect(component.mediaSrc()).toBeTruthy();
        });

        it('falls back to octet-stream mime when none given', () => {
            api.processMedia(new Uint8Array([1, 2, 3]), '');
            expect(component.mediaSrc()).toBeTruthy();
        });

        it('onMediaError sets error state', () => {
            component.onMediaError('boom');
            expect(component.state()).toBe('error');
            expect(component.errorMessage()).toBe('boom');
        });
    });

    describe('error handling and outputs', () => {
        it('handleError emits loadError', () => {
            const events: { type: string; message: string }[] = [];
            component.loadError.subscribe(e => events.push(e));
            component.detectedType.set('pdf');
            api.handleError('failed');
            expect(component.state()).toBe('error');
            expect(events[0]).toEqual({ type: 'pdf', message: 'failed' });
        });

        it('emits pageChange/zoomChange', () => {
            const pages: number[] = [];
            const zooms: number[] = [];
            component.pageChange.subscribe(p => pages.push(p));
            component.zoomChange.subscribe(z => zooms.push(z));
            component.totalPages.set(3);
            component.nextPage();
            component.prevPage();
            component.zoomIn();
            component.zoomOut();
            expect(pages).toEqual([2, 1]);
            expect(zooms).toEqual([1.25, 1]);
        });
    });

    describe('SVG detection', () => {
        it('detects <svg root', () => {
            const bytes = new TextEncoder().encode('  <svg xmlns="x"></svg>');
            expect(api.checkIfSvg(bytes)).toBe(true);
        });

        it('detects <?xml prolog', () => {
            const bytes = new TextEncoder().encode('<?xml version="1.0"?><svg/>');
            expect(api.checkIfSvg(bytes)).toBe(true);
        });

        it('skips UTF-8 BOM', () => {
            const svg = new TextEncoder().encode('<svg/>');
            const bytes = new Uint8Array([0xEF, 0xBB, 0xBF, ...svg]);
            expect(api.checkIfSvg(bytes)).toBe(true);
        });

        it('returns false for non-svg', () => {
            expect(api.checkIfSvg(new TextEncoder().encode('plain text'))).toBe(false);
        });
    });

    describe('processImage', () => {
        it('renders a raster image via blob url', async () => {
            const file = new File([new Uint8Array([0xFF, 0xD8, 0xFF])], 'a.jpg', { type: 'image/jpeg' });
            await api.processImage(new Uint8Array([0xFF, 0xD8, 0xFF]), file);
            expect(component.imageSrc()).toBeTruthy();
        });

        it('sanitizes and renders a valid svg', async () => {
            const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>';
            const bytes = new TextEncoder().encode(svg);
            const file = new File([bytes], 'a.svg', { type: 'image/svg+xml' });
            await api.processImage(bytes, file);
            expect(component.imageSrc()).toBeTruthy();
        });

        it('throws on unsafe/invalid svg', async () => {
            const bytes = new TextEncoder().encode('<svg not really');
            const file = new File([bytes], 'a.svg', { type: 'image/svg+xml' });
            await expect(api.processImage(bytes, file)).rejects.toThrow();
        });
    });

    describe('extractFilename', () => {
        it('extracts the name from a url path', () => {
            expect(api.extractFilename('https://x.com/a/b/report.pdf')).toBe('report.pdf');
        });

        it('falls back to "file" for trailing slash', () => {
            expect(api.extractFilename('https://x.com/')).toBe('file');
        });
    });

    describe('loadFromUrl', () => {
        it('handles non-ok responses', async () => {
            const orig = globalThis.fetch;
            globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
            await api.loadFromUrl('https://x.com/missing.txt');
            expect(component.state()).toBe('error');
            expect(component.errorMessage()).toContain('404');
            globalThis.fetch = orig;
        });

        it('loads a text file from a url', async () => {
            const orig = globalThis.fetch;
            const blob = new Blob(['url text'], { type: 'text/plain' });
            globalThis.fetch = vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                blob: () => Promise.resolve(blob),
            } as unknown as Response);
            await api.loadFromUrl('https://x.com/note.txt');
            await flush();
            expect(component.state()).toBe('loaded');
            expect(component.textContent()).toBe('url text');
            globalThis.fetch = orig;
        });
    });

    describe('loadFile end-to-end with explicit type', () => {
        it('loads text and emits loaded event', async () => {
            const events: { type: string; filename: string }[] = [];
            component.loaded.subscribe(e => events.push(e));
            fixture.componentRef.setInput('type', 'text');
            const file = new File(['content here'], 'doc.txt', { type: 'text/plain' });
            await api.loadFile(file);
            expect(component.state()).toBe('loaded');
            expect(component.detectedType()).toBe('text');
            expect(component.textContent()).toBe('content here');
            expect(events[0].type).toBe('text');
        });

        it('handles an unknown/default type without error', async () => {
            fixture.componentRef.setInput('type', 'unknown');
            const file = new File([new Uint8Array([0, 1, 2])], 'x.bin');
            await api.loadFile(file);
            expect(component.state()).toBe('loaded');
        });

        it('routes audio/video through media processing', async () => {
            fixture.componentRef.setInput('type', 'audio');
            const file = new File([new Uint8Array([1, 2, 3])], 's.mp3', { type: 'audio/mpeg' });
            await api.loadFile(file);
            expect(component.mediaSrc()).toBeTruthy();
            expect(component.state()).toBe('loaded');
        });
    });

    describe('escapeHtml', () => {
        it('escapes special characters', () => {
            expect(api.escapeHtml('<a href="x">&y</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;y&lt;/a&gt;');
        });
    });

    describe('docx rendering', () => {
        function para(opts: Record<string, unknown> = {}): unknown {
            return { type: 'paragraph', style: '', runs: [{ text: 'Hello', style: {} }], ...opts };
        }

        it('detects rtl document when majority paragraphs are rtl', () => {
            const els = [
                { type: 'paragraph', rtl: true },
                { type: 'paragraph', rtl: true },
                { type: 'paragraph', rtl: false },
            ];
            expect(api.detectDocumentRtl(els)).toBe(true);
        });

        it('returns false rtl when no paragraphs', () => {
            expect(api.detectDocumentRtl([{ type: 'table' }])).toBe(false);
        });

        it('renders a basic paragraph', () => {
            const html = api.renderDocxParagraph(para());
            expect(html).toContain('<p');
            expect(html).toContain('Hello');
        });

        it('renders heading paragraphs', () => {
            const html = api.renderDocxParagraph(para({ style: 'Heading2' }));
            expect(html).toContain('<h2');
        });

        it('renders list items', () => {
            const html = api.renderDocxParagraph(para({ listType: 'bullet', listLevel: 1 }));
            expect(html).toContain('<li');
        });

        it('renders page break for empty paragraph with page break run', () => {
            const html = api.renderDocxParagraph({ type: 'paragraph', style: '', runs: [{ text: '', breakType: 'page', style: {} }] });
            expect(html).toContain('<hr');
        });

        it('returns empty string for blank paragraph', () => {
            expect(api.renderDocxParagraph({ type: 'paragraph', style: '', runs: [{ text: '   ', style: {} }] })).toBe('');
        });

        it('applies full run formatting', () => {
            const run = {
                text: 'x', href: 'http://h', isInserted: true, isDeleted: true,
                style: {
                    bold: true, italic: true, underline: true, strikethrough: true,
                    doubleStrikethrough: true, caps: true, smallCaps: true,
                    fontSize: 12, color: '#f00', fontFamily: 'Arial', highlight: 'yellow',
                    backgroundColor: '#0f0', vertAlign: 'superscript', rtl: true, charSpacing: 1,
                },
            };
            const html = api.renderDocxParagraph({ type: 'paragraph', style: '', runs: [run] });
            expect(html).toContain('<strong>');
            expect(html).toContain('<em>');
            expect(html).toContain('<a href="http://h"');
            expect(html).toContain('dir="rtl"');
            expect(html).toContain('<ins');
            expect(html).toContain('<del');
        });

        it('renders subscript and background color path', () => {
            const run = { text: 'y', style: { vertAlign: 'subscript', backgroundColor: '#abc' } };
            const html = api.renderDocxParagraph({ type: 'paragraph', style: '', runs: [run] });
            expect(html).toContain('<sub>');
            expect(html).toContain('background-color:#abc');
        });

        it('hides hidden runs', () => {
            const html = api.renderDocxParagraph({ type: 'paragraph', style: '', runs: [{ text: 'visible', style: {} }, { text: 'secret', style: { hidden: true } }] });
            expect(html).toContain('visible');
            expect(html).not.toContain('secret');
        });

        it('renders anchor runs', () => {
            const html = api.renderDocxParagraph({ type: 'paragraph', style: '', runs: [{ text: '', anchorId: 'bm1', style: {} }, { text: 't', style: {} }] });
            expect(html).toContain('id="bm1"');
        });

        it('applies paragraph-level styling and borders', () => {
            const html = api.renderDocxParagraph(para({
                rtl: true, alignment: 'center', spacingBefore: 6, spacingAfter: 6,
                lineSpacing: 1.5, indentLeft: 10, indentRight: 5, indentHanging: 3,
                indentFirstLine: 2, listLevel: 2, shading: '#eee',
                borders: {
                    top: { style: 's', color: '#000', size: 1 },
                    bottom: { style: 's', color: '#000', size: 1 },
                    left: { style: 's', color: '#000', size: 1 },
                    right: { style: 's', color: '#000', size: 1 },
                },
            }));
            expect(html).toContain('text-align:center');
            expect(html).toContain('border-top');
            expect(html).toContain('background-color:#eee');
        });

        it('maps alignments', () => {
            expect(api.mapDocxAlignment('right')).toBe('right');
            expect(api.mapDocxAlignment('both')).toBe('justify');
            expect(api.mapDocxAlignment('distribute')).toBe('justify');
            expect(api.mapDocxAlignment('left')).toBe('left');
        });

        it('renders an image element', () => {
            const html = api.renderDocxImage({ dataUrl: 'data:img', width: 10, height: 20, altText: 'alt<x>' });
            expect(html).toContain('src="data:img"');
            expect(html).toContain('alt="alt&lt;x&gt;"');
        });

        it('renders a table with thead, colspan, rowspan and cell styles', () => {
            const cell = (opts: Record<string, unknown> = {}) => ({
                elements: [{ type: 'paragraph', style: '', runs: [{ text: 'c', style: {} }] }],
                colSpan: 1, rowSpan: 1, ...opts,
            });
            const table = {
                type: 'table',
                tableStyle: { width: 5000, widthUnit: 'pct' },
                rows: [
                    { rowStyle: { isHeader: true, height: 20 }, cells: [cell({ colSpan: 2 })] },
                    {
                        cells: [
                            cell({ rowSpan: 2, cellStyle: {
                                backgroundColor: '#fff', verticalAlign: 'center', width: 1000, widthUnit: 'dxa',
                                borders: { top: { size: 1, color: '#000' }, bottom: { size: 1, color: '#000' }, left: { size: 1, color: '#000' }, right: { size: 1, color: '#000' } },
                                paddings: { top: 1, bottom: 1, left: 1, right: 1 },
                            } }),
                            cell({ rowSpan: 0 }),
                        ],
                    },
                ],
            };
            const html = api.renderDocxTable(table);
            expect(html).toContain('<thead>');
            expect(html).toContain('<th');
            expect(html).toContain('colspan="2"');
            expect(html).toContain('rowspan="2"');
            expect(html).toContain('vertical-align:middle');
        });

        it('builds table width for dxa unit', () => {
            expect(api.buildTableWidth({ width: 2000, widthUnit: 'dxa' })).toContain('pt');
            expect(api.buildTableWidth(undefined)).toBe('');
        });

        it('maps vertical align', () => {
            expect(api.mapVerticalAlign('center')).toBe('middle');
            expect(api.mapVerticalAlign('bottom')).toBe('bottom');
            expect(api.mapVerticalAlign('top')).toBe('top');
        });

        it('renders footnotes and endnotes', () => {
            const notes = [{ id: '1', paragraphs: [{ type: 'paragraph', style: '', runs: [{ text: 'fn', style: {} }] }] }];
            const html = api.renderDocxFootnotes(notes, notes);
            expect(html).toContain('<section');
            expect(html).toContain('fn');
        });

        it('returns empty for no footnotes', () => {
            expect(api.renderDocxFootnotes([], [])).toBe('');
        });

        it('renders comments', () => {
            const comments = [{ id: 'c1', author: 'Bob', date: 'today', paragraphs: [{ type: 'paragraph', style: '', runs: [{ text: 'note', style: {} }] }] }];
            const html = api.renderDocxComments(comments);
            expect(html).toContain('Comments');
            expect(html).toContain('Bob');
        });

        it('returns empty for no comments', () => {
            expect(api.renderDocxComments([])).toBe('');
        });

        it('renders headers/footers', () => {
            const section = [[{ type: 'paragraph', style: '', runs: [{ text: 'hdr', style: {} }] }]];
            expect(api.renderDocxHeadersFooters(section, 'header')).toContain('hdr');
            expect(api.renderDocxHeadersFooters(section, 'footer')).toContain('border-t');
        });

        it('returns empty for empty header sections', () => {
            expect(api.renderDocxHeadersFooters([], 'header')).toBe('');
            expect(api.renderDocxHeadersFooters([[]], 'header')).toBe('');
        });

        it('renderDocxToHtml dispatches paragraph/table/image', () => {
            const html = api.renderDocxToHtml([
                { type: 'paragraph', style: '', runs: [{ text: 'p', style: {} }] },
                { type: 'table', tableStyle: {}, rows: [] },
                { type: 'image', dataUrl: 'd', width: 1, height: 1, altText: '' },
            ]);
            expect(html).toContain('<p');
            expect(html).toContain('<table');
            expect(html).toContain('<img');
        });
    });

    describe('pptx slide rendering', () => {
        it('renders slide background, image, and dispatches elements', () => {
            const slide = {
                backgroundColor: '#123', backgroundImage: 'data:bg',
                elements: [
                    { type: 'image', dataUrl: 'd', x: 1, y: 2, width: 3, height: 4 },
                    { type: 'unknownkind', x: 0, y: 0, width: 0, height: 0 },
                ],
            };
            const html = api.renderSlideToHtml(slide);
            expect(html).toContain('background-color:#123');
            expect(html).toContain('background-image:url(data:bg)');
            expect(html).toContain('<img');
        });

        it('renders a text frame with paragraphs, bullets and font scale', () => {
            const tf = {
                type: 'text', x: 1, y: 2, width: 100, height: 50,
                fillColor: '#fff', borderColor: '#000', borderWidth: 2, rotation: 10,
                fontScale: 0.5,
                paragraphs: [
                    {
                        alignment: 'ctr', spacingBefore: 2, spacingAfter: 2, lineSpacing: 1.2,
                        marginLeft: 5, indent: 3, level: 1, fontAlign: 'ctr', rtl: true,
                        bullet: { type: 'char', char: '-', color: '#f00', fontFamily: 'Arial', sizePoints: 10 },
                        runs: [{ text: 'word', bold: true, italic: true, fontSize: 12, fontFamily: 'Arial', color: '#000' }],
                    },
                ],
            };
            const html = api.renderSlideTextFrame(tf);
            expect(html).toContain('transform:scale(0.5)');
            expect(html).toContain('dir="rtl"');
            expect(html).toContain('word');
        });

        it('renders empty paragraph as line break', () => {
            const html = api.renderSlideParagraph({ runs: [], bullet: { type: 'none' } }, 0);
            expect(html).toContain('<br/>');
        });

        it('renders auto-numbered bullets', () => {
            const html = api.renderSlideTextFrame({
                type: 'text', x: 0, y: 0, width: 1, height: 1,
                paragraphs: [
                    { bullet: { type: 'autoNum', autoNumScheme: 'arabicPeriod', startAt: 1 }, runs: [{ text: 'a' }] },
                    { bullet: { type: 'autoNum', autoNumScheme: 'arabicPeriod', startAt: 1 }, runs: [{ text: 'b' }] },
                    { bullet: { type: 'none' }, runs: [{ text: 'c' }] },
                ],
            });
            expect(html).toContain('1.');
            expect(html).toContain('2.');
        });

        it('renders image bullet prefix', () => {
            expect(api.renderBulletPrefix({ imageDataUrl: 'data:b' }, 0)).toContain('<img');
        });

        it('renders run with tab content', () => {
            const html = api.renderSlideParagraph({
                runs: [{ text: 'a\tb' }],
                tabs: [{ position: 100, alignment: 'r' }],
                defaultTabSize: 48,
            }, 0);
            expect(html).toContain('a');
        });

        it('renders various run fills and effects', () => {
            const base = { text: 'x' };
            expect(api.renderSlideRun({ ...base, noFill: true })).toContain('transparent');
            expect(api.renderSlideRun({ ...base, gradientFill: { type: 'linear', angle: 45, stops: [{ color: '#000', position: 0 }, { color: '#fff', position: 100 }] } })).toContain('linear-gradient');
            expect(api.renderSlideRun({ ...base, imageFill: 'data:i' })).toContain('background-image');
            expect(api.renderSlideRun({ ...base, patternFill: { preset: 'cross', fgColor: '#000', bgColor: '#fff' } })).toContain('background-image');
            expect(api.renderSlideRun({ ...base, cap: 'all', spc: 1, highlight: '#ff0' })).toContain('uppercase');
            expect(api.renderSlideRun({ ...base, cap: 'small' })).toContain('small-caps');
            expect(api.renderSlideRun({ ...base, isHyperlink: true })).toContain('<u>');
            expect(api.renderSlideRun({ ...base, strikethrough: true, baseline: 1 })).toContain('<sup>');
            expect(api.renderSlideRun({ ...base, baseline: -1 })).toContain('<sub>');
            expect(api.renderSlideRun({ ...base, underline: true })).toContain('<u>');
            expect(api.renderSlideRun({ ...base, underlineStyle: { color: '#000', width: 1, compound: 'dbl' } })).toContain('underline');
            expect(api.renderSlideRun({ ...base, textOutline: { width: 1, color: '#000' }, hoverTooltip: 'tip', effects: { glow: { radius: 2, color: '#0f0' } } })).toContain('text-stroke');
        });

        it('renders shapes with fills, borders, radius and clip-paths', () => {
            const shapeOf = (opts: Record<string, unknown>) => api.renderSlideShape({
                type: 'shape', x: 0, y: 0, width: 10, height: 10, shapeType: 'rect', ...opts,
            });
            expect(shapeOf({ gradientFill: { type: 'radial', stops: [{ color: '#000', position: 0 }] } })).toContain('radial-gradient');
            expect(shapeOf({ imageFill: 'data:i' })).toContain('background-image');
            expect(shapeOf({ patternFill: { preset: 'pct50', fgColor: '#000', bgColor: '#fff' } })).toContain('radial-gradient');
            expect(shapeOf({ fillColor: '#abc', borderColor: '#000', borderWidth: 2, dashStyle: 'dash', rotation: 5 })).toContain('rotate(5deg)');
            expect(shapeOf({ shapeType: 'roundRect' })).toContain('border-radius:8px');
            expect(shapeOf({ shapeType: 'ellipse' })).toContain('border-radius:50%');
            expect(shapeOf({ shapeType: 'rightArrow' })).toContain('clip-path');
            expect(shapeOf({ effects: { outerShadow: { offsetX: 1, offsetY: 1, blur: 2, color: '#000' } } })).toContain('box-shadow');
        });

        it('renders connectors of each type', () => {
            const connOf = (opts: Record<string, unknown>) => api.renderSlideConnector({
                type: 'connector', x: 0, y: 0, width: 50, height: 30, color: '#000', lineWidth: 2, ...opts,
            });
            expect(connOf({ connectorType: 'straightConnector1' })).toContain('<path');
            expect(connOf({ connectorType: 'bentConnector2', flipH: true })).toContain('<path');
            expect(connOf({ connectorType: 'bentConnector3', flipV: true })).toContain('<path');
            expect(connOf({ connectorType: 'curvedConnector3' })).toContain('C');
            expect(connOf({ dashStyle: 'dash', headEnd: { type: 'arrow' }, tailEnd: { type: 'arrow' }, rotation: 10 })).toContain('marker-end');
        });

        it('renders a slide table', () => {
            const html = api.renderSlideTable({
                type: 'table', x: 0, y: 0, width: 100, height: 50,
                columnWidths: [50, 50],
                rows: [[{ text: 'h', bold: true, fillColor: '#eee', color: '#000' }], [{ text: 'd' }]],
            });
            expect(html).toContain('<table');
            expect(html).toContain('<strong>h</strong>');
            expect(html).toContain('<colgroup>');
        });

        it('renders slide element dispatch for table/shape/connector/text', () => {
            expect(api.renderSlideElement({ type: 'table', x: 0, y: 0, width: 1, height: 1, columnWidths: [], rows: [] })).toContain('<table');
            expect(api.renderSlideElement({ type: 'shape', x: 0, y: 0, width: 1, height: 1, shapeType: 'rect' })).toContain('<div');
            expect(api.renderSlideElement({ type: 'connector', x: 0, y: 0, width: 1, height: 1 })).toContain('<svg');
            expect(api.renderSlideElement({ type: 'text', x: 0, y: 0, width: 1, height: 1, paragraphs: [] })).toContain('<div');
            expect(api.renderSlideElement({ type: 'nope', x: 0, y: 0, width: 0, height: 0 })).toBe('');
        });
    });

    describe('formatting helper units', () => {
        it('formats auto numbers across schemes', () => {
            expect(api.formatAutoNumber('arabicPeriod', 1, 1)).toBe('1.');
            expect(api.formatAutoNumber('arabicParenR', 1, 1)).toBe('1)');
            expect(api.formatAutoNumber('romanUcPeriod', 4, 1)).toBe('IV.');
            expect(api.formatAutoNumber('romanLcPeriod', 4, 1)).toBe('iv.');
            expect(api.formatAutoNumber('alphaUcPeriod', 1, 1)).toBe('A.');
            expect(api.formatAutoNumber('alphaLcPeriod', 27, 1)).toBe('aa.');
            expect(api.formatAutoNumber('whatever', 1, 1)).toBe('1.');
        });

        it('toRoman and toAlpha edge cases', () => {
            expect(api.toRoman(2024)).toBe('MMXXIV');
            expect(api.toAlpha(0)).toBe('');
            expect(api.toAlpha(26)).toBe('Z');
        });

        it('builds gradient css linear and radial', () => {
            expect(api.buildGradientCss({ type: 'linear', angle: 90, stops: [{ color: '#000', position: 0 }] })).toContain('linear-gradient(90deg');
            expect(api.buildGradientCss({ type: 'radial', stops: [{ color: '#000', position: 0 }] })).toContain('radial-gradient');
        });

        it('builds pattern css for pct, thin, thick, grids, cross', () => {
            expect(api.buildPatternCss({ preset: 'pct25', fgColor: '#000', bgColor: '#fff' })).toContain('radial-gradient');
            expect(api.buildPatternCss({ preset: 'horz', fgColor: '#000', bgColor: '#fff' })).toContain('repeating-linear-gradient');
            expect(api.buildPatternCss({ preset: 'dkVert', fgColor: '#000', bgColor: '#fff' })).toContain('repeating-linear-gradient');
            expect(api.buildPatternCss({ preset: 'cross', fgColor: '#000', bgColor: '#fff' })).toContain('90deg');
            expect(api.buildPatternCss({ preset: 'diagCross', fgColor: '#000', bgColor: '#fff' })).toContain('135deg');
            expect(api.buildPatternCss({ preset: 'unknownpat', fgColor: '#000', bgColor: '#fff' })).toContain('45deg');
        });

        it('builds effects css for text and shape contexts', () => {
            const eff = {
                outerShadow: { offsetX: 1, offsetY: 1, blur: 2, color: '#000' },
                innerShadow: { offsetX: 1, offsetY: 1, blur: 2, color: '#000' },
                glow: { radius: 3, color: '#0f0' },
                blur: 2, softEdge: 10,
                reflection: { distance: 5, startOpacity: 0.5 },
            };
            const textCss = api.buildEffectsCss(eff, 'text');
            expect(textCss.join(';')).toContain('text-shadow');
            expect(textCss.join(';')).toContain('filter');
            const shapeCss = api.buildEffectsCss(eff, 'shape');
            expect(shapeCss.join(';')).toContain('box-shadow:inset');
            expect(shapeCss.join(';')).toContain('mask-image');
        });

        it('builds underline css variants', () => {
            expect(api.buildUnderlineCss({ color: '#000', width: 1, compound: 'tri' }).join(';')).toContain('double');
            expect(api.buildUnderlineCss({ dashStyle: 'dot' }).join(';')).toContain('dotted');
            expect(api.buildUnderlineCss({}).join(';')).toContain('underline');
        });

        it('maps dash styles to css', () => {
            expect(api.mapDashStyleToCss(undefined)).toBe('solid');
            expect(api.mapDashStyleToCss('dot')).toBe('dotted');
            expect(api.mapDashStyleToCss('lgDash')).toBe('dashed');
            expect(api.mapDashStyleToCss('weird')).toBe('solid');
        });

        it('maps dash to decoration style', () => {
            expect(api.mapDashToDecorationStyle('sysDot')).toBe('dotted');
            expect(api.mapDashToDecorationStyle('dashDot')).toBe('dashed');
            expect(api.mapDashToDecorationStyle('x')).toBe('solid');
        });

        it('shape border radius and clip path defaults', () => {
            expect(api.getShapeBorderRadius('rect')).toBe('');
            expect(api.getShapeClipPath('rect')).toBe('');
            expect(api.getShapeClipPath('leftArrow')).toContain('polygon');
            expect(api.getShapeClipPath('chevron')).toContain('polygon');
        });

        it('connector dash attributes', () => {
            expect(api.getConnectorDashAttr(undefined)).toBe('');
            expect(api.getConnectorDashAttr('dot')).toContain('dasharray');
            expect(api.getConnectorDashAttr('lgDash')).toContain('12');
            expect(api.getConnectorDashAttr('lgDashDotDot')).toContain('dasharray');
            expect(api.getConnectorDashAttr('weird')).toBe('');
        });

        it('renderTabContent with explicit tabs and defaults', () => {
            expect(api.renderTabContent('no tabs')).toBe('no tabs');
            const withTabs = api.renderTabContent('a\tb\tc', [{ position: 50, alignment: 'r' }], 48);
            expect(withTabs).toContain('min-width:50px');
            expect(withTabs).toContain('width:48px');
        });

        it('maps slide alignment', () => {
            expect(api.mapSlideAlignment('ctr')).toBe('center');
            expect(api.mapSlideAlignment('r')).toBe('right');
            expect(api.mapSlideAlignment('just')).toBe('justify');
            expect(api.mapSlideAlignment('l')).toBe('left');
        });
    });

    describe('computed view state', () => {
        it('currentPdfPageHtml returns empty when out of range', () => {
            expect(component.currentPdfPageHtml()).toBe('');
        });

        it('currentSlideHtml returns empty when out of range', () => {
            expect(component.currentSlideHtml()).toBe('');
        });

        it('pptx display defaults when no slides', () => {
            expect(component.pptxDisplayWidth()).toBe(960);
            expect(component.pptxDisplayHeight()).toBe(540);
        });

        it('xlsx computeds default when no data', () => {
            expect(component.xlsxSheetNames()).toEqual([]);
            expect(component.xlsxTruncated()).toBe(false);
            expect(component.xlsxHeaderRow()).toBeNull();
            expect(component.xlsxDataRows()).toEqual([]);
        });

        it('xlsx computeds reflect set data', () => {
            api.xlsxData.set({
                truncated: true,
                sheets: [
                    { name: 'Sheet1', data: [['H1', 'H2'], ['a', 'b'], ['c', 'd']] },
                    { name: 'Sheet2', data: [] },
                ],
            });
            expect(component.xlsxSheetNames()).toEqual(['Sheet1', 'Sheet2']);
            expect(component.xlsxTruncated()).toBe(true);
            expect(component.xlsxHeaderRow()).toEqual(['H1', 'H2']);
            expect(component.xlsxDataRows()).toEqual([['a', 'b'], ['c', 'd']]);
            component.setActiveSheet(1);
            expect(component.xlsxHeaderRow()).toBeNull();
            expect(component.xlsxDataRows()).toEqual([]);
        });

        it('currentPdfPageHtml renders the active page', () => {
            api.pdfPages.set([{ html: '<p>page1</p>' }, { html: '<p>page2</p>' }]);
            api.pdfGlobalCss.set('.x{color:red}');
            component.totalPages.set(2);
            component.currentPage.set(2);
            const html = component.currentPdfPageHtml();
            expect(html).toBeTruthy();
        });

        it('currentSlideHtml and pptx display reflect set slides', () => {
            api.pptxSlides.set([{ html: '<div>slide</div>', width: 800, height: 600 }]);
            component.currentPage.set(1);
            expect(component.currentSlideHtml()).toBeTruthy();
            expect(component.pptxDisplayWidth()).toBe(800);
            expect(component.pptxDisplayHeight()).toBe(600);
        });

        it('docxHtml reflects set rendered html', () => {
            api.docxRenderedHtml.set('<p>doc body</p>');
            expect(component.docxHtml()).toBeTruthy();
        });
    });

    describe('additional branch coverage', () => {
        it('renders cell content containing a nested table', () => {
            const nestedTable = {
                type: 'table', tableStyle: {},
                rows: [{ cells: [{ elements: [{ type: 'paragraph', style: '', runs: [{ text: 'inner', style: {} }] }], colSpan: 1, rowSpan: 1 }] }],
            };
            const outer = {
                type: 'table', tableStyle: {},
                rows: [{ cells: [{ elements: [nestedTable], colSpan: 1, rowSpan: 1 }] }],
            };
            const html = api.renderDocxTable(outer);
            expect(html).toContain('inner');
        });

        it('omits blank nested paragraph from cell content', () => {
            const table = {
                type: 'table', tableStyle: {},
                rows: [{ cells: [{ elements: [{ type: 'paragraph', style: '', runs: [{ text: '   ', style: {} }] }], colSpan: 1, rowSpan: 1 }] }],
            };
            const html = api.renderDocxTable(table);
            expect(html).toContain('<td');
        });

        it('builds cell percentage width', () => {
            const table = {
                type: 'table', tableStyle: {},
                rows: [{ cells: [{ elements: [], colSpan: 1, rowSpan: 1, cellStyle: { width: 2500, widthUnit: 'pct' } }] }],
            };
            expect(api.renderDocxTable(table)).toContain('width:50%');
        });

        it('renders all clip-path arrow shapes', () => {
            for (const t of ['notchedRightArrow', 'upArrow', 'downArrow', 'leftRightArrow', 'upDownArrow', 'homePlate']) {
                const html = api.renderSlideShape({ type: 'shape', x: 0, y: 0, width: 5, height: 5, shapeType: t });
                expect(html).toContain('clip-path');
            }
        });

        it('connector with dashDot dash array and bentConnector flips', () => {
            expect(api.getConnectorDashAttr('dashDot')).toContain('dasharray');
            const conn = api.renderSlideConnector({ type: 'connector', x: 5, y: 5, width: 40, height: 20, connectorType: 'bentConnector2', flipH: true, flipV: true });
            expect(conn).toContain('<path');
        });
    });
});

describe('file-type-detector', () => {
    let detectFileType: typeof import('../../lib/parsers/file-type-detector').detectFileType;

    beforeAll(async () => {
        const module = await import('../../lib/parsers/file-type-detector');
        detectFileType = module.detectFileType;
    });

    it('should detect PDF', () => {
        const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D]);
        expect(detectFileType(bytes).type).toBe('pdf');
    });

    it('should detect JPEG', () => {
        const bytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]);
        expect(detectFileType(bytes).type).toBe('image');
    });

    it('should detect PNG', () => {
        const bytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        expect(detectFileType(bytes).type).toBe('image');
    });

    it('should detect GIF', () => {
        const bytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
        expect(detectFileType(bytes).type).toBe('image');
    });

    it('should detect MP3 (sync bytes)', () => {
        const bytes = new Uint8Array([0xFF, 0xFB, 0x90, 0x00]);
        expect(detectFileType(bytes).type).toBe('audio');
    });

    it('should detect MP3 (ID3 tag)', () => {
        const bytes = new Uint8Array([0x49, 0x44, 0x33, 0x03]);
        expect(detectFileType(bytes).type).toBe('audio');
    });

    it('should detect text content', () => {
        const text = 'Hello, this is a plain text file with no special bytes.';
        const bytes = new TextEncoder().encode(text);
        expect(detectFileType(bytes).type).toBe('text');
    });

    it('should return unknown for empty data', () => {
        const bytes = new Uint8Array(0);
        expect(detectFileType(bytes).type).toBe('unknown');
    });

    it('should return unknown for binary data', () => {
        const bytes = new Uint8Array([0x00, 0x01, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00]);
        expect(detectFileType(bytes).type).toBe('unknown');
    });
});

describe('inflate', () => {
    let inflate: typeof import('../../lib/parsers/inflate').inflate;
    let zlibInflate: typeof import('../../lib/parsers/inflate').zlibInflate;

    beforeAll(async () => {
        const module = await import('../../lib/parsers/inflate');
        inflate = module.inflate;
        zlibInflate = module.zlibInflate;
    });

    it('should inflate stored block data', () => {
        const stored = new Uint8Array([
            0x01, 0x05, 0x00, 0xFA, 0xFF,
            0x48, 0x65, 0x6C, 0x6C, 0x6F,
        ]);
        const result = inflate(stored);
        const text = new TextDecoder().decode(result);
        expect(text).toBe('Hello');
    });

    it('should handle zlib wrapper', () => {
        const zlibWrapped = new Uint8Array([
            0x78, 0x01,
            0x01, 0x05, 0x00, 0xFA, 0xFF,
            0x48, 0x65, 0x6C, 0x6C, 0x6F,
        ]);
        const result = zlibInflate(zlibWrapped);
        const text = new TextDecoder().decode(result);
        expect(text).toBe('Hello');
    });
});

describe('zip-reader', () => {
    let readZip: typeof import('../../lib/parsers/zip-reader').readZip;
    let listZipEntries: typeof import('../../lib/parsers/zip-reader').listZipEntries;

    beforeAll(async () => {
        const module = await import('../../lib/parsers/zip-reader');
        readZip = module.readZip;
        listZipEntries = module.listZipEntries;
    });

    function createMinimalZip(): Uint8Array {
        const encoder = new TextEncoder();
        const filename = encoder.encode('hello.txt');
        const content = encoder.encode('Hello');
        const crc = 0xF7D18982;

        const buf = new Uint8Array(30 + filename.length + content.length + 46 + filename.length + 22);
        const view = new DataView(buf.buffer);
        let pos = 0;

        view.setUint32(pos, 0x04034b50, true); pos += 4;
        view.setUint16(pos, 20, true); pos += 2;
        view.setUint16(pos, 0, true); pos += 2;
        view.setUint16(pos, 0, true); pos += 2;
        view.setUint16(pos, 0, true); pos += 2;
        view.setUint16(pos, 0, true); pos += 2;
        view.setUint32(pos, crc, true); pos += 4;
        view.setUint32(pos, content.length, true); pos += 4;
        view.setUint32(pos, content.length, true); pos += 4;
        view.setUint16(pos, filename.length, true); pos += 2;
        view.setUint16(pos, 0, true); pos += 2;
        buf.set(filename, pos); pos += filename.length;
        buf.set(content, pos); pos += content.length;

        const centralDirOffset = pos;
        view.setUint32(pos, 0x02014b50, true); pos += 4;
        view.setUint16(pos, 20, true); pos += 2;
        view.setUint16(pos, 20, true); pos += 2;
        view.setUint16(pos, 0, true); pos += 2;
        view.setUint16(pos, 0, true); pos += 2;
        view.setUint16(pos, 0, true); pos += 2;
        view.setUint16(pos, 0, true); pos += 2;
        view.setUint32(pos, crc, true); pos += 4;
        view.setUint32(pos, content.length, true); pos += 4;
        view.setUint32(pos, content.length, true); pos += 4;
        view.setUint16(pos, filename.length, true); pos += 2;
        view.setUint16(pos, 0, true); pos += 2;
        view.setUint16(pos, 0, true); pos += 2;
        view.setUint16(pos, 0, true); pos += 2;
        view.setUint16(pos, 0, true); pos += 2;
        view.setUint32(pos, 0, true); pos += 4;
        view.setUint32(pos, 0, true); pos += 4;
        buf.set(filename, pos); pos += filename.length;

        const centralDirSize = pos - centralDirOffset;
        view.setUint32(pos, 0x06054b50, true); pos += 4;
        view.setUint16(pos, 0, true); pos += 2;
        view.setUint16(pos, 0, true); pos += 2;
        view.setUint16(pos, 1, true); pos += 2;
        view.setUint16(pos, 1, true); pos += 2;
        view.setUint32(pos, centralDirSize, true); pos += 4;
        view.setUint32(pos, centralDirOffset, true); pos += 4;
        view.setUint16(pos, 0, true);

        return buf;
    }

    it('should list zip entries', () => {
        const zip = createMinimalZip();
        const entries = listZipEntries(zip);
        expect(entries).toHaveLength(1);
        expect(entries[0].path).toBe('hello.txt');
    });

    it('should extract zip files', () => {
        const zip = createMinimalZip();
        const files = readZip(zip);
        expect(files.size).toBe(1);
        const content = new TextDecoder().decode(files.get('hello.txt'));
        expect(content).toBe('Hello');
    });

    it('should throw on non-zip data', () => {
        const data = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
        expect(() => listZipEntries(data)).toThrow();
    });

    it('should throw on too small data', () => {
        const data = new Uint8Array([0x50, 0x4B]);
        expect(() => listZipEntries(data)).toThrow();
    });

    it('should reject path traversal', () => {
        const zip = createMinimalZip();
        const view = new DataView(zip.buffer);
        const encoder = new TextEncoder();
        const maliciousName = encoder.encode('../etc/passwd');
        const nameOffset = 30;
        view.setUint16(26, maliciousName.length, true);
        zip.set(maliciousName, nameOffset);

        const centralNameOffset = 30 + maliciousName.length + 5 + 46;
        view.setUint16(centralNameOffset - 46 + 28, maliciousName.length, true);

        expect(() => readZip(zip)).toThrow();
    });
});
