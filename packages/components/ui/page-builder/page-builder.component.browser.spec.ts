import { TestBed } from '@angular/core/testing';
import { afterEach, describe, it, expect } from 'vitest';
import { cdp } from 'vitest/browser';
import { PageBuilderComponent } from './page-builder.component';

/**
 * Switches Chromium's touch emulation, which is what flips `(pointer: coarse)`
 * and `(hover: none)` — `Emulation.setEmulatedMedia` silently ignores the
 * `pointer` feature.
 */
async function emulateTouch(enabled: boolean): Promise<void> {
    await cdp().send('Emulation.setTouchEmulationEnabled', { enabled, maxTouchPoints: 1 });
}

/**
 * Browser-only page-builder case: it measures rendered buttons, which needs
 * real CSS and layout. The portable (jsdom) leg and the shipped `testFiles`
 * exclude this file.
 */
describe('PageBuilderComponent radius presets (browser)', () => {
    afterEach(() => emulateTouch(false));

    async function presetRects(): Promise<DOMRect[]> {
        const fixture = TestBed.createComponent(PageBuilderComponent);
        fixture.detectChanges();
        await fixture.whenStable();
        const input = (fixture.nativeElement as HTMLElement).querySelector('#pb-border-radius')!;
        const rects = Array.from(input.parentElement!.querySelectorAll('button'), (button) => button.getBoundingClientRect());
        fixture.destroy();
        return rects;
    }

    /** WCAG 2.5.8: the border-radius presets are 44x44 targets on a touch screen and stay 24x24 for a mouse. */
    it('grows the radius preset buttons to 44x44 touch targets on a coarse pointer only', async () => {
        await emulateTouch(false);
        const fine = await presetRects();
        await emulateTouch(true);
        const coarse = await presetRects();

        expect(fine.map((r) => [r.width, r.height])).toEqual([[24, 24], [24, 24], [24, 24]]);
        for (const r of coarse) {
            expect(r.width).toBeGreaterThanOrEqual(44);
            expect(r.height).toBeGreaterThanOrEqual(44);
        }
    });
});
