import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { describe, it, expect } from 'vitest';
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
