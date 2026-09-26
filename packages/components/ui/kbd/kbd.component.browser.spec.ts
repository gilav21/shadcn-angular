import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { KbdComponent } from './kbd.component';

@Component({
    template: `<ui-kbd>Ctrl</ui-kbd>`,
    imports: [KbdComponent],
})
class KbdHost { }

/** Real-style case: computed display and font, which jsdom does not compute. */
describe('KbdComponent — appearance', () => {
    it('renders the key as an inline-flex monospace chip', () => {
        const fixture = TestBed.createComponent(KbdHost);
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();

        const style = getComputedStyle(fixture.nativeElement.querySelector('kbd') as HTMLElement);
        expect(style.display).toBe('inline-flex');
        // The theme's mono stack (Tailwind preflight and font-mono both supply it), not the UA's bare `monospace`.
        expect(style.fontFamily).toMatch(/^ui-monospace/);

        fixture.destroy();
        fixture.nativeElement.remove();
    });
});
