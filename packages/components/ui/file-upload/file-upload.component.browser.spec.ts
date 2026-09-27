import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, it, expect } from 'vitest';
import { cdp } from 'vitest/browser';
import { FileUploadComponent } from './file-upload.component';

@Component({
    template: `<ui-file-upload />`,
    imports: [FileUploadComponent],
})
class UploadHost { }

/** Real-layout case: visually-hidden geometry, which jsdom does not compute. */
describe('FileUploadComponent — file input', () => {
    it('hides the native input visually but keeps it named for assistive tech', () => {
        const fixture = TestBed.createComponent(UploadHost);
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();

        const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
        const rect = input.getBoundingClientRect();
        const style = getComputedStyle(input);

        expect(rect.width).toBeLessThanOrEqual(1);
        expect(rect.height).toBeLessThanOrEqual(1);
        expect(style.display).not.toBe('none');
        expect(style.visibility).toBe('visible');
        expect(input.getAttribute('aria-label')).toBeTruthy();

        fixture.destroy();
        fixture.nativeElement.remove();
    });
});

/**
 * Switches Chromium's touch emulation, which is what flips `(pointer: coarse)`
 * and `(hover: none)` — `Emulation.setEmulatedMedia` silently ignores the
 * `pointer` feature.
 */
async function emulateTouch(enabled: boolean): Promise<void> {
    await cdp().send('Emulation.setTouchEmulationEnabled', { enabled, maxTouchPoints: 1 });
}

describe('FileUploadComponent — remove button', () => {
    afterEach(() => emulateTouch(false));

    async function removeButtonRect(): Promise<DOMRect> {
        const fixture = TestBed.createComponent(FileUploadComponent);
        fixture.componentInstance.addFiles([new File(['%PDF-1.7'], 'quarterly-report.pdf', { type: 'application/pdf' })]);
        fixture.detectChanges();
        await fixture.whenStable();
        const rect = (fixture.nativeElement as HTMLElement)
            .querySelector('button[aria-label="Remove file"]')!.getBoundingClientRect();
        fixture.destroy();
        return rect;
    }

    /** WCAG 2.5.8: a listed file's remove button is a 44x44 target on a touch screen and stays compact for a mouse. */
    it('grows the remove button to a 44x44 touch target on a coarse pointer only', async () => {
        await emulateTouch(false);
        const fine = await removeButtonRect();
        await emulateTouch(true);
        const coarse = await removeButtonRect();

        expect([fine.width, fine.height]).toEqual([26, 36]);
        expect(coarse.width).toBeGreaterThanOrEqual(44);
        expect(coarse.height).toBeGreaterThanOrEqual(44);
    });
});
