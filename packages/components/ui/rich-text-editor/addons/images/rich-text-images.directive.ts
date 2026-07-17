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
import { DOCUMENT } from '@angular/common';
import { firstValueFrom, from, type Observable, type Subscription } from 'rxjs';
import {
    RichTextEditorAddonHost,
    RichTextSanitizerService,
    RichTextPasteNormalizerService,
} from '../..';
import { isValidImageDataUrl } from '../../../../lib/parsers/image-validator';
import { createLocaleBindings, type LocaleInput } from '../../../../lib/i18n';
import {
    RICH_TEXT_IMAGES_LOCALES,
    type RichTextImagesLocale,
} from './rich-text-images.locales';
import {
    RICH_TEXT_IMAGES_BUTTON_CONTEXT,
    type RichTextImagesButtonContext,
    type RichTextImageSources,
} from './rich-text-images.context';
import { RichTextImagesButtonComponent } from './rich-text-images-button.component';
import {
    RichTextImagesOverlayComponent,
    type ImageUploadErrorEntry,
} from './rich-text-images-overlay.component';
import type { RichTextImageResizerLabels } from './rich-text-images-resizer.component';
import {
    type ImageAlignment,
    type ImageInsertDefaults,
    TRANSPARENT_PIXEL,
    createImageElement,
    placeImageAtSelection,
    dataUrlToFile,
    readFileAsDataUrl,
} from './rich-text-images.utils';

const IMAGE_SLOT_ID = 'images.insert';
const AUTO_UPLOAD_STYLE_ID = 'ui-rte-auto-upload-styles';
const AUTO_UPLOAD_STYLES = `
    @keyframes ui-auto-upload-shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
    }
    img[data-auto-upload-status="uploading"] {
        background: linear-gradient(90deg, hsl(var(--muted)) 25%, hsl(var(--muted-foreground) / 0.1) 50%, hsl(var(--muted)) 75%);
        background-size: 200% 100%;
        animation: ui-auto-upload-shimmer 1.5s ease-in-out infinite;
        border-radius: 0.375rem;
    }
    img[data-auto-upload-status="error"] {
        opacity: 0.4;
        border: 2px dashed hsl(var(--destructive));
        border-radius: 0.375rem;
    }
`;

interface AutoUploadPending {
    readonly subscription: Subscription;
    readonly dataUrl: string;
}

/**
 * Opt-in images addon for `<ui-rich-text-editor>`. Attaches via DI to the
 * `RichTextEditorAddonHost` the base provides and owns the whole image feature:
 * the toolbar image button + insert popover, image paste and drag-and-drop, the
 * upload pipeline (`uiRteImagesUploader` + `uiRteImagesAutoUpload`), and the
 * resize/align overlay on a selected image. The base editor keeps only
 * content-level image support (sanitizer + markdown); every image control is
 * opt-in through this directive.
 *
 * Inserts route through the host transaction (`mutateContent`) after the base
 * sanitizer validates the source, so an unsafe URL is rejected exactly as the
 * former built-in did. Paste/drop divert through the host's paste/drop
 * interceptor seams; the resize overlay mounts in the host's positioned
 * container. Strings resolve from `[uiRteImagesLocale]` (a registry key or a
 * full dictionary) or the app-wide `UI_LOCALE_ID` token — NOT the editor's own
 * `[locale]` input.
 *
 * ```html
 * <ui-rich-text-editor uiRteImages [uiRteImagesUploader]="upload" />
 * ```
 */
@Directive({
    selector: 'ui-rich-text-editor[uiRteImages], ui-rich-text-editor[uiRteFull]',
    standalone: true,
})
export class RichTextImagesDirective {
    private readonly host = inject(RichTextEditorAddonHost);
    private readonly sanitizer = inject(RichTextSanitizerService);
    private readonly pasteNormalizer = inject(RichTextPasteNormalizerService);
    private readonly injector = inject(Injector);
    private readonly vcr = inject(ViewContainerRef);
    private readonly document = inject(DOCUMENT);

    /** Locale for the addon UI: a registry key (`'en'`/`'he'`/…) or a full dictionary. */
    readonly uiRteImagesLocale = input<LocaleInput<RichTextImagesLocale>>();
    /** Master toggle for the whole image feature (default true). */
    readonly uiRteImages = input(true, { transform: coerceEnabled });
    /** Sort order of the image button among addon toolbar slots. */
    readonly uiRteImagesOrder = input(325);
    /** Contribute the toolbar button (default true). */
    readonly uiRteImagesToolbar = input(true);
    /** Custom upload handler; returns an `Observable<string>` of the final URL. */
    readonly uiRteImagesUploader = input<((file: File) => Observable<string>) | undefined>(undefined);
    /** Auto-upload base64 images pasted/typed into the editor. */
    readonly uiRteImagesAutoUpload = input(false);
    /** Which sources the insert popover offers. */
    readonly uiRteImagesSources = input<RichTextImageSources>('all');
    /** Allow drag-resizing inserted images. */
    readonly uiRteImagesResize = input(true);
    /** Show the alignment buttons on a selected image. */
    readonly uiRteImagesAlignment = input(true);
    /** Default width applied to every inserted image. */
    readonly uiRteImagesDefaultWidth = input<number | string>();
    /** Default height applied to every inserted image. */
    readonly uiRteImagesDefaultHeight = input<number | string>();
    /** Alignment applied to every inserted image. */
    readonly uiRteImagesDefaultAlignment = input<ImageAlignment>('inline');
    /** Lower clamp (px) for drag-resizing. */
    readonly uiRteImagesMinWidth = input(20);
    /** Upper clamp (px) for drag-resizing. No ceiling when unset. */
    readonly uiRteImagesMaxWidth = input<number>();
    /** Keep aspect ratio locked while resizing. */
    readonly uiRteImagesLockAspectRatio = input(true);

    /** Emits the `File` when an image upload begins. */
    readonly imageUploadStart = output<File>();
    /** Emits the final URL when an image upload completes. */
    readonly imageUploadComplete = output<string>();
    /** Emits an error message when an image upload fails. */
    readonly imageUploadError = output<string>();
    /** Emits the final URL when a base64 auto-upload completes. */
    readonly autoImageUploadComplete = output<string>();
    /** Emits an error message when a base64 auto-upload fails. */
    readonly autoImageUploadError = output<string>();

    private readonly i18n = createLocaleBindings(this.uiRteImagesLocale, RICH_TEXT_IMAGES_LOCALES);
    private readonly viewReady = signal(false);

    private readonly selectedImage = signal<HTMLImageElement | null>(null);
    private readonly uploading = signal(false);
    private readonly autoUploadErrors =
        signal<Map<string, { dataUrl: string; imgElement: HTMLImageElement }>>(new Map());

    private readonly autoUploadMap = new Map<string, AutoUploadPending>();
    private autoUploadCounter = 0;
    private autoUploadMutating = false;
    private autoUploadObserver: MutationObserver | null = null;

    private overlayRef?: ComponentRef<RichTextImagesOverlayComponent>;

    private readonly resizerLabels = computed<RichTextImageResizerLabels>(() => {
        const l = this.i18n.t();
        return {
            inline: l.inline,
            floatLeft: l.floatLeft,
            center: l.center,
            floatRight: l.floatRight,
            deleteImage: l.deleteImage,
        };
    });

    private readonly errorEntries = computed<ImageUploadErrorEntry[]>(() => {
        const errors = this.autoUploadErrors();
        const container = this.host.contentRoot;
        if (!container || errors.size === 0) return [];
        const cRect = container.getBoundingClientRect();
        const entries: ImageUploadErrorEntry[] = [];
        errors.forEach((entry, id) => {
            if (!entry.imgElement.isConnected) return;
            const r = entry.imgElement.getBoundingClientRect();
            entries.push({
                id,
                top: r.top - cRect.top,
                left: r.left - cRect.left,
                width: Math.max(r.width, 120),
                height: Math.max(r.height, 80),
            });
        });
        return entries;
    });

    private readonly clickProbe = (event: Event): void => this.onContentClick(event);

    constructor() {
        afterNextRender(() => this.viewReady.set(true));
        this.registerToolbarSlot();
        this.registerPasteSeam();
        this.registerDropSeams();
        this.registerClickProbe();
        this.registerAutoUpload();
        this.mountOverlay();
        inject(DestroyRef).onDestroy(() => this.teardown());
    }

    // ── Source gating ─────────────────────────────────────────────────

    private canUseUpload(): boolean {
        const s = this.uiRteImagesSources();
        return s === 'all' || s === 'upload';
    }

    private canUseUrl(): boolean {
        const s = this.uiRteImagesSources();
        return s === 'all' || s === 'url';
    }

    private insertDefaults(): ImageInsertDefaults {
        return {
            width: this.uiRteImagesDefaultWidth(),
            height: this.uiRteImagesDefaultHeight(),
            alignment: this.uiRteImagesDefaultAlignment(),
        };
    }

    // ── Toolbar slot ──────────────────────────────────────────────────

    private registerToolbarSlot(): void {
        const context: RichTextImagesButtonContext = {
            locale: computed(() => this.i18n.t()),
            sources: computed(() => this.uiRteImagesSources()),
            onOpen: () => this.host.saveSelection(),
            onInsertUrl: (url, alt) => this.insertFromUrl(url, alt),
            onUploadFile: (file) => void this.insertImageFile(file),
        };
        const slotInjector = Injector.create({
            providers: [{ provide: RICH_TEXT_IMAGES_BUTTON_CONTEXT, useValue: context }],
            parent: this.injector,
        });
        effect((onCleanup) => {
            if (!this.uiRteImages() || !this.uiRteImagesToolbar()) return;
            onCleanup(this.host.toolbarSlots.register({
                id: IMAGE_SLOT_ID,
                order: this.uiRteImagesOrder(),
                component: RichTextImagesButtonComponent,
                injector: slotInjector,
            }));
        });
    }

    // ── Paste / drop seams ────────────────────────────────────────────

    private registerPasteSeam(): void {
        effect((onCleanup) => {
            onCleanup(this.host.registerPasteInterceptor((event) => this.onPaste(event)));
        });
    }

    private registerDropSeams(): void {
        effect((onCleanup) => {
            onCleanup(this.host.registerDropInterceptor((event) => this.onDrop(event)));
        });
        effect((onCleanup) => {
            onCleanup(this.host.registerDropZonePredicate(() => this.canAcceptDrag()));
        });
    }

    private onPaste(event: ClipboardEvent): boolean {
        if (!this.uiRteImages()) return false;
        const imageFile = Array.from(event.clipboardData?.files ?? [])
            .find((f) => f.type.startsWith('image/'));
        if (!imageFile) return false;
        const html = event.clipboardData?.getData('text/html') ?? null;
        const text = event.clipboardData?.getData('text/plain') ?? '';
        if (this.pasteNormalizer.detectSource(html, text) === 'excel') return false;
        void this.insertImageFile(imageFile);
        return true;
    }

    private onDrop(event: DragEvent): boolean {
        if (!this.canAcceptDrag()) return false;
        const imageFile = Array.from(event.dataTransfer?.files ?? [])
            .find((f) => f.type.startsWith('image/'));
        if (!imageFile) return false;
        event.preventDefault();
        void this.insertImageFile(imageFile);
        return true;
    }

    private canAcceptDrag(): boolean {
        return this.uiRteImages() && (this.canUseUpload() || this.canUseUrl());
    }

    // ── Insert / upload ───────────────────────────────────────────────

    private insertFromUrl(url: string, alt: string): void {
        const safe = this.sanitizer.sanitizeImageSrc(url);
        if (safe) {
            this.doInsert(safe, alt);
        } else {
            this.imageUploadError.emit('Invalid image URL.');
        }
    }

    private doInsert(safeSrc: string, alt: string): void {
        this.host.restoreSelection();
        this.host.mutateContent((root) => {
            const doc = root.ownerDocument;
            const img = createImageElement(doc, safeSrc, alt, this.insertDefaults());
            placeImageAtSelection(doc, root, img);
        });
    }

    private async insertImageFile(file: File): Promise<void> {
        const uploader = this.uiRteImagesUploader();
        if (this.canUseUpload() && uploader) {
            await this.uploadImageFile(file, uploader);
            return;
        }
        if (this.canUseUrl()) {
            await this.insertImageAsDataUrl(file);
            return;
        }
        if (this.canUseUpload() && !uploader) {
            this.imageUploadError.emit('No imageUploader configured.');
        }
    }

    private async insertImageAsDataUrl(file: File): Promise<void> {
        try {
            const dataUrl = await readFileAsDataUrl(file);
            if (!dataUrl.toLowerCase().startsWith('data:image/')) {
                this.imageUploadError.emit('Pasted image is not allowed by sanitizer policy.');
                return;
            }
            this.doInsert(dataUrl, file.name);
            this.imageUploadComplete.emit(dataUrl);
        } catch {
            this.imageUploadError.emit('Could not read image file.');
        }
    }

    private async uploadImageFile(file: File, uploader: (file: File) => Observable<string>): Promise<void> {
        this.uploading.set(true);
        this.imageUploadStart.emit(file);
        try {
            const uploadedUrl = await firstValueFrom(uploader(file));
            const safeSrc = this.sanitizer.sanitizeImageSrc(uploadedUrl);
            if (!safeSrc) {
                this.imageUploadError.emit('Uploaded image URL is not allowed by sanitizer policy.');
                return;
            }
            this.doInsert(safeSrc, file.name);
            this.imageUploadComplete.emit(safeSrc);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : undefined;
            this.imageUploadError.emit(message ?? 'Image upload failed.');
        } finally {
            this.uploading.set(false);
        }
    }

    // ── Selected-image tracking ───────────────────────────────────────

    private registerClickProbe(): void {
        effect((onCleanup) => {
            if (!this.viewReady()) return;
            const root = this.host.contentRoot;
            root.addEventListener('click', this.clickProbe);
            onCleanup(() => root.removeEventListener('click', this.clickProbe));
        });
    }

    private onContentClick(event: Event): void {
        if (!this.uiRteImages()) {
            this.selectedImage.set(null);
            return;
        }
        const target = event.target as HTMLElement;
        this.selectedImage.set(target.tagName === 'IMG' ? (target as HTMLImageElement) : null);
    }

    private onResizeEnd(): void {
        this.host.mutateContent(() => { /* size already applied live; record one entry */ });
    }

    private onAlignmentChange(): void {
        this.host.mutateContent(() => { /* alignment already applied live; record one entry */ });
    }

    private onImageRemove(img: HTMLImageElement): void {
        this.host.mutateContent(() => img.remove());
        this.selectedImage.set(null);
    }

    // ── Auto-upload pipeline ──────────────────────────────────────────

    private registerAutoUpload(): void {
        effect((onCleanup) => {
            if (!this.viewReady()) return;
            const enabled = this.uiRteImages() && this.uiRteImagesAutoUpload();
            if (!enabled) return;
            this.injectAutoUploadStyles();
            const editor = this.host.contentRoot;
            const observer = new MutationObserver(() => {
                if (this.autoUploadMutating) return;
                this.scanForBase64Images();
            });
            observer.observe(editor, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['src'],
            });
            this.autoUploadObserver = observer;
            this.scanForBase64Images();
            onCleanup(() => {
                observer.disconnect();
                this.autoUploadObserver = null;
            });
        });
    }

    private injectAutoUploadStyles(): void {
        if (this.document.getElementById(AUTO_UPLOAD_STYLE_ID)) return;
        const style = this.document.createElement('style');
        style.id = AUTO_UPLOAD_STYLE_ID;
        style.textContent = AUTO_UPLOAD_STYLES;
        this.document.head.appendChild(style);
    }

    private scanForBase64Images(): void {
        if (!this.uiRteImagesUploader() || this.host.disabled() || this.host.readonly()) return;
        const editor = this.host.contentRoot;
        if (!editor) return;
        for (const img of Array.from(editor.querySelectorAll('img'))) {
            const src = img.getAttribute('src') ?? '';
            if (src.startsWith('data:image/') && img.dataset['autoUploadId'] === undefined) {
                this.processAutoUploadImage(img);
            }
        }
    }

    private processAutoUploadImage(img: HTMLImageElement): void {
        const uploader = this.uiRteImagesUploader();
        if (!uploader) return;
        const uploadId = `auto-upload-${++this.autoUploadCounter}`;
        const dataUrl = img.getAttribute('src') ?? '';
        this.markImageAsUploading(img, uploadId);
        this.host.commitContent();
        if (!isValidImageDataUrl(dataUrl)) {
            this.revertInvalidUploadImage(img);
            return;
        }
        this.startAutoUploadSubscription(img, uploadId, dataUrl, uploader);
    }

    private markImageAsUploading(img: HTMLImageElement, uploadId: string): void {
        const width = img.naturalWidth || img.width || Number.parseInt(img.getAttribute('width') ?? '0', 10) || 200;
        const height = img.naturalHeight || img.height || Number.parseInt(img.getAttribute('height') ?? '0', 10) || 150;
        this.autoUploadMutating = true;
        img.dataset['autoUploadId'] = uploadId;
        img.dataset['autoUploadStatus'] = 'uploading';
        if (!img.getAttribute('width')) img.setAttribute('width', String(width));
        if (!img.getAttribute('height')) img.setAttribute('height', String(height));
        img.setAttribute('src', TRANSPARENT_PIXEL);
        this.autoUploadMutating = false;
    }

    private revertInvalidUploadImage(img: HTMLImageElement): void {
        this.autoUploadMutating = true;
        delete img.dataset['autoUploadId'];
        delete img.dataset['autoUploadStatus'];
        img.setAttribute('src', TRANSPARENT_PIXEL);
        this.autoUploadMutating = false;
        this.host.commitContent();
        this.autoImageUploadError.emit(this.i18n.t().uploadNotImage);
    }

    private startAutoUploadSubscription(
        img: HTMLImageElement,
        uploadId: string,
        dataUrl: string,
        uploader: (file: File) => Observable<string>,
    ): void {
        const ext = (/data:image\/([\w+]+)/.exec(dataUrl)?.[1] ?? 'png').replace('+xml', '');
        const file = dataUrlToFile(dataUrl, `pasted-image-${uploadId}.${ext}`);
        const subscription = from(firstValueFrom(uploader(file))).subscribe({
            next: (uploadedUrl) => this.onAutoUploadSuccess(img, uploadId, dataUrl, uploadedUrl),
            error: (err: unknown) => {
                const message = err instanceof Error ? err.message : 'Auto image upload failed.';
                this.handleAutoUploadError(uploadId, img, dataUrl, message);
            },
        });
        this.autoUploadMap.set(uploadId, { subscription, dataUrl });
    }

    private onAutoUploadSuccess(img: HTMLImageElement, uploadId: string, dataUrl: string, uploadedUrl: string): void {
        const safeSrc = this.sanitizer.sanitizeImageSrc(uploadedUrl);
        if (!safeSrc) {
            this.handleAutoUploadError(uploadId, img, dataUrl, 'Uploaded image URL is not allowed by sanitizer policy.');
            return;
        }
        this.autoUploadMutating = true;
        img.setAttribute('src', safeSrc);
        delete img.dataset['autoUploadId'];
        delete img.dataset['autoUploadStatus'];
        this.autoUploadMutating = false;
        this.autoUploadMap.delete(uploadId);
        this.host.mutateContent(() => { /* src swapped live; record one entry */ });
        this.autoImageUploadComplete.emit(safeSrc);
    }

    private handleAutoUploadError(uploadId: string, img: HTMLImageElement, dataUrl: string, message: string): void {
        this.autoUploadMutating = true;
        img.dataset['autoUploadStatus'] = 'error';
        this.autoUploadMutating = false;
        this.autoUploadMap.delete(uploadId);
        const errors = new Map(this.autoUploadErrors());
        errors.set(uploadId, { dataUrl, imgElement: img });
        this.autoUploadErrors.set(errors);
        this.host.commitContent();
        this.autoImageUploadError.emit(message);
    }

    private retryAutoUpload(uploadId: string): void {
        const errors = new Map(this.autoUploadErrors());
        const entry = errors.get(uploadId);
        if (!entry) return;
        const img = entry.imgElement;
        errors.delete(uploadId);
        this.autoUploadErrors.set(errors);
        if (!img.isConnected) return;
        this.autoUploadMutating = true;
        delete img.dataset['autoUploadId'];
        delete img.dataset['autoUploadStatus'];
        img.setAttribute('src', entry.dataUrl);
        this.autoUploadMutating = false;
        this.processAutoUploadImage(img);
    }

    private removeAutoUploadImage(uploadId: string): void {
        const errors = new Map(this.autoUploadErrors());
        const entry = errors.get(uploadId);
        if (entry?.imgElement?.isConnected) {
            entry.imgElement.remove();
        }
        errors.delete(uploadId);
        this.autoUploadErrors.set(errors);
        const pending = this.autoUploadMap.get(uploadId);
        if (pending) {
            pending.subscription.unsubscribe();
            this.autoUploadMap.delete(uploadId);
        }
        this.host.mutateContent(() => { /* element already removed */ });
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
        const ref = this.vcr.createComponent(RichTextImagesOverlayComponent, { injector: this.injector });
        ref.instance.resizeEnd.subscribe(() => this.onResizeEnd());
        ref.instance.alignmentChange.subscribe(() => this.onAlignmentChange());
        ref.instance.imageRemove.subscribe((img) => this.onImageRemove(img));
        ref.instance.retryError.subscribe((id) => this.retryAutoUpload(id));
        ref.instance.removeError.subscribe((id) => this.removeAutoUploadImage(id));
        this.host.overlayAnchor.appendChild(ref.location.nativeElement);
        this.overlayRef = ref;
    }

    private syncOverlayInputs(): void {
        const ref = this.overlayRef;
        if (!ref) return;
        ref.setInput('locale', this.i18n.t());
        ref.setInput('resizerLabels', this.resizerLabels());
        ref.setInput('container', this.host.contentRoot);
        ref.setInput('target', this.uiRteImages() ? this.selectedImage() : null);
        ref.setInput('resizable', this.uiRteImagesResize());
        ref.setInput('showAlignment', this.uiRteImagesAlignment());
        ref.setInput('minWidth', this.uiRteImagesMinWidth());
        ref.setInput('maxWidth', this.uiRteImagesMaxWidth());
        ref.setInput('lockAspectRatio', this.uiRteImagesLockAspectRatio());
        ref.setInput('uploading', this.uploading());
        ref.setInput('errorEntries', this.errorEntries());
        ref.changeDetectorRef.markForCheck();
    }

    private teardown(): void {
        this.autoUploadObserver?.disconnect();
        this.autoUploadObserver = null;
        this.autoUploadMap.forEach((entry) => entry.subscription.unsubscribe());
        this.autoUploadMap.clear();
        this.overlayRef?.destroy();
        this.overlayRef = undefined;
    }
}

/** Coerce the bare `uiRteImages` attribute (empty string) to `true`. */
function coerceEnabled(value: boolean | string | undefined): boolean {
    return value === '' || value === true || value === undefined;
}
