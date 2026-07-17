import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { Subject, of, throwError, type Observable } from 'rxjs';
import { RichTextEditorComponent } from '../../rich-text-editor.component';
import { RichTextImagesDirective } from './rich-text-images.directive';
import { RichTextImagesButtonComponent } from './rich-text-images-button.component';
import { RichTextImageResizerComponent } from './rich-text-images-resizer.component';
import type { RichTextImagesButtonContext } from './rich-text-images.context';
import type { RichTextImageSources } from './rich-text-images.context';

const TINY_BASE64 =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

@Component({
    standalone: true,
    imports: [RichTextEditorComponent, RichTextImagesDirective],
    template: `<ui-rich-text-editor mode="html" [disabled]="disabled()" [readonly]="readonly()"
        uiRteImages [uiRteImagesLocale]="locale()"
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

    it('resolves Hebrew locale strings for the button and RTL flag', () => {
        const fixture = createFixture();
        fixture.componentInstance.locale.set('he');
        fixture.detectChanges();
        const ctx = buttonContext(fixture);
        expect(ctx.locale().tooltip).toBe('הוספת תמונה');
        expect(ctx.locale().rtl).toBe(true);
    });
});
