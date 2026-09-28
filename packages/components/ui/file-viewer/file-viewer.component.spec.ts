import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as nodeBuffer from 'node:buffer';
import { FileViewerComponent, FileViewerToolbarDirective, FileViewerContentDirective } from './file-viewer.component';

/** The shape of every image source the document parsers emit. */
const PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgo=';

function createTextBlob(content: string): File {
    return new File([content], 'test.txt', { type: 'text/plain' });
}

type ObjectUrlApi = {
    createObjectURL?: (blob: unknown) => string;
    revokeObjectURL?: (url: string) => void;
};
type GlobalBlobApi = { Blob: unknown; File: unknown };

const urlApi = URL as unknown as ObjectUrlApi;
const globalBlobApi = globalThis as unknown as GlobalBlobApi;
const nodeBlobApi = nodeBuffer as unknown as { Blob: unknown; File: unknown };

let savedCreateObjectURL: ObjectUrlApi['createObjectURL'];
let savedRevokeObjectURL: ObjectUrlApi['revokeObjectURL'];
let savedBlob: unknown;
let savedFile: unknown;

/** True when a Blob/File ctor's instances lack a usable arrayBuffer() (jsdom). */
function lacksArrayBuffer(ctor: unknown): boolean {
    return typeof (ctor as { prototype?: { arrayBuffer?: unknown } })?.prototype?.arrayBuffer !== 'function';
}

beforeEach(() => {
    savedCreateObjectURL = urlApi.createObjectURL;
    savedRevokeObjectURL = urlApi.revokeObjectURL;
    savedBlob = globalBlobApi.Blob;
    savedFile = globalBlobApi.File;

    let counter = 0;
    urlApi.createObjectURL = () => `blob:mock/${counter++}`;
    urlApi.revokeObjectURL = () => { /* jsdom lacks this; noop stub */ };
    // jsdom's Blob/File lack arrayBuffer(); back them with Node's implementations
    // ONLY there. In a real browser the natives are complete and node:buffer's
    // File is undefined, so swapping would null the global and break instanceof.
    if (nodeBlobApi.Blob && lacksArrayBuffer(globalBlobApi.Blob)) {
        globalBlobApi.Blob = nodeBlobApi.Blob;
    }
    if (nodeBlobApi.File && lacksArrayBuffer(globalBlobApi.File)) {
        globalBlobApi.File = nodeBlobApi.File;
    }
});

afterEach(() => {
    urlApi.createObjectURL = savedCreateObjectURL;
    urlApi.revokeObjectURL = savedRevokeObjectURL;
    globalBlobApi.Blob = savedBlob;
    globalBlobApi.File = savedFile;
});

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

    it('should show correct default height', () => {
        fixture.detectChanges();
        const el = fixture.nativeElement.querySelector('[data-slot="file-viewer"]');
        expect(el.style.height).toBe('600px');
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
        it('should revoke blob URLs on destroy', async () => {
            const created: string[] = [];
            const revoked: string[] = [];
            urlApi.createObjectURL = () => {
                const url = `blob:mock/${created.length}`;
                created.push(url);
                return url;
            };
            urlApi.revokeObjectURL = url => { revoked.push(url); };
            const loaded = whenLoaded(component);
            fixture.componentRef.setInput('type', 'audio');
            fixture.componentRef.setInput('file', new File([new Uint8Array([1, 2, 3])], 's.mp3', { type: 'audio/mpeg' }));
            fixture.detectChanges();
            await loaded;
            // One URL for the download link, one for the media source.
            expect(created).toHaveLength(2);
            fixture.destroy();
            expect(revoked).toEqual(created);
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

/** Resolves on the `loaded` output, before a rendered media/img element can report a load error. */
function whenLoaded(c: FileViewerComponent): Promise<unknown> {
    return new Promise(resolve => c.loaded.subscribe(resolve));
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
        it('falls back to octet-stream mime when none given', async () => {
            const blobs: Blob[] = [];
            urlApi.createObjectURL = blob => {
                blobs.push(blob as Blob);
                return `blob:mock/${blobs.length}`;
            };
            // An explicit `type` skips detection, so no MIME reaches processMedia.
            const loaded = whenLoaded(component);
            fixture.componentRef.setInput('type', 'video');
            fixture.componentRef.setInput('file', new File([new Uint8Array([1, 2, 3])], 'clip'));
            fixture.detectChanges();
            await loaded;
            expect(blobs.at(-1)?.type).toBe('application/octet-stream');
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
        it('strips scripts and event handlers from an svg before rendering it', async () => {
            const blobs: Blob[] = [];
            urlApi.createObjectURL = blob => {
                blobs.push(blob as Blob);
                return `blob:mock/${blobs.length}`;
            };
            const svg = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">'
                + '<script>alert(2)</script><rect width="10" height="10"/></svg>';
            const loaded = whenLoaded(component);
            fixture.componentRef.setInput('type', 'image');
            fixture.componentRef.setInput('file', new File([svg], 'a.svg', { type: 'image/svg+xml' }));
            fixture.detectChanges();
            await loaded;
            const rendered = await blobs.at(-1)!.text();
            expect(rendered).toContain('<rect');
            expect(rendered).not.toMatch(/onload|<script|alert/);
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
            globalThis.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 404 } as Response)) as unknown as typeof fetch;
            await api.loadFromUrl('https://x.com/missing.txt');
            expect(component.state()).toBe('error');
            expect(component.errorMessage()).toContain('404');
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
                text: 'x', href: 'https://example.com/report', isInserted: true, isDeleted: true,
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
            expect(html).toContain('<a href="https://example.com/report"');
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
            const html = api.renderDocxImage({ dataUrl: PNG_DATA_URL, width: 10, height: 20, altText: 'alt<x>' });
            expect(html).toContain(`src="${PNG_DATA_URL}"`);
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

        it('builds table width for dxa and pct units', () => {
            expect(api.buildTableWidth({ width: 2000, widthUnit: 'dxa' })).toBe(' style="width:100pt"');
            expect(api.buildTableWidth({ width: 2500, widthUnit: 'pct' })).toBe(' style="width:50%"');
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
                { type: 'image', dataUrl: PNG_DATA_URL, width: 1, height: 1, altText: '' },
            ]);
            expect(html).toContain('<p');
            expect(html).toContain('<table');
            expect(html).toContain('<img');
        });
    });

    describe('pptx slide rendering', () => {
        it('renders slide background, image, and dispatches elements', () => {
            const slide = {
                backgroundColor: '#123', backgroundImage: PNG_DATA_URL,
                elements: [
                    { type: 'image', dataUrl: PNG_DATA_URL, x: 1, y: 2, width: 3, height: 4 },
                    { type: 'unknownkind', x: 0, y: 0, width: 0, height: 0 },
                ],
            };
            const html = api.renderSlideToHtml(slide);
            expect(html).toContain('background-color:#123');
            expect(html).toContain(`background-image:url(${PNG_DATA_URL})`);
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
            expect(api.renderBulletPrefix({ imageDataUrl: PNG_DATA_URL }, 0)).toContain('<img');
        });

        it('renders run with tab content', () => {
            const html = api.renderSlideParagraph({
                runs: [{ text: 'a\tb' }],
                tabs: [{ position: 100, alignment: 'r' }],
                defaultTabSize: 48,
            }, 0);
            expect(html).toContain('a<span style="display:inline-block;min-width:100px;text-align:right"></span>b');
        });

        it('renders various run fills and effects', () => {
            const base = { text: 'x' };
            expect(api.renderSlideRun({ ...base, noFill: true })).toContain('transparent');
            expect(api.renderSlideRun({ ...base, gradientFill: { type: 'linear', angle: 45, stops: [{ color: '#000', position: 0 }, { color: '#fff', position: 100 }] } })).toContain('linear-gradient');
            expect(api.renderSlideRun({ ...base, imageFill: PNG_DATA_URL })).toContain('background-image');
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
            expect(shapeOf({ imageFill: PNG_DATA_URL })).toContain('background-image');
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
            const pathOf = (opts: Record<string, unknown>) => /<path d="([^"]+)"/.exec(connOf(opts))?.[1];
            // 50x30 box, line width 2 -> 4px padding on every side.
            expect(pathOf({ connectorType: 'straightConnector1' })).toBe('M4,4 L54,34');
            expect(pathOf({ connectorType: 'bentConnector2', flipH: true })).toBe('M54,4 L4,4 L4,34');
            expect(pathOf({ connectorType: 'bentConnector3', flipV: true })).toBe('M4,34 L29,34 L29,4 L54,4');
            expect(pathOf({ connectorType: 'curvedConnector3' })).toBe('M4,4 C29,4 29,34 54,34');
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
            expect(api.getConnectorDashAttr('dashDot')).toBe(' stroke-dasharray="8,4,2,4"');
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

        it('renders the active pdf page with the global css', () => {
            component.state.set('loaded');
            component.detectedType.set('pdf');
            api.pdfPages.set([{ html: '<p>page1</p>' }, { html: '<p>page2</p>' }]);
            api.pdfGlobalCss.set('.x{color:red}');
            component.totalPages.set(2);
            component.currentPage.set(2);
            fixture.detectChanges();
            const page: HTMLElement = fixture.nativeElement.querySelector('[data-slot="file-viewer-content"] .pdf-page');
            expect(page.querySelector('p')?.textContent).toBe('page2');
            expect(page.textContent).not.toContain('page1');
            expect(page.querySelector('style')?.textContent).toBe('.x{color:red}');
        });

        it('currentSlideHtml and pptx display reflect set slides', () => {
            api.pptxSlides.set([{ html: '<div>slide</div>', width: 800, height: 600 }]);
            component.currentPage.set(1);
            expect(component.currentSlideHtml()).toBeTruthy();
            expect(component.pptxDisplayWidth()).toBe(800);
            expect(component.pptxDisplayHeight()).toBe(600);
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
    });

    describe('additional branch coverage: false/fallback paths', () => {
        it('scrollContentToTop no-ops when the content slot is absent (custom mode)', () => {
            const customFixture = TestBed.createComponent(CustomModeHostComponent);
            customFixture.detectChanges();
            const viewer = customFixture.debugElement.children[0].componentInstance as FileViewerComponent;
            viewer.totalPages.set(3);
            expect(() => viewer.nextPage()).not.toThrow();
            expect(viewer.currentPage()).toBe(2);
        });

        it('loadFromUrl handles a non-Error rejection', async () => {
            const orig = globalThis.fetch;
            globalThis.fetch = vi.fn(() => Promise.reject('network down')) as unknown as typeof fetch;
            await api.loadFromUrl('https://x.com/fail.txt');
            expect(component.state()).toBe('error');
            expect(component.errorMessage()).toBe('Failed to load file');
            globalThis.fetch = orig;
        });

        it('loadFile handles a non-Error rejection from arrayBuffer', async () => {
            const badFile = { arrayBuffer: () => Promise.reject('nope') } as unknown as File;
            await api.loadFile(badFile);
            expect(component.state()).toBe('error');
            expect(component.errorMessage()).toBe('Failed to process file');
        });

        it('renderDocxToHtml ignores unrecognized element types', () => {
            expect(api.renderDocxToHtml([{ type: 'bookmarkEnd' }])).toBe('');
        });

        it('builds a run span for rtl direction alone (no other styles)', () => {
            const run = { text: 'x', style: { rtl: true } };
            const html = api.renderDocxParagraph({ type: 'paragraph', style: '', runs: [run] });
            expect(html).toContain('dir="rtl"');
            expect(html).not.toContain('style="');
        });

        it('omits missing paragraph border sides', () => {
            const html = api.renderDocxParagraph({
                type: 'paragraph', style: '', runs: [{ text: 'x', style: {} }],
                borders: {},
            });
            expect(html).not.toContain('border-top');
            expect(html).not.toContain('border-bottom');
            expect(html).not.toContain('border-left');
            expect(html).not.toContain('border-right');
            expect(html).not.toContain('padding:4px 8px');
        });

        it('treats out-of-range heading levels as a plain paragraph', () => {
            const html = api.renderDocxParagraph({ type: 'paragraph', style: 'Heading8', runs: [{ text: 'x', style: {} }] });
            expect(html).toContain('<p');
            expect(html).not.toContain('<h8');
        });

        it('cell with an empty cellStyle object yields no style attribute', () => {
            const table = {
                type: 'table', tableStyle: {},
                rows: [{ cells: [{ elements: [], colSpan: 1, rowSpan: 1, cellStyle: {} }] }],
            };
            expect(api.renderDocxTable(table)).not.toContain('style="');
        });

        it('cell borders and paddings with all sides empty add no extra styles', () => {
            const table = {
                type: 'table', tableStyle: {},
                rows: [{
                    cells: [{
                        elements: [], colSpan: 1, rowSpan: 1,
                        cellStyle: { backgroundColor: '#fff', borders: {}, paddings: {} },
                    }],
                }],
            };
            const html = api.renderDocxTable(table);
            expect(html).toContain('background-color:#fff');
            expect(html).not.toContain('border-top');
            expect(html).not.toContain('padding-top');
        });

        it('renders a comment without an author safely', () => {
            const html = api.renderDocxComments([{ id: 'c2', author: '', date: '', paragraphs: [] }]);
            expect(html).toContain('*c2');
            expect(html).not.toContain('<strong>');
        });

        it('applies text outline width without a color', () => {
            const html = api.renderSlideRun({ text: 'x', textOutline: { width: 2 } });
            expect(html).toContain('text-stroke-width:2pt');
            expect(html).not.toContain('text-stroke-color');
        });

        it('bullet char falls back to a bullet dot when char is missing', () => {
            expect(api.renderBulletPrefix({ type: 'char' }, 0)).toContain('•');
        });

        it('bullet with an unrecognized type still renders a prefix span', () => {
            expect(api.renderBulletPrefix({ type: 'other' }, 0)).toContain('<span');
        });

        it('autoNum bullet falls back to default scheme and start number', () => {
            expect(api.renderBulletPrefix({ type: 'autoNum' }, 3)).toContain('3.');
        });

        it('text frame border uses the default width when unspecified', () => {
            const html = api.renderSlideTextFrame({
                type: 'text', x: 0, y: 0, width: 10, height: 10,
                borderColor: '#000',
                paragraphs: [],
            });
            expect(html).toContain('border:1px solid #000');
        });

        it('paragraph vertical-align falls back to baseline for an unknown fontAlign', () => {
            const html = api.renderSlideParagraph({ runs: [{ text: 'x' }], fontAlign: 'weird' }, 0);
            expect(html).toContain('vertical-align:baseline');
        });

        it('shape border uses the default width when unspecified', () => {
            const html = api.renderSlideShape({ type: 'shape', x: 0, y: 0, width: 5, height: 5, borderColor: '#000' });
            expect(html).toContain('border:1px solid #000');
        });

        it('connector marker defs render tail-only and head-only variants', () => {
            const tailOnly = api.renderSlideConnector({ type: 'connector', x: 0, y: 0, width: 10, height: 10, tailEnd: true });
            expect(tailOnly).toContain('marker-end');
            expect(tailOnly).not.toContain('marker-start');

            const headOnly = api.renderSlideConnector({ type: 'connector', x: 0, y: 0, width: 10, height: 10, headEnd: true });
            expect(headOnly).toContain('marker-start');
            expect(headOnly).not.toContain('marker-end');
        });

        it('slide table without column widths omits the colgroup', () => {
            const html = api.renderSlideTable({ type: 'table', x: 0, y: 0, width: 10, height: 10, rows: [] });
            expect(html).not.toContain('<colgroup>');
        });

        it('linear gradient falls back to 0deg when angle is missing', () => {
            expect(api.buildGradientCss({ type: 'linear', stops: [{ color: '#000', position: 0 }] })).toContain('linear-gradient(0deg');
        });

        it('maps additional dash-to-decoration case labels', () => {
            expect(api.mapDashToDecorationStyle('dash')).toBe('dashed');
            expect(api.mapDashToDecorationStyle('sysDash')).toBe('dashed');
            expect(api.mapDashToDecorationStyle('lgDash')).toBe('dashed');
        });

        it('tab alignment falls back to left when unspecified or unmapped', () => {
            const noAlign = api.renderTabContent('a\tb', [{ position: 20 }]);
            expect(noAlign).toContain('text-align:left');

            const unmapped = api.renderTabContent('a\tb', [{ position: 20, alignment: 'l' }]);
            expect(unmapped).toContain('text-align:left');
        });

        it('tab width falls back to 48px when no tab stop or default size is given', () => {
            expect(api.renderTabContent('a\tb')).toContain('width:48px');
        });
    });
});

// ── Fixture builders for the end-to-end parser paths ──────────────────

function fixtureCrc32(data: Uint8Array): number {
    let crc = 0xffffffff;
    for (const b of data) {
        crc ^= b;
        for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    return (crc ^ 0xffffffff) >>> 0;
}

const u16 = (v: number): number[] => [v & 0xff, (v >>> 8) & 0xff];
const u32 = (v: number): number[] => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];

/** Build a stored (uncompressed) ZIP with correct CRCs from the given parts. */
function buildStoredZip(files: ReadonlyArray<{ name: string; content: string }>): Uint8Array {
    const enc = new TextEncoder();
    const entries = files.map(f => ({ name: f.name, data: enc.encode(f.content) }));
    const local: number[] = [];
    const central: number[] = [];
    const offsets: number[] = [];
    let offset = 0;
    for (const e of entries) {
        const nb = enc.encode(e.name);
        const crc = fixtureCrc32(e.data);
        offsets.push(offset);
        const l = [
            ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
            ...u32(crc), ...u32(e.data.length), ...u32(e.data.length),
            ...u16(nb.length), ...u16(0), ...nb, ...e.data,
        ];
        local.push(...l);
        offset += l.length;
    }
    const centralStart = offset;
    for (let i = 0; i < entries.length; i++) {
        const nb = enc.encode(entries[i].name);
        central.push(
            ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
            ...u32(fixtureCrc32(entries[i].data)), ...u32(entries[i].data.length), ...u32(entries[i].data.length),
            ...u16(nb.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offsets[i]), ...nb,
        );
    }
    const eocd = [
        ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(entries.length), ...u16(entries.length),
        ...u32(central.length), ...u32(centralStart), ...u16(0),
    ];
    return new Uint8Array([...local, ...central, ...eocd]);
}

function buildMinimalDocx(
    paragraphs = '<w:p><w:r><w:t>Hi</w:t></w:r></w:p>',
    relationships: ReadonlyArray<{ id: string; target: string }> = [],
): Uint8Array {
    const ns = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
        + ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
    const parts = [{ name: 'word/document.xml', content: `<?xml version="1.0"?><w:document ${ns}><w:body>${paragraphs}</w:body></w:document>` }];
    if (relationships.length > 0) {
        const hyperlinkType = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink';
        const rels = relationships
            .map(r => `<Relationship Id="${r.id}" Type="${hyperlinkType}" Target="${r.target}" TargetMode="External"/>`)
            .join('');
        parts.push({
            name: 'word/_rels/document.xml.rels',
            content: `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`,
        });
    }
    return buildStoredZip(parts);
}

function buildMinimalPdf(): Uint8Array {
    const objs = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Contents 4 0 R >>',
        '<< /Length 3 >>\nstream\nx\nendstream',
    ];
    let body = '%PDF-1.4\n';
    const offs: number[] = [];
    for (let i = 0; i < objs.length; i++) {
        offs.push(body.length);
        body += `${i + 1} 0 obj\n${objs[i]}\nendobj\n`;
    }
    const xrefOff = body.length;
    const total = objs.length + 1;
    let xref = `xref\n0 ${total}\n0000000000 65535 f \n`;
    for (const o of offs) xref += `${String(o).padStart(10, '0')} 00000 n \n`;
    const trailer = `trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xrefOff}\n%%EOF`;
    return new TextEncoder().encode(body + xref + trailer);
}

const OLE_SECTOR = 512;
const OLE_EOC = 0xfffffffe;
const OLE_FREE = 0xffffffff;

function oleSetU16(b: Uint8Array, o: number, v: number): void { b[o] = v & 0xff; b[o + 1] = (v >>> 8) & 0xff; }
function oleSetU32(b: Uint8Array, o: number, v: number): void {
    b[o] = v & 0xff; b[o + 1] = (v >>> 8) & 0xff; b[o + 2] = (v >>> 16) & 0xff; b[o + 3] = (v >>> 24) & 0xff;
}

function oleWriteDirEntry(dir: Uint8Array, idx: number, name: string, type: number, start: number, size: number): void {
    const base = idx * 128;
    for (let i = 0; i < name.length; i++) oleSetU16(dir, base + i * 2, name.codePointAt(i) ?? 0);
    oleSetU16(dir, base + 64, (name.length + 1) * 2);
    dir[base + 66] = type;
    oleSetU32(dir, base + 116, start);
    oleSetU32(dir, base + 120, size);
}

/** Build a minimal OLE2 (compound file) holding a single named stream. */
function buildOle2(streamName: string, payload: Uint8Array): Uint8Array {
    const payloadSectors = Math.max(1, Math.ceil(payload.length / OLE_SECTOR));
    const streamStart = 1;
    const dirSector = streamStart + payloadSectors;
    const buf = new Uint8Array(OLE_SECTOR + (dirSector + 1) * OLE_SECTOR);
    const magic = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
    for (let i = 0; i < magic.length; i++) buf[i] = magic[i];
    oleSetU16(buf, 30, 9);
    oleSetU16(buf, 32, 6);
    oleSetU32(buf, 44, 1);
    oleSetU32(buf, 48, dirSector);
    oleSetU32(buf, 56, 0);
    oleSetU32(buf, 60, OLE_EOC);
    oleSetU32(buf, 68, OLE_EOC);
    const sectorBase = (i: number): number => OLE_SECTOR + i * OLE_SECTOR;
    const fatOff = sectorBase(0);
    for (let i = 0; i < OLE_SECTOR / 4; i++) oleSetU32(buf, fatOff + i * 4, OLE_FREE);
    oleSetU32(buf, fatOff, 0xfffffffd);
    for (let i = 0; i < payloadSectors; i++) {
        oleSetU32(buf, fatOff + (streamStart + i) * 4, i === payloadSectors - 1 ? OLE_EOC : streamStart + i + 1);
    }
    oleSetU32(buf, fatOff + dirSector * 4, OLE_EOC);
    buf.set(payload, sectorBase(streamStart));
    const dir = new Uint8Array(OLE_SECTOR);
    oleWriteDirEntry(dir, 0, 'Root Entry', 5, OLE_EOC, 0);
    oleWriteDirEntry(dir, 1, streamName, 2, streamStart, payload.length);
    buf.set(dir, sectorBase(dirSector));
    return buf;
}

function buildMinimalPptx(shapes = ''): Uint8Array {
    const p = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
    const a = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';
    const slide = `<?xml version="1.0"?><p:sld ${p} ${a}><p:cSld><p:spTree>${shapes}</p:spTree></p:cSld></p:sld>`;
    return buildStoredZip([{ name: 'ppt/slides/slide1.xml', content: slide }]);
}

function pptRecordHeader(ver: number, type: number, len: number): number[] {
    const vi = ver & 0x0f;
    return [vi & 0xff, (vi >>> 8) & 0xff, type & 0xff, (type >>> 8) & 0xff,
        len & 0xff, (len >>> 8) & 0xff, (len >>> 16) & 0xff, (len >>> 24) & 0xff];
}

function buildMinimalPpt(): Uint8Array {
    const textBytesAtom: number[] = [];
    const text = 'Hello';
    for (let i = 0; i < text.length; i++) textBytesAtom.push((text.codePointAt(i) ?? 0) & 0xff);
    const persistAtom = [...pptRecordHeader(0, 0x03f3, 20), ...new Array(20).fill(0)];
    const bytesAtom = [...pptRecordHeader(0, 0x0fa8, textBytesAtom.length), ...textBytesAtom];
    const children = [...persistAtom, ...bytesAtom];
    const slideList = [...pptRecordHeader(0xf, 0x0ff0, children.length), ...children];
    return buildOle2('PowerPoint Document', new Uint8Array(slideList));
}

function fileOf(bytes: Uint8Array, name: string): File {
    return new File([bytes as BlobPart], name, { type: 'application/octet-stream' });
}

describe('FileViewerComponent end-to-end parser paths', () => {
    let fixture: ComponentFixture<FileViewerComponent>;
    let component: FileViewerComponent;
    let api: FileViewerInternals;

    beforeEach(() => {
        fixture = TestBed.createComponent(FileViewerComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        api = internals(component);
    });

    it('loads a PDF through the pixel-perfect renderer', async () => {
        fixture.componentRef.setInput('type', 'pdf');
        await api.loadFile(fileOf(buildMinimalPdf(), 'doc.pdf'));
        expect(component.state()).toBe('loaded');
        expect(component.detectedType()).toBe('pdf');
        expect(component.totalPages()).toBe(1);
    });

    it('loads an XLSX workbook', async () => {
        const wb = '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            + '<sheets><sheet name="Sales" sheetId="1" r:id="rId1"/></sheets></workbook>';
        const cell = (ref: string, text: string) => `<c r="${ref}" t="str"><v>${text}</v></c>`;
        const sheet = '<worksheet><sheetData>'
            + `<row r="1">${cell('A1', 'Region')}${cell('B1', 'Total')}</row>`
            + `<row r="2">${cell('A2', 'North')}<c r="B2"><v>120</v></c></row>`
            + `<row r="3">${cell('A3', 'South')}<c r="B3"><v>95</v></c></row>`
            + '</sheetData></worksheet>';
        fixture.componentRef.setInput('type', 'xlsx');
        await api.loadFile(fileOf(buildStoredZip([
            { name: 'xl/workbook.xml', content: wb },
            { name: 'xl/worksheets/sheet1.xml', content: sheet },
        ]), 's.xlsx'));
        expect(component.state()).toBe('loaded');
        expect(component.xlsxSheetNames()).toEqual(['Sales']);
        expect(component.xlsxHeaderRow()).toEqual(['Region', 'Total']);
        expect(component.xlsxDataRows()).toEqual([['North', '120'], ['South', '95']]);
    });

    it('loads a DOCX document and renders body html', async () => {
        fixture.componentRef.setInput('type', 'docx');
        await api.loadFile(fileOf(buildMinimalDocx(), 'a.docx'));
        fixture.detectChanges();
        expect(component.state()).toBe('loaded');
        const content: HTMLElement = fixture.nativeElement.querySelector('[data-slot="file-viewer-content"]');
        expect(content.textContent).toContain('Hi');
    });

    /**
     * An XML-escaped font name that tries to end its CSS string and add a declaration,
     * then end the style attribute and add a marker attribute.
     */
    const HOSTILE_FONT = 'x&apos;;background-image:url(https://tracker.example/f);&quot; data-injected=&quot;1&quot; title=&quot;';

    function renderedContent(): HTMLElement {
        fixture.detectChanges();
        return fixture.nativeElement.querySelector('[data-slot="file-viewer-content"]');
    }

    /** Every background image any rendered element ended up with. */
    function backgroundImages(root: HTMLElement): string[] {
        return Array.from(root.querySelectorAll<HTMLElement>('[style]'), el => el.style.backgroundImage).filter(Boolean);
    }

    it('keeps DOCX run font and colour values inside their style declarations', async () => {
        const hostile = `<w:rPr><w:rFonts w:ascii="${HOSTILE_FONT}"/><w:color w:val="f00&quot; data-injected=&quot;2"/>`
            + '<w:highlight w:val="red;background-image:url(https://tracker.example/h)"/>'
            + '<w:shd w:fill="0f0&quot; data-injected=&quot;3"/></w:rPr>';
        const plain = '<w:rPr><w:rFonts w:ascii="Georgia"/><w:color w:val="1F4E79"/></w:rPr>';
        fixture.componentRef.setInput('type', 'docx');
        await api.loadFile(fileOf(buildMinimalDocx(
            `<w:p><w:r>${hostile}<w:t>Quarterly results</w:t></w:r><w:r>${plain}<w:t> in navy</w:t></w:r></w:p>`,
        ), 'a.docx'));
        const content = renderedContent();

        expect(content.querySelector('[data-injected]')).toBeNull();
        expect(backgroundImages(content)).toEqual([]);
        expect(content.textContent).toContain('Quarterly results in navy');
        const navy = Array.from(content.querySelectorAll('span')).find(s => s.textContent === ' in navy');
        expect(navy?.style.color).toBe('rgb(31, 78, 121)');
        expect(navy?.style.fontFamily).toContain('Georgia');
    });

    it('links DOCX hyperlinks only to http, https, mailto and in-document targets', async () => {
        const link = (rId: string, text: string): string =>
            `<w:hyperlink r:id="${rId}"><w:r><w:t>${text}</w:t></w:r></w:hyperlink>`;
        fixture.componentRef.setInput('type', 'docx');
        await api.loadFile(fileOf(buildMinimalDocx(
            '<w:p>'
            + link('rId1', 'script link') + link('rId2', 'data link') + link('rId3', 'site') + link('rId4', 'mail')
            + link('rId5', 'appendix')
            + '<w:hyperlink w:anchor="summary"><w:r><w:t>jump</w:t></w:r></w:hyperlink>'
            + '</w:p>',
            [
                { id: 'rId1', target: ' JaVaScRiPt:void(0)' },
                { id: 'rId2', target: 'data:text/html;base64,PGI+eDwvYj4=' },
                { id: 'rId3', target: 'https://example.com/docs' },
                { id: 'rId4', target: 'mailto:team@example.com' },
                { id: 'rId5', target: 'appendix/costs.docx' },
            ],
        ), 'a.docx'));
        const content = renderedContent();

        const hrefs = Array.from(content.querySelectorAll('a[href]'), a => [a.textContent, a.getAttribute('href')]);
        expect(hrefs).toEqual([
            ['site', 'https://example.com/docs'],
            ['mail', 'mailto:team@example.com'],
            ['jump', '#bookmark-summary'],
        ]);
        expect(content.textContent).toContain('script link');
        expect(content.textContent).toContain('data link');
        expect(content.textContent).toContain('appendix');
    });

    it('keeps PPTX run and bullet font names inside their style declarations', async () => {
        const shape = '<p:sp><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="3000000" cy="1000000"/></a:xfrm></p:spPr>'
            + '<p:txBody><a:bodyPr/><a:p>'
            + `<a:pPr><a:buFont typeface="${HOSTILE_FONT}"/><a:buChar char="-"/></a:pPr>`
            + `<a:r><a:rPr><a:latin typeface="${HOSTILE_FONT}"/></a:rPr><a:t>Roadmap</a:t></a:r>`
            + '<a:r><a:rPr><a:latin typeface="Georgia"/></a:rPr><a:t> 2027</a:t></a:r>'
            + '</a:p></p:txBody></p:sp>';
        fixture.componentRef.setInput('type', 'pptx');
        await api.loadFile(fileOf(buildMinimalPptx(shape), 'p.pptx'));
        const content = renderedContent();

        expect(content.querySelector('[data-injected]')).toBeNull();
        expect(backgroundImages(content)).toEqual([]);
        expect(content.textContent).toContain('Roadmap 2027');
        const georgia = Array.from(content.querySelectorAll('span')).find(s => s.textContent === ' 2027');
        expect(georgia?.style.fontFamily).toContain('Georgia');
    });

    it('loads a legacy DOC via graceful fallback', async () => {
        fixture.componentRef.setInput('type', 'doc');
        await api.loadFile(fileOf(buildOle2('NotWordDocument', new Uint8Array(16)), 'a.doc'));
        expect(component.state()).toBe('loaded');
        expect(component.detectedType()).toBe('doc');
    });

    it('loads a PPTX presentation and builds slide html', async () => {
        fixture.componentRef.setInput('type', 'pptx');
        await api.loadFile(fileOf(buildMinimalPptx(), 'p.pptx'));
        expect(component.state()).toBe('loaded');
        expect(component.detectedType()).toBe('pptx');
        expect(component.totalPages()).toBe(1);
    });

    it('loads a legacy PPT presentation and builds slide html', async () => {
        fixture.componentRef.setInput('type', 'ppt');
        await api.loadFile(fileOf(buildMinimalPpt(), 'p.ppt'));
        expect(component.state()).toBe('loaded');
        expect(component.detectedType()).toBe('ppt');
        expect(component.totalPages()).toBe(1);
    });

    it('routes an image through file loading', async () => {
        fixture.componentRef.setInput('type', 'image');
        await api.loadFile(fileOf(new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]), 'a.jpg'));
        expect(component.state()).toBe('loaded');
        expect(component.imageSrc()).toBeTruthy();
    });

    it('sets error state when a parser throws during processing', async () => {
        fixture.componentRef.setInput('type', 'pdf');
        await api.loadFile(fileOf(new Uint8Array([1, 2, 3, 4, 5]), 'bad.pdf'));
        expect(component.state()).toBe('error');
        expect(component.errorMessage()).toBeTruthy();
    });

    it('loads from a src url via the reactive effect', async () => {
        const orig = globalThis.fetch;
        const blob = new Blob(['effect text'], { type: 'text/plain' });
        globalThis.fetch = vi.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            blob: () => Promise.resolve(blob),
        } as unknown as Response)) as unknown as typeof fetch;
        fixture.componentRef.setInput('src', 'https://x.com/note.txt');
        fixture.detectChanges();
        // The effect → fetch → blob-read chain resolves over several async hops;
        // poll rather than assume a fixed flush drains them (browser timing varies).
        await vi.waitFor(() => {
            fixture.detectChanges();
            expect(component.state()).toBe('loaded');
        });
        expect(component.textContent()).toBe('effect text');
        globalThis.fetch = orig;
    });
});

describe('FileViewerComponent remaining branch coverage', () => {
    let component: FileViewerComponent;
    let api: FileViewerInternals;

    beforeEach(() => {
        const fixture = TestBed.createComponent(FileViewerComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        api = internals(component);
    });

    it('extractFilename falls back to "file" when the URL is invalid', () => {
        expect(api.extractFilename('http://[')).toBe('file');
    });

    it('renders a page break for an empty paragraph whose page-break run is hidden', () => {
        const html = api.renderDocxParagraph({
            type: 'paragraph', style: '',
            runs: [{ text: '', breakType: 'page', style: { hidden: true } }],
        });
        expect(html).toContain('<hr');
    });

    it('closes an open thead when the final table row is a header', () => {
        const html = api.renderDocxTable({
            type: 'table', tableStyle: {},
            rows: [{
                rowStyle: { isHeader: true },
                cells: [{ elements: [{ type: 'paragraph', style: '', runs: [{ text: 'h', style: {} }] }], colSpan: 1, rowSpan: 1 }],
            }],
        });
        expect(html).toContain('<thead>');
        expect(html.endsWith('</thead></table>')).toBe(true);
    });

    it('skips cell width when a cell style has no width', () => {
        const html = api.renderDocxTable({
            type: 'table', tableStyle: {},
            rows: [{ cells: [{ elements: [], colSpan: 1, rowSpan: 1, cellStyle: { backgroundColor: '#fff' } }] }],
        });
        expect(html).toContain('background-color:#fff');
        expect(html).not.toContain('width:');
    });

    it('returns the long-dash-dot connector dash array', () => {
        expect(api.getConnectorDashAttr('lgDashDot')).toContain('12,4,2,4');
    });
});
