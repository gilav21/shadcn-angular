import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
    RichTextImagesOverlayComponent,
    type ImageUploadErrorEntry,
} from './rich-text-images-overlay.component';
import {
    RichTextImageResizerComponent,
    type RichTextImageResizerLabels,
} from './rich-text-images-resizer.component';
import { RICH_TEXT_IMAGES_LOCALES } from './rich-text-images.locales';

/** jsdom lacks ResizeObserver; the embedded resizer's tracking effect constructs one. */
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

const LOCALE_EN = RICH_TEXT_IMAGES_LOCALES['en'];
const LABELS: RichTextImageResizerLabels = {
    inline: 'Inline',
    floatLeft: 'Float left',
    center: 'Center',
    floatRight: 'Float right',
    deleteImage: 'Delete image',
};

describe('RichTextImagesOverlayComponent', () => {
    let fixture: ComponentFixture<RichTextImagesOverlayComponent>;
    let host: HTMLElement;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RichTextImagesOverlayComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(RichTextImagesOverlayComponent);
        fixture.componentRef.setInput('locale', LOCALE_EN);
        fixture.componentRef.setInput('resizerLabels', LABELS);
        host = fixture.nativeElement as HTMLElement;
    });

    it('hides the uploading layer by default', () => {
        fixture.detectChanges();
        expect(host.querySelector('[data-slot="rte-images-uploading"]')).toBeNull();
    });

    it('shows the uploading layer with the localized string', () => {
        fixture.componentRef.setInput('uploading', true);
        fixture.detectChanges();
        const layer = host.querySelector('[data-slot="rte-images-uploading"]');
        expect(layer?.textContent).toContain(LOCALE_EN.uploading);
    });

    it('renders one error badge per error entry positioned via inline styles', () => {
        const entries: ImageUploadErrorEntry[] = [
            { id: 'a', top: 10, left: 20, width: 120, height: 80 },
        ];
        fixture.componentRef.setInput('errorEntries', entries);
        fixture.detectChanges();
        const badge = host.querySelector<HTMLElement>('[data-slot="rte-images-error"]');
        expect(badge).toBeTruthy();
        expect(badge?.style.top).toBe('10px');
        expect(badge?.style.left).toBe('20px');
        expect(badge?.textContent).toContain(LOCALE_EN.uploadFailed);
    });

    it('re-emits retryError and removeError from the badge buttons', () => {
        const entries: ImageUploadErrorEntry[] = [
            { id: 'entry-1', top: 0, left: 0, width: 120, height: 80 },
        ];
        fixture.componentRef.setInput('errorEntries', entries);
        fixture.detectChanges();

        const retried: string[] = [];
        const removed: string[] = [];
        fixture.componentInstance.retryError.subscribe((id) => retried.push(id));
        fixture.componentInstance.removeError.subscribe((id) => removed.push(id));

        const buttons = host.querySelectorAll<HTMLButtonElement>('[data-slot="rte-images-error"] button');
        buttons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
        buttons[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(retried).toEqual(['entry-1']);
        expect(removed).toEqual(['entry-1']);
    });

    it('forwards target/container inputs to the embedded resizer', () => {
        const img = document.createElement('img');
        const container = document.createElement('div');
        fixture.componentRef.setInput('target', img);
        fixture.componentRef.setInput('container', container);
        fixture.detectChanges();
        const resizer = fixture.debugElement.query(By.directive(RichTextImageResizerComponent))
            .componentInstance as RichTextImageResizerComponent;
        expect(resizer.target()).toBe(img);
        expect(resizer.container()).toBe(container);
    });

    it('re-emits resizer outputs (resizeEnd, alignmentChange, imageRemove)', () => {
        const img = document.createElement('img');
        fixture.componentRef.setInput('target', img);
        fixture.detectChanges();
        const resizer = fixture.debugElement.query(By.directive(RichTextImageResizerComponent))
            .componentInstance as RichTextImageResizerComponent;

        let ended = false;
        let alignment = '';
        let removed: HTMLImageElement | null = null;
        fixture.componentInstance.resizeEnd.subscribe(() => (ended = true));
        fixture.componentInstance.alignmentChange.subscribe((a) => (alignment = a));
        fixture.componentInstance.imageRemove.subscribe((el) => (removed = el));

        resizer.resizeEnd.emit();
        resizer.alignmentChange.emit('center');
        resizer.imageRemove.emit(img);

        expect(ended).toBe(true);
        expect(alignment).toBe('center');
        expect(removed).toBe(img);
    });
});
