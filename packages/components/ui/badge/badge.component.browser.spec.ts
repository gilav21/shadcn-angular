import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { BadgeComponent } from './badge.component';

/** Browser-only: asserts resolved style, which jsdom does not compute from classes. */
describe('BadgeComponent layout (browser)', () => {
    it('renders as an inline flex row with vertically centred content', () => {
        const fixture = TestBed.createComponent(BadgeComponent);
        fixture.detectChanges();
        const style = getComputedStyle(fixture.nativeElement as HTMLElement);
        expect(style.display).toBe('inline-flex');
        expect(style.alignItems).toBe('center');
    });
});
