import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { SpinnerComponent } from './spinner.component';
import { PageSpinnerComponent } from './sub/page-spinner.component';

/** Browser-only: preset sizes, the spin animation and the page overlay asserted as rendered layout. */
describe('Spinner layout (real browser)', () => {
    it.each([
        { variant: 'ring', size: 'default', part: 'svg', width: 20, height: 20 },
        { variant: 'ring', size: 'lg', part: 'svg', width: 24, height: 24 },
        { variant: 'dots', size: 'sm', part: '[data-slot="spinner"] > div', width: 6, height: 6 },
        { variant: 'bars', size: 'lg', part: '[data-slot="spinner"] > div', width: 6, height: 24 },
        { variant: 'pulse', size: 'xl', part: '[data-slot="spinner"]', width: 32, height: 32 },
    ])('renders $variant at size $size as $width x $height', async ({ variant, size, part, width, height }) => {
        await TestBed.configureTestingModule({ imports: [SpinnerComponent] }).compileComponents();
        const fixture = TestBed.createComponent(SpinnerComponent);
        fixture.componentRef.setInput('variant', variant);
        fixture.componentRef.setInput('size', size);
        fixture.detectChanges();

        const rect = (fixture.nativeElement as HTMLElement).querySelector(part)!.getBoundingClientRect();
        expect(rect.width).toBeCloseTo(width, 0);
        expect(rect.height).toBeCloseTo(height, 0);
    });

    it('spins the ring', async () => {
        await TestBed.configureTestingModule({ imports: [SpinnerComponent] }).compileComponents();
        const fixture = TestBed.createComponent(SpinnerComponent);
        fixture.detectChanges();

        const svg = (fixture.nativeElement as HTMLElement).querySelector('svg')!;
        expect(getComputedStyle(svg).animationName).not.toBe('none');
    });

    it('covers the whole viewport with the page overlay', async () => {
        await TestBed.configureTestingModule({ imports: [PageSpinnerComponent] }).compileComponents();
        const fixture = TestBed.createComponent(PageSpinnerComponent);
        fixture.detectChanges();

        const rect = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="page-spinner"]')!.getBoundingClientRect();
        expect([rect.left, rect.top, rect.width, rect.height])
            .toEqual([0, 0, document.documentElement.clientWidth, document.documentElement.clientHeight]);
    });
});
