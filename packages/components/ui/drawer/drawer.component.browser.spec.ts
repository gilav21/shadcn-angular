import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { DrawerComponent, DrawerContentComponent, DrawerTriggerComponent } from './index';

/** Browser-only: which edge the panel docks to is layout, asserted as geometry. */
@Component({
    template: `
        <div [dir]="dir()">
            <ui-drawer direction="right">
                <ui-drawer-trigger>فتح</ui-drawer-trigger>
                <ui-drawer-content>محتوى</ui-drawer-content>
            </ui-drawer>
        </div>
    `,
    imports: [DrawerComponent, DrawerTriggerComponent, DrawerContentComponent],
})
class DirectionHost {
    readonly dir = signal<'ltr' | 'rtl'>('ltr');
}

describe('Drawer RTL Support (browser)', () => {
    afterEach(() => {
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
    });

    it.each([
        { dir: 'ltr' as const, edge: 'right' },
        { dir: 'rtl' as const, edge: 'left' },
    ])('docks a right drawer to the $edge edge under dir="$dir"', async ({ dir, edge }) => {
        const fixture = TestBed.createComponent(DirectionHost);
        fixture.componentInstance.dir.set(dir);
        fixture.detectChanges();

        const root = fixture.nativeElement as HTMLElement;
        root.querySelector<HTMLElement>('[data-slot="drawer-trigger"]')!.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const panel = root.querySelector('[data-slot="drawer-content"]')!.getBoundingClientRect();
        const viewport = document.documentElement.clientWidth;
        expect(panel.width).toBeLessThan(viewport);
        if (edge === 'right') {
            expect(panel.right).toBeCloseTo(viewport, 0);
        } else {
            expect(panel.left).toBeCloseTo(0, 0);
        }
    });
});
