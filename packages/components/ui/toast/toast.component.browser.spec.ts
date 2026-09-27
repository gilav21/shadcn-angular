import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, it, expect } from 'vitest';
import { cdp } from 'vitest/browser';
import { ToasterComponent } from './sub/toaster.component';
import { ToastComponent } from './toast.component';

/** Browser-only: the toaster's placement is fixed-position geometry, which jsdom cannot lay out. */
@Component({
    template: `
    <div [dir]="dir()">
      <ui-toaster [vertical]="vertical()" [horizontal]="horizontal()" />
    </div>
  `,
    imports: [ToasterComponent],
})
class PlacementHost {
    readonly dir = signal<'ltr' | 'rtl'>('ltr');
    readonly vertical = signal<'top' | 'center' | 'bottom'>('bottom');
    readonly horizontal = signal<'start' | 'center' | 'end'>('end');
}

async function toasterRect(
    dir: 'ltr' | 'rtl',
    vertical: 'top' | 'bottom',
    horizontal: 'start' | 'end',
): Promise<DOMRect> {
    const fixture = TestBed.createComponent(PlacementHost);
    fixture.componentInstance.dir.set(dir);
    fixture.componentInstance.vertical.set(vertical);
    fixture.componentInstance.horizontal.set(horizontal);
    fixture.detectChanges();
    await fixture.whenStable();
    const container = fixture.nativeElement.querySelector('[data-slot="toaster"]') as HTMLElement;
    return container.getBoundingClientRect();
}

describe('ToasterComponent placement (browser)', () => {
    it('pins a top/start toaster to the top-left corner', async () => {
        const rect = await toasterRect('ltr', 'top', 'start');
        expect(rect.top).toBeCloseTo(0, 0);
        expect(rect.left).toBeCloseTo(0, 0);
        expect(rect.right).toBeLessThan(document.documentElement.clientWidth - 1);
    });

    it('mirrors an end toaster to the left edge in RTL', async () => {
        const viewportWidth = document.documentElement.clientWidth;

        const ltr = await toasterRect('ltr', 'bottom', 'end');
        expect(ltr.right).toBeCloseTo(viewportWidth, 0);
        expect(ltr.left).toBeGreaterThan(1);

        const rtl = await toasterRect('rtl', 'bottom', 'end');
        expect(rtl.left).toBeCloseTo(0, 0);
        expect(rtl.right).toBeLessThan(viewportWidth - 1);
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

@Component({
    template: `
    <div [dir]="dir()" style="width: 360px">
      <ui-toast title="Changes saved" description="Your profile was updated and synced to every signed-in device." />
    </div>
  `,
    imports: [ToastComponent],
})
class CloseHost {
    readonly dir = signal<'ltr' | 'rtl'>('ltr');
}

describe('ToastComponent close button (browser)', () => {
    afterEach(() => emulateTouch(false));

    /** Renders a toast under the current pointer emulation — the toast's `transition-all` would animate a live media switch. */
    async function renderToast(dir: 'ltr' | 'rtl') {
        const fixture = TestBed.createComponent(CloseHost);
        fixture.componentInstance.dir.set(dir);
        fixture.detectChanges();
        await fixture.whenStable();
        const toast = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('[data-slot="toast"]')!;
        const button = toast.querySelector<HTMLElement>(':scope > button[aria-label]')!;
        return {
            toast: toast.getBoundingClientRect(),
            button: button.getBoundingClientRect(),
            icon: button.querySelector('svg')!.getBoundingClientRect(),
            text: toast.querySelector<HTMLElement>('[data-slot="toast-title"]')!.parentElement!.getBoundingClientRect(),
        };
    }

    /**
     * WCAG 2.5.8: on a touch screen the close button must be a 44x44 target in
     * the toast's corner, and the text must make room for it so a tap on the
     * end of a line never dismisses the toast. A mouse user keeps the 24x24
     * button.
     */
    it.each(['ltr', 'rtl'] as const)(
        'grows the close button to a 44x44 touch target on a coarse pointer only, clear of the text, in the %s corner',
        async dir => {
            await emulateTouch(false);
            const fine = (await renderToast(dir)).button;
            await emulateTouch(true);
            const { toast: t, button: b, icon: i, text: x } = await renderToast(dir);

            expect([fine.width, fine.height]).toEqual([24, 24]);
            expect(b.width).toBeGreaterThanOrEqual(44);
            expect(b.height).toBeGreaterThanOrEqual(44);
            expect(b.top - t.top).toBeLessThanOrEqual(4);
            if (dir === 'ltr') {
                expect(t.right - b.right).toBeLessThanOrEqual(4);
                expect(b.left).toBeGreaterThanOrEqual(x.right);
            } else {
                expect(b.left - t.left).toBeLessThanOrEqual(4);
                expect(b.right).toBeLessThanOrEqual(x.left);
            }
            expect(i.left + i.width / 2).toBeCloseTo(b.left + b.width / 2, 0);
            expect(i.top + i.height / 2).toBeCloseTo(b.top + b.height / 2, 0);
        },
    );
});
