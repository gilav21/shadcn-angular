import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
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
