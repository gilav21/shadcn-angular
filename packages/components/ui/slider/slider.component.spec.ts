import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SliderComponent } from './slider.component';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('SliderComponent', () => {
    let component: SliderComponent;
    let fixture: ComponentFixture<SliderComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SliderComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(SliderComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('reflects min/max on the range input and resolves an unbound max to 100', () => {
        fixture.componentRef.setInput('min', 10);
        fixture.componentRef.setInput('max', 50);
        fixture.detectChanges();
        const input = fixture.debugElement.query(By.css('input[type="range"]')).nativeElement as HTMLInputElement;
        expect([input.min, input.max]).toEqual(['10', '50']);

        // A Signal Forms field with no max rule pushes `undefined` in.
        fixture.componentRef.setInput('max', undefined);
        fixture.detectChanges();
        expect(input.max).toBe('100');
    });

    it('reflects value on the native range input', async () => {
        component.value.set(50);
        fixture.detectChanges();
        await fixture.whenStable();

        const thumb = fixture.debugElement.query(By.css('input[type="range"]'));
        expect(thumb.nativeElement.value).toBe('50');
    });

    it('should respect custom min/max', () => {
        fixture.componentRef.setInput('min', 10);
        fixture.componentRef.setInput('max', 50);
        component.value.set(30);
        fixture.detectChanges();

        // (30-10)/(50-10) = 20/40 = 50%
        expect(component.percentage()).toBe(50);
    });

    it('should apply disabled opacity', async () => {
        fixture.componentRef.setInput('disabled', true);
        fixture.detectChanges();
        await fixture.whenStable();

        const slider = fixture.debugElement.query(By.css('[data-slot="slider"]'));
        expect(slider.nativeElement.className).toContain('opacity-50');
    });

    it('should set aria-label', () => {
        fixture.componentRef.setInput('ariaLabel', 'Volume');
        fixture.detectChanges();

        const thumb = fixture.debugElement.query(By.css('input[type="range"]'));
        expect(thumb.nativeElement.getAttribute('aria-label')).toBe('Volume');
    });
});

describe('Slider Keyboard Navigation', () => {
    let component: SliderComponent;
    let fixture: ComponentFixture<SliderComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SliderComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(SliderComponent);
        component = fixture.componentInstance;
        component.value.set(50);
        fixture.detectChanges();
    });

    it('should increase value on ArrowRight', () => {
        const thumb = fixture.debugElement.query(By.css('input[type="range"]'));
        thumb.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
        fixture.detectChanges();

        expect(component.value()).toBe(51);
    });

    it('should decrease value on ArrowLeft', () => {
        const thumb = fixture.debugElement.query(By.css('input[type="range"]'));
        thumb.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
        fixture.detectChanges();

        expect(component.value()).toBe(49);
    });

    it('should go to min on Home', () => {
        const thumb = fixture.debugElement.query(By.css('input[type="range"]'));
        thumb.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
        fixture.detectChanges();

        expect(component.value()).toBe(0);
    });

    it('should go to max on End', () => {
        const thumb = fixture.debugElement.query(By.css('input[type="range"]'));
        thumb.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
        fixture.detectChanges();

        expect(component.value()).toBe(100);
    });
});

describe('Slider Keyboard — additional keys', () => {
    let component: SliderComponent;
    let fixture: ComponentFixture<SliderComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [SliderComponent] }).compileComponents();
        fixture = TestBed.createComponent(SliderComponent);
        component = fixture.componentInstance;
        component.value.set(50);
        fixture.detectChanges();
    });

    function key(k: string): void {
        const thumb = fixture.debugElement.query(By.css('input[type="range"]'));
        thumb.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: k }));
        fixture.detectChanges();
    }

    it('PageUp jumps by ten steps', () => {
        key('PageUp');
        expect(component.value()).toBe(60);
    });

    it('PageDown drops by ten steps', () => {
        key('PageDown');
        expect(component.value()).toBe(40);
    });

    it('ArrowUp increases, ArrowDown decreases', () => {
        key('ArrowUp');
        expect(component.value()).toBe(51);
        key('ArrowDown');
        expect(component.value()).toBe(50);
    });

    it('clamps to max and min at the bounds', () => {
        component.value.set(100);
        fixture.detectChanges();
        key('ArrowRight');
        expect(component.value()).toBe(100);
        component.value.set(0);
        fixture.detectChanges();
        key('ArrowLeft');
        expect(component.value()).toBe(0);
    });

    it('ignores unrelated keys', () => {
        key('Enter');
        expect(component.value()).toBe(50);
    });

    it('does nothing when disabled', () => {
        fixture.componentRef.setInput('disabled', true);
        fixture.detectChanges();
        key('ArrowRight');
        expect(component.value()).toBe(50);
    });
});

describe('Slider pointer dragging', () => {
    let component: SliderComponent;
    let fixture: ComponentFixture<SliderComponent>;
    const protoRef = Element.prototype as unknown as { getBoundingClientRect: () => DOMRect };
    let originalRect: () => DOMRect;

    beforeEach(async () => {
        originalRect = protoRef.getBoundingClientRect;
        protoRef.getBoundingClientRect = () =>
            ({
                left: 0,
                top: 0,
                right: 200,
                bottom: 10,
                width: 200,
                height: 10,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            }) as DOMRect;

        await TestBed.configureTestingModule({ imports: [SliderComponent] }).compileComponents();
        fixture = TestBed.createComponent(SliderComponent);
        component = fixture.componentInstance;
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();
    });

    afterEach(() => {
        fixture.nativeElement.remove();
        protoRef.getBoundingClientRect = originalRect;
    });

    function track(): HTMLElement {
        return fixture.debugElement.query(By.css('[data-slot="slider"]')).nativeElement as HTMLElement;
    }

    it('sets the value from a track mousedown position', () => {
        const t = track();
        const rect = t.getBoundingClientRect();
        // Click at midpoint → ~50
        t.dispatchEvent(new MouseEvent('mousedown', { clientX: rect.left + rect.width / 2, bubbles: true }));
        fixture.detectChanges();
        expect(component.value()).toBeGreaterThanOrEqual(45);
        expect(component.value()).toBeLessThanOrEqual(55);
        // Clean up the document-level listeners
        document.dispatchEvent(new MouseEvent('mouseup'));
    });

    it('updates value as the mouse moves while dragging', () => {
        const t = track();
        const rect = t.getBoundingClientRect();
        t.dispatchEvent(new MouseEvent('mousedown', { clientX: rect.left, bubbles: true }));
        fixture.detectChanges();
        expect(component.value()).toBe(0);

        document.dispatchEvent(new MouseEvent('mousemove', { clientX: rect.right }));
        fixture.detectChanges();
        expect(component.value()).toBe(100);

        document.dispatchEvent(new MouseEvent('mouseup'));
        // After mouseup, further moves do nothing
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: rect.left }));
        fixture.detectChanges();
        expect(component.value()).toBe(100);
    });

    it('clamps position beyond the track edges', () => {
        const t = track();
        const rect = t.getBoundingClientRect();
        t.dispatchEvent(new MouseEvent('mousedown', { clientX: rect.right + 500, bubbles: true }));
        fixture.detectChanges();
        expect(component.value()).toBe(100);
        document.dispatchEvent(new MouseEvent('mouseup'));
    });

    it('thumb mousedown starts dragging without jumping the value', () => {
        component.value.set(40);
        fixture.detectChanges();
        const rect = track().getBoundingClientRect();
        const thumb = fixture.debugElement.query(By.css('[data-slot="slider-thumb"]')).nativeElement as HTMLElement;
        // The grab bubbles to the track; unless the thumb stops it, the value jumps to 100.
        thumb.dispatchEvent(new MouseEvent('mousedown', { clientX: rect.right, bubbles: true }));
        fixture.detectChanges();
        expect(component.value()).toBe(40);
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: rect.right }));
        fixture.detectChanges();
        expect(component.value()).toBe(100);
        document.dispatchEvent(new MouseEvent('mouseup'));
    });

    it('touchstart sets value and touchmove updates it', () => {
        const t = track();
        const rect = t.getBoundingClientRect();
        const mkTouch = (type: string, clientX: number): TouchEvent => {
            const ev = new Event(type, { bubbles: true, cancelable: true }) as unknown as TouchEvent;
            Object.defineProperty(ev, 'touches', { value: [{ clientX, clientY: 0 }] });
            return ev;
        };
        t.dispatchEvent(mkTouch('touchstart', rect.left));
        fixture.detectChanges();
        expect(component.value()).toBe(0);

        document.dispatchEvent(mkTouch('touchmove', rect.right));
        fixture.detectChanges();
        expect(component.value()).toBe(100);

        document.dispatchEvent(new Event('touchend'));
    });

    it('ignores pointer interactions when disabled', () => {
        fixture.componentRef.setInput('disabled', true);
        fixture.detectChanges();
        const t = track();
        const rect = t.getBoundingClientRect();
        t.dispatchEvent(new MouseEvent('mousedown', { clientX: rect.right, bubbles: true }));
        fixture.detectChanges();
        expect(component.value()).toBe(0);
    });

    it('inverts position mapping in RTL', () => {
        // isRtl() reads getComputedStyle(el).direction; jsdom doesn't cascade
        // `dir` into computed direction across runners, so reflect the nearest
        // [dir] ancestor here (what a real browser resolves).
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
            fixture.nativeElement.setAttribute('dir', 'rtl');
            const t = track();
            const rect = t.getBoundingClientRect();
            // In RTL, the left edge corresponds to max
            t.dispatchEvent(new MouseEvent('mousedown', { clientX: rect.left, bubbles: true }));
            fixture.detectChanges();
            expect(component.value()).toBe(100);
            document.dispatchEvent(new MouseEvent('mouseup'));
            fixture.nativeElement.removeAttribute('dir');
        } finally {
            globalThis.getComputedStyle = originalGetComputedStyle;
        }
    });

    it('toString returns the current value', () => {
        component.value.set(42);
        expect(component.toString()).toBe('42');
    });
});

describe('Slider invalid range', () => {
    it('returns 0 percentage when min >= max', async () => {
        await TestBed.configureTestingModule({ imports: [SliderComponent] }).compileComponents();
        const fixture = TestBed.createComponent(SliderComponent);
        fixture.componentRef.setInput('min', 100);
        fixture.componentRef.setInput('max', 50);
        fixture.componentInstance.value.set(75);
        fixture.detectChanges();
        expect(fixture.componentInstance.percentage()).toBe(0);
    });
});

describe('SliderComponent — i18n integration', () => {
    async function setup(opts: { locale?: string; providerLocale?: string } = {}) {
        const { provideUiLocale } = await import('../../lib/i18n');
        await TestBed.configureTestingModule({
            imports: [SliderComponent],
            providers: opts.providerLocale ? [provideUiLocale(opts.providerLocale)] : [],
        }).compileComponents();
        const fixture = TestBed.createComponent(SliderComponent);
        if (opts.locale) fixture.componentRef.setInput('locale', opts.locale);
        fixture.componentRef.setInput('max', 10000);
        fixture.componentInstance.value.set(1234);
        fixture.detectChanges();
        return fixture;
    }

    it('defaults aria-valuetext to en-US grouping', async () => {
        const fixture = await setup();
        const handle = fixture.nativeElement.querySelector('input[type="range"]');
        expect(handle.getAttribute('aria-valuetext')).toBe('1,234');
    });

    it('localises aria-valuetext when locale="de" (uses German decimal/grouping)', async () => {
        const fixture = await setup({ locale: 'de' });
        const handle = fixture.nativeElement.querySelector('input[type="range"]');
        expect(handle.getAttribute('aria-valuetext')).toBe('1.234');
    });

    it('falls back to UI_LOCALE_ID when no locale input is set', async () => {
        const fixture = await setup({ providerLocale: 'fr' });
        const handle = fixture.nativeElement.querySelector('input[type="range"]');
        const v = handle.getAttribute('aria-valuetext');
        // French uses narrow no-break space (U+202F) or regular space — both are non-ASCII.
        expect(v).toContain('234');
        expect(v).toHaveLength('1 234'.length);
    });
});
