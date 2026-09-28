import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, it, expect } from 'vitest';
import { cdp } from 'vitest/browser';
import { BannerComponent } from './banner.component';

@Component({
    template: `
        <div [style.width.px]="width()">
            <ui-banner [message]="message()" />
        </div>
    `,
    imports: [BannerComponent],
})
class ContainerHost {
    readonly width = signal(480);
    readonly message = signal('Scheduled maintenance at 02:00 UTC.');
}

describe('BannerComponent layout (browser)', () => {
    function render(width: number, message?: string) {
        const fixture = TestBed.createComponent(ContainerHost);
        fixture.componentInstance.width.set(width);
        if (message !== undefined) fixture.componentInstance.message.set(message);
        fixture.detectChanges();
        const root = fixture.nativeElement as HTMLElement;
        return {
            container: root.firstElementChild as HTMLElement,
            banner: root.querySelector<HTMLElement>('ui-banner')!,
            message: root.querySelector<HTMLElement>('[data-slot="banner-message"]')!,
        };
    }

    it('spans the full width of its container', () => {
        const { container, banner } = render(480);
        expect(banner.getBoundingClientRect().width).toBe(container.getBoundingClientRect().width);
    });

    it('wraps an extremely long unbroken message instead of overflowing', () => {
        const { banner, message } = render(200, 'x'.repeat(400));
        expect(message.scrollWidth).toBeLessThanOrEqual(message.clientWidth);
        const msg = message.getBoundingClientRect();
        const box = banner.getBoundingClientRect();
        expect(msg.left).toBeGreaterThanOrEqual(box.left);
        expect(msg.right).toBeLessThanOrEqual(box.right);
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
    template: `<ui-banner message="Scheduled maintenance at 02:00 UTC." dismissible />`,
    imports: [BannerComponent],
})
class DismissHost {}

describe('BannerComponent dismiss button (browser)', () => {
    afterEach(() => emulateTouch(false));

    async function dismissRect(): Promise<DOMRect> {
        const fixture = TestBed.createComponent(DismissHost);
        fixture.detectChanges();
        await fixture.whenStable();
        const rect = (fixture.nativeElement as HTMLElement)
            .querySelector('[data-slot="banner-dismiss"] button')!.getBoundingClientRect();
        fixture.destroy();
        return rect;
    }

    /** WCAG 2.5.8: the dismiss button is a 44x44 target on a touch screen and keeps its 32x32 size for a mouse. */
    it('grows the dismiss button to a 44x44 touch target on a coarse pointer only', async () => {
        await emulateTouch(false);
        const fine = await dismissRect();
        await emulateTouch(true);
        const coarse = await dismissRect();

        expect([fine.width, fine.height]).toEqual([32, 32]);
        expect(coarse.width).toBeGreaterThanOrEqual(44);
        expect(coarse.height).toBeGreaterThanOrEqual(44);
    });
});
