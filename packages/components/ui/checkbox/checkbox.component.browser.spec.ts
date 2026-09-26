import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { CheckboxComponent } from './checkbox.component';

/** Browser-only: asserts rendered geometry, which jsdom does not lay out. */
describe('CheckboxComponent layout (browser)', () => {
    it('should render the label beside the box, vertically centred on it', () => {
        const fixture = TestBed.createComponent(CheckboxComponent);
        fixture.componentRef.setInput('label', 'Accept terms');
        fixture.detectChanges();

        const root = fixture.nativeElement as HTMLElement;
        const box = root.querySelector<HTMLElement>('[data-slot="checkbox"]')!.getBoundingClientRect();
        const label = root.querySelector('label')!.getBoundingClientRect();

        expect(label.left).toBeGreaterThanOrEqual(box.right);
        expect(Math.abs((label.top + label.bottom) / 2 - (box.top + box.bottom) / 2)).toBeLessThanOrEqual(1);
    });
});
