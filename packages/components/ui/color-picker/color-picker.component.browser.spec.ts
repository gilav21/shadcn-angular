import { TestBed } from '@angular/core/testing';
import { afterEach, describe, it, expect } from 'vitest';
import { cdp } from 'vitest/browser';
import { ColorPickerComponent } from './color-picker.component';
import { COLOR_PICKER_LOCALES } from './color-picker.locales';

/**
 * Switches Chromium's touch emulation, which is what flips `(pointer: coarse)`
 * and `(hover: none)` — `Emulation.setEmulatedMedia` silently ignores the
 * `pointer` feature.
 */
async function emulateTouch(enabled: boolean): Promise<void> {
    await cdp().send('Emulation.setTouchEmulationEnabled', { enabled, maxTouchPoints: 1 });
}

const LOCALE_EN = COLOR_PICKER_LOCALES['en'];

/**
 * Browser-only color-picker case: it measures rendered buttons, which needs
 * real CSS and layout. The portable (jsdom) leg and the shipped `testFiles`
 * exclude this file.
 */
describe('ColorPickerComponent copy buttons (browser)', () => {
    afterEach(() => emulateTouch(false));

    /** The copy button of each format, each rendered as the only (so active) tab. */
    async function copyButtonRects(): Promise<DOMRect[]> {
        const formats = [['hex', LOCALE_EN.copyHex], ['rgb', LOCALE_EN.copyRgb], ['hsl', LOCALE_EN.copyHsl], ['oklch', LOCALE_EN.copyOklch]] as const;
        const rects: DOMRect[] = [];
        for (const [format, label] of formats) {
            const fixture = TestBed.createComponent(ColorPickerComponent);
            fixture.componentRef.setInput('inline', true);
            fixture.componentRef.setInput('formats', [format]);
            fixture.detectChanges();
            await fixture.whenStable();
            rects.push((fixture.nativeElement as HTMLElement).querySelector(`button[aria-label="${label}"]`)!.getBoundingClientRect());
            fixture.destroy();
        }
        return rects;
    }

    /** WCAG 2.5.8: each format's copy button is a 44x44 target on a touch screen and keeps its compact size for a mouse. */
    it('grows every copy button to a 44x44 touch target on a coarse pointer only', async () => {
        await emulateTouch(false);
        const fine = await copyButtonRects();
        await emulateTouch(true);
        const coarse = await copyButtonRects();

        expect(fine.map((r) => [r.width, r.height])).toEqual([[32, 32], [28, 28], [28, 28], [28, 28]]);
        for (const r of coarse) {
            expect(r.width).toBeGreaterThanOrEqual(44);
            expect(r.height).toBeGreaterThanOrEqual(44);
        }
    });
});
