import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect, afterEach } from 'vitest';
import {
    CarouselComponent,
    CarouselContentComponent,
    CarouselItemComponent,
    CarouselPreviousComponent,
    CarouselNextComponent,
} from './index';

/**
 * Real-layout carousel cases: geometry, computed style and the `dir` cascade
 * into computed `direction`, none of which jsdom computes.
 */
@Component({
    template: `
        <div style="margin: 80px 0; width: 300px">
            <ui-carousel orientation="vertical">
                <ui-carousel-content>
                    <ui-carousel-item>Slide 1</ui-carousel-item>
                    <ui-carousel-item>Slide 2</ui-carousel-item>
                </ui-carousel-content>
                <ui-carousel-previous />
                <ui-carousel-next />
            </ui-carousel>
        </div>
    `,
    imports: [CarouselComponent, CarouselContentComponent, CarouselItemComponent, CarouselPreviousComponent, CarouselNextComponent],
})
class VerticalHost { }

@Component({
    template: `
        <ui-carousel>
            <ui-carousel-content>
                <ui-carousel-item>Slide 1</ui-carousel-item>
                <ui-carousel-item>Slide 2</ui-carousel-item>
            </ui-carousel-content>
        </ui-carousel>
    `,
    imports: [CarouselComponent, CarouselContentComponent, CarouselItemComponent],
})
class HorizontalHost { }

function el(fixture: ComponentFixture<unknown>, slot: string): HTMLElement {
    return fixture.debugElement.query(By.css(`[data-slot="${slot}"]`)).nativeElement as HTMLElement;
}

describe('Carousel — vertical layout', () => {
    let fixture: ComponentFixture<VerticalHost>;

    function render(): void {
        fixture = TestBed.createComponent(VerticalHost);
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();
    }

    afterEach(() => {
        fixture.destroy();
        fixture.nativeElement.remove();
    });

    it('stacks the slides top to bottom', () => {
        render();
        const content = el(fixture, 'carousel-content');
        const [first, second] = fixture.debugElement
            .queryAll(By.css('[data-slot="carousel-item"]'))
            .map(d => (d.nativeElement as HTMLElement).getBoundingClientRect());

        expect(getComputedStyle(content).flexDirection).toBe('column');
        expect(second.top).toBeGreaterThanOrEqual(first.bottom);
        expect(second.left).toBe(first.left);
    });

    it('puts the slide gutter on the block start, not the inline start', () => {
        render();
        const item = getComputedStyle(el(fixture, 'carousel-item'));

        expect(Number.parseFloat(item.paddingTop)).toBeGreaterThan(0);
        expect(Number.parseFloat(item.paddingInlineStart)).toBe(0);
    });

    it('rotates the previous/next buttons and places them above and below the carousel', () => {
        render();
        const carousel = el(fixture, 'carousel').getBoundingClientRect();
        const prev = el(fixture, 'carousel-previous');
        const next = el(fixture, 'carousel-next');

        expect(getComputedStyle(prev).rotate).toBe('90deg');
        expect(getComputedStyle(next).rotate).toBe('90deg');
        expect(prev.getBoundingClientRect().bottom).toBeLessThanOrEqual(carousel.top);
        expect(next.getBoundingClientRect().top).toBeGreaterThanOrEqual(carousel.bottom);
    });
});

describe('Carousel — document direction', () => {
    afterEach(() => document.documentElement.removeAttribute('dir'));

    it('re-reads RTL state when the document dir attribute mutates', async () => {
        const fixture = TestBed.createComponent(HorizontalHost);
        fixture.detectChanges();
        const carousel = fixture.debugElement.query(By.directive(CarouselComponent)).componentInstance as CarouselComponent;
        // Let the post-init setup re-read direction first, so only the observer can flip it below.
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(carousel.rtl()).toBe(false);

        document.documentElement.setAttribute('dir', 'rtl');
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(carousel.rtl()).toBe(true);
        fixture.destroy();
    });
});
