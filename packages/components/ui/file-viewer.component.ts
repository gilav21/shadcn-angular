import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    signal,
    effect,
    OnDestroy,
    ContentChild,
    AfterContentInit,
    Directive,
} from '@angular/core';
import { DomSanitizer, type SafeHtml, type SafeResourceUrl, type SafeUrl } from '@angular/platform-browser';
import { cn } from '../lib/utils';
import { SpinnerComponent } from './spinner.component';
import type { FileViewerType } from '../lib/file-type-detector';

type ViewerState = 'idle' | 'loading' | 'loaded' | 'error';

export interface FileViewerLoadedEvent {
    readonly type: FileViewerType;
    readonly filename: string;
}

export interface FileViewerErrorEvent {
    readonly type: string;
    readonly message: string;
}

@Directive({ selector: 'ui-file-viewer-toolbar' })
export class FileViewerToolbarDirective {}

@Directive({ selector: 'ui-file-viewer-content' })
export class FileViewerContentDirective {}

@Component({
    selector: 'ui-file-viewer',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [SpinnerComponent],
    template: `
        <div [class]="containerClasses()" [attr.data-slot]="'file-viewer'" [style.height]="height()">
            @if (hasCustomContent()) {
                <ng-content />
            } @else {
                <!-- Toolbar -->
                <div [attr.data-slot]="'file-viewer-toolbar'" class="flex items-center justify-between gap-2 border-b bg-muted/30 px-3 py-2 text-sm">
                    <div class="flex items-center gap-2 min-w-0">
                        <span class="truncate font-medium">{{ displayFilename() }}</span>
                        @if (detectedType() && detectedType() !== 'unknown') {
                            <span class="text-muted-foreground text-xs uppercase">{{ detectedType() }}</span>
                        }
                    </div>
                    <div class="flex items-center gap-1 shrink-0">
                        @if (isPaginated()) {
                            <button class="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted disabled:opacity-50"
                                    [disabled]="currentPage() <= 1"
                                    (click)="prevPage()">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                            </button>
                            <span class="text-xs text-muted-foreground tabular-nums min-w-[60px] text-center">
                                {{ currentPage() }} / {{ totalPages() }}
                            </span>
                            <button class="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted disabled:opacity-50"
                                    [disabled]="currentPage() >= totalPages()"
                                    (click)="nextPage()">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                            </button>
                        }
                        @if (isZoomable()) {
                            <button class="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted disabled:opacity-50"
                                    [disabled]="currentZoom() <= 0.25"
                                    (click)="zoomOut()">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="8" x2="14" y1="11" y2="11"/></svg>
                            </button>
                            <span class="text-xs text-muted-foreground tabular-nums min-w-[40px] text-center">
                                {{ zoomPercent() }}%
                            </span>
                            <button class="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted disabled:opacity-50"
                                    [disabled]="currentZoom() >= 3"
                                    (click)="zoomIn()">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/></svg>
                            </button>
                        }
                        @if (downloadUrl()) {
                            <a [href]="downloadUrl()"
                               [download]="displayFilename()"
                               class="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted"
                               title="Download">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                            </a>
                        }
                    </div>
                </div>

                <!-- Content area -->
                <div class="flex-1 overflow-auto relative" [attr.data-slot]="'file-viewer-content'">
                    @switch (state()) {
                        @case ('loading') {
                            <div class="absolute inset-0 flex items-center justify-center">
                                <ui-spinner size="lg" />
                            </div>
                        }
                        @case ('error') {
                            <div class="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                                <p class="text-sm text-muted-foreground max-w-xs">{{ errorMessage() }}</p>
                                @if (downloadUrl()) {
                                    <a [href]="downloadUrl()" [download]="displayFilename()"
                                       class="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                                        Download file
                                    </a>
                                }
                            </div>
                        }
                        @case ('loaded') {
                            @switch (detectedType()) {
                                @case ('image') {
                                    <div class="flex items-center justify-center p-4 min-h-full">
                                        <img [src]="imageSrc()"
                                             [alt]="displayFilename()"
                                             class="max-w-full max-h-full object-contain transition-transform"
                                             [style.transform]="'scale(' + currentZoom() + ')'"
                                             [style.transform-origin]="'center center'" />
                                    </div>
                                }
                                @case ('pdf') {
                                    <iframe [src]="pdfSrc()"
                                            class="w-full h-full border-0"
                                            [title]="displayFilename()">
                                    </iframe>
                                }
                                @case ('xlsx') {
                                    <div class="flex flex-col h-full">
                                        <div class="flex-1 overflow-auto">
                                            <table class="w-full border-collapse text-sm">
                                                <thead class="sticky top-0 bg-muted z-10">
                                                    @if (xlsxHeaderRow(); as headerRow) {
                                                        <tr>
                                                            @for (cell of headerRow; track $index) {
                                                                <th class="border border-border px-2 py-1.5 text-left font-medium text-xs whitespace-nowrap">{{ cell }}</th>
                                                            }
                                                        </tr>
                                                    }
                                                </thead>
                                                <tbody>
                                                    @for (row of xlsxDataRows(); track $index) {
                                                        <tr class="hover:bg-muted/50">
                                                            @for (cell of row; track $index) {
                                                                <td class="border border-border px-2 py-1 text-xs whitespace-nowrap">{{ cell }}</td>
                                                            }
                                                        </tr>
                                                    }
                                                </tbody>
                                            </table>
                                        </div>
                                        @if (xlsxSheetNames().length > 1) {
                                            <div class="flex items-center gap-0.5 border-t bg-muted/30 px-2 py-1 overflow-x-auto" [attr.data-slot]="'file-viewer-sheet-tabs'">
                                                @for (name of xlsxSheetNames(); track $index) {
                                                    <button class="px-3 py-1 text-xs rounded-t whitespace-nowrap transition-colors"
                                                            [class]="$index === activeSheetIndex() ? 'bg-background text-foreground font-medium border border-b-0 border-border' : 'text-muted-foreground hover:text-foreground'"
                                                            (click)="setActiveSheet($index)">
                                                        {{ name }}
                                                    </button>
                                                }
                                            </div>
                                        }
                                    </div>
                                }
                                @case ('docx') {
                                    <div class="p-6 max-w-4xl mx-auto"
                                         [style.zoom]="currentZoom()"
                                         [innerHTML]="docxHtml()">
                                    </div>
                                }
                                @case ('pptx') {
                                    <div class="flex items-center justify-center p-4">
                                        <div class="bg-white rounded shadow-lg overflow-hidden"
                                             [style.width.px]="pptxDisplayWidth()"
                                             [style.height.px]="pptxDisplayHeight()"
                                             [style.transform]="'scale(' + currentZoom() + ')'"
                                             [style.transform-origin]="'center center'"
                                             [innerHTML]="currentSlideHtml()">
                                        </div>
                                    </div>
                                }
                                @case ('text') {
                                    <div class="p-4 overflow-auto font-mono text-sm"
                                         [style.zoom]="currentZoom()">
                                        <pre class="whitespace-pre-wrap break-words">{{ textContent() }}</pre>
                                    </div>
                                }
                                @case ('video') {
                                    <div class="flex items-center justify-center p-4 h-full">
                                        <video controls class="max-w-full max-h-full" [src]="mediaSrc()">
                                            Your browser does not support the video element.
                                        </video>
                                    </div>
                                }
                                @case ('audio') {
                                    <div class="flex items-center justify-center p-6">
                                        <audio controls [src]="mediaSrc()" class="w-full max-w-lg">
                                            Your browser does not support the audio element.
                                        </audio>
                                    </div>
                                }
                                @default {
                                    <div class="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
                                        <p class="text-sm text-muted-foreground">Preview not available for this file type.</p>
                                        @if (downloadUrl()) {
                                            <a [href]="downloadUrl()" [download]="displayFilename()"
                                               class="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                                                Download file
                                            </a>
                                        }
                                    </div>
                                }
                            }
                        }
                    }
                </div>
            }
        </div>
    `,
    host: { class: 'contents' },
})
export class FileViewerComponent implements AfterContentInit, OnDestroy {
    readonly class = input('');
    readonly file = input<File | Blob | null>(null);
    readonly src = input('');
    readonly type = input<FileViewerType | ''>('');
    readonly height = input('600px');
    readonly zoom = input(1);
    readonly page = input(1);
    readonly filename = input('');

    readonly loaded = output<FileViewerLoadedEvent>();
    readonly error = output<FileViewerErrorEvent>();
    readonly pageChange = output<number>();
    readonly zoomChange = output<number>();

    @ContentChild(FileViewerToolbarDirective) readonly customToolbar?: FileViewerToolbarDirective;
    @ContentChild(FileViewerContentDirective) readonly customContent?: FileViewerContentDirective;

    private readonly _hasCustomContent = signal(false);
    readonly hasCustomContent = this._hasCustomContent.asReadonly();

    readonly state = signal<ViewerState>('idle');
    readonly errorMessage = signal('');
    readonly detectedType = signal<FileViewerType>('unknown');

    readonly currentPage = signal(1);
    readonly totalPages = signal(1);
    readonly currentZoom = signal(1);

    readonly textContent = signal('');
    readonly imageSrc = signal<SafeUrl>('');
    readonly mediaSrc = signal<SafeUrl>('');
    readonly pdfSrc = signal<SafeResourceUrl>('');
    readonly downloadUrl = signal<SafeUrl>('');

    private readonly xlsxData = signal<{ sheets: ReadonlyArray<{ name: string; data: string[][] }> } | null>(null);
    readonly activeSheetIndex = signal(0);
    private readonly docxRenderedHtml = signal('');
    private readonly pptxSlides = signal<ReadonlyArray<{ html: string; width: number; height: number }>>([]);

    private readonly blobUrls: string[] = [];
    private readonly sanitizer: DomSanitizer;

    readonly displayFilename = computed(() => {
        if (this.filename()) return this.filename();
        const f = this.file();
        if (f instanceof File) return f.name;
        return 'File';
    });

    readonly isPaginated = computed(() => {
        const t = this.detectedType();
        return t === 'pptx';
    });

    readonly isZoomable = computed(() => {
        const t = this.detectedType();
        return t === 'image' || t === 'docx' || t === 'pptx' || t === 'text';
    });

    readonly zoomPercent = computed(() => Math.round(this.currentZoom() * 100));

    readonly xlsxSheetNames = computed(() => {
        const data = this.xlsxData();
        if (!data) return [];
        return data.sheets.map(s => s.name);
    });

    readonly xlsxHeaderRow = computed<string[] | null>(() => {
        const data = this.xlsxData();
        if (!data) return null;
        const sheet = data.sheets[this.activeSheetIndex()];
        if (!sheet || sheet.data.length === 0) return null;
        return sheet.data[0];
    });

    readonly xlsxDataRows = computed<string[][]>(() => {
        const data = this.xlsxData();
        if (!data) return [];
        const sheet = data.sheets[this.activeSheetIndex()];
        if (!sheet || sheet.data.length <= 1) return [];
        return sheet.data.slice(1);
    });

    readonly docxHtml = computed<SafeHtml>(() => {
        return this.sanitizer.bypassSecurityTrustHtml(this.docxRenderedHtml());
    });

    readonly currentSlideHtml = computed<SafeHtml>(() => {
        const slides = this.pptxSlides();
        const idx = this.currentPage() - 1;
        if (idx >= 0 && idx < slides.length) {
            return this.sanitizer.bypassSecurityTrustHtml(slides[idx].html);
        }
        return '';
    });

    readonly pptxDisplayWidth = computed(() => {
        const slides = this.pptxSlides();
        if (slides.length > 0) return slides[0].width;
        return 960;
    });

    readonly pptxDisplayHeight = computed(() => {
        const slides = this.pptxSlides();
        if (slides.length > 0) return slides[0].height;
        return 540;
    });

    readonly containerClasses = computed(() => cn(
        'flex flex-col border rounded-lg overflow-hidden bg-background',
        this.class()
    ));

    constructor(sanitizer: DomSanitizer) {
        this.sanitizer = sanitizer;

        effect(() => {
            this.currentZoom.set(this.zoom());
        });

        effect(() => {
            this.currentPage.set(this.page());
        });

        effect(() => {
            const file = this.file();
            const src = this.src();
            if (file) {
                void this.loadFile(file);
            } else if (src) {
                void this.loadFromUrl(src);
            } else {
                this.state.set('idle');
            }
        });
    }

    ngAfterContentInit(): void {
        this._hasCustomContent.set(!!this.customToolbar || !!this.customContent);
    }

    ngOnDestroy(): void {
        for (const url of this.blobUrls) {
            URL.revokeObjectURL(url);
        }
    }

    prevPage(): void {
        const p = Math.max(1, this.currentPage() - 1);
        this.currentPage.set(p);
        this.pageChange.emit(p);
    }

    nextPage(): void {
        const p = Math.min(this.totalPages(), this.currentPage() + 1);
        this.currentPage.set(p);
        this.pageChange.emit(p);
    }

    zoomIn(): void {
        const z = Math.min(3, Math.round((this.currentZoom() + 0.25) * 100) / 100);
        this.currentZoom.set(z);
        this.zoomChange.emit(z);
    }

    zoomOut(): void {
        const z = Math.max(0.25, Math.round((this.currentZoom() - 0.25) * 100) / 100);
        this.currentZoom.set(z);
        this.zoomChange.emit(z);
    }

    setActiveSheet(index: number): void {
        this.activeSheetIndex.set(index);
    }

    private async loadFromUrl(url: string): Promise<void> {
        this.state.set('loading');
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const blob = await response.blob();
            const file = new File([blob], this.extractFilename(url), { type: blob.type });
            await this.loadFile(file);
        } catch (err) {
            this.handleError(err instanceof Error ? err.message : 'Failed to load file');
        }
    }

    private extractFilename(url: string): string {
        try {
            const u = new URL(url, globalThis.location?.href);
            const path = u.pathname;
            const name = path.split('/').pop();
            return name || 'file';
        } catch {
            return 'file';
        }
    }

    private async loadFile(file: File | Blob): Promise<void> {
        this.state.set('loading');
        this.errorMessage.set('');

        try {
            const buffer = await file.arrayBuffer();
            const bytes = new Uint8Array(buffer);

            const fileType = this.type() || await this.detectType(bytes);
            this.detectedType.set(fileType);

            const blobUrl = URL.createObjectURL(file);
            this.blobUrls.push(blobUrl);
            this.downloadUrl.set(this.sanitizer.bypassSecurityTrustUrl(blobUrl));

            await this.processFile(fileType, bytes, buffer, file);

            this.state.set('loaded');
            this.loaded.emit({
                type: fileType,
                filename: this.displayFilename(),
            });
        } catch (err) {
            this.handleError(err instanceof Error ? err.message : 'Failed to process file');
        }
    }

    private async detectType(bytes: Uint8Array): Promise<FileViewerType> {
        const { detectFileType } = await import('../lib/file-type-detector');
        return detectFileType(bytes).type;
    }

    private async processFile(type: FileViewerType, bytes: Uint8Array, buffer: ArrayBuffer, file: File | Blob): Promise<void> {
        switch (type) {
            case 'image':
                await this.processImage(bytes, file);
                break;
            case 'pdf':
                this.processPdf(file);
                break;
            case 'xlsx':
                await this.processXlsx(bytes);
                break;
            case 'docx':
                await this.processDocx(bytes);
                break;
            case 'pptx':
                await this.processPptx(bytes);
                break;
            case 'text':
                this.processText(bytes);
                break;
            case 'video':
            case 'audio':
                this.processMedia(file);
                break;
            default:
                break;
        }
    }

    private async processImage(bytes: Uint8Array, file: File | Blob): Promise<void> {
        const isSvg = this.checkIfSvg(bytes);
        if (isSvg) {
            const svgText = new TextDecoder().decode(bytes);
            const { sanitizeSvg } = await import('../lib/svg-sanitizer');
            const sanitized = sanitizeSvg(svgText);
            if (!sanitized) throw new Error('Invalid or unsafe SVG file');
            const blob = new Blob([sanitized], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            this.blobUrls.push(url);
            this.imageSrc.set(this.sanitizer.bypassSecurityTrustUrl(url));
        } else {
            const url = URL.createObjectURL(file);
            this.blobUrls.push(url);
            this.imageSrc.set(this.sanitizer.bypassSecurityTrustUrl(url));
        }
    }

    private checkIfSvg(bytes: Uint8Array): boolean {
        let offset = 0;
        if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
            offset = 3;
        }
        const length = Math.min(bytes.length, 256);
        let text = '';
        for (let i = offset; i < length; i++) {
            text += String.fromCharCode(bytes[i]);
        }
        const trimmed = text.trimStart().toLowerCase();
        return trimmed.startsWith('<svg') || trimmed.startsWith('<?xml');
    }

    private processPdf(file: File | Blob): void {
        const url = URL.createObjectURL(file);
        this.blobUrls.push(url);
        this.pdfSrc.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
    }

    private async processXlsx(bytes: Uint8Array): Promise<void> {
        const { parseXlsx } = await import('../lib/xlsx-reader');
        const result = parseXlsx(bytes);
        this.xlsxData.set(result);
        this.activeSheetIndex.set(0);
    }

    private async processDocx(bytes: Uint8Array): Promise<void> {
        const { parseDocx } = await import('../lib/docx-parser');
        const result = parseDocx(bytes);
        this.docxRenderedHtml.set(this.renderDocxToHtml(result.elements));
    }

    private renderDocxToHtml(elements: ReadonlyArray<unknown>): string {
        const parts: string[] = [];
        for (const el of elements) {
            const element = el as { type: string };
            if (element.type === 'paragraph') {
                parts.push(this.renderDocxParagraph(el));
            } else if (element.type === 'table') {
                parts.push(this.renderDocxTable(el));
            } else if (element.type === 'image') {
                parts.push(this.renderDocxImage(el));
            }
        }
        return parts.join('\n');
    }

    private renderDocxParagraph(el: unknown): string {
        const para = el as { runs: ReadonlyArray<{ text: string; style: { bold?: boolean; italic?: boolean; underline?: boolean; fontSize?: number; color?: string } }>; style: string; listLevel?: number; listType?: string };

        const isHeading = para.style.startsWith('Heading');
        const headingMatch = /Heading(\d)/.exec(para.style);
        const level = headingMatch ? Number.parseInt(headingMatch[1], 10) : 0;

        let content = '';
        for (const run of para.runs) {
            let text = this.escapeHtml(run.text);
            if (run.style.bold) text = `<strong>${text}</strong>`;
            if (run.style.italic) text = `<em>${text}</em>`;
            if (run.style.underline) text = `<u>${text}</u>`;
            if (run.style.color) text = `<span style="color:${run.style.color}">${text}</span>`;
            content += text;
        }

        if (!content.trim()) return '';

        if (isHeading && level >= 1 && level <= 6) {
            return `<h${level} class="font-bold mt-4 mb-2">${content}</h${level}>`;
        }
        if (para.listType) {
            return `<li style="margin-left:${(para.listLevel ?? 0) * 24}px">${content}</li>`;
        }
        return `<p class="mb-2 leading-relaxed">${content}</p>`;
    }

    private renderDocxTable(el: unknown): string {
        const table = el as { rows: ReadonlyArray<ReadonlyArray<{ paragraphs: ReadonlyArray<{ runs: ReadonlyArray<{ text: string }> }>; colSpan: number }>> };
        let html = '<table class="w-full border-collapse my-4 text-sm">';
        for (const row of table.rows) {
            html += '<tr>';
            for (const cell of row) {
                const text = cell.paragraphs.map(p => p.runs.map(r => this.escapeHtml(r.text)).join('')).join('<br/>');
                const colspan = cell.colSpan > 1 ? ` colspan="${cell.colSpan}"` : '';
                html += `<td class="border border-border px-2 py-1"${colspan}>${text}</td>`;
            }
            html += '</tr>';
        }
        html += '</table>';
        return html;
    }

    private renderDocxImage(el: unknown): string {
        const img = el as { dataUrl: string; width: number; height: number; altText: string };
        return `<img src="${img.dataUrl}" width="${img.width}" height="${img.height}" alt="${this.escapeHtml(img.altText)}" class="my-2 max-w-full" />`;
    }

    private async processPptx(bytes: Uint8Array): Promise<void> {
        const { parsePptx } = await import('../lib/pptx-parser');
        const result = parsePptx(bytes);

        const slides = result.slides.map(slide => ({
            html: this.renderSlideToHtml(slide),
            width: result.slideWidth,
            height: result.slideHeight,
        }));

        this.pptxSlides.set(slides);
        this.totalPages.set(result.slides.length);
        this.currentPage.set(Math.min(this.page(), result.slides.length));
    }

    private renderSlideToHtml(slide: { elements: ReadonlyArray<{ type: string; x: number; y: number; width: number; height: number }> }): string {
        let html = '<div style="position:relative;width:100%;height:100%;background:#fff;">';
        for (const el of slide.elements) {
            if (el.type === 'text') {
                html += this.renderSlideTextFrame(el as unknown as { runs: ReadonlyArray<{ text: string; bold?: boolean; italic?: boolean; fontSize?: number; color?: string }>; x: number; y: number; width: number; height: number });
            } else if (el.type === 'image') {
                const img = el as unknown as { dataUrl: string; x: number; y: number; width: number; height: number };
                html += `<img src="${img.dataUrl}" style="position:absolute;left:${img.x}px;top:${img.y}px;width:${img.width}px;height:${img.height}px;object-fit:contain;" />`;
            }
        }
        html += '</div>';
        return html;
    }

    private renderSlideTextFrame(tf: { runs: ReadonlyArray<{ text: string; bold?: boolean; italic?: boolean; fontSize?: number; color?: string }>; x: number; y: number; width: number; height: number }): string {
        let content = '';
        for (const run of tf.runs) {
            if (run.text === '\n') {
                content += '<br/>';
                continue;
            }
            let text = this.escapeHtml(run.text);
            if (run.bold) text = `<strong>${text}</strong>`;
            if (run.italic) text = `<em>${text}</em>`;
            const styles: string[] = [];
            if (run.fontSize) styles.push(`font-size:${run.fontSize}px`);
            if (run.color) styles.push(`color:${run.color}`);
            if (styles.length > 0) {
                text = `<span style="${styles.join(';')}">${text}</span>`;
            }
            content += text;
        }
        return `<div style="position:absolute;left:${tf.x}px;top:${tf.y}px;width:${tf.width}px;height:${tf.height}px;overflow:hidden;padding:4px;box-sizing:border-box;">${content}</div>`;
    }

    private processText(bytes: Uint8Array): void {
        this.textContent.set(new TextDecoder().decode(bytes));
    }

    private processMedia(file: File | Blob): void {
        const url = URL.createObjectURL(file);
        this.blobUrls.push(url);
        this.mediaSrc.set(this.sanitizer.bypassSecurityTrustUrl(url));
    }

    private handleError(message: string): void {
        this.state.set('error');
        this.errorMessage.set(message);
        this.error.emit({ type: this.detectedType(), message });
    }

    private escapeHtml(str: string): string {
        return str
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;');
    }
}
