import {
    Directive,
    DestroyRef,
    Injector,
    ViewContainerRef,
    afterNextRender,
    computed,
    effect,
    inject,
    input,
    output,
    signal,
    type ComponentRef,
} from '@angular/core';
import { RichTextEditorAddonHost } from '../..';
import { createLocaleBindings, type LocaleInput } from '../../../../lib/i18n';
import {
    RICH_TEXT_FILE_IMPORT_LOCALES,
    type RichTextFileImportLocale,
} from './rich-text-file-import.locales';
import {
    RICH_TEXT_FILE_IMPORT_BUTTON_CONTEXT,
    type RichTextFileImportButtonContext,
} from './rich-text-file-import.context';
import { RichTextFileImportButtonComponent } from './rich-text-file-import-button.component';
import { RichTextFileImportOverlayComponent } from './rich-text-file-import-overlay.component';
import {
    DOCUMENT_IMPORT_ACCEPT,
    HEADER_BYTES,
    IMAGE_IMPORT_ACCEPT,
    classifyImport,
    dragHasSupportedDocument,
    isSupportedDocumentFile,
    simpleHash,
    type DocumentImportKind,
} from './rich-text-file-import.utils';

const FILE_IMPORT_SLOT_ID = 'file-import.import';
const ERROR_DISMISS_MS = 4000;

/**
 * Opt-in file-import addon for `<ui-rich-text-editor>`. Attaches via DI to the
 * `RichTextEditorAddonHost` the base provides and owns the whole document import
 * feature: the toolbar import button (a hidden picker), drag-and-drop of a
 * document onto the editor, the lazy-loaded `docx`/`pdf` parsers, and the
 * busy/error overlay. The base editor ships no import UI or parser code; every
 * import control is opt-in through this directive.
 *
 * When an addon owns image files (the images addon), the picker additionally
 * offers PNG/JPEG/GIF/WEBP and hands a picked image straight to that addon's
 * pipeline through the host's `insertImageFile` — this addon never inserts an
 * image itself, so an image picked here behaves exactly like one pasted or
 * dropped. Without that addon the picker offers documents only. Image
 * drag-and-drop and paste are likewise not handled here; see
 * {@link IMAGE_IMPORT_ACCEPT} for why the drop path differs.
 *
 * Parsed HTML lands at the saved caret through the host's `insertHtmlAtCaret`
 * (one history entry, re-sanitized) after `restoreSelection`, reproducing the
 * former built-in exactly. The drop path diverts through the host's
 * `registerDropInterceptor` / `registerDropZonePredicate` seams so the drag
 * highlight and drop both come from the addon. Strings resolve from
 * `[uiRteFileImportLocale]` (a registry key or a full dictionary) or the app-wide
 * `UI_LOCALE_ID` token — NOT the editor's own `[locale]` input.
 *
 * ```html
 * <ui-rich-text-editor uiRteFileImport />
 * ```
 */
/**
 * Largest file the addon will read into memory. Generous on purpose: real
 * documents with embedded images run to tens of megabytes, so this exists to
 * stop the pathological case, not to police ordinary files.
 */
const MAX_IMPORT_BYTES = 100 * 1024 * 1024;

/** Signals a file rejected on size, whose message is already user-facing. */
class ImportTooLargeError extends Error {}

/** How many imported-PDF font stylesheets may accumulate in the document. */
const MAX_PDF_FONT_STYLES = 12;

@Directive({
    selector: 'ui-rich-text-editor[uiRteFileImport], ui-rich-text-editor[uiRteFull]',
    standalone: true,
})
export class RichTextFileImportDirective {
    private readonly host = inject(RichTextEditorAddonHost);
    private readonly injector = inject(Injector);
    private readonly vcr = inject(ViewContainerRef);

    /** Locale for the addon UI: a registry key (`'en'`/`'he'`/…) or a full dictionary. */
    readonly uiRteFileImportLocale = input<LocaleInput<RichTextFileImportLocale>>();
    /** Master toggle for the whole import feature (default true). */
    readonly uiRteFileImport = input(true, { transform: coerceEnabled });
    /** Sort order of the import button among addon toolbar slots; lower first. */
    readonly uiRteFileImportOrder = input(340);
    /** Contribute the toolbar button (default true). */
    readonly uiRteFileImportToolbar = input(true);
    /**
     * `accept` attribute for the toolbar file picker. Leave unset to accept the
     * document formats plus, when an addon owns image files, the image formats
     * too. Drag-and-drop stays documents-only regardless of this value — see
     * {@link IMAGE_IMPORT_ACCEPT}.
     */
    readonly uiRteFileImportAccept = input<string>();

    /** Emits the `File` when an import begins. */
    readonly fileImportStart = output<File>();
    /** Emits the inserted HTML when an import completes. */
    readonly fileImportComplete = output<string>();
    /** Emits an error message when an import fails. */
    readonly fileImportError = output<string>();

    private readonly i18n = createLocaleBindings(this.uiRteFileImportLocale, RICH_TEXT_FILE_IMPORT_LOCALES);

    /**
     * Image types appear only while an addon owns image files, so the picker
     * can never offer an image the editor has no pipeline to insert.
     */
    private readonly accept = computed(() => this.uiRteFileImportAccept()
        ?? (this.host.hasImageFileHandler()
            ? `${DOCUMENT_IMPORT_ACCEPT},${IMAGE_IMPORT_ACCEPT}`
            : DOCUMENT_IMPORT_ACCEPT));
    private readonly viewReady = signal(false);

    private readonly importing = signal(false);
    private readonly errorMessage = signal('');
    private errorTimer: ReturnType<typeof setTimeout> | null = null;

    private overlayRef?: ComponentRef<RichTextFileImportOverlayComponent>;

    constructor() {
        afterNextRender(() => this.viewReady.set(true));
        this.registerToolbarSlot();
        this.registerDropSeams();
        this.mountOverlay();
        inject(DestroyRef).onDestroy(() => this.teardown());
    }


    private registerToolbarSlot(): void {
        const context: RichTextFileImportButtonContext = {
            locale: computed(() => this.i18n.t()),
            accept: this.accept,
            onImport: (file) => void this.importFile(file),
        };
        const slotInjector = Injector.create({
            providers: [{ provide: RICH_TEXT_FILE_IMPORT_BUTTON_CONTEXT, useValue: context }],
            parent: this.injector,
        });
        effect((onCleanup) => {
            if (!this.uiRteFileImport() || !this.uiRteFileImportToolbar()) return;
            onCleanup(this.host.toolbarSlots.register({
                id: FILE_IMPORT_SLOT_ID,
                order: this.uiRteFileImportOrder(),
                component: RichTextFileImportButtonComponent,
                injector: slotInjector,
            }));
        });
    }


    private registerDropSeams(): void {
        effect((onCleanup) => {
            onCleanup(this.host.registerDropInterceptor((event) => this.onDrop(event)));
        });
        effect((onCleanup) => {
            onCleanup(this.host.registerDropZonePredicate((event) => this.canAcceptDrag(event)));
        });
    }

    private onDrop(event: DragEvent): boolean {
        if (!this.uiRteFileImport()) return false;
        const file = Array.from(event.dataTransfer?.files ?? []).find(isSupportedDocumentFile);
        if (!file) return false;
        event.preventDefault();
        void this.importFile(file);
        return true;
    }

    private canAcceptDrag(event: DragEvent): boolean {
        return this.uiRteFileImport() && dragHasSupportedDocument(event.dataTransfer);
    }


    private async importFile(file: File): Promise<void> {
        if (!this.uiRteFileImport() || this.host.readonly() || this.host.isDisabled()) return;
        this.host.flushPendingHistoryPush();

        const header = new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer());
        const kind = classifyImport(header);
        if (!kind) {
            this.reportError(this.i18n.t().importInvalidFile);
            return;
        }
        if (kind.type === 'image') {
            this.routeImage(file);
            return;
        }
        await this.runImport(file, kind);
    }

    /**
     * An image is not parsed here at all: it goes to whichever addon owns image
     * files, so a picked image takes the identical path to a pasted or dropped
     * one — configured uploader, default width/height/alignment, resizer
     * wiring, and the image upload outputs (this addon's own import outputs
     * stay quiet, since no import happened).
     */
    private routeImage(file: File): void {
        if (this.host.insertImageFile(file)) return;
        this.reportError(this.i18n.t().importInvalidFile);
    }

    private async runImport(file: File, kind: DocumentImportKind): Promise<void> {
        this.importing.set(true);
        this.fileImportStart.emit(file);
        try {
            if (kind.type === 'docx') {
                await this.importDocx(file);
            } else {
                await this.importPdf(file);
            }
        } catch (error: unknown) {
            // Parser exceptions read like "Cannot find end of central directory"
            // — accurate for a developer, meaningless to the person who just
            // picked a file, and untranslated in every locale. Show the localized
            // message and keep the technical one for the console.
            if (error instanceof ImportTooLargeError) {
                this.reportError(error.message);
            } else {
                if (error instanceof Error) console.error('[rich-text-editor] file import failed', error);
                this.reportError(this.i18n.t().importFailed);
            }
        } finally {
            this.importing.set(false);
        }
    }

    /**
     * Refuse a file too large to read into memory.
     *
     * The parsers bound their own DECOMPRESSED output, but nothing bounded the
     * input: `file.arrayBuffer()` buffers the whole thing first, so a multi-GB
     * pick could exhaust memory before any of those ceilings applied. The limit
     * is deliberately generous — real documents with embedded media are large —
     * it exists to stop the pathological case, not to police normal files.
     */
    private assertImportableSize(file: File): void {
        if (file.size > MAX_IMPORT_BYTES) {
            throw new ImportTooLargeError(this.i18n.t().importTooLarge);
        }
    }

    private async importDocx(file: File): Promise<void> {
        this.assertImportableSize(file);
        const bytes = new Uint8Array(await file.arrayBuffer());
        const { parseDocx } = await import('../../../../lib/parsers/docx-parser');
        const { renderDocxForEditor } = await import('../../../../lib/parsers/docx-to-editor-html');
        const html = renderDocxForEditor(parseDocx(bytes));
        this.insertImported(html);
    }

    private async importPdf(file: File): Promise<void> {
        this.assertImportableSize(file);
        const buffer = await file.arrayBuffer();
        const { parsePdfReadable } = await import('../../../../lib/parsers/pdf-readable/pdf-readable');
        const result = await parsePdfReadable(buffer);
        if (result.html.trim() && result.fontFaceCss) this.injectFontCss(result.fontFaceCss);
        this.insertImported(this.atDesignMeasure(result.html, result.pageWidthPt));
    }

    /**
     * The PDF's layout geometry (floats, anchored panels, pt indents) assumes
     * the page's own measure; in a narrower editor the constraints would
     * squeeze flow content into slivers. Wrapping the import at the design
     * measure lets the editor scroll horizontally instead — like any document
     * wider than its window.
     */
    private atDesignMeasure(html: string, pageWidthPt: number): string {
        if (!pageWidthPt || pageWidthPt <= 0) return html;
        return `<div style="min-width:${Math.round(pageWidthPt)}pt">${html}</div>`;
    }

    /**
     * Embedded PDF fonts arrive as `@font-face` CSS that cannot travel inside
     * the sanitized editor HTML (`<style>` tags are stripped), so it is
     * injected into `document.head` instead. Deduped by content hash and
     * intentionally never removed on destroy — the imported text outlives this
     * directive and would lose its fonts, so tearing these down with the
     * component would break already-imported documents.
     *
     * They are capped instead: a session importing many PDFs would otherwise
     * accumulate style elements without bound. The oldest are dropped first,
     * which at worst falls back to a default face on the least recent import.
     */
    private injectFontCss(css: string): void {
        const hash = `${css.length.toString(36)}-${simpleHash(css)}`;
        const doc = this.host.overlayAnchor.ownerDocument;
        if (doc.head.querySelector(`style[data-ui-rte-pdf-fonts="${hash}"]`)) return;
        const style = doc.createElement('style');
        style.dataset['uiRtePdfFonts'] = hash;
        style.textContent = css;
        doc.head.appendChild(style);

        const injected = doc.head.querySelectorAll('style[data-ui-rte-pdf-fonts]');
        for (let i = 0; i < injected.length - MAX_PDF_FONT_STYLES; i++) {
            injected[i].remove();
        }
    }

    private insertImported(html: string): void {
        if (!html.trim()) {
            this.reportError(this.i18n.t().importFailed);
            return;
        }
        this.host.restoreSelection();
        this.host.insertHtmlAtCaret(html);
        this.fileImportComplete.emit(html);
    }

    private reportError(message: string): void {
        this.fileImportError.emit(message);
        this.errorMessage.set(message);
        if (this.errorTimer) clearTimeout(this.errorTimer);
        this.errorTimer = setTimeout(() => this.errorMessage.set(''), ERROR_DISMISS_MS);
    }


    private mountOverlay(): void {
        effect(() => {
            if (!this.viewReady()) return;
            if (!this.overlayRef) this.createOverlay();
            this.syncOverlayInputs();
        });
    }

    private createOverlay(): void {
        const ref = this.vcr.createComponent(RichTextFileImportOverlayComponent, { injector: this.injector });
        this.host.overlayAnchor.appendChild(ref.location.nativeElement);
        this.overlayRef = ref;
    }

    private syncOverlayInputs(): void {
        const ref = this.overlayRef;
        if (!ref) return;
        ref.setInput('locale', this.i18n.t());
        ref.setInput('importing', this.importing());
        ref.setInput('errorMessage', this.errorMessage());
        ref.changeDetectorRef.markForCheck();
    }

    private teardown(): void {
        if (this.errorTimer) clearTimeout(this.errorTimer);
        this.errorTimer = null;
        this.overlayRef?.destroy();
        this.overlayRef = undefined;
    }
}

/** Coerce the bare `uiRteFileImport` attribute (empty string) to `true`. */
function coerceEnabled(value: boolean | string | undefined): boolean {
    return value === '' || value === true || value === undefined;
}
