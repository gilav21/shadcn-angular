import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, describe, it, expect } from 'vitest';
import { SheetComponent, SheetContentComponent } from '../sheet';

/** Real-browser docking checks: side placement is geometry, which jsdom cannot lay out. */
@Component({
    template: `
        <div [dir]="dir()">
            <ui-sheet>
                <ui-sheet-content [side]="side()">Panel</ui-sheet-content>
            </ui-sheet>
        </div>
    `,
    imports: [SheetComponent, SheetContentComponent],
})
class DockHost {
    readonly dir = signal<'ltr' | 'rtl'>('ltr');
    readonly side = signal<'left' | 'right'>('right');
}

describe('Sheet side docking (browser)', () => {
    afterEach(() => {
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
    });

    async function panelRect(dir: 'ltr' | 'rtl', side: 'left' | 'right'): Promise<DOMRect> {
        TestBed.configureTestingModule({ imports: [DockHost] });
        const fixture = TestBed.createComponent(DockHost);
        fixture.componentInstance.dir.set(dir);
        fixture.componentInstance.side.set(side);
        fixture.detectChanges();
        (fixture.debugElement.query(By.directive(SheetComponent)).componentInstance as SheetComponent).show();
        fixture.detectChanges();
        await fixture.whenStable();
        const panel = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('[data-slot="sheet-content"]');
        return panel!.getBoundingClientRect();
    }

    const viewportWidth = () => document.documentElement.clientWidth;

    it.each([
        { dir: 'ltr', side: 'right', edge: 'right' },
        { dir: 'ltr', side: 'left', edge: 'left' },
        { dir: 'rtl', side: 'right', edge: 'left' },
        { dir: 'rtl', side: 'left', edge: 'right' },
    ] as const)('side="$side" under dir="$dir" docks to the viewport $edge edge', async ({ dir, side, edge }) => {
        const rect = await panelRect(dir, side);
        expect(rect.width).toBeLessThan(viewportWidth());
        if (edge === 'right') {
            expect(rect.right).toBeCloseTo(viewportWidth(), 0);
        } else {
            expect(rect.left).toBeCloseTo(0, 0);
        }
    });
});
