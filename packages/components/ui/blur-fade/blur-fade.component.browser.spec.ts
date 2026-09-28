import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { BlurFadeComponent } from './blur-fade.component';

@Component({
    template: `<ui-blur-fade><span>Fade content</span></ui-blur-fade>`,
    imports: [BlurFadeComponent],
})
class BlurFadeHost { }

/** Real-style case: a transform only applies to a non-inline host, and jsdom computes no display. */
describe('BlurFadeComponent — host box', () => {
    it('renders the host as a block so its transform applies', () => {
        const fixture = TestBed.createComponent(BlurFadeHost);
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();

        const host = fixture.nativeElement.querySelector('ui-blur-fade') as HTMLElement;
        expect(getComputedStyle(host).display).toBe('block');

        fixture.destroy();
        fixture.nativeElement.remove();
    });
});
