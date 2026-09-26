import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
    RichTextImagesOverlayComponent,
    type ImageUploadErrorEntry,
} from './rich-text-images-overlay.component';
import { RICH_TEXT_IMAGES_LOCALES } from './rich-text-images.locales';

/**
 * Browser-only overlay case. It asserts where each error badge is laid out,
 * as rendered rects, and jsdom performs no layout — every rect is zero there.
 * It runs in the real-browser leg only; the portable (jsdom) leg and the
 * shipped `testFiles` exclude this file.
 */
const LOCALE_EN = RICH_TEXT_IMAGES_LOCALES['en'];

describe('RichTextImagesOverlayComponent', () => {
    let fixture: ComponentFixture<RichTextImagesOverlayComponent>;
    let host: HTMLElement;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RichTextImagesOverlayComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(RichTextImagesOverlayComponent);
        fixture.componentRef.setInput('locale', LOCALE_EN);
        fixture.componentRef.setInput('resizerLabels', {
            inline: 'Inline',
            floatLeft: 'Float left',
            center: 'Center',
            floatRight: 'Float right',
            deleteImage: 'Delete image',
        });
        host = fixture.nativeElement as HTMLElement;
    });

    it('renders one error badge per entry, laid out over its image', () => {
        const frame = document.createElement('div');
        frame.style.position = 'relative';
        frame.style.width = '400px';
        frame.style.height = '300px';
        frame.appendChild(host);
        document.body.appendChild(frame);
        const entries: ImageUploadErrorEntry[] = [
            { id: 'a', top: 10, left: 20, width: 120, height: 80 },
            { id: 'b', top: 150, left: 200, width: 160, height: 90 },
        ];
        fixture.componentRef.setInput('errorEntries', entries);
        fixture.detectChanges();

        const origin = frame.getBoundingClientRect();
        const badges = Array.from(host.querySelectorAll<HTMLElement>('[data-slot="rte-images-error"]'));
        const boxes = badges.map((b) => {
            const r = b.getBoundingClientRect();
            return { top: r.top - origin.top, left: r.left - origin.left, width: r.width, height: r.height };
        });
        expect(boxes).toEqual(entries.map(({ top, left, width, height }) => ({ top, left, width, height })));
        expect(badges.every((b) => b.textContent?.includes(LOCALE_EN.uploadFailed))).toBe(true);
        frame.remove();
    });
});
