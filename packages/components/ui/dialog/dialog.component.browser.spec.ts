import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, describe, it, expect } from 'vitest';
import { cdp } from 'vitest/browser';
import { DialogComponent, DialogContentComponent } from '../dialog';

/**
 * Switches Chromium's touch emulation, which is what flips `(pointer: coarse)`
 * and `(hover: none)` — `Emulation.setEmulatedMedia` silently ignores the
 * `pointer` feature.
 */
async function emulateTouch(enabled: boolean): Promise<void> {
    await cdp().send('Emulation.setTouchEmulationEnabled', { enabled, maxTouchPoints: 1 });
}

@Component({
    template: `
        <div [dir]="dir()">
            <ui-dialog>
                <ui-dialog-content title="Edit profile">Body</ui-dialog-content>
            </ui-dialog>
        </div>
    `,
    imports: [DialogComponent, DialogContentComponent],
})
class CloseHost {
    readonly dir = signal<'ltr' | 'rtl'>('ltr');
}

/** Real-browser touch-target checks: hit-area size is geometry, which jsdom cannot lay out. */
describe('Dialog close button (browser)', () => {
    afterEach(async () => {
        await emulateTouch(false);
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
    });

    async function openDialog(dir: 'ltr' | 'rtl'): Promise<HTMLElement> {
        TestBed.configureTestingModule({ imports: [CloseHost] });
        const fixture = TestBed.createComponent(CloseHost);
        fixture.componentInstance.dir.set(dir);
        fixture.detectChanges();
        (fixture.debugElement.query(By.directive(DialogComponent)).componentInstance as DialogComponent).show();
        fixture.detectChanges();
        await fixture.whenStable();
        return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('[data-slot="dialog-content"]')!;
    }

    /**
     * WCAG 2.5.8: on a touch screen the corner close button must be a 44x44
     * target, while a mouse user keeps today's 16x16 button. The icon has to
     * stay put either way, so the bigger target never pushes it out of the
     * corner or onto the title.
     */
    it.each(['ltr', 'rtl'] as const)(
        'grows the close button to a 44x44 touch target on a coarse pointer only, icon fixed in the %s corner',
        async dir => {
            const panel = await openDialog(dir);
            const button = panel.querySelector<HTMLElement>(':scope > button[aria-label]')!;
            const icon = button.querySelector('svg')!;
            const measure = () => {
                const p = panel.getBoundingClientRect();
                const b = button.getBoundingClientRect();
                const i = icon.getBoundingClientRect();
                const iconX = i.left + i.width / 2;
                const iconY = i.top + i.height / 2;
                return {
                    width: b.width,
                    height: b.height,
                    fromCornerX: dir === 'ltr' ? p.right - iconX : iconX - p.left,
                    fromCornerY: iconY - p.top,
                    offCentreX: iconX - (b.left + b.width / 2),
                    offCentreY: iconY - (b.top + b.height / 2),
                };
            };

            await emulateTouch(false);
            const fine = measure();
            await emulateTouch(true);
            const coarse = measure();

            expect([fine.width, fine.height]).toEqual([16, 16]);
            expect(coarse.width).toBeGreaterThanOrEqual(44);
            expect(coarse.height).toBeGreaterThanOrEqual(44);
            expect(coarse.fromCornerX).toBeCloseTo(fine.fromCornerX, 0);
            expect(coarse.fromCornerY).toBeCloseTo(fine.fromCornerY, 0);
            expect(coarse.offCentreX).toBeCloseTo(0, 0);
            expect(coarse.offCentreY).toBeCloseTo(0, 0);
        },
    );
});
