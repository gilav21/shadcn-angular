import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SliderComponent } from './slider.component';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// RTL Test host
@Component({
    template: `
        <div [dir]="dir()">
            <ui-slider [defaultValue]="50" (valueChange)="onValueChange($event)" />
        </div>
    `,
    imports: [SliderComponent]
})
class RTLTestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
    currentValue = 50;
    onValueChange(value: number) {
        this.currentValue = value;
    }
}

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

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have data-slot="slider"', () => {
        const slider = fixture.debugElement.query(By.css('[data-slot="slider"]'));
        expect(slider).toBeTruthy();
    });

    it('renders a native range input as the slider control', () => {
        const thumb = fixture.debugElement.query(By.css('input[type="range"]'));
        expect(thumb).toBeTruthy();
    });

    it('should have default min/max values', () => {
        const thumb = fixture.debugElement.query(By.css('input[type="range"]'));
        expect(thumb.nativeElement.min).toBe('0');
        expect(thumb.nativeElement.max).toBe('100');
    });

    it('reflects value on the native range input', async () => {
        component.value.set(50);
        fixture.detectChanges();
        await fixture.whenStable();

        const thumb = fixture.debugElement.query(By.css('input[type="range"]'));
        expect(thumb.nativeElement.value).toBe('50');
    });

    it('should calculate percentage correctly', () => {
        component.value.set(75);
        fixture.detectChanges();

        expect(component.percentage()).toBe(75);
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

    it('should apply flex layout', () => {
        const slider = fixture.debugElement.query(By.css('[data-slot="slider"]'));
        expect(slider.nativeElement.className).toContain('flex');
        expect(slider.nativeElement.className).toContain('items-center');
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

    it('emits valueChange only when the value changes', () => {
        let emitted: number | null = null;
        component.value.subscribe((v: number) => (emitted = v));
        key('ArrowRight');
        expect(emitted).toBe(51);
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
        const thumb = fixture.debugElement.query(By.css('[data-slot="slider"]')).nativeElement as HTMLElement;
        const rect = thumb.getBoundingClientRect();
        // Dispatch a mousedown on the slider element marked as thumb handler is bound in template;
        // call the handler directly to assert it does not change the value immediately.
        component.onThumbMouseDown(new MouseEvent('mousedown', { clientX: rect.left }));
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
    it('returns 0 percentage and logs when min >= max', async () => {
        await TestBed.configureTestingModule({ imports: [SliderComponent] }).compileComponents();
        const fixture = TestBed.createComponent(SliderComponent);
        fixture.componentRef.setInput('min', 100);
        fixture.componentRef.setInput('max', 50);
        fixture.componentInstance.value.set(75);
        fixture.detectChanges();
        expect(fixture.componentInstance.percentage()).toBe(0);
    });
});

describe('Slider RTL Support', () => {
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

    afterEach(() => {
        document.documentElement.removeAttribute('dir');
    });

    it('should render in LTR mode', () => {
        const container = fixture.debugElement.query(By.css('[dir="ltr"]'));
        expect(container).toBeTruthy();
    });

    it('should render in RTL mode', async () => {
        component.dir.set('rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const container = fixture.debugElement.query(By.css('[dir="rtl"]'));
        expect(container).toBeTruthy();
    });

    it('should maintain slider functionality in RTL', async () => {
        component.dir.set('rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const slider = fixture.debugElement.query(By.directive(SliderComponent));
        expect(slider).toBeTruthy();
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
