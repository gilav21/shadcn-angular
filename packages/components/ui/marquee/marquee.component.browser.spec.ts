import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { MarqueeComponent } from './marquee.component';

/** Browser-only: clipping is asserted as computed overflow, which jsdom does not resolve. */
@Component({
    template: `<ui-marquee><span>Item A</span><span>Item B</span></ui-marquee>`,
    imports: [MarqueeComponent],
})
class Host { }

describe('MarqueeComponent clipping (browser)', () => {
    it('clips the scrolling track to its box', () => {
        const fixture = TestBed.createComponent(Host);
        fixture.detectChanges();
        const marquee = fixture.nativeElement.querySelector('[data-slot="marquee"]') as HTMLElement;
        expect(getComputedStyle(marquee).overflow).toBe('hidden');
    });
});
