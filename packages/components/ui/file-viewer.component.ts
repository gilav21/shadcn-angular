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
import { DomSanitizer, type SafeHtml, type SafeUrl } from '@angular/platform-browser';
import type { PdfPageResult } from '../lib/pdf-parser';
import { cn } from '../lib/utils';
import { SpinnerComponent } from './spinner.component';
import type { FileViewerType, FileTypeResult } from '../lib/file-type-detector';
import type {
    PptxTextFrame, PptxTextRun, PptxBullet,
    PptxShapeElement, PptxConnectorElement, PptxTableElement,
    PptxParagraph, PptxGradientFill, PptxPatternFill, PptxEffects,
    PptxUnderlineStyle, PptxTabStop,
} from '../lib/pptx-parser';

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

const TWIPS_PER_PT = 20;

const HEADING_CLASSES: Record<number, string> = {
    1: 'text-4xl font-bold mt-6 mb-3',
    2: 'text-3xl font-bold mt-5 mb-3',
    3: 'text-2xl font-bold mt-4 mb-2',
    4: 'text-xl font-bold mt-4 mb-2',
    5: 'text-lg font-bold mt-3 mb-2',
    6: 'text-base font-bold mt-3 mb-2',
};

@Component({
    selector: 'ui-file-viewer',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [SpinnerComponent],
    styles: `
        .pdf-page {
            line-height: 1.6;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }
        .pdf-page img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 0.5rem auto;
        }
        .pdf-page p {
            margin: 0.25em 0;
        }
        .pdf-page h1, .pdf-page h2, .pdf-page h3,
        .pdf-page h4, .pdf-page h5, .pdf-page h6 {
            margin-top: 1em;
            margin-bottom: 0.4em;
        }
        .pdf-page table {
            margin: 0.5em 0;
        }
        .pdf-page td {
            vertical-align: top;
        }
        .pdf-page ul, .pdf-page ol {
            margin: 0.25em 0;
            padding-inline-start: 1.5em;
        }
    `,
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
                                             [style.transform-origin]="'center center'"
                                             (error)="onMediaError('Failed to load image')" />
                                    </div>
                                }
                                @case ('pdf') {
                                    <div class="overflow-auto h-full bg-muted/40 flex justify-center py-4 sm:py-6"
                                         [style.zoom]="currentZoom()">
                                        <div class="pdf-page bg-white dark:bg-zinc-900 shadow-lg rounded-sm w-full max-w-[800px] min-h-full px-8 sm:px-12 py-10 sm:py-14 mx-4 sm:mx-6"
                                             [attr.dir]="pdfPageRtl() ? 'rtl' : null"
                                             [innerHTML]="currentPdfPageHtml()">
                                        </div>
                                    </div>
                                }
                                @case ('xlsx') {
                                    <div class="flex flex-col h-full">
                                        @if (xlsxTruncated()) {
                                            <div class="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-xs border-b">
                                                Showing first 10,000 rows. Download the file to see all data.
                                            </div>
                                        }
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
                                         [attr.dir]="docxRtl() ? 'rtl' : null"
                                         [innerHTML]="docxHtml()">
                                    </div>
                                }
                                @case ('doc') {
                                    <div class="p-6 max-w-4xl mx-auto"
                                         [style.zoom]="currentZoom()"
                                         [attr.dir]="docxRtl() ? 'rtl' : null"
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
                                @case ('ppt') {
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
                                        <video controls class="max-w-full max-h-full" [src]="mediaSrc()"
                                               (error)="onMediaError('Failed to load video. The format may not be supported by your browser.')">
                                            Your browser does not support the video element.
                                        </video>
                                    </div>
                                }
                                @case ('audio') {
                                    <div class="flex items-center justify-center p-6">
                                        <audio controls [src]="mediaSrc()" class="w-full max-w-lg"
                                               (error)="onMediaError('Failed to load audio. The format may not be supported by your browser.')">
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
    private readonly pdfPages = signal<ReadonlyArray<PdfPageResult>>([]);
    readonly downloadUrl = signal<SafeUrl>('');

    private readonly xlsxData = signal<{ sheets: ReadonlyArray<{ name: string; data: string[][] }>; truncated?: boolean } | null>(null);
    readonly activeSheetIndex = signal(0);
    private readonly docxRenderedHtml = signal('');
    protected readonly docxRtl = signal(false);
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
        return t === 'pptx' || t === 'ppt' || t === 'pdf';
    });

    readonly isZoomable = computed(() => {
        const t = this.detectedType();
        return t === 'image' || t === 'docx' || t === 'doc' || t === 'pptx' || t === 'ppt' || t === 'text' || t === 'pdf';
    });

    readonly zoomPercent = computed(() => Math.round(this.currentZoom() * 100));

    readonly xlsxSheetNames = computed(() => {
        const data = this.xlsxData();
        if (!data) return [];
        return data.sheets.map(s => s.name);
    });

    readonly xlsxTruncated = computed(() => {
        const data = this.xlsxData();
        return data?.truncated ?? false;
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

    readonly currentPdfPageHtml = computed<SafeHtml>(() => {
        const pages = this.pdfPages();
        const idx = this.currentPage() - 1;
        if (idx >= 0 && idx < pages.length) {
            return this.sanitizer.bypassSecurityTrustHtml(pages[idx].html);
        }
        return '';
    });

    readonly pdfPageRtl = computed(() => {
        const pages = this.pdfPages();
        const idx = this.currentPage() - 1;
        if (idx < 0 || idx >= pages.length) return false;
        const text = pages[idx].text;
        if (!text) return false;
        let rtlCount = 0;
        let totalCount = 0;
        for (let i = 0; i < text.length; i++) {
            const code = text.codePointAt(i) ?? 0;
            if (code <= 0x20) continue;
            totalCount++;
            if ((code >= 0x0590 && code <= 0x05FF) || (code >= 0xFB1D && code <= 0xFB4F) ||
                (code >= 0x0600 && code <= 0x06FF) || (code >= 0xFB50 && code <= 0xFDFF) ||
                (code >= 0xFE70 && code <= 0xFEFF)) {
                rtlCount++;
            }
        }
        return totalCount > 0 && rtlCount > totalCount * 0.3;
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

    onMediaError(message: string): void {
        this.handleError(message);
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

            const typeResult = this.type()
                ? { type: this.type() as FileViewerType, mimeType: '', extension: '' }
                : await this.detectTypeResult(bytes);
            const fileType = typeResult.type;
            this.detectedType.set(fileType);

            const blobUrl = URL.createObjectURL(file);
            this.blobUrls.push(blobUrl);
            this.downloadUrl.set(this.sanitizer.bypassSecurityTrustUrl(blobUrl));

            await this.processFile(fileType, bytes, file, typeResult.mimeType);

            this.state.set('loaded');
            this.loaded.emit({
                type: fileType,
                filename: this.displayFilename(),
            });
        } catch (err) {
            this.handleError(err instanceof Error ? err.message : 'Failed to process file');
        }
    }

    private async detectTypeResult(bytes: Uint8Array): Promise<FileTypeResult> {
        const { detectFileType } = await import('../lib/file-type-detector');
        return detectFileType(bytes);
    }

    private async processFile(type: FileViewerType, bytes: Uint8Array, file: File | Blob, mimeType: string): Promise<void> {
        switch (type) {
            case 'image':
                await this.processImage(bytes, file);
                break;
            case 'pdf':
                await this.processPdf(bytes);
                break;
            case 'xlsx':
                await this.processXlsx(bytes);
                break;
            case 'docx':
                await this.processDocx(bytes);
                break;
            case 'doc':
                await this.processDoc(bytes);
                break;
            case 'pptx':
                await this.processPptx(bytes);
                break;
            case 'ppt':
                await this.processLegacyPpt(bytes);
                break;
            case 'text':
                this.processText(bytes);
                break;
            case 'video':
            case 'audio':
                this.processMedia(bytes, mimeType);
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
            text += String.fromCodePoint(bytes[i]);
        }
        const trimmed = text.trimStart().toLowerCase();
        return trimmed.startsWith('<svg') || trimmed.startsWith('<?xml');
    }

    private async processPdf(bytes: Uint8Array): Promise<void> {
        const { parsePdfPaged } = await import('../lib/pdf-parser');
        const result = await parsePdfPaged(bytes.buffer as ArrayBuffer);
        this.pdfPages.set(result.pages);
        this.totalPages.set(result.totalPages);
        this.currentPage.set(1);
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
        this.docxRtl.set(this.detectDocumentRtl(result.elements));
        const headerHtml = this.renderDocxHeadersFooters(result.headers, 'header');
        const bodyHtml = this.renderDocxToHtml(result.elements);
        const footerHtml = this.renderDocxHeadersFooters(result.footers, 'footer');
        const footnotesHtml = this.renderDocxFootnotes(result.footnotes, result.endnotes);
        const commentsHtml = this.renderDocxComments(result.comments);
        this.docxRenderedHtml.set(headerHtml + bodyHtml + footerHtml + footnotesHtml + commentsHtml);
    }

    private async processDoc(bytes: Uint8Array): Promise<void> {
        const { parseDocEnhanced } = await import('../lib/doc-enhanced-parser');
        const result = parseDocEnhanced(bytes);
        this.docxRtl.set(this.detectDocumentRtl(result.elements));
        this.docxRenderedHtml.set(this.renderDocxToHtml(result.elements));
    }

    private detectDocumentRtl(elements: ReadonlyArray<{ type: string }>): boolean {
        let rtlCount = 0;
        let totalCount = 0;
        for (const el of elements) {
            if (el.type === 'paragraph') {
                const para = el as { type: string; rtl?: boolean };
                totalCount++;
                if (para.rtl) rtlCount++;
            }
        }
        return totalCount > 0 && rtlCount > totalCount / 2;
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
        const para = el as {
            runs: ReadonlyArray<{
                text: string;
                href?: string;
                breakType?: string;
                isInserted?: boolean;
                isDeleted?: boolean;
                anchorId?: string;
                style: {
                    bold?: boolean; italic?: boolean; underline?: boolean;
                    strikethrough?: boolean; doubleStrikethrough?: boolean;
                    caps?: boolean; smallCaps?: boolean;
                    fontSize?: number; color?: string; fontFamily?: string;
                    highlight?: string; backgroundColor?: string;
                    vertAlign?: string; rtl?: boolean;
                    charSpacing?: number; hidden?: boolean;
                };
            }>;
            style: string;
            listLevel?: number; listType?: string;
            rtl?: boolean; alignment?: string;
            spacingBefore?: number; spacingAfter?: number; lineSpacing?: number;
            indentLeft?: number; indentRight?: number; indentHanging?: number;
            indentFirstLine?: number;
            shading?: string;
            borders?: {
                top?: { style: string; color: string; size: number };
                bottom?: { style: string; color: string; size: number };
                left?: { style: string; color: string; size: number };
                right?: { style: string; color: string; size: number };
            };
        };

        const content = para.runs.map(run => this.buildRunHtml(run)).join('');
        if (!content.trim()) {
            const hasPageBreak = para.runs.some(r => r.breakType === 'page');
            if (hasPageBreak) return '<hr class="my-8 border-t-2 border-dashed border-muted-foreground/30" />';
            return '';
        }

        const attrs = this.buildParagraphAttrs(para);
        const tag = this.getParagraphTag(para);

        return `<${tag.tag} ${attrs}>${tag.prefix}${content}${tag.suffix}</${tag.tag}>`;
    }

    private buildRunHtml(run: {
        text: string;
        href?: string;
        breakType?: string;
        isInserted?: boolean;
        isDeleted?: boolean;
        anchorId?: string;
        style: {
            bold?: boolean; italic?: boolean; underline?: boolean;
            strikethrough?: boolean; doubleStrikethrough?: boolean;
            caps?: boolean; smallCaps?: boolean;
            fontSize?: number; color?: string; fontFamily?: string;
            highlight?: string; backgroundColor?: string;
            vertAlign?: string; rtl?: boolean;
            charSpacing?: number; hidden?: boolean;
        };
    }): string {
        if (run.style.hidden) return '';
        if (run.breakType === 'page') return '<hr class="my-8 border-t-2 border-dashed border-muted-foreground/30" />';
        if (run.anchorId) return `<a id="${this.escapeHtml(run.anchorId)}"></a>`;

        let text = this.wrapRunInlineFormatting(this.escapeHtml(run.text), run);

        const styles = this.buildRunStyles(run.style);
        const dirAttr = run.style.rtl ? ' dir="rtl"' : '';
        if (styles || dirAttr) {
            const styleAttr = styles ? ` style="${styles}"` : '';
            text = `<span${dirAttr}${styleAttr}>${text}</span>`;
        }

        if (run.href) {
            text = `<a href="${this.escapeHtml(run.href)}" target="_blank" rel="noopener noreferrer">${text}</a>`;
        }

        return text;
    }

    private wrapRunInlineFormatting(text: string, run: {
        isInserted?: boolean; isDeleted?: boolean;
        style: {
            bold?: boolean; italic?: boolean; underline?: boolean;
            strikethrough?: boolean; doubleStrikethrough?: boolean;
            vertAlign?: string;
        };
    }): string {
        if (run.style.bold) text = `<strong>${text}</strong>`;
        if (run.style.italic) text = `<em>${text}</em>`;
        if (run.style.underline) text = `<u>${text}</u>`;
        if (run.style.strikethrough || run.style.doubleStrikethrough) text = `<s>${text}</s>`;
        if (run.style.vertAlign === 'superscript') text = `<sup>${text}</sup>`;
        if (run.style.vertAlign === 'subscript') text = `<sub>${text}</sub>`;
        if (run.isInserted) text = `<ins class="bg-green-100 dark:bg-green-900/30">${text}</ins>`;
        if (run.isDeleted) text = `<del class="bg-red-100 dark:bg-red-900/30 text-muted-foreground">${text}</del>`;
        return text;
    }

    private buildRunStyles(style: {
        fontSize?: number; color?: string; fontFamily?: string;
        highlight?: string; backgroundColor?: string;
        doubleStrikethrough?: boolean; caps?: boolean; smallCaps?: boolean;
        charSpacing?: number;
    }): string {
        const parts: string[] = [];
        if (style.color) parts.push(`color:${style.color}`);
        if (style.fontSize) parts.push(`font-size:${style.fontSize}pt`);
        if (style.fontFamily) parts.push(`font-family:'${style.fontFamily}',sans-serif`);
        if (style.highlight) parts.push(`background-color:${style.highlight}`);
        if (style.backgroundColor && !style.highlight) parts.push(`background-color:${style.backgroundColor}`);
        if (style.doubleStrikethrough) parts.push('text-decoration-style:double');
        if (style.caps) parts.push('text-transform:uppercase');
        if (style.smallCaps) parts.push('font-variant:small-caps');
        if (style.charSpacing) parts.push(`letter-spacing:${style.charSpacing}pt`);
        return parts.join(';');
    }

    private buildParagraphAttrs(para: {
        rtl?: boolean; alignment?: string;
        spacingBefore?: number; spacingAfter?: number; lineSpacing?: number;
        indentLeft?: number; indentRight?: number; indentHanging?: number;
        indentFirstLine?: number; listLevel?: number;
        shading?: string;
        borders?: {
            top?: { style: string; color: string; size: number };
            bottom?: { style: string; color: string; size: number };
            left?: { style: string; color: string; size: number };
            right?: { style: string; color: string; size: number };
        };
    }): string {
        const attrs: string[] = [];
        if (para.rtl) attrs.push('dir="rtl"');

        const styles = this.buildParagraphStyles(para);
        if (styles) attrs.push(`style="${styles}"`);

        return attrs.join(' ');
    }

    private buildParagraphStyles(para: {
        alignment?: string; spacingBefore?: number; spacingAfter?: number;
        lineSpacing?: number; indentLeft?: number; indentRight?: number;
        indentHanging?: number; indentFirstLine?: number; listLevel?: number;
        shading?: string;
        borders?: {
            top?: { style: string; color: string; size: number };
            bottom?: { style: string; color: string; size: number };
            left?: { style: string; color: string; size: number };
            right?: { style: string; color: string; size: number };
        };
    }): string {
        const parts: string[] = [];
        if (para.alignment) parts.push(`text-align:${this.mapDocxAlignment(para.alignment)}`);
        if (para.spacingBefore) parts.push(`margin-top:${para.spacingBefore}pt`);
        if (para.spacingAfter) parts.push(`margin-bottom:${para.spacingAfter}pt`);
        if (para.lineSpacing && para.lineSpacing > 0) parts.push(`line-height:${para.lineSpacing}`);
        if (para.indentLeft) parts.push(`margin-left:${para.indentLeft}pt`);
        if (para.indentRight) parts.push(`margin-right:${para.indentRight}pt`);
        if (para.indentHanging) parts.push(`text-indent:-${para.indentHanging}pt`);
        if (para.indentFirstLine) parts.push(`text-indent:${para.indentFirstLine}pt`);
        if (para.listLevel !== undefined) parts.push(`margin-left:${(para.listLevel) * 24}px`);
        if (para.shading) parts.push(`background-color:${para.shading};padding:4px 8px`);
        if (para.borders) {
            this.appendBorderStyles(parts, para.borders);
        }
        return parts.join(';');
    }

    private appendBorderStyles(parts: string[], borders: {
        top?: { style: string; color: string; size: number };
        bottom?: { style: string; color: string; size: number };
        left?: { style: string; color: string; size: number };
        right?: { style: string; color: string; size: number };
    }): void {
        if (borders.top) parts.push(`border-top:${borders.top.size}pt solid ${borders.top.color}`);
        if (borders.bottom) parts.push(`border-bottom:${borders.bottom.size}pt solid ${borders.bottom.color}`);
        if (borders.left) parts.push(`border-left:${borders.left.size}pt solid ${borders.left.color}`);
        if (borders.right) parts.push(`border-right:${borders.right.size}pt solid ${borders.right.color}`);
        if (borders.top || borders.bottom || borders.left || borders.right) {
            parts.push('padding:4px 8px');
        }
    }

    private getParagraphTag(para: {
        style: string; listType?: string; listLevel?: number;
    }): { tag: string; prefix: string; suffix: string } {
        const headingMatch = /Heading(\d)/.exec(para.style);
        if (headingMatch) {
            const level = Number.parseInt(headingMatch[1], 10);
            if (level >= 1 && level <= 6) {
                const cls = HEADING_CLASSES[level] ?? 'font-bold mt-4 mb-2';
                return { tag: `h${level} class="${cls}"`, prefix: '', suffix: '' };
            }
        }
        if (para.listType) {
            return { tag: 'li', prefix: '', suffix: '' };
        }
        return { tag: 'p class="mb-3 leading-relaxed"', prefix: '', suffix: '' };
    }

    private mapDocxAlignment(alignment: string): string {
        switch (alignment) {
            case 'right': return 'right';
            case 'center': return 'center';
            case 'both':
            case 'distribute': return 'justify';
            default: return 'left';
        }
    }

    private renderDocxTable(el: unknown): string {
        const table = el as {
            rows: ReadonlyArray<{
                cells: ReadonlyArray<{
                    elements: ReadonlyArray<{ type: string }>;
                    colSpan: number;
                    rowSpan: number;
                    cellStyle?: {
                        backgroundColor?: string; verticalAlign?: string;
                        width?: number; widthUnit?: string;
                        borders?: {
                            top?: { size: number; color: string };
                            bottom?: { size: number; color: string };
                            left?: { size: number; color: string };
                            right?: { size: number; color: string };
                        };
                        paddings?: {
                            top?: number; bottom?: number; left?: number; right?: number;
                        };
                    };
                }>;
                rowStyle?: { height?: number; isHeader?: boolean };
            }>;
            tableStyle?: {
                width?: number; widthUnit?: string;
            };
        };

        const tableWidth = this.buildTableWidth(table.tableStyle);
        let html = `<table class="w-full border-collapse my-4 text-sm"${tableWidth}>`;

        let inThead = false;
        for (const row of table.rows) {
            const isHeader = row.rowStyle?.isHeader ?? false;
            if (isHeader && !inThead) { html += '<thead>'; inThead = true; }
            if (!isHeader && inThead) { html += '</thead><tbody>'; inThead = false; }

            const rowHeight = row.rowStyle?.height ? ` style="height:${row.rowStyle.height}pt"` : '';
            html += `<tr${rowHeight}>`;
            for (const cell of row.cells) {
                if (cell.rowSpan === 0) continue;
                html += this.renderDocxTableCell(cell, isHeader);
            }
            html += '</tr>';
        }

        if (inThead) html += '</thead>';
        html += '</table>';
        return html;
    }

    private buildTableWidth(tableStyle?: { width?: number; widthUnit?: string }): string {
        if (!tableStyle?.width) return '';
        if (tableStyle.widthUnit === 'pct') return ` style="width:${tableStyle.width / 50}%"`;
        return ` style="width:${tableStyle.width / TWIPS_PER_PT}pt"`;
    }

    private renderDocxTableCell(cell: {
        elements: ReadonlyArray<{ type: string }>;
        colSpan: number;
        rowSpan: number;
        cellStyle?: {
            backgroundColor?: string; verticalAlign?: string;
            width?: number; widthUnit?: string;
            borders?: {
                top?: { size: number; color: string };
                bottom?: { size: number; color: string };
                left?: { size: number; color: string };
                right?: { size: number; color: string };
            };
            paddings?: {
                top?: number; bottom?: number; left?: number; right?: number;
            };
        };
    }, isHeader: boolean): string {
        const tag = isHeader ? 'th' : 'td';
        const content = this.renderDocxCellContent(cell.elements);
        const colspan = cell.colSpan > 1 ? ` colspan="${cell.colSpan}"` : '';
        const rowspan = cell.rowSpan > 1 ? ` rowspan="${cell.rowSpan}"` : '';
        const cellStyles = this.buildCellStyles(cell.cellStyle);

        return `<${tag} class="border border-border px-2 py-1"${colspan}${rowspan}${cellStyles}>${content}</${tag}>`;
    }

    private renderDocxCellContent(elements: ReadonlyArray<{ type: string }>): string {
        const parts: string[] = [];
        for (const el of elements) {
            if (el.type === 'paragraph') {
                const paraHtml = this.renderDocxParagraph(el);
                if (paraHtml) parts.push(paraHtml);
            } else if (el.type === 'table') {
                parts.push(this.renderDocxTable(el));
            }
        }
        return parts.join('');
    }

    private buildCellStyles(cellStyle?: {
        backgroundColor?: string; verticalAlign?: string;
        width?: number; widthUnit?: string;
        borders?: {
            top?: { size: number; color: string };
            bottom?: { size: number; color: string };
            left?: { size: number; color: string };
            right?: { size: number; color: string };
        };
        paddings?: {
            top?: number; bottom?: number; left?: number; right?: number;
        };
    }): string {
        if (!cellStyle) return '';
        const parts: string[] = [];
        if (cellStyle.backgroundColor) parts.push(`background-color:${cellStyle.backgroundColor}`);
        if (cellStyle.verticalAlign) parts.push(`vertical-align:${this.mapVerticalAlign(cellStyle.verticalAlign)}`);
        this.appendCellWidth(cellStyle, parts);
        this.appendCellBorders(cellStyle.borders, parts);
        this.appendCellPaddings(cellStyle.paddings, parts);
        return parts.length > 0 ? ` style="${parts.join(';')}"` : '';
    }

    private appendCellWidth(cellStyle: { width?: number; widthUnit?: string }, parts: string[]): void {
        if (!cellStyle.width) return;
        if (cellStyle.widthUnit === 'pct') {
            parts.push(`width:${cellStyle.width / 50}%`);
        } else {
            parts.push(`width:${cellStyle.width / TWIPS_PER_PT}pt`);
        }
    }

    private appendCellBorders(borders: {
        top?: { size: number; color: string }; bottom?: { size: number; color: string };
        left?: { size: number; color: string }; right?: { size: number; color: string };
    } | undefined, parts: string[]): void {
        if (!borders) return;
        if (borders.top) parts.push(`border-top:${borders.top.size}pt solid ${borders.top.color}`);
        if (borders.bottom) parts.push(`border-bottom:${borders.bottom.size}pt solid ${borders.bottom.color}`);
        if (borders.left) parts.push(`border-left:${borders.left.size}pt solid ${borders.left.color}`);
        if (borders.right) parts.push(`border-right:${borders.right.size}pt solid ${borders.right.color}`);
    }

    private appendCellPaddings(paddings: {
        top?: number; bottom?: number; left?: number; right?: number;
    } | undefined, parts: string[]): void {
        if (!paddings) return;
        if (paddings.top) parts.push(`padding-top:${paddings.top}pt`);
        if (paddings.bottom) parts.push(`padding-bottom:${paddings.bottom}pt`);
        if (paddings.left) parts.push(`padding-left:${paddings.left}pt`);
        if (paddings.right) parts.push(`padding-right:${paddings.right}pt`);
    }

    private mapVerticalAlign(val: string): string {
        if (val === 'center') return 'middle';
        if (val === 'bottom') return 'bottom';
        return 'top';
    }

    private renderDocxImage(el: unknown): string {
        const img = el as { dataUrl: string; width: number; height: number; altText: string };
        return `<img src="${img.dataUrl}" width="${img.width}" height="${img.height}" alt="${this.escapeHtml(img.altText)}" class="my-2 max-w-full" />`;
    }

    private renderDocxFootnotes(
        footnotes: ReadonlyArray<{ id: string; paragraphs: ReadonlyArray<unknown> }>,
        endnotes: ReadonlyArray<{ id: string; paragraphs: ReadonlyArray<unknown> }>,
    ): string {
        const allNotes = [...footnotes, ...endnotes];
        if (allNotes.length === 0) return '';

        let html = '<hr class="my-6 border-t border-border" />';
        html += '<section class="text-xs text-muted-foreground space-y-1">';
        for (const note of allNotes) {
            const content = note.paragraphs.map(p => this.renderDocxParagraph(p)).join('');
            html += `<div><sup>${this.escapeHtml(note.id)}</sup> ${content}</div>`;
        }
        html += '</section>';
        return html;
    }

    private renderDocxComments(
        comments: ReadonlyArray<{ id: string; author: string; date: string; paragraphs: ReadonlyArray<unknown> }>,
    ): string {
        if (comments.length === 0) return '';

        let html = '<hr class="my-6 border-t border-border" />';
        html += '<section class="text-xs text-muted-foreground space-y-2">';
        html += '<h4 class="font-semibold text-sm text-foreground">Comments</h4>';
        for (const comment of comments) {
            const content = comment.paragraphs.map(p => this.renderDocxParagraph(p)).join('');
            const authorHtml = comment.author ? `<strong>${this.escapeHtml(comment.author)}</strong>` : '';
            html += `<div class="border-l-2 border-muted pl-2"><sup>*${this.escapeHtml(comment.id)}</sup> ${authorHtml} ${content}</div>`;
        }
        html += '</section>';
        return html;
    }

    private renderDocxHeadersFooters(
        sections: ReadonlyArray<ReadonlyArray<unknown>>,
        type: 'header' | 'footer',
    ): string {
        if (sections.length === 0) return '';

        const first = sections[0];
        if (!first || first.length === 0) return '';

        const borderClass = type === 'header' ? 'border-b mb-4 pb-2' : 'border-t mt-4 pt-2';
        let html = `<section class="text-xs text-muted-foreground ${borderClass} border-border">`;
        html += this.renderDocxToHtml(first);
        html += '</section>';
        return html;
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

    private async processLegacyPpt(bytes: Uint8Array): Promise<void> {
        const { parsePpt } = await import('../lib/ppt-parser');
        const result = parsePpt(bytes);

        const slides = result.slides.map(slide => ({
            html: this.renderSlideToHtml(slide),
            width: result.slideWidth,
            height: result.slideHeight,
        }));

        this.pptxSlides.set(slides);
        this.totalPages.set(result.slides.length);
        this.currentPage.set(Math.min(this.page(), result.slides.length));
    }

    private renderSlideToHtml(slide: {
        elements: ReadonlyArray<{ type: string; x: number; y: number; width: number; height: number }>;
        backgroundColor?: string;
        backgroundImage?: string;
    }): string {
        const bgStyles = ['position:relative', 'width:100%', 'height:100%'];
        bgStyles.push(`background-color:${slide.backgroundColor ?? '#fff'}`);
        if (slide.backgroundImage) {
            bgStyles.push(`background-image:url(${slide.backgroundImage})`, 'background-size:cover', 'background-position:center');
        }
        let html = `<div style="${bgStyles.join(';')}">`;
        for (const el of slide.elements) {
            html += this.renderSlideElement(el);
        }
        html += '</div>';
        return html;
    }

    private renderSlideElement(el: { type: string; x: number; y: number; width: number; height: number }): string {
        if (el.type === 'text') {
            return this.renderSlideTextFrame(el as unknown as PptxTextFrame);
        }
        if (el.type === 'image') {
            const img = el as unknown as { dataUrl: string; x: number; y: number; width: number; height: number };
            return `<img src="${img.dataUrl}" style="position:absolute;left:${img.x}px;top:${img.y}px;width:${img.width}px;height:${img.height}px;object-fit:contain;z-index:2" />`;
        }
        if (el.type === 'table') {
            return this.renderSlideTable(el as unknown as PptxTableElement);
        }
        if (el.type === 'shape') {
            return this.renderSlideShape(el as unknown as PptxShapeElement);
        }
        if (el.type === 'connector') {
            return this.renderSlideConnector(el as unknown as PptxConnectorElement);
        }
        return '';
    }

    private renderSlideTextFrame(tf: PptxTextFrame): string {
        let content = '';
        let autoNumCounter = 0;
        for (const para of tf.paragraphs) {
            if (para.bullet?.type === 'autoNum') {
                autoNumCounter++;
            } else {
                autoNumCounter = 0;
            }
            content += this.renderSlideParagraph(para, autoNumCounter);
        }
        const styles = this.buildTextFrameStyles(tf);
        if (tf.fontScale && tf.fontScale < 1) {
            const invScale = Math.round(100 / tf.fontScale);
            const innerStyle = `transform:scale(${tf.fontScale});transform-origin:top left;width:${invScale}%`;
            return `<div style="${styles.join(';')}"><div style="${innerStyle}">${content}</div></div>`;
        }
        return `<div style="${styles.join(';')}">${content}</div>`;
    }

    private renderSlideParagraph(para: PptxParagraph, autoNumCounter: number): string {
        let content = '';
        if (para.bullet && para.bullet.type !== 'none') {
            content += this.renderBulletPrefix(para.bullet, autoNumCounter);
        }
        for (const run of para.runs) {
            // Handle tab characters in run text
            if (run.text.includes('\t')) {
                const tabRendered = this.renderTabContent(run.text, para.tabs, para.defaultTabSize);
                const runWithReplacedText = { ...run, text: '' };
                const runHtml = this.renderSlideRun(runWithReplacedText);
                // Insert tab-rendered content into the span
                content += runHtml.replace('></span>', `>${tabRendered}</span>`).replace(/^$/, tabRendered);
            } else {
                content += this.renderSlideRun(run);
            }
        }
        if (!content) content = '<br/>';
        const styles = this.buildSlideParagraphStyles(para);
        const dirAttr = para.rtl ? ' dir="rtl"' : '';
        return `<div style="${styles.join(';')}"${dirAttr}>${content}</div>`;
    }

    private renderSlideRun(run: PptxTextRun): string {
        let text = this.wrapSlideRunFormatting(this.escapeHtml(run.text), run);

        const styles: string[] = [];
        if (run.fontSize) styles.push(`font-size:${run.fontSize}pt`);
        if (run.fontFamily) styles.push(`font-family:'${run.fontFamily}',sans-serif`);

        this.applyRunFillStyles(run, styles);
        this.applyRunDecorationStyles(run, styles);
        this.applyRunTextEffects(run, styles);
        this.applySlideRunUnderline(run, styles);
        this.applySlideRunHyperlinkDefaults(run, styles);

        if (run.isHyperlink && !run.underline && !run.underlineStyle) {
            text = `<u>${text}</u>`;
        }

        const attrs: string[] = [];
        if (styles.length > 0) attrs.push(`style="${styles.join(';')}"`);
        if (run.hoverTooltip) attrs.push(`title="${this.escapeHtml(run.hoverTooltip)}"`);

        if (attrs.length > 0) text = `<span ${attrs.join(' ')}>${text}</span>`;
        return text;
    }

    private wrapSlideRunFormatting(text: string, run: PptxTextRun): string {
        if (run.bold) text = `<strong>${text}</strong>`;
        if (run.italic) text = `<em>${text}</em>`;
        if (run.strikethrough) text = `<s>${text}</s>`;
        if (run.baseline && run.baseline > 0) text = `<sup>${text}</sup>`;
        if (run.baseline && run.baseline < 0) text = `<sub>${text}</sub>`;
        if (run.underline && !run.underlineStyle) text = `<u>${text}</u>`;
        return text;
    }

    private applySlideRunUnderline(run: PptxTextRun, styles: string[]): void {
        if (run.underlineStyle) {
            styles.push(...this.buildUnderlineCss(run.underlineStyle));
        }
    }

    private applySlideRunHyperlinkDefaults(run: PptxTextRun, styles: string[]): void {
        if (run.isHyperlink && !run.color && !run.gradientFill && !run.noFill) {
            styles.push('color:#0563C1');
        }
    }

    private applyRunFillStyles(run: PptxTextRun, styles: string[]): void {
        if (run.noFill) {
            styles.push('color:transparent');
            return;
        }
        if (run.gradientFill) {
            styles.push(`background:${this.buildGradientCss(run.gradientFill)}`, '-webkit-background-clip:text', 'background-clip:text', 'color:transparent');
            return;
        }
        if (run.imageFill) {
            styles.push(`background-image:url(${run.imageFill})`, 'background-size:cover', '-webkit-background-clip:text', 'background-clip:text', 'color:transparent');
            return;
        }
        if (run.patternFill) {
            styles.push(this.buildPatternCss(run.patternFill), '-webkit-background-clip:text', 'background-clip:text', 'color:transparent');
            return;
        }
        if (run.color) styles.push(`color:${run.color}`);
    }

    private applyRunDecorationStyles(run: PptxTextRun, styles: string[]): void {
        if (run.cap === 'all') styles.push('text-transform:uppercase');
        if (run.cap === 'small') styles.push('font-variant:small-caps');
        if (run.spc != null) styles.push(`letter-spacing:${run.spc}pt`);
        if (run.highlight) styles.push(`background-color:${run.highlight}`);
    }

    private applyRunTextEffects(run: PptxTextRun, styles: string[]): void {
        if (run.textOutline) {
            styles.push(`-webkit-text-stroke-width:${run.textOutline.width}pt`);
            if (run.textOutline.color) styles.push(`-webkit-text-stroke-color:${run.textOutline.color}`);
            styles.push('paint-order:stroke fill');
        }
        if (run.effects) styles.push(...this.buildEffectsCss(run.effects, 'text'));
    }

    private renderBulletPrefix(bullet: PptxBullet, autoNumCounter: number): string {
        // Image bullet
        if (bullet.imageDataUrl) {
            return `<img src="${bullet.imageDataUrl}" style="height:1em;vertical-align:middle;margin-right:0.25em;display:inline-block" />`;
        }

        let text = '';
        if (bullet.type === 'char') {
            text = bullet.char ?? '•';
        } else if (bullet.type === 'autoNum') {
            const startAt = bullet.startAt ?? 1;
            text = this.formatAutoNumber(bullet.autoNumScheme ?? 'arabicPeriod', autoNumCounter, startAt);
        }

        const styles: string[] = ['display:inline-block', 'min-width:1.5em', 'margin-right:0.25em'];
        if (bullet.color) styles.push(`color:${bullet.color}`);
        if (bullet.fontFamily) styles.push(`font-family:'${bullet.fontFamily}',sans-serif`);
        if (bullet.sizePoints) styles.push(`font-size:${bullet.sizePoints}pt`);

        return `<span style="${styles.join(';')}">${this.escapeHtml(text)}</span>`;
    }

    private formatAutoNumber(scheme: string, counter: number, startAt: number): string {
        const n = counter - 1 + startAt;
        switch (scheme) {
            case 'arabicPeriod': return `${n}.`;
            case 'arabicParenR': return `${n})`;
            case 'romanUcPeriod': return `${this.toRoman(n)}.`;
            case 'romanLcPeriod': return `${this.toRoman(n).toLowerCase()}.`;
            case 'alphaUcPeriod': return `${this.toAlpha(n)}.`;
            case 'alphaLcPeriod': return `${this.toAlpha(n).toLowerCase()}.`;
            default: return `${n}.`;
        }
    }

    private toRoman(n: number): string {
        const vals = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
        const syms = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
        let result = '';
        let remaining = n;
        for (let i = 0; i < vals.length; i++) {
            while (remaining >= vals[i]) {
                result += syms[i];
                remaining -= vals[i];
            }
        }
        return result;
    }

    private toAlpha(n: number): string {
        if (n <= 0) return '';
        let result = '';
        let remaining = n;
        while (remaining > 0) {
            remaining--;
            result = String.fromCodePoint(65 + (remaining % 26)) + result;
            remaining = Math.floor(remaining / 26);
        }
        return result;
    }

    private buildTextFrameStyles(tf: {
        readonly x: number; readonly y: number; readonly width: number; readonly height: number;
        readonly fillColor?: string; readonly borderColor?: string;
        readonly borderWidth?: number; readonly rotation?: number;
    }): string[] {
        const styles = [
            'position:absolute',
            `left:${tf.x}px`, `top:${tf.y}px`,
            `width:${tf.width}px`,
            'padding:4px', 'box-sizing:border-box',
            'z-index:4',
        ];
        if (tf.fillColor) styles.push(`background-color:${tf.fillColor}`);
        if (tf.borderColor) styles.push(`border:${tf.borderWidth ?? 1}px solid ${tf.borderColor}`);
        if (tf.rotation) styles.push(`transform:rotate(${tf.rotation}deg)`);
        return styles;
    }

    private buildSlideParagraphStyles(para: PptxParagraph): string[] {
        const styles: string[] = ['margin:0'];
        if (para.alignment) styles.push(`text-align:${this.mapSlideAlignment(para.alignment)}`);
        if (para.spacingBefore) styles.push(`margin-top:${para.spacingBefore}pt`);
        if (para.spacingAfter) styles.push(`margin-bottom:${para.spacingAfter}pt`);
        if (para.lineSpacing) styles.push(`line-height:${para.lineSpacing}`);
        if (para.marginLeft) styles.push(`margin-left:${para.marginLeft}px`);
        if (para.indent) styles.push(`text-indent:${para.indent}px`);
        if (para.level) styles.push(`padding-left:${para.level * 24}px`);
        if (para.fontAlign) {
            const vaMap: Record<string, string> = { auto: 'baseline', t: 'top', ctr: 'middle', base: 'baseline', b: 'bottom' };
            styles.push(`vertical-align:${vaMap[para.fontAlign] ?? 'baseline'}`);
        }
        return styles;
    }

    private renderSlideShape(shape: PptxShapeElement): string {
        const styles: string[] = [
            'position:absolute',
            `left:${shape.x}px`, `top:${shape.y}px`,
            `width:${shape.width}px`, `height:${shape.height}px`,
            'z-index:1',
        ];

        this.applyShapeFillStyles(shape, styles);

        if (shape.borderColor) {
            const borderStyle = this.mapDashStyleToCss(shape.dashStyle);
            styles.push(`border:${shape.borderWidth ?? 1}px ${borderStyle} ${shape.borderColor}`);
        }
        if (shape.rotation) styles.push(`transform:rotate(${shape.rotation}deg)`);

        const borderRadius = this.getShapeBorderRadius(shape.shapeType);
        if (borderRadius) styles.push(`border-radius:${borderRadius}`);

        const clipPath = this.getShapeClipPath(shape.shapeType);
        if (clipPath) styles.push(`clip-path:${clipPath}`);

        if (shape.effects) styles.push(...this.buildEffectsCss(shape.effects, 'shape'));

        return `<div style="${styles.join(';')}"></div>`;
    }

    private applyShapeFillStyles(shape: PptxShapeElement, styles: string[]): void {
        if (shape.gradientFill) {
            styles.push(`background:${this.buildGradientCss(shape.gradientFill)}`);
        } else if (shape.imageFill) {
            styles.push(`background-image:url(${shape.imageFill})`, 'background-size:cover');
        } else if (shape.patternFill) {
            styles.push(this.buildPatternCss(shape.patternFill));
        } else if (shape.fillColor) {
            styles.push(`background-color:${shape.fillColor}`);
        }
    }

    private getShapeBorderRadius(shapeType: string): string {
        switch (shapeType) {
            case 'roundRect': return '8px';
            case 'ellipse': return '50%';
            default: return '';
        }
    }

    private getShapeClipPath(shapeType: string): string {
        switch (shapeType) {
            case 'rightArrow':
            case 'notchedRightArrow':
                return 'polygon(0 20%, 70% 20%, 70% 0, 100% 50%, 70% 100%, 70% 80%, 0 80%)';
            case 'leftArrow':
                return 'polygon(30% 0, 30% 20%, 100% 20%, 100% 80%, 30% 80%, 30% 100%, 0 50%)';
            case 'upArrow':
                return 'polygon(50% 0, 100% 30%, 80% 30%, 80% 100%, 20% 100%, 20% 30%, 0 30%)';
            case 'downArrow':
                return 'polygon(20% 0, 80% 0, 80% 70%, 100% 70%, 50% 100%, 0 70%, 20% 70%)';
            case 'leftRightArrow':
                return 'polygon(0 50%, 15% 20%, 15% 35%, 85% 35%, 85% 20%, 100% 50%, 85% 80%, 85% 65%, 15% 65%, 15% 80%)';
            case 'upDownArrow':
                return 'polygon(50% 0, 80% 15%, 65% 15%, 65% 85%, 80% 85%, 50% 100%, 20% 85%, 35% 85%, 35% 15%, 20% 15%)';
            case 'chevron':
                return 'polygon(0 0, 80% 0, 100% 50%, 80% 100%, 0 100%, 20% 50%)';
            case 'homePlate':
                return 'polygon(0 0, 85% 0, 100% 50%, 85% 100%, 0 100%)';
            default:
                return '';
        }
    }

    private mapDashStyleToCss(dashStyle?: string): string {
        if (!dashStyle) return 'solid';
        switch (dashStyle) {
            case 'dot':
            case 'sysDot': return 'dotted';
            case 'dash':
            case 'sysDash':
            case 'lgDash':
            case 'dashDot':
            case 'lgDashDot':
            case 'sysDashDot':
            case 'lgDashDotDot':
            case 'sysDashDotDot': return 'dashed';
            default: return 'solid';
        }
    }

    private renderSlideConnector(conn: PptxConnectorElement): string {
        const color = conn.color ?? '#000';
        const lw = conn.lineWidth ?? 1;
        const pad = lw + 2;
        const w = Math.max(conn.width, 0);
        const h = Math.max(conn.height, 0);
        const svgW = w + pad * 2;
        const svgH = h + pad * 2;

        const dashAttr = this.getConnectorDashAttr(conn.dashStyle);
        const markerDefs = this.getConnectorMarkerDefs(conn, color);
        const markerAttrs = this.getConnectorMarkerAttrs(conn);

        const pathD = this.buildConnectorPath(conn.connectorType, w, h, conn.flipH, conn.flipV, pad);

        const rotateStyle = conn.rotation ? `transform:rotate(${conn.rotation}deg);transform-origin:center;` : '';
        return `<svg style="position:absolute;left:${conn.x - pad}px;top:${conn.y - pad}px;width:${svgW}px;height:${svgH}px;${rotateStyle}pointer-events:none;z-index:1">${markerDefs}<path d="${pathD}" stroke="${color}" stroke-width="${lw}" fill="none"${dashAttr}${markerAttrs}/></svg>`;
    }

    private flipPoint(x: number, y: number, w: number, h: number, fH?: boolean, fV?: boolean): [number, number] {
        return [fH ? w - x : x, fV ? h - y : y];
    }

    private buildConnectorPath(
        connType: string | undefined, w: number, h: number, flipH?: boolean, flipV?: boolean, pad = 0,
    ): string {
        if (connType?.startsWith('bentConnector')) {
            return this.buildBentConnectorPath(connType, w, h, flipH, flipV, pad);
        }
        if (connType?.startsWith('curvedConnector')) {
            return this.buildCurvedConnectorPath(w, h, flipH, flipV, pad);
        }
        // Straight line: start at (0,0), end at (w,h) in logical space, then flip + offset by pad
        const [x1, y1] = this.flipPoint(0, 0, w, h, flipH, flipV);
        const [x2, y2] = this.flipPoint(w, h, w, h, flipH, flipV);
        return `M${x1 + pad},${y1 + pad} L${x2 + pad},${y2 + pad}`;
    }

    private buildBentConnectorPath(
        connType: string, w: number, h: number, flipH?: boolean, flipV?: boolean, pad = 0,
    ): string {
        const midX = w / 2;
        const fp = (x: number, y: number): [number, number] => {
            const [fx, fy] = this.flipPoint(x, y, w, h, flipH, flipV);
            return [fx + pad, fy + pad];
        };

        if (connType === 'bentConnector2') {
            const [x0, y0] = fp(0, 0);
            const [x1, y1] = fp(w, 0);
            const [x2, y2] = fp(w, h);
            return `M${x0},${y0} L${x1},${y1} L${x2},${y2}`;
        }

        // bentConnector3+: Z-shape horizontal-first
        const [x0, y0] = fp(0, 0);
        const [x1, y1] = fp(midX, 0);
        const [x2, y2] = fp(midX, h);
        const [x3, y3] = fp(w, h);
        return `M${x0},${y0} L${x1},${y1} L${x2},${y2} L${x3},${y3}`;
    }

    private buildCurvedConnectorPath(
        w: number, h: number, flipH?: boolean, flipV?: boolean, pad = 0,
    ): string {
        const fp = (x: number, y: number): [number, number] => {
            const [fx, fy] = this.flipPoint(x, y, w, h, flipH, flipV);
            return [fx + pad, fy + pad];
        };
        const [x0, y0] = fp(0, 0);
        const [cx1, cy1] = fp(w / 2, 0);
        const [cx2, cy2] = fp(w / 2, h);
        const [x1, y1] = fp(w, h);
        return `M${x0},${y0} C${cx1},${cy1} ${cx2},${cy2} ${x1},${y1}`;
    }

    private getConnectorDashAttr(dashStyle?: string): string {
        if (!dashStyle) return '';
        switch (dashStyle) {
            case 'dot':
            case 'sysDot': return ' stroke-dasharray="2,4"';
            case 'dash':
            case 'sysDash': return ' stroke-dasharray="8,4"';
            case 'lgDash': return ' stroke-dasharray="12,4"';
            case 'dashDot':
            case 'sysDashDot': return ' stroke-dasharray="8,4,2,4"';
            case 'lgDashDot': return ' stroke-dasharray="12,4,2,4"';
            case 'lgDashDotDot':
            case 'sysDashDotDot': return ' stroke-dasharray="12,4,2,4,2,4"';
            default: return '';
        }
    }

    private getConnectorMarkerDefs(conn: PptxConnectorElement, color: string): string {
        if (!conn.headEnd && !conn.tailEnd) return '';
        let defs = '<defs>';
        if (conn.tailEnd) {
            defs += `<marker id="arrow-end" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="${color}"/></marker>`;
        }
        if (conn.headEnd) {
            defs += `<marker id="arrow-start" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto"><polygon points="10 0, 0 3.5, 10 7" fill="${color}"/></marker>`;
        }
        defs += '</defs>';
        return defs;
    }

    private getConnectorMarkerAttrs(conn: PptxConnectorElement): string {
        let attrs = '';
        if (conn.tailEnd) attrs += ' marker-end="url(#arrow-end)"';
        if (conn.headEnd) attrs += ' marker-start="url(#arrow-start)"';
        return attrs;
    }

    private renderSlideTable(table: PptxTableElement): string {
        let html = `<div style="position:absolute;left:${table.x}px;top:${table.y}px;width:${table.width}px;height:${table.height}px;overflow:hidden;z-index:3">`;
        html += '<table style="width:100%;border-collapse:collapse;font-size:12px;">';

        if (table.columnWidths) {
            html += '<colgroup>';
            for (const w of table.columnWidths) {
                html += `<col style="width:${w}px">`;
            }
            html += '</colgroup>';
        }

        for (const row of table.rows) {
            html += '<tr>';
            for (const cell of row) {
                const text = this.escapeHtml(cell.text);
                const content = cell.bold ? `<strong>${text}</strong>` : text;
                const cellStyles: string[] = ['border:1px solid #ccc', 'padding:2px 4px'];
                if (cell.fillColor) cellStyles.push(`background:${cell.fillColor}`);
                if (cell.color) cellStyles.push(`color:${cell.color}`);
                html += `<td style="${cellStyles.join(';')}">${content}</td>`;
            }
            html += '</tr>';
        }
        html += '</table></div>';
        return html;
    }

    private buildGradientCss(grad: PptxGradientFill): string {
        const stopStr = grad.stops.map(s => `${s.color} ${s.position}%`).join(', ');
        if (grad.type === 'linear') {
            return `linear-gradient(${grad.angle ?? 0}deg, ${stopStr})`;
        }
        return `radial-gradient(ellipse at center, ${stopStr})`;
    }

    private buildPatternCss(pat: PptxPatternFill): string {
        const fg = pat.fgColor;
        const bg = pat.bgColor;
        const preset = pat.preset;

        if (preset.startsWith('pct')) {
            const pct = Number.parseInt(preset.replace('pct', ''), 10);
            const size = Math.max(4, Math.round(20 - pct / 6));
            return `background-color:${bg};background-image:radial-gradient(circle, ${fg} 1px, transparent 1px);background-size:${size}px ${size}px`;
        }

        return this.buildPatternCssForPreset(preset, fg, bg);
    }

    private buildPatternCssForPreset(preset: string, fg: string, bg: string): string {
        switch (preset) {
            case 'horz':
            case 'ltHorz':
            case 'narHorz':
                return `background-color:${bg};background-image:repeating-linear-gradient(0deg,${fg},${fg} 1px,transparent 1px,transparent 8px)`;
            case 'dkHorz':
                return `background-color:${bg};background-image:repeating-linear-gradient(0deg,${fg},${fg} 2px,transparent 2px,transparent 6px)`;
            case 'vert':
            case 'ltVert':
            case 'narVert':
                return `background-color:${bg};background-image:repeating-linear-gradient(90deg,${fg},${fg} 1px,transparent 1px,transparent 8px)`;
            case 'dkVert':
                return `background-color:${bg};background-image:repeating-linear-gradient(90deg,${fg},${fg} 2px,transparent 2px,transparent 6px)`;
            case 'dnDiag':
            case 'ltDnDiag':
                return `background-color:${bg};background-image:repeating-linear-gradient(45deg,${fg},${fg} 1px,transparent 1px,transparent 8px)`;
            case 'upDiag':
            case 'ltUpDiag':
                return `background-color:${bg};background-image:repeating-linear-gradient(135deg,${fg},${fg} 1px,transparent 1px,transparent 8px)`;
            case 'dkDnDiag':
                return `background-color:${bg};background-image:repeating-linear-gradient(45deg,${fg},${fg} 2px,transparent 2px,transparent 6px)`;
            case 'dkUpDiag':
                return `background-color:${bg};background-image:repeating-linear-gradient(135deg,${fg},${fg} 2px,transparent 2px,transparent 6px)`;
            case 'cross':
            case 'smGrid':
            case 'lgGrid':
                return `background-color:${bg};background-image:repeating-linear-gradient(0deg,${fg},${fg} 1px,transparent 1px,transparent 8px),repeating-linear-gradient(90deg,${fg},${fg} 1px,transparent 1px,transparent 8px)`;
            case 'diagCross':
                return `background-color:${bg};background-image:repeating-linear-gradient(45deg,${fg},${fg} 1px,transparent 1px,transparent 8px),repeating-linear-gradient(135deg,${fg},${fg} 1px,transparent 1px,transparent 8px)`;
            default:
                return `background-color:${bg};background-image:repeating-linear-gradient(45deg,${fg},${fg} 1px,transparent 1px,transparent 8px)`;
        }
    }

    private buildEffectsCss(effects: PptxEffects, context: 'text' | 'shape'): string[] {
        const result: string[] = [];
        const filters: string[] = [];

        if (effects.outerShadow) {
            const s = effects.outerShadow;
            if (context === 'text') {
                result.push(`text-shadow:${s.offsetX}px ${s.offsetY}px ${s.blur}px ${s.color}`);
            } else {
                result.push(`box-shadow:${s.offsetX}px ${s.offsetY}px ${s.blur}px ${s.color}`);
            }
        }

        if (effects.innerShadow && context === 'shape') {
            const s = effects.innerShadow;
            result.push(`box-shadow:inset ${s.offsetX}px ${s.offsetY}px ${s.blur}px ${s.color}`);
        }

        if (effects.glow) {
            if (context === 'text') {
                filters.push(`drop-shadow(0 0 ${effects.glow.radius}px ${effects.glow.color})`);
            } else {
                result.push(`box-shadow:0 0 ${effects.glow.radius}px ${effects.glow.color}`);
            }
        }

        if (effects.blur) filters.push(`blur(${effects.blur}px)`);
        if (effects.softEdge) {
            result.push(`mask-image:radial-gradient(ellipse, black ${Math.max(0, 100 - effects.softEdge)}%, transparent 100%)`);
        }
        if (effects.reflection) {
            const r = effects.reflection;
            result.push(`-webkit-box-reflect:below ${r.distance}px linear-gradient(transparent, rgba(0,0,0,${r.startOpacity}))`);
        }
        if (filters.length > 0) result.push(`filter:${filters.join(' ')}`);

        return result;
    }

    private buildUnderlineCss(uStyle: PptxUnderlineStyle): string[] {
        const result: string[] = ['text-decoration-line:underline'];
        if (uStyle.color) result.push(`text-decoration-color:${uStyle.color}`);
        if (uStyle.width) result.push(`text-decoration-thickness:${uStyle.width}pt`);

        if (uStyle.compound === 'dbl' || uStyle.compound === 'tri') {
            result.push('text-decoration-style:double');
        } else if (uStyle.dashStyle) {
            result.push(`text-decoration-style:${this.mapDashToDecorationStyle(uStyle.dashStyle)}`);
        }

        return result;
    }

    private mapDashToDecorationStyle(dashStyle: string): string {
        switch (dashStyle) {
            case 'dot':
            case 'sysDot': return 'dotted';
            case 'dash':
            case 'sysDash':
            case 'lgDash':
            case 'dashDot':
            case 'lgDashDot':
            case 'sysDashDot': return 'dashed';
            default: return 'solid';
        }
    }

    private renderTabContent(text: string, tabs?: ReadonlyArray<PptxTabStop>, defaultTabSize?: number): string {
        if (!text.includes('\t')) return this.escapeHtml(text);

        const parts = text.split('\t');
        let result = this.escapeHtml(parts[0]);

        for (let i = 1; i < parts.length; i++) {
            if (tabs && tabs.length >= i) {
                const tab = tabs[i - 1];
                const alignMap: Record<string, string> = { r: 'right', ctr: 'center' };
                const align = alignMap[tab.alignment ?? ''] ?? 'left';
                result += `<span style="display:inline-block;min-width:${tab.position}px;text-align:${align}"></span>`;
            } else {
                const tabWidth = defaultTabSize ?? 48;
                result += `<span style="display:inline-block;width:${tabWidth}px"></span>`;
            }
            result += this.escapeHtml(parts[i]);
        }

        return result;
    }

    private mapSlideAlignment(alignment: string): string {
        switch (alignment) {
            case 'ctr': return 'center';
            case 'r': return 'right';
            case 'just': return 'justify';
            default: return 'left';
        }
    }

    private processText(bytes: Uint8Array): void {
        this.textContent.set(new TextDecoder().decode(bytes));
    }

    private processMedia(bytes: Uint8Array, mimeType = 'application/octet-stream'): void {
        const effectiveMime = mimeType || 'application/octet-stream';
        const blob = new Blob([bytes as BlobPart], { type: effectiveMime });
        const url = URL.createObjectURL(blob);
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
