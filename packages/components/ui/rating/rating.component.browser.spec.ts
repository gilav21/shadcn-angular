import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { RatingComponent } from './rating.component';

/** Real-layout check: star boxes and glyphs are sized by `size`, whatever their fill. */
describe('RatingComponent star size (browser)', () => {
    it.each([
        ['sm', 16],
        ['md', 20],
        ['lg', 24],
    ] as const)('sizes every star button and glyph to %spx for size "%s"', (size, px) => {
        const fixture = TestBed.createComponent(RatingComponent);
        fixture.componentRef.setInput('size', size);
        fixture.componentRef.setInput('precision', 0.5);
        fixture.componentInstance.writeValue(1.5);
        fixture.detectChanges();

        const stars = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button[data-star]')];
        // Value 1.5 renders a full, a half and three empty glyphs.
        expect(stars.map(b => b.querySelector('svg')!.getAttribute('fill') ?? 'gradient'))
            .toEqual(['currentColor', 'gradient', 'none', 'none', 'none']);
        const sizes = stars.flatMap(b => [b, b.querySelector('svg')!]).map(el => {
            const r = el.getBoundingClientRect();
            return [r.width, r.height];
        });
        expect(sizes).toEqual(new Array(stars.length * 2).fill([px, px]));
    });
});

@Component({
    template: `
        <div dir="rtl">
            <ui-rating [(value)]="value" [precision]="0.5" />
        </div>
    `,
    imports: [RatingComponent],
})
class RtlHost {
    readonly value = signal(0);
}

/**
 * Direction is resolved from the host's computed style, so an ancestor
 * dir="rtl" must flip half-star hit-testing, the arrow keys and the half fill.
 */
describe('RatingComponent under an RTL ancestor (browser)', () => {
    let fixture: ComponentFixture<RtlHost>;

    const rating = (): RatingComponent => fixture.debugElement.query(By.directive(RatingComponent)).componentInstance;
    const star = (i: number): HTMLElement =>
        (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('button[data-star]')[i];
    const rangeInput = (): HTMLInputElement =>
        (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input[type="range"]')!;
    const nearRightEdge = (type: string, el: HTMLElement): MouseEvent => {
        const rect = el.getBoundingClientRect();
        return new MouseEvent(type, { bubbles: true, clientX: rect.right - 2, clientY: rect.top + rect.height / 2 });
    };
    function setValue(v: number): void {
        fixture.componentInstance.value.set(v);
        fixture.detectChanges();
    }
    function press(key: string): void {
        rangeInput().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
        fixture.detectChanges();
    }

    beforeEach(() => {
        fixture = TestBed.createComponent(RtlHost);
        fixture.detectChanges();
    });

    it('treats the right half as the lower value on RTL click', () => {
        star(2).dispatchEvent(nearRightEdge('click', star(2)));
        fixture.detectChanges();
        expect(fixture.componentInstance.value()).toBe(2.5);
    });

    it('treats the right half as the lower value on RTL hover', () => {
        star(2).dispatchEvent(nearRightEdge('mousemove', star(2)));
        fixture.detectChanges();
        expect(rating().hoverValue()).toBe(2.5);
    });

    it('ArrowLeft increases value in RTL', () => {
        setValue(2);
        press('ArrowLeft');
        expect(fixture.componentInstance.value()).toBe(2.5);
    });

    it('ArrowRight decreases value in RTL', () => {
        setValue(2);
        press('ArrowRight');
        expect(fixture.componentInstance.value()).toBe(1.5);
    });

    it('renders an RTL half-fill gradient', () => {
        setValue(2.5);
        const stops = [...(fixture.nativeElement as HTMLElement).querySelectorAll('stop')]
            .map(s => s.getAttribute('stop-color'));
        // RTL fills the half on the inline start, which is the physical right.
        expect(stops).toEqual(['transparent', 'currentColor']);
    });
});
