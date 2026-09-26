import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { LabelComponent } from './label.component';

/** Browser-only: label typography is asserted as computed style, which jsdom does not resolve. */
describe('LabelComponent typography (browser)', () => {
    it('renders 14px medium text with a line height equal to its font size', () => {
        const fixture = TestBed.createComponent(LabelComponent);
        fixture.detectChanges();
        const style = getComputedStyle(fixture.nativeElement.querySelector('label'));
        expect(style.fontSize).toBe('14px');
        expect(style.fontWeight).toBe('500');
        expect(style.lineHeight).toBe(style.fontSize);
    });
});
