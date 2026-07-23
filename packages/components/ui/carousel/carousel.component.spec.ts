import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CarouselComponent, CarouselContentComponent, CarouselItemComponent, CarouselPreviousComponent, CarouselNextComponent } from './index';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Shared jsdom stubs ──────────────────────────────────────────────────────
// jsdom lacks ResizeObserver; the carousel constructs one in ngAfterContentInit.
// Stub it (via vi.stubGlobal) for the whole file and unstub after each test.
class ResizeObserverStub {
    observe(): void { /* no-op */ }
    unobserve(): void { /* no-op */ }
    disconnect(): void { /* no-op */ }
}

beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
});

afterEach(() => {
    document.documentElement.removeAttribute('dir');
    vi.unstubAllGlobals();
});

// ── Shared helpers (hoisted to module scope, no duplication) ─────────────────
/** Runs the ngAfterContentInit setTimeout(0) then re-renders. */
async function flushSetup(fixture: ComponentFixture<unknown>): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
}

function getCarousel(fixture: ComponentFixture<unknown>): CarouselComponent {
    return fixture.debugElement.query(By.directive(CarouselComponent)).componentInstance as CarouselComponent;
}

function getScrollEl(fixture: ComponentFixture<unknown>): HTMLElement {
    return fixture.debugElement.query(By.css('[data-slot="carousel-content"]')).nativeElement as HTMLElement;
}

function getItems(fixture: ComponentFixture<unknown>): HTMLElement[] {
    return fixture.debugElement.queryAll(By.css('[data-slot="carousel-item"]')).map((d) => d.nativeElement as HTMLElement);
}

/** Defines read-only scroll/size metrics on an element for jsdom (which reports 0). */
function setMetrics(el: HTMLElement, metrics: Record<string, number>): void {
    for (const [key, value] of Object.entries(metrics)) {
        Object.defineProperty(el, key, { configurable: true, get: () => value });
    }
}

// ── Test hosts ───────────────────────────────────────────────────────────────
@Component({
    template: `
        <ui-carousel>
            <ui-carousel-content>
                <ui-carousel-item>Slide 1</ui-carousel-item>
                <ui-carousel-item>Slide 2</ui-carousel-item>
                <ui-carousel-item>Slide 3</ui-carousel-item>
            </ui-carousel-content>
            <ui-carousel-previous />
            <ui-carousel-next />
        </ui-carousel>
    `,
    imports: [CarouselComponent, CarouselContentComponent, CarouselItemComponent, CarouselPreviousComponent, CarouselNextComponent]
})
class TestHostComponent { }

@Component({
    template: `
        <ui-carousel orientation="vertical">
            <ui-carousel-content>
                <ui-carousel-item>Slide 1</ui-carousel-item>
                <ui-carousel-item>Slide 2</ui-carousel-item>
            </ui-carousel-content>
        </ui-carousel>
    `,
    imports: [CarouselComponent, CarouselContentComponent, CarouselItemComponent]
})
class VerticalTestHost { }

@Component({
    template: `
        <ui-carousel orientation="vertical">
            <ui-carousel-content>
                <ui-carousel-item>Slide 1</ui-carousel-item>
                <ui-carousel-item>Slide 2</ui-carousel-item>
            </ui-carousel-content>
            <ui-carousel-previous />
            <ui-carousel-next />
        </ui-carousel>
    `,
    imports: [CarouselComponent, CarouselContentComponent, CarouselItemComponent, CarouselPreviousComponent, CarouselNextComponent]
})
class VerticalWithButtonsHost { }

@Component({
    template: `
        <ui-carousel>
            <ui-carousel-content></ui-carousel-content>
        </ui-carousel>
    `,
    imports: [CarouselComponent, CarouselContentComponent]
})
class EmptyContentHost { }

@Component({
    template: `
        <div [dir]="dir()">
            <ui-carousel>
                <ui-carousel-content>
                    <ui-carousel-item>شريحة 1</ui-carousel-item>
                    <ui-carousel-item>شريحة 2</ui-carousel-item>
                </ui-carousel-content>
                <ui-carousel-previous />
                <ui-carousel-next />
            </ui-carousel>
        </div>
    `,
    imports: [CarouselComponent, CarouselContentComponent, CarouselItemComponent, CarouselPreviousComponent, CarouselNextComponent]
})
class RTLTestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
}

describe('CarouselComponent', () => {
    let component: CarouselComponent;
    let fixture: ComponentFixture<CarouselComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [CarouselComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(CarouselComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have data-slot="carousel"', () => {
        const carousel = fixture.debugElement.query(By.css('[data-slot="carousel"]'));
        expect(carousel).toBeTruthy();
    });

    it('should have role="region"', () => {
        const carousel = fixture.debugElement.query(By.css('[role="region"]'));
        expect(carousel).toBeTruthy();
    });

    it('should have default orientation of horizontal', () => {
        expect(component.orientation()).toBe('horizontal');
    });

    it('should have aria-roledescription="carousel"', () => {
        const carousel = fixture.debugElement.query(By.css('[aria-roledescription="carousel"]'));
        expect(carousel).toBeTruthy();
    });

    it('applies a custom class input', () => {
        fixture.componentRef.setInput('class', 'my-extra');
        fixture.detectChanges();
        expect(component.classes()).toContain('my-extra');
    });

    it('scroll methods no-op before a scroll container exists', async () => {
        await flushSetup(fixture);
        expect(() => {
            component.scrollPrev();
            component.scrollNext();
            component.scrollTo(0);
            component.updateScrollState();
        }).not.toThrow();
        expect(component.canScrollNext()).toBe(true);
    });
});

describe('Carousel Integration', () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
    });

    it('should render carousel content', () => {
        const content = fixture.debugElement.query(By.css('[data-slot="carousel-content"]'));
        expect(content).toBeTruthy();
    });

    it('should render carousel items', () => {
        const items = fixture.debugElement.queryAll(By.css('[data-slot="carousel-item"]'));
        expect(items).toHaveLength(3);
    });

    it('should render previous button', () => {
        const prev = fixture.debugElement.query(By.css('[data-slot="carousel-previous"]'));
        expect(prev).toBeTruthy();
    });

    it('should render next button', () => {
        const next = fixture.debugElement.query(By.css('[data-slot="carousel-next"]'));
        expect(next).toBeTruthy();
    });

    it('should have aria-roledescription="slide" on items', () => {
        const items = fixture.debugElement.queryAll(By.css('[aria-roledescription="slide"]'));
        expect(items).toHaveLength(3);
    });

    it('should have role="group" on items', () => {
        const items = fixture.debugElement.queryAll(By.css('[role="group"]'));
        expect(items).toHaveLength(3);
    });
});

describe('Carousel scroll behaviour (LTR horizontal)', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let carousel: CarouselComponent;
    let scrollEl: HTMLElement;
    let scrollBy: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
        await flushSetup(fixture);
        carousel = getCarousel(fixture);
        scrollEl = getScrollEl(fixture);
        scrollBy = vi.fn();
        (scrollEl as unknown as { scrollBy: unknown }).scrollBy = scrollBy;
    });

    it('reports "at start" when scrollLeft is 0', () => {
        setMetrics(scrollEl, { scrollLeft: 0, scrollWidth: 300, clientWidth: 100 });
        setMetrics(getItems(fixture)[0], { offsetWidth: 100 });
        carousel.updateScrollState();
        expect(carousel.canScrollPrev()).toBe(false);
        expect(carousel.canScrollNext()).toBe(true);
        expect(carousel.currentIndex()).toBe(0);
    });

    it('reports "at end" and computes the current index', () => {
        setMetrics(scrollEl, { scrollLeft: 200, scrollWidth: 300, clientWidth: 100 });
        setMetrics(getItems(fixture)[0], { offsetWidth: 100 });
        carousel.updateScrollState();
        expect(carousel.canScrollPrev()).toBe(true);
        expect(carousel.canScrollNext()).toBe(false);
        expect(carousel.currentIndex()).toBe(2);
    });

    it('leaves the index untouched when item width is 0', () => {
        setMetrics(scrollEl, { scrollLeft: 50, scrollWidth: 300, clientWidth: 100 });
        setMetrics(getItems(fixture)[0], { offsetWidth: 0 });
        carousel.updateScrollState();
        expect(carousel.currentIndex()).toBe(0);
    });

    it('scrollNext scrolls one page forward', () => {
        setMetrics(scrollEl, { clientWidth: 120 });
        carousel.scrollNext();
        expect(scrollBy).toHaveBeenCalledWith({ left: 120, behavior: 'smooth' });
    });

    it('scrollPrev scrolls one page backward', () => {
        setMetrics(scrollEl, { clientWidth: 120 });
        carousel.scrollPrev();
        expect(scrollBy).toHaveBeenCalledWith({ left: -120, behavior: 'smooth' });
    });

    it('scrollTo scrolls the target item into view', () => {
        const items = getItems(fixture);
        const into = vi.fn();
        (items[1] as unknown as { scrollIntoView: unknown }).scrollIntoView = into;
        carousel.scrollTo(1);
        expect(into).toHaveBeenCalledWith({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    });

    it('scrollTo is a no-op for an out-of-range index', () => {
        expect(() => carousel.scrollTo(99)).not.toThrow();
    });

    it('ArrowRight triggers next, ArrowLeft triggers prev, other keys are ignored', () => {
        setMetrics(scrollEl, { clientWidth: 100 });
        carousel.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
        expect(scrollBy).toHaveBeenLastCalledWith({ left: 100, behavior: 'smooth' });
        carousel.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
        expect(scrollBy).toHaveBeenLastCalledWith({ left: -100, behavior: 'smooth' });
        carousel.onKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));
        expect(scrollBy).toHaveBeenCalledTimes(2);
    });

    it('clicking next/previous buttons drives the scroll container', () => {
        setMetrics(scrollEl, { clientWidth: 100 });
        const next = fixture.debugElement.query(By.css('[data-slot="carousel-next"]')).nativeElement as HTMLButtonElement;
        const prev = fixture.debugElement.query(By.css('[data-slot="carousel-previous"]')).nativeElement as HTMLButtonElement;
        next.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(scrollBy).toHaveBeenLastCalledWith({ left: 100, behavior: 'smooth' });
        prev.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(scrollBy).toHaveBeenLastCalledWith({ left: -100, behavior: 'smooth' });
    });
});

describe('Carousel scroll behaviour (RTL horizontal)', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let carousel: CarouselComponent;
    let scrollEl: HTMLElement;
    let scrollBy: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
        await flushSetup(fixture);
        carousel = getCarousel(fixture);
        carousel.rtl.set(true);
        scrollEl = getScrollEl(fixture);
        setMetrics(scrollEl, { clientWidth: 100 });
        scrollBy = vi.fn();
        (scrollEl as unknown as { scrollBy: unknown }).scrollBy = scrollBy;
    });

    it('scrollNext inverts direction in RTL', () => {
        carousel.scrollNext();
        expect(scrollBy).toHaveBeenCalledWith({ left: -100, behavior: 'smooth' });
    });

    it('scrollPrev inverts direction in RTL', () => {
        carousel.scrollPrev();
        expect(scrollBy).toHaveBeenCalledWith({ left: 100, behavior: 'smooth' });
    });
});

describe('Carousel Vertical Orientation', () => {
    let fixture: ComponentFixture<VerticalTestHost>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [VerticalTestHost]
        }).compileComponents();

        fixture = TestBed.createComponent(VerticalTestHost);
        fixture.detectChanges();
    });

    it('should set data-orientation="vertical"', () => {
        const carousel = fixture.debugElement.query(By.css('[data-slot="carousel"]'));
        expect(carousel.nativeElement.dataset['orientation']).toBe('vertical');
    });

    it('should apply vertical flex classes to content', () => {
        const content = fixture.debugElement.query(By.css('[data-slot="carousel-content"]'));
        expect(content.nativeElement.className).toContain('flex-col');
    });

    it('should apply vertical padding class to items', () => {
        const item = fixture.debugElement.query(By.css('[data-slot="carousel-item"]'));
        expect(item.nativeElement.className).toContain('pt-4');
    });

    it('updates scroll state and index along the vertical axis', async () => {
        await flushSetup(fixture);
        const carousel = getCarousel(fixture);
        const scrollEl = getScrollEl(fixture);
        setMetrics(scrollEl, { scrollTop: 200, scrollHeight: 300, clientHeight: 100 });
        setMetrics(getItems(fixture)[0], { offsetHeight: 100 });
        carousel.updateScrollState();
        expect(carousel.canScrollPrev()).toBe(true);
        expect(carousel.canScrollNext()).toBe(false);
        expect(carousel.currentIndex()).toBe(2);
    });

    it('scrolls along the top axis with arrow up/down', async () => {
        await flushSetup(fixture);
        const carousel = getCarousel(fixture);
        const scrollEl = getScrollEl(fixture);
        setMetrics(scrollEl, { clientHeight: 200 });
        const scrollBy = vi.fn();
        (scrollEl as unknown as { scrollBy: unknown }).scrollBy = scrollBy;
        carousel.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        expect(scrollBy).toHaveBeenLastCalledWith({ top: 200, behavior: 'smooth' });
        carousel.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
        expect(scrollBy).toHaveBeenLastCalledWith({ top: -200, behavior: 'smooth' });
    });
});

describe('Carousel vertical nav buttons', () => {
    it('renders previous/next with vertical positioning classes', async () => {
        await TestBed.configureTestingModule({ imports: [VerticalWithButtonsHost] }).compileComponents();
        const fixture = TestBed.createComponent(VerticalWithButtonsHost);
        fixture.detectChanges();
        const prev = fixture.debugElement.query(By.css('[data-slot="carousel-previous"]')).nativeElement as HTMLElement;
        const next = fixture.debugElement.query(By.css('[data-slot="carousel-next"]')).nativeElement as HTMLElement;
        expect(prev.className).toContain('rotate-90');
        expect(next.className).toContain('rotate-90');
    });
});

describe('Carousel with empty content', () => {
    it('handles a scroll container that has no items', async () => {
        await TestBed.configureTestingModule({ imports: [EmptyContentHost] }).compileComponents();
        const fixture = TestBed.createComponent(EmptyContentHost);
        fixture.detectChanges();
        await flushSetup(fixture);
        const carousel = getCarousel(fixture);
        const scrollEl = getScrollEl(fixture);
        setMetrics(scrollEl, { scrollLeft: 0, scrollWidth: 100, clientWidth: 100 });
        expect(() => carousel.updateScrollState()).not.toThrow();
        expect(carousel.currentIndex()).toBe(0);
    });
});

describe('Carousel lifecycle cleanup', () => {
    it('clears the pending setup timer when destroyed before it fires', async () => {
        await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();
        const fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
        expect(() => fixture.destroy()).not.toThrow();
    });

    it('detaches the scroll listener and observers on destroy', async () => {
        await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();
        const fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
        await flushSetup(fixture);
        const scrollEl = getScrollEl(fixture);
        const removeSpy = vi.spyOn(scrollEl, 'removeEventListener');
        fixture.destroy();
        expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
    });
});

describe('Carousel RTL Support', () => {
    let fixture: ComponentFixture<RTLTestHostComponent>;
    let component: RTLTestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RTLTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(RTLTestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should render in LTR mode', () => {
        const container = fixture.debugElement.query(By.css('[dir="ltr"]'));
        expect(container).toBeTruthy();
    });

    it('should render in RTL mode', async () => {
        component.dir.set('rtl');
        document.documentElement.setAttribute('dir', 'rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const container = fixture.debugElement.query(By.css('[dir="rtl"]'));
        expect(container).toBeTruthy();
    });

    it('re-reads RTL state when the document dir attribute mutates', async () => {
        const carousel = getCarousel(fixture);
        const spy = vi.spyOn(carousel, 'updateScrollState');
        document.documentElement.setAttribute('dir', 'rtl');
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(spy).toHaveBeenCalled();
    });

    it('should maintain navigation buttons in RTL', async () => {
        component.dir.set('rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const prev = fixture.debugElement.query(By.css('[data-slot="carousel-previous"]'));
        const next = fixture.debugElement.query(By.css('[data-slot="carousel-next"]'));
        expect(prev).toBeTruthy();
        expect(next).toBeTruthy();
    });

    it('should have next (right arrow) disabled at first index in RTL', async () => {
        component.dir.set('rtl');
        document.documentElement.setAttribute('dir', 'rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const carouselComp = fixture.debugElement.query(By.directive(CarouselComponent));
        carouselComp.componentInstance.rtl.set(true);
        carouselComp.componentInstance.canScrollPrev.set(false);
        carouselComp.componentInstance.canScrollNext.set(true);
        fixture.detectChanges();
        await fixture.whenStable();

        const next = fixture.debugElement.query(By.css('[data-slot="carousel-next"]'));
        expect(next.nativeElement.disabled).toBe(true);
    });

    it('should have previous (left arrow) enabled at first index in RTL', async () => {
        component.dir.set('rtl');
        document.documentElement.setAttribute('dir', 'rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const carouselComp = fixture.debugElement.query(By.directive(CarouselComponent));
        carouselComp.componentInstance.rtl.set(true);
        carouselComp.componentInstance.canScrollPrev.set(false);
        carouselComp.componentInstance.canScrollNext.set(true);
        fixture.detectChanges();
        await fixture.whenStable();

        const prev = fixture.debugElement.query(By.css('[data-slot="carousel-previous"]'));
        expect(prev.nativeElement.disabled).toBe(false);
    });

    it('clicking previous in RTL scrolls forward; clicking next scrolls back', async () => {
        component.dir.set('rtl');
        document.documentElement.setAttribute('dir', 'rtl');
        fixture.detectChanges();
        await flushSetup(fixture);

        const carousel = getCarousel(fixture);
        carousel.rtl.set(true);
        const scrollEl = getScrollEl(fixture);
        setMetrics(scrollEl, { clientWidth: 100 });
        const scrollBy = vi.fn();
        (scrollEl as unknown as { scrollBy: unknown }).scrollBy = scrollBy;
        fixture.detectChanges();

        const prev = fixture.debugElement.query(By.css('[data-slot="carousel-previous"]')).nativeElement as HTMLButtonElement;
        const next = fixture.debugElement.query(By.css('[data-slot="carousel-next"]')).nativeElement as HTMLButtonElement;
        prev.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(scrollBy).toHaveBeenLastCalledWith({ left: -100, behavior: 'smooth' });
        next.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(scrollBy).toHaveBeenLastCalledWith({ left: 100, behavior: 'smooth' });
    });

    it('should have previous (left arrow) disabled at last index in RTL', async () => {
        component.dir.set('rtl');
        document.documentElement.setAttribute('dir', 'rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const carouselComp = fixture.debugElement.query(By.directive(CarouselComponent));
        carouselComp.componentInstance.rtl.set(true);
        carouselComp.componentInstance.canScrollNext.set(false);
        fixture.detectChanges();
        await fixture.whenStable();

        const prev = fixture.debugElement.query(By.css('[data-slot="carousel-previous"]'));
        expect(prev.nativeElement.disabled).toBe(true);
    });

    it('should have next (right arrow) enabled at last index in RTL', async () => {
        component.dir.set('rtl');
        document.documentElement.setAttribute('dir', 'rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const carouselComp = fixture.debugElement.query(By.directive(CarouselComponent));
        carouselComp.componentInstance.rtl.set(true);
        carouselComp.componentInstance.canScrollNext.set(false);
        carouselComp.componentInstance.canScrollPrev.set(true);
        fixture.detectChanges();
        await fixture.whenStable();

        const next = fixture.debugElement.query(By.css('[data-slot="carousel-next"]'));
        expect(next.nativeElement.disabled).toBe(false);
    });
});

@Component({
    standalone: true,
    imports: [CarouselComponent, CarouselContentComponent, CarouselItemComponent, CarouselPreviousComponent, CarouselNextComponent],
    template: `
        <div dir="rtl">
            <ui-carousel dir="rtl">
                <ui-carousel-content>
                    <ui-carousel-item>شريحة 1</ui-carousel-item>
                    <ui-carousel-item>شريحة 2</ui-carousel-item>
                </ui-carousel-content>
                <ui-carousel-previous />
                <ui-carousel-next />
            </ui-carousel>
        </div>
    `,
})
class RtlInitHost { }

describe('Carousel RTL auto-detection on init', () => {
    it('re-reads RTL direction after content init so a direct rtl load is detected', async () => {
        // isRtl() reads getComputedStyle(el).direction; jsdom does not cascade
        // `dir` into computed direction consistently across runners, so reflect
        // the nearest [dir] ancestor here (what a real browser resolves).
        const originalGetComputedStyle = globalThis.getComputedStyle;
        globalThis.getComputedStyle = ((el: Element, pseudo?: string | null) => {
            const real = originalGetComputedStyle(el, pseudo ?? undefined);
            const dir = (el as HTMLElement).closest?.('[dir]')?.getAttribute('dir');
            if (!dir) return real;
            return new Proxy(real, {
                get: (target, prop) => (prop === 'direction' ? dir : Reflect.get(target, prop)),
            });
        }) as typeof getComputedStyle;

        try {
            await TestBed.configureTestingModule({ imports: [RtlInitHost] }).compileComponents();
            const rtlFixture = TestBed.createComponent(RtlInitHost);
            document.body.appendChild(rtlFixture.nativeElement);
            rtlFixture.detectChanges();
            await rtlFixture.whenStable();

            const carousel = rtlFixture.debugElement.query(By.directive(CarouselComponent)).componentInstance as CarouselComponent;

            carousel.rtl.set(false);
            carousel.ngAfterContentInit();
            await new Promise(resolve => setTimeout(resolve, 5));

            expect(carousel.rtl()).toBe(true);
            rtlFixture.nativeElement.remove();
        } finally {
            globalThis.getComputedStyle = originalGetComputedStyle;
        }
    });
});

describe('Carousel — i18n integration', () => {
    it('defaults Previous/Next slide aria-labels to English', async () => {
        await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();
        const fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
        const prev = fixture.debugElement.query(By.css('[data-slot="carousel-previous"]'));
        const next = fixture.debugElement.query(By.css('[data-slot="carousel-next"]'));
        expect(prev.nativeElement.getAttribute('aria-label')).toBe('Previous slide');
        expect(next.nativeElement.getAttribute('aria-label')).toBe('Next slide');
    });

    it('localises Previous/Next slide aria-labels (sr-only included) via UI_LOCALE_ID', async () => {
        const { provideUiLocale } = await import('../../lib/i18n');
        await TestBed.configureTestingModule({
            imports: [TestHostComponent],
            providers: [provideUiLocale('he')],
        }).compileComponents();
        const fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
        const prev = fixture.debugElement.query(By.css('[data-slot="carousel-previous"]'));
        const next = fixture.debugElement.query(By.css('[data-slot="carousel-next"]'));
        expect(prev.nativeElement.getAttribute('aria-label')).toBe('השקופית הקודמת');
        expect(next.nativeElement.getAttribute('aria-label')).toBe('השקופית הבאה');
        expect(prev.nativeElement.querySelector('.sr-only').textContent.trim()).toBe('השקופית הקודמת');
        expect(next.nativeElement.querySelector('.sr-only').textContent.trim()).toBe('השקופית הבאה');
    });

    it('accepts a fully custom CarouselLocale object on each button', async () => {
        @Component({
            standalone: true,
            imports: [CarouselComponent, CarouselContentComponent, CarouselItemComponent, CarouselPreviousComponent, CarouselNextComponent],
            template: `
                <ui-carousel>
                    <ui-carousel-content><ui-carousel-item>Slide 1</ui-carousel-item></ui-carousel-content>
                    <ui-carousel-previous [locale]="prevLocale" />
                    <ui-carousel-next [locale]="nextLocale" />
                </ui-carousel>
            `,
        })
        class CustomLocaleHost {
            prevLocale = { code: 'xx', previousSlide: 'CUSTOM_PREV', nextSlide: 'CUSTOM_NEXT' };
            nextLocale = { code: 'xx', previousSlide: 'CUSTOM_PREV', nextSlide: 'CUSTOM_NEXT' };
        }

        await TestBed.configureTestingModule({ imports: [CustomLocaleHost] }).compileComponents();
        const fixture = TestBed.createComponent(CustomLocaleHost);
        fixture.detectChanges();
        const prev = fixture.debugElement.query(By.css('[data-slot="carousel-previous"]'));
        const next = fixture.debugElement.query(By.css('[data-slot="carousel-next"]'));
        expect(prev.nativeElement.getAttribute('aria-label')).toBe('CUSTOM_PREV');
        expect(next.nativeElement.getAttribute('aria-label')).toBe('CUSTOM_NEXT');
    });

    it('per-instance locale input on a button overrides the global', async () => {
        @Component({
            standalone: true,
            imports: [CarouselComponent, CarouselContentComponent, CarouselItemComponent, CarouselPreviousComponent, CarouselNextComponent],
            template: `
                <ui-carousel>
                    <ui-carousel-content><ui-carousel-item>Slide 1</ui-carousel-item></ui-carousel-content>
                    <ui-carousel-previous locale="fr" />
                    <ui-carousel-next locale="fr" />
                </ui-carousel>
            `,
        })
        class OverrideHost {}

        const { provideUiLocale } = await import('../../lib/i18n');
        await TestBed.configureTestingModule({
            imports: [OverrideHost],
            providers: [provideUiLocale('he')],
        }).compileComponents();
        const fixture = TestBed.createComponent(OverrideHost);
        fixture.detectChanges();
        const prev = fixture.debugElement.query(By.css('[data-slot="carousel-previous"]'));
        const next = fixture.debugElement.query(By.css('[data-slot="carousel-next"]'));
        expect(prev.nativeElement.getAttribute('aria-label')).toBe('Diapositive précédente');
        expect(next.nativeElement.getAttribute('aria-label')).toBe('Diapositive suivante');
    });
});
