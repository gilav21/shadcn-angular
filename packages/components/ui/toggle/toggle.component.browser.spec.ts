import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { ToggleComponent } from './toggle.component';

/** Browser-only: size presets are asserted as rendered height, which jsdom cannot lay out. */
describe('ToggleComponent sizes (browser)', () => {
    it('renders 32 / 36 / 40px tall for sm / default / lg at density 1', () => {
        const fixture = TestBed.createComponent(ToggleComponent);
        const height = (): number =>
            (fixture.nativeElement.querySelector('button') as HTMLElement).getBoundingClientRect().height;
        const heights: Record<string, number> = {};
        for (const size of ['sm', 'default', 'lg'] as const) {
            fixture.componentRef.setInput('size', size);
            fixture.detectChanges();
            heights[size] = height();
        }
        expect(heights).toEqual({ sm: 32, default: 36, lg: 40 });
    });
});
