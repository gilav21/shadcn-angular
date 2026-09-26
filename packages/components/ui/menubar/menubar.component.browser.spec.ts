import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { MenubarItemComponent } from './';

/** Real-browser check: the inset indent is computed padding, which jsdom does not resolve. */
@Component({
    template: `
        <div [dir]="dir()" style="width: 240px">
            <ui-menubar-item>Plain</ui-menubar-item>
            <ui-menubar-item inset>Inset</ui-menubar-item>
        </div>
    `,
    imports: [MenubarItemComponent],
})
class InsetHost {
    readonly dir = signal<'ltr' | 'rtl'>('ltr');
}

describe('Menubar item inset (browser)', () => {
    it.each(['ltr', 'rtl'] as const)('indents an inset item on the inline-start side under dir="%s"', dir => {
        TestBed.configureTestingModule({ imports: [InsetHost] });
        const fixture = TestBed.createComponent(InsetHost);
        fixture.componentInstance.dir.set(dir);
        fixture.detectChanges();

        const [plain, inset] = Array.from(
            (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[data-slot="menubar-item"]'),
        ).map(el => getComputedStyle(el));
        const start = dir === 'ltr' ? 'paddingLeft' : 'paddingRight';
        const end = dir === 'ltr' ? 'paddingRight' : 'paddingLeft';

        expect(Number.parseFloat(inset[start])).toBeGreaterThan(Number.parseFloat(plain[start]));
        expect(inset[end]).toBe(plain[end]);
    });
});
