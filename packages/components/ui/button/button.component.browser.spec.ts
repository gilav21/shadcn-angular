import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { ButtonComponent } from './button.component';

/** Browser-only: button sizes are scoped CSS keyed on `data-size`, asserted as computed style. */
function renderInner(size?: 'sm' | 'lg' | 'icon'): { el: HTMLElement; style: CSSStyleDeclaration } {
    const fixture = TestBed.createComponent(ButtonComponent);
    if (size) fixture.componentRef.setInput('size', size);
    fixture.detectChanges();
    const el = (fixture.nativeElement as HTMLElement).querySelector('button')!;
    return { el, style: getComputedStyle(el) };
}

describe('ButtonComponent sizes (browser)', () => {
    it('renders a 32px small button with 12px text, shorter than the 36px default', () => {
        expect(renderInner().el.getBoundingClientRect().height).toBe(36);
        const { el, style } = renderInner('sm');
        expect(el.getBoundingClientRect().height).toBe(32);
        expect(style.fontSize).toBe('12px');
    });

    it('renders a 40px large button with tighter corners than the default', () => {
        const defaultRadius = Number.parseFloat(renderInner().style.borderTopLeftRadius);
        const { el, style } = renderInner('lg');
        expect(el.getBoundingClientRect().height).toBe(40);
        expect(Number.parseFloat(style.borderTopLeftRadius)).toBeLessThan(defaultRadius);
    });

    it('renders a square 36px icon button with no padding', () => {
        const { el, style } = renderInner('icon');
        const rect = el.getBoundingClientRect();
        expect(rect.width).toBe(36);
        expect(rect.height).toBe(36);
        expect(style.paddingLeft).toBe('0px');
        expect(style.paddingTop).toBe('0px');
    });
});
