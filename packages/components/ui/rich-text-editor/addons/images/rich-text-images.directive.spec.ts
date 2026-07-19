import { Component, signal, type WritableSignal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Subject, Subscription, of, throwError, type Observable } from 'rxjs';
import { RichTextImagesOverlayComponent } from './rich-text-images-overlay.component';

/** jsdom lacks ResizeObserver; the resize overlay's tracking effect constructs one. */
class ResizeObserverStub {
    observe(): void { /* no-op */ }
    unobserve(): void { /* no-op */ }
    disconnect(): void { /* no-op */ }
}
type ResizeObserverGlobal = { ResizeObserver?: typeof ResizeObserver };
const originalResizeObserver = (globalThis as ResizeObserverGlobal).ResizeObserver;

beforeEach(() => {
    (globalThis as ResizeObserverGlobal).ResizeObserver =
        ResizeObserverStub as unknown as typeof ResizeObserver;
});

afterEach(() => {
    if (originalResizeObserver) {
        (globalThis as ResizeObserverGlobal).ResizeObserver = originalResizeObserver;
    } else {
        delete (globalThis as ResizeObserverGlobal).ResizeObserver;
    }
});
import { RichTextImagesDirective } from './rich-text-images.directive';
import { RichTextImagesButtonComponent } from './rich-text-images-button.component';
import { RichTextImageResizerComponent } from './rich-text-images-resizer.component';
import type { RichTextImagesButtonContext } from './rich-text-images.context';
import type { RichTextImageSources } from './rich-text-images.context';
import { RichTextEditorComponent } from '../..';

const TINY_BASE64 =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

@Component({
    standalone: true,
    imports: [RichTextEditorComponent, RichTextImagesDirective],
    template: `<ui-rich-text-editor mode="html" [disabled]="disabled()" [readonly]="readonly()"
        [uiRteImages]="enabled()" [uiRteImagesToolbar]="toolbar()" [uiRteImagesLocale]="locale()"
        [uiRteImagesSources]="sources()"
        [uiRteImagesAutoUpload]="autoUpload()"
        [uiRteImagesUploader]="uploader()"
        [uiRteImagesDefaultWidth]="defaultWidth()"
        [uiRteImagesDefaultAlignment]="defaultAlignment()"
        (imageUploadComplete)="uploadComplete.push($event)"
        (imageUploadError)="uploadError.push($event)"
        (autoImageUploadComplete)="autoComplete.push($event)"
        (autoImageUploadError)="autoError.push($event)"></ui-rich-text-editor>`,
})
class HostCmp {
    readonly disabled = signal(false);
    readonly readonly = signal(false);
    readonly enabled = signal(true);
    readonly toolbar = signal(true);
    readonly locale = signal<string | undefined>(undefined);
    readonly sources = signal<RichTextImageSources>('all');
    readonly autoUpload = signal(false);
    readonly uploader = signal<((file: File) => Observable<string>) | undefined>(undefined);
    readonly defaultWidth = signal<number | string | undefined>(undefined);
    readonly defaultAlignment = signal<'inline' | 'left' | 'center' | 'right'>('inline');
    uploadComplete: string[] = [];
    uploadError: string[] = [];
    autoComplete: string[] = [];
    autoError: string[] = [];
}

type ButtonProbe = { context: RichTextImagesButtonContext };

interface FakeClipboard {
    files: File[];
    getData: (type: string) => string;
}

describe('RichTextImagesDirective', () => {
    const fixtures: ComponentFixture<HostCmp>[] = [];

    function createFixture(): ComponentFixture<HostCmp> {
        const fixture = TestBed.createComponent(HostCmp);
        fixtures.push(fixture);
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();
        return fixture;
    }

    function editorOf(fixture: ComponentFixture<HostCmp>): { el: HTMLElement; cmp: RichTextEditorComponent } {
        const cmp = fixture.debugElement.query(By.directive(RichTextEditorComponent))
            .componentInstance as RichTextEditorComponent;
        const el = fixture.nativeElement.querySelector('[data-slot="rich-text-editor"]') as HTMLElement;
        return { el, cmp };
    }

    function buttonContext(fixture: ComponentFixture<HostCmp>): RichTextImagesButtonContext {
        const probe = fixture.debugElement.query(By.directive(RichTextImagesButtonComponent))
            .componentInstance as unknown as ButtonProbe;
        return probe.context;
    }

    function resizer(fixture: ComponentFixture<HostCmp>): RichTextImageResizerComponent | null {
        const de = fixture.debugElement.query(By.directive(RichTextImageResizerComponent));
        return de ? (de.componentInstance as RichTextImageResizerComponent) : null;
    }

    function setContent(fixture: ComponentFixture<HostCmp>, html: string): { el: HTMLElement; cmp: RichTextEditorComponent } {
        const ctx = editorOf(fixture);
        ctx.el.innerHTML = html;
        ctx.el.dispatchEvent(new Event('input', { bubbles: true }));
        fixture.detectChanges();
        return ctx;
    }

    function caretAtEnd(el: HTMLElement): void {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        const sel = document.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
    }

    function pasteEvent(files: File[], html = '', text = ''): ClipboardEvent {
        const data: FakeClipboard = {
            files,
            getData: (t) => (t === 'text/html' ? html : text),
        };
        return {
            preventDefault: vi.fn(),
            clipboardData: data as unknown as DataTransfer,
        } as unknown as ClipboardEvent;
    }

    function dropEvent(files: File[]): DragEvent {
        return {
            preventDefault: vi.fn(),
            dataTransfer: {
                types: ['Files'],
                files: files as unknown as FileList,
                items: files.map((f) => ({ kind: 'file', type: f.type })) as unknown as DataTransferItemList,
            } as unknown as DataTransfer,
        } as unknown as DragEvent;
    }

    const wait = (ms = 50): Promise<void> => new Promise((r) => setTimeout(r, ms));

    afterEach(() => {
        for (const f of fixtures) {
            f.nativeElement.remove();
            f.destroy();
        }
        fixtures.length = 0;
    });

    it('registers the image toolbar slot and renders the button', () => {
        const fixture = createFixture();
        const { cmp } = editorOf(fixture);
        expect(cmp.toolbarSlots.slots().some((s) => s.id === 'images.insert')).toBe(true);
        expect(fixture.debugElement.query(By.directive(RichTextImagesButtonComponent))).toBeTruthy();
    });

    it('inserts an image from the URL field with sanitized src and alt', () => {
        const fixture = createFixture();
        const { el } = setContent(fixture, '<p>here</p>');
        caretAtEnd(el.querySelector('p')!);
        const ctx = buttonContext(fixture);
        ctx.onOpen();
        ctx.onInsertUrl('https://cdn.test/pic.png', 'A picture');
        fixture.detectChanges();

        const img = el.querySelector('img')!;
        expect(img.getAttribute('src')).toBe('https://cdn.test/pic.png');
        expect(img.getAttribute('alt')).toBe('A picture');
    });

    it('applies default width and alignment to an inserted image', () => {
        const fixture = createFixture();
        fixture.componentInstance.defaultWidth.set(320);
        fixture.componentInstance.defaultAlignment.set('center');
        fixture.detectChanges();
        const { el } = setContent(fixture, '<p>here</p>');
        caretAtEnd(el.querySelector('p')!);
        const ctx = buttonContext(fixture);
        ctx.onOpen();
        ctx.onInsertUrl('https://cdn.test/pic.png', 'x');
        fixture.detectChanges();

        const img = el.querySelector('img')!;
        expect(img.style.width).toBe('320px');
        expect(img.dataset['align']).toBe('center');
        expect(img.style.display).toBe('block');
        expect(img.style.marginLeft).toBe('auto');
    });

    it('rejects an unsafe image URL and surfaces an error', () => {
        const fixture = createFixture();
        const { el } = setContent(fixture, '<p>x</p>');
        caretAtEnd(el.querySelector('p')!);
        buttonContext(fixture).onInsertUrl('javascript:evil()', 'x');
        fixture.detectChanges();

        expect(el.querySelector('img')).toBeNull();
        expect(fixture.componentInstance.uploadError).toContain('Invalid image URL.');
    });

    it('does not allow attribute injection through the alt text', () => {
        const fixture = createFixture();
        const { el } = setContent(fixture, '<p>x</p>');
        caretAtEnd(el.querySelector('p')!);
        const ctx = buttonContext(fixture);
        ctx.onOpen();
        ctx.onInsertUrl('https://example.com/safe.png', 'x" onerror="alert(1)" data-x="1');
        fixture.detectChanges();

        const img = el.querySelector('img')!;
        expect(img.getAttribute('onerror')).toBeNull();
        expect(img.getAttribute('alt')).toBe('x" onerror="alert(1)" data-x="1');
    });

    it('pastes a clipboard image as a data URL when no uploader is configured', async () => {
        const fixture = createFixture();
        const { el, cmp } = setContent(fixture, '<p>x</p>');
        caretAtEnd(el.querySelector('p')!);
        const file = new File(['paste-image'], 'clip.png', { type: 'image/png' });
        cmp.onPaste(pasteEvent([file]));
        await wait();
        fixture.detectChanges();

        expect(el.innerHTML).toContain('<img');
        expect(el.innerHTML).toContain('data:image/png;base64');
        expect(fixture.componentInstance.uploadComplete).toHaveLength(1);
    });

    it('pastes a clipboard image via the uploader when configured', async () => {
        const fixture = createFixture();
        fixture.componentInstance.sources.set('upload');
        fixture.componentInstance.uploader.set(() => of('https://cdn.example.com/clip.png'));
        fixture.detectChanges();
        const { el, cmp } = setContent(fixture, '<p>x</p>');
        caretAtEnd(el.querySelector('p')!);
        cmp.onPaste(pasteEvent([new File(['img'], 'clip.png', { type: 'image/png' })]));
        await wait();
        fixture.detectChanges();

        expect(el.innerHTML).toContain('https://cdn.example.com/clip.png');
        expect(fixture.componentInstance.uploadComplete).toContain('https://cdn.example.com/clip.png');
    });

    it('defers an Excel-sourced paste back to the base (no image insert)', async () => {
        const fixture = createFixture();
        const { el, cmp } = setContent(fixture, '<p>x</p>');
        caretAtEnd(el.querySelector('p')!);
        const excelHtml = '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><body><table><tr><td>1</td></tr></table></body></html>';
        cmp.onPaste(pasteEvent([new File(['img'], 'x.png', { type: 'image/png' })], excelHtml, '1'));
        await wait();
        fixture.detectChanges();

        expect(el.querySelector('img')).toBeNull();
        expect(el.querySelector('table')).toBeTruthy();
    });

    it('inserts a dropped image file as a data URL', async () => {
        const fixture = createFixture();
        const { el, cmp } = setContent(fixture, '<p>x</p>');
        caretAtEnd(el.querySelector('p')!);
        await cmp.onEditorDrop(dropEvent([new File(['img'], 'drop.png', { type: 'image/png' })]));
        await wait();
        fixture.detectChanges();

        expect(el.querySelector('img')).toBeTruthy();
        expect(fixture.componentInstance.uploadComplete).toHaveLength(1);
    });

    it('highlights the drop zone when an image drag enters', () => {
        const fixture = createFixture();
        const { cmp } = editorOf(fixture);
        cmp.onEditorDragOver(dropEvent([]));
        expect(cmp.dragOver()).toBe(true);
    });

    it('does not drop when readonly', async () => {
        const fixture = createFixture();
        fixture.componentInstance.readonly.set(true);
        fixture.detectChanges();
        const { el, cmp } = editorOf(fixture);
        await cmp.onEditorDrop(dropEvent([new File(['img'], 'd.png', { type: 'image/png' })]));
        await wait();
        expect(el.querySelector('img')).toBeNull();
    });

    it('auto-uploads a base64 image and swaps in the returned URL', async () => {
        const fixture = createFixture();
        const upload$ = new Subject<string>();
        fixture.componentInstance.autoUpload.set(true);
        fixture.componentInstance.uploader.set(() => upload$);
        fixture.detectChanges();
        const { el } = editorOf(fixture);

        const img = document.createElement('img');
        img.setAttribute('src', TINY_BASE64);
        el.appendChild(img);
        await wait();

        expect(img.dataset['autoUploadStatus']).toBe('uploading');
        expect(img.getAttribute('src')).toBe(TRANSPARENT_PIXEL);

        upload$.next('https://cdn.example.com/uploaded.png');
        upload$.complete();
        await wait();

        expect(img.getAttribute('src')).toBe('https://cdn.example.com/uploaded.png');
        expect('autoUploadId' in img.dataset).toBe(false);
        expect(fixture.componentInstance.autoComplete).toContain('https://cdn.example.com/uploaded.png');
    });

    it('surfaces an auto-upload failure as an error overlay entry', async () => {
        const fixture = createFixture();
        fixture.componentInstance.autoUpload.set(true);
        fixture.componentInstance.uploader.set(() => throwError(() => new Error('Network error')));
        fixture.detectChanges();
        const { el } = editorOf(fixture);

        const img = document.createElement('img');
        img.setAttribute('src', TINY_BASE64);
        el.appendChild(img);
        await wait();
        fixture.detectChanges();

        expect(img.dataset['autoUploadStatus']).toBe('error');
        expect(fixture.componentInstance.autoError).toContain('Network error');
        expect(fixture.nativeElement.querySelector('[data-slot="rte-images-error"]')).toBeTruthy();
    });

    it('selects an image on click and drives the resize overlay', () => {
        const fixture = createFixture();
        const { el } = setContent(fixture, '<p><img src="https://cdn.test/a.png" alt="a"></p>');
        const img = el.querySelector('img')!;
        img.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();
        expect(resizer(fixture)?.target()).toBe(img);
    });

    it('resizes the selected image via mouse and touch drag', () => {
        const fixture = createFixture();
        const { el } = setContent(fixture, '<p><img src="https://cdn.test/a.png" alt="a"></p>');
        const img = el.querySelector('img')!;
        Object.defineProperty(img, 'getBoundingClientRect', {
            value: () => ({ width: 100, height: 80, top: 0, left: 0, right: 100, bottom: 80 }),
        });
        img.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();
        const rz = resizer(fixture)!;

        rz.startResize(new MouseEvent('mousedown', { clientX: 0, clientY: 0 }), 'se');
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: 40, clientY: 40 }));
        expect(Number.parseInt(img.style.width, 10)).toBeGreaterThan(100);
        document.dispatchEvent(new MouseEvent('mouseup'));

        const touch = { clientX: 60, clientY: 60 } as Touch;
        rz.startResize({ preventDefault: vi.fn(), stopPropagation: vi.fn(), touches: [touch] } as unknown as TouchEvent, 'se');
        document.dispatchEvent(Object.assign(new Event('touchmove'), { touches: [{ clientX: 80, clientY: 80 }], preventDefault: vi.fn() }));
        expect(Number.parseInt(img.style.width, 10)).toBeGreaterThan(100);
        document.dispatchEvent(new Event('touchend'));
    });

    it('changes image alignment through the overlay', () => {
        const fixture = createFixture();
        const { el } = setContent(fixture, '<p><img src="https://cdn.test/a.png" alt="a"></p>');
        const img = el.querySelector('img')!;
        img.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();
        resizer(fixture)!.onAlignClick(new MouseEvent('mousedown'), 'right');
        expect(img.dataset['align']).toBe('right');
        expect(img.style.float).toBe('right');
    });

    it('removes the selected image through the overlay', () => {
        const fixture = createFixture();
        const { el } = setContent(fixture, '<p><img src="https://cdn.test/a.png" alt="a"></p>');
        const img = el.querySelector('img')!;
        img.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();
        resizer(fixture)!.onDeleteClick(new MouseEvent('mousedown'));
        fixture.detectChanges();
        expect(el.querySelector('img')).toBeNull();
    });

    it('does not insert when the editor is disabled', () => {
        const fixture = createFixture();
        fixture.componentInstance.disabled.set(true);
        fixture.detectChanges();
        const { el, cmp } = editorOf(fixture);
        cmp.onPaste(pasteEvent([new File(['img'], 'x.png', { type: 'image/png' })]));
        expect(el.querySelector('img')).toBeNull();
    });

    // ── Edge / error / defensive paths ────────────────────────────────

    interface DirectiveInternals {
        autoUploadErrors: WritableSignal<Map<string, { dataUrl: string; imgElement: HTMLImageElement }>>;
        autoUploadMap: Map<string, { subscription: Subscription; dataUrl: string }>;
        overlayRef?: unknown;
        scanForBase64Images(): void;
        processAutoUploadImage(img: HTMLImageElement): void;
        removeAutoUploadImage(id: string): void;
        syncOverlayInputs(): void;
        errorEntries(): ReadonlyArray<{ id: string }>;
    }

    function directiveOf(fixture: ComponentFixture<HostCmp>): RichTextImagesDirective {
        return fixture.debugElement.query(By.directive(RichTextImagesDirective))
            .injector.get(RichTextImagesDirective);
    }

    function internalsOf(fixture: ComponentFixture<HostCmp>): DirectiveInternals {
        return directiveOf(fixture) as unknown as DirectiveInternals;
    }

    function overlayOf(fixture: ComponentFixture<HostCmp>): RichTextImagesOverlayComponent {
        return fixture.debugElement.query(By.directive(RichTextImagesOverlayComponent))
            .componentInstance as RichTextImagesOverlayComponent;
    }

    function imageFile(name = 'p.png'): File {
        return new File(['img'], name, { type: 'image/png' });
    }

    /** Append a base64 image and let the mutation observer + microtasks settle. */
    async function appendBase64(el: HTMLElement, src: string): Promise<HTMLImageElement> {
        const img = document.createElement('img');
        img.setAttribute('src', src);
        el.appendChild(img);
        await wait();
        return img;
    }

    it('imports a file through the toolbar upload callback as a data URL', async () => {
        const fixture = createFixture();
        setContent(fixture, '<p>x</p>');
        buttonContext(fixture).onUploadFile(imageFile());
        await wait();
        fixture.detectChanges();
        expect(editorOf(fixture).el.querySelector('img')).toBeTruthy();
    });

    it('omits the toolbar slot when the toolbar contribution is disabled', () => {
        const fixture = createFixture();
        fixture.componentInstance.toolbar.set(false);
        fixture.detectChanges();
        expect(editorOf(fixture).cmp.toolbarSlots.slots().some((s) => s.id === 'images.insert')).toBe(false);
    });

    it('defers a paste while the image feature is disabled', () => {
        const fixture = createFixture();
        fixture.componentInstance.enabled.set(false);
        fixture.detectChanges();
        const { el, cmp } = setContent(fixture, '<p>x</p>');
        cmp.onPaste(pasteEvent([imageFile()]));
        expect(el.querySelector('img')).toBeNull();
    });

    it('defers a paste that carries no image file', () => {
        const fixture = createFixture();
        const { el, cmp } = setContent(fixture, '<p>x</p>');
        cmp.onPaste(pasteEvent([new File(['t'], 'a.txt', { type: 'text/plain' })]));
        expect(el.querySelector('img')).toBeNull();
    });

    it('defers a drop while the image feature is disabled', async () => {
        const fixture = createFixture();
        fixture.componentInstance.enabled.set(false);
        fixture.detectChanges();
        const { el, cmp } = editorOf(fixture);
        await cmp.onEditorDrop(dropEvent([imageFile()]));
        await wait();
        expect(el.querySelector('img')).toBeNull();
    });

    it('defers a drop that carries no image file', async () => {
        const fixture = createFixture();
        const { el, cmp } = editorOf(fixture);
        await cmp.onEditorDrop(dropEvent([new File(['t'], 'a.txt', { type: 'text/plain' })]));
        await wait();
        expect(el.querySelector('img')).toBeNull();
    });

    it('errors when upload is the only source but no uploader is configured', async () => {
        const fixture = createFixture();
        fixture.componentInstance.sources.set('upload');
        fixture.detectChanges();
        buttonContext(fixture).onUploadFile(imageFile());
        await wait();
        expect(fixture.componentInstance.uploadError).toContain('No imageUploader configured.');
    });

    it('rejects a non-image file when inserting as a data URL', async () => {
        const fixture = createFixture();
        fixture.componentInstance.sources.set('url');
        fixture.detectChanges();
        buttonContext(fixture).onUploadFile(new File(['plain'], 'a.bin'));
        await wait();
        expect(fixture.componentInstance.uploadError).toContain('Pasted image is not allowed by sanitizer policy.');
    });

    it('surfaces a read failure when the data-URL reader errors', async () => {
        const fixture = createFixture();
        fixture.componentInstance.sources.set('url');
        fixture.detectChanges();
        const readAsDataURL = vi.spyOn(FileReader.prototype, 'readAsDataURL')
            .mockImplementation(function (this: FileReader): void {
                this.onerror?.(new ProgressEvent('error'));
            });
        buttonContext(fixture).onUploadFile(imageFile());
        await wait();
        expect(fixture.componentInstance.uploadError).toContain('Could not read image file.');
        readAsDataURL.mockRestore();
    });

    it('rejects an uploaded URL the sanitizer disallows', async () => {
        const fixture = createFixture();
        fixture.componentInstance.sources.set('upload');
        fixture.componentInstance.uploader.set(() => of('javascript:alert(1)'));
        fixture.detectChanges();
        buttonContext(fixture).onUploadFile(imageFile());
        await wait();
        expect(fixture.componentInstance.uploadError)
            .toContain('Uploaded image URL is not allowed by sanitizer policy.');
    });

    it('surfaces an uploader Error message', async () => {
        const fixture = createFixture();
        fixture.componentInstance.sources.set('upload');
        fixture.componentInstance.uploader.set(() => throwError(() => new Error('upstream down')));
        fixture.detectChanges();
        buttonContext(fixture).onUploadFile(imageFile());
        await wait();
        expect(fixture.componentInstance.uploadError).toContain('upstream down');
    });

    it('falls back to a generic message when the uploader throws a non-Error', async () => {
        const fixture = createFixture();
        fixture.componentInstance.sources.set('upload');
        fixture.componentInstance.uploader.set(() => throwError(() => 'nope'));
        fixture.detectChanges();
        buttonContext(fixture).onUploadFile(imageFile());
        await wait();
        expect(fixture.componentInstance.uploadError).toContain('Image upload failed.');
    });

    it('clears the selection on click while the image feature is disabled', async () => {
        const fixture = createFixture();
        fixture.componentInstance.enabled.set(false);
        fixture.detectChanges();
        const { el } = setContent(fixture, '<p><img src="https://cdn.test/a.png" alt="a"></p>');
        await wait();
        el.querySelector('img')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();
        expect(resizer(fixture)?.target() ?? null).toBeNull();
    });

    it('skips auto-upload scanning when no uploader is configured', async () => {
        const fixture = createFixture();
        fixture.componentInstance.autoUpload.set(true);
        fixture.detectChanges();
        const { el } = editorOf(fixture);
        const img = await appendBase64(el, TINY_BASE64);
        expect('autoUploadStatus' in img.dataset).toBe(false);
    });

    it('reverts and reports a base64 image that is not a valid image', async () => {
        const fixture = createFixture();
        fixture.componentInstance.autoUpload.set(true);
        fixture.componentInstance.uploader.set(() => of('https://cdn.example.com/ok.png'));
        fixture.detectChanges();
        const { el } = editorOf(fixture);
        await appendBase64(el, 'data:image/png;base64,QUJD');
        expect(fixture.componentInstance.autoError)
            .toContain('The image could not be uploaded because its content is not a valid image.');
    });

    it('reports an auto-upload whose returned URL the sanitizer disallows', async () => {
        const fixture = createFixture();
        fixture.componentInstance.autoUpload.set(true);
        fixture.componentInstance.uploader.set(() => of('javascript:evil()'));
        fixture.detectChanges();
        const { el } = editorOf(fixture);
        const img = await appendBase64(el, TINY_BASE64);
        expect(img.dataset['autoUploadStatus']).toBe('error');
        expect(fixture.componentInstance.autoError)
            .toContain('Uploaded image URL is not allowed by sanitizer policy.');
    });

    it('retries a failed auto-upload from the error overlay', async () => {
        const fixture = createFixture();
        fixture.componentInstance.autoUpload.set(true);
        fixture.componentInstance.uploader.set(() => throwError(() => new Error('flaky')));
        fixture.detectChanges();
        const { el } = editorOf(fixture);
        await appendBase64(el, TINY_BASE64);
        const errors = internalsOf(fixture).autoUploadErrors();
        const id = [...errors.keys()][0];
        expect(id).toBeTruthy();
        overlayOf(fixture).retryError.emit(id);
        await wait();
        expect(internalsOf(fixture).autoUploadErrors().has(id)).toBe(false);
    });

    it('ignores a retry for an unknown error id', () => {
        const fixture = createFixture();
        expect(() => overlayOf(fixture).retryError.emit('does-not-exist')).not.toThrow();
    });

    it('ignores a retry when the errored image is disconnected', async () => {
        const fixture = createFixture();
        fixture.componentInstance.autoUpload.set(true);
        fixture.componentInstance.uploader.set(() => throwError(() => new Error('flaky')));
        fixture.detectChanges();
        const { el } = editorOf(fixture);
        const img = await appendBase64(el, TINY_BASE64);
        const id = [...internalsOf(fixture).autoUploadErrors().keys()][0];
        img.remove();
        overlayOf(fixture).retryError.emit(id);
        await wait();
        expect('autoUploadStatus' in img.dataset).toBe(true);
    });

    it('removes a failed auto-upload image from the error overlay', async () => {
        const fixture = createFixture();
        fixture.componentInstance.autoUpload.set(true);
        fixture.componentInstance.uploader.set(() => throwError(() => new Error('flaky')));
        fixture.detectChanges();
        const { el } = editorOf(fixture);
        const img = await appendBase64(el, TINY_BASE64);
        const id = [...internalsOf(fixture).autoUploadErrors().keys()][0];
        overlayOf(fixture).removeError.emit(id);
        await wait();
        expect(img.isConnected).toBe(false);
        expect(internalsOf(fixture).autoUploadErrors().has(id)).toBe(false);
    });

    it('unsubscribes a still-pending upload when its image is removed', () => {
        const fixture = createFixture();
        const internals = internalsOf(fixture);
        const img = document.createElement('img');
        editorOf(fixture).el.appendChild(img);
        const subscription = new Subscription();
        const unsub = vi.spyOn(subscription, 'unsubscribe');
        internals.autoUploadMap.set('pending-1', { subscription, dataUrl: TINY_BASE64 });
        internals.autoUploadErrors.set(new Map([['pending-1', { dataUrl: TINY_BASE64, imgElement: img }]]));
        internals.removeAutoUploadImage('pending-1');
        expect(unsub).toHaveBeenCalled();
        expect(internals.autoUploadMap.has('pending-1')).toBe(false);
    });

    it('skips disconnected images when computing error overlay positions', () => {
        const fixture = createFixture();
        const internals = internalsOf(fixture);
        const detached = document.createElement('img');
        internals.autoUploadErrors.set(new Map([['gone', { dataUrl: TINY_BASE64, imgElement: detached }]]));
        expect(internals.errorEntries()).toHaveLength(0);
    });

    it('does nothing when auto-uploading an image with no uploader configured', () => {
        const fixture = createFixture();
        const img = document.createElement('img');
        img.setAttribute('src', TINY_BASE64);
        expect(() => internalsOf(fixture).processAutoUploadImage(img)).not.toThrow();
        expect('autoUploadStatus' in img.dataset).toBe(false);
    });

    it('guards the base64 scan when the content root is unavailable', () => {
        const fixture = createFixture();
        fixture.componentInstance.uploader.set(() => of('https://cdn.example.com/ok.png'));
        fixture.detectChanges();
        const { cmp } = editorOf(fixture);
        const descriptor = Object.getOwnPropertyDescriptor(
            Object.getPrototypeOf(cmp), 'contentRoot',
        );
        Object.defineProperty(cmp, 'contentRoot', { get: () => null, configurable: true });
        try {
            expect(() => internalsOf(fixture).scanForBase64Images()).not.toThrow();
        } finally {
            if (descriptor) {
                delete (cmp as unknown as Record<string, unknown>).contentRoot;
            }
        }
    });

    it('is a no-op when syncing overlay inputs before the overlay exists', () => {
        const fixture = createFixture();
        const internals = internalsOf(fixture);
        internals.overlayRef = undefined;
        expect(() => internals.syncOverlayInputs()).not.toThrow();
    });

    it('unsubscribes in-flight auto-uploads on teardown', async () => {
        const fixture = createFixture();
        const upload$ = new Subject<string>();
        fixture.componentInstance.autoUpload.set(true);
        fixture.componentInstance.uploader.set(() => upload$);
        fixture.detectChanges();
        const { el } = editorOf(fixture);
        await appendBase64(el, TINY_BASE64);
        expect(internalsOf(fixture).autoUploadMap.size).toBeGreaterThan(0);
        expect(() => fixture.destroy()).not.toThrow();
    });

    it('ignores mutations that originate from its own edits', async () => {
        const fixture = createFixture();
        fixture.componentInstance.autoUpload.set(true);
        fixture.componentInstance.uploader.set(() => of('https://cdn.example.com/ok.png'));
        fixture.detectChanges();
        await wait();

        const { el } = editorOf(fixture);
        const internals = directiveOf(fixture) as unknown as { autoUploadMutating: boolean };
        internals.autoUploadMutating = true;
        const img = document.createElement('img');
        img.setAttribute('src', TINY_BASE64);
        el.appendChild(img);
        await wait();
        internals.autoUploadMutating = false;

        expect('autoUploadStatus' in img.dataset).toBe(false);
    });

    it('tears down auto-upload scanning when the feature is turned off', async () => {
        const fixture = createFixture();
        fixture.componentInstance.autoUpload.set(true);
        fixture.componentInstance.uploader.set(() => of('https://cdn.example.com/ok.png'));
        fixture.detectChanges();
        await wait();

        fixture.componentInstance.autoUpload.set(false);
        fixture.detectChanges();
        await wait();

        const { el } = editorOf(fixture);
        const img = await appendBase64(el, TINY_BASE64);
        expect('autoUploadStatus' in img.dataset).toBe(false);
    });

    it('resolves Hebrew locale strings for the button and RTL flag', () => {
        const fixture = createFixture();
        fixture.componentInstance.locale.set('he');
        fixture.detectChanges();
        const ctx = buttonContext(fixture);
        expect(ctx.locale().tooltip).toBe('הוספת תמונה');
        expect(ctx.locale().rtl).toBe(true);
    });
});
