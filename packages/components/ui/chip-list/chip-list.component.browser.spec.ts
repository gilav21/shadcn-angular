import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { afterEach, describe, it, expect } from 'vitest';
import { cdp } from 'vitest/browser';
import { ChipListComponent } from './chip-list.component';

/** Browser-only: asserts resolved padding, which needs real CSS and layout. */
@Component({
    template: `
    <div [dir]="dir()">
      <ui-chip-list [ngModel]="chips" />
    </div>
  `,
    imports: [ChipListComponent, FormsModule],
})
class DirHost {
    readonly chips = ['React'];
    readonly dir = signal<'ltr' | 'rtl'>('ltr');
}

async function chipPadding(dir: 'ltr' | 'rtl'): Promise<{ left: string; right: string }> {
    const fixture = TestBed.createComponent(DirHost);
    fixture.componentInstance.dir.set(dir);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const chip = fixture.nativeElement.querySelector('ui-badge') as HTMLElement;
    const style = getComputedStyle(chip);
    return { left: style.paddingLeft, right: style.paddingRight };
}

describe('ChipListComponent (browser layout)', () => {
    it('tightens the padding on the remove-button side, mirrored in RTL', async () => {
        const ltr = await chipPadding('ltr');
        expect(ltr.right).toBe('4px');
        expect(ltr.left).not.toBe('4px');

        const rtl = await chipPadding('rtl');
        expect(rtl.left).toBe('4px');
        expect(rtl.right).not.toBe('4px');
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

describe('ChipListComponent remove button (browser)', () => {
    afterEach(() => emulateTouch(false));

    async function removeButtonRect(): Promise<DOMRect> {
        const fixture = TestBed.createComponent(DirHost);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        const rect = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="chip-remove"]')!.getBoundingClientRect();
        fixture.destroy();
        return rect;
    }

    /** WCAG 2.5.8: the chip's remove button is a 44x44 target on a touch screen and stays 16x16 for a mouse. */
    it('grows the remove button to a 44x44 touch target on a coarse pointer only', async () => {
        await emulateTouch(false);
        const fine = await removeButtonRect();
        await emulateTouch(true);
        const coarse = await removeButtonRect();

        expect([fine.width, fine.height]).toEqual([16, 16]);
        expect(coarse.width).toBeGreaterThanOrEqual(44);
        expect(coarse.height).toBeGreaterThanOrEqual(44);
    });
});
