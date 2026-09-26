import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { ToasterComponent } from './sub/toaster.component';

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
