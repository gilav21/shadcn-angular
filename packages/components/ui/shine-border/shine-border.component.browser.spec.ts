import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { ShineBorderComponent } from './shine-border.component';

/** Browser-only shine-border layout: wrapper and host boxes come from utility classes, so only computed style shows them. */
@Component({
    template: `<ui-shine-border [borderRadius]="16"><span>Content</span></ui-shine-border>`,
    imports: [ShineBorderComponent],
})
class Host {}

@Component({
    template: `<ui-shine-border [colors]="['#ff0000']"><span>Content</span></ui-shine-border>`,
    imports: [ShineBorderComponent],
})
class SingleColourHost {}

function mount(): HTMLElement {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
}

describe('ShineBorder rendering', () => {
    it('renders the wrapper as a positioned inline block', () => {
        const style = getComputedStyle(mount().querySelector('[data-slot="shine-border"]')!);
        expect(style.display).toBe('inline-block');
        expect(style.position).toBe('relative');
    });

    it('generates no box of its own', () => {
        expect(getComputedStyle(mount().querySelector('ui-shine-border')!).display).toBe('contents');
    });

    it('rounds the inner surface to the wrapper radius, keeping the rim concentric', () => {
        const inner = mount().querySelector('[data-slot="shine-border"] > div')!;
        expect(getComputedStyle(inner).borderTopLeftRadius).toBe('16px');
    });

    // jsdom's CSS parser drops a one-stop gradient; Chromium keeps it and paints a solid rim.
    it('draws a single-colour rim', () => {
        const fixture = TestBed.createComponent(SingleColourHost);
        fixture.detectChanges();
        const wrapper = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('[data-slot="shine-border"]')!;
        const image = getComputedStyle(wrapper).backgroundImage;
        expect(image).toMatch(/^conic-gradient\(/);
        expect(image).toContain('rgb(255, 0, 0)');
    });
});
