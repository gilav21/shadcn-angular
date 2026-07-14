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
    dragHasSupportedDocument,
    isPdfHeader,
    isSupportedDocumentFile,
    isZipHeader,
} from './rich-text-file-import.utils';

const FILE_IMPORT_SLOT_ID = 'file-import.import';
const ERROR_DISMISS_MS = 4000;

/**
 * Opt-in file-import addon for `<ui-rich-text-editor>`. Attaches via DI to the
 * `RichTextEditorAddonHost` the base provides and owns the whole DOCX/PDF import
 * feature: the toolbar import button (a hidden `.pdf,.docx` picker), drag-and-drop
 * of a document onto the editor, the lazy-loaded `docx`/`pdf` parsers, and the
 * busy/error overlay. The base editor ships no import UI or parser code; every
 * import control is opt-in through this directive.
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
@Directive({
    selector: 'ui-rich-text-editor[uiRteFileImport]',
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
    /** `accept` attribute for the file picker and drop filter. */
    readonly uiRteFileImportAccept = input('.pdf,.docx');

    /** Emits the `File` when an import begins. */
    readonly fileImportStart = output<File>();
    /** Emits the inserted HTML when an import completes. */
    readonly fileImportComplete = output<string>();
    /** Emits an error message when an import fails. */
    readonly fileImportError = output<string>();

    private readonly i18n = createLocaleBindings(this.uiRteFileImportLocale, RICH_TEXT_FILE_IMPORT_LOCALES);
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

    // ── Toolbar slot ──────────────────────────────────────────────────

    private registerToolbarSlot(): void {
        const context: RichTextFileImportButtonContext = {
            locale: computed(() => this.i18n.t()),
            accept: computed(() => this.uiRteFileImportAccept()),
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

    // ── Drop seams ────────────────────────────────────────────────────

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

    // ── Import pipeline ───────────────────────────────────────────────

    private async importFile(file: File): Promise<void> {
        if (!this.uiRteFileImport() || this.host.readonly() || this.host.disabled()) return;
        this.host.flushPendingHistoryPush();

        const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
        const isZip = isZipHeader(header);
        const isPdf = isPdfHeader(header);
        if (!isZip && !isPdf) {
            this.reportError(this.i18n.t().importInvalidFile);
            return;
        }
        await this.runImport(file, isZip);
    }

    private async runImport(file: File, isZip: boolean): Promise<void> {
        this.importing.set(true);
        this.fileImportStart.emit(file);
        try {
            if (isZip) {
                await this.importDocx(file);
            } else {
                await this.importPdf(file);
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : this.i18n.t().importFailed;
            this.reportError(message);
        } finally {
            this.importing.set(false);
        }
    }

    private async importDocx(file: File): Promise<void> {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const { parseDocx } = await import('../../../../lib/parsers/docx-parser');
        const { renderDocxForEditor } = await import('../../../../lib/parsers/docx-to-editor-html');
        const html = renderDocxForEditor(parseDocx(bytes));
        this.insertImported(html);
    }

    private async importPdf(file: File): Promise<void> {
        const buffer = await file.arrayBuffer();
        const { parsePdf } = await import('../../../../lib/parsers/pdf-parser');
        const result = await parsePdf(buffer);
        this.insertImported(result.html);
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

    // ── Overlay mount ─────────────────────────────────────────────────

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
