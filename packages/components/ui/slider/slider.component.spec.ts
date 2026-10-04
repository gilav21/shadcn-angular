import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
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

/** The inputs a test mounts the slider with; `value` is the model's two-way input. */
type SliderSetup = Readonly<Partial<Record<'min' | 'max' | 'step' | 'value' | 'defaultValue', number>>>;

@Component({
    template: `
        <ui-slider
            [formControl]="control"
            [defaultValue]="40"
            ariaLabel="Level"
            (valueChange)="emissions.push($event)"
        />
    `,
    imports: [SliderComponent, ReactiveFormsModule],
})
class FormSliderHost {
    readonly control = new FormControl<number | null>(30);
    readonly emissions: number[] = [];
}

/**
 * The grid rule — every value the slider renders or produces is
 * `min + k·step` inside `[min, top]` — and every path a value reaches it by:
 * a key, the pointer, a written value, a default, assistive tech, a form.
 * Expected values are what a native `<input type=range>` gives for the same
 * attributes, compared exactly: a near miss is the bug.
 */
describe('SliderComponent — the grid and every way in', () => {
    const mounted: ComponentFixture<unknown>[] = [];

    afterEach(() => {
        for (const fixture of mounted.splice(0)) {
            fixture.nativeElement.remove();
            fixture.destroy();
        }
    });

    function mount(setup: SliderSetup): { fixture: ComponentFixture<SliderComponent>; emissions: number[] } {
        const fixture = TestBed.createComponent(SliderComponent);
        for (const [name, value] of Object.entries(setup)) {
            fixture.componentRef.setInput(name, value);
        }
        const emissions: number[] = [];
        fixture.componentInstance.value.subscribe(v => emissions.push(v));
        document.body.appendChild(fixture.nativeElement);
        mounted.push(fixture);
        fixture.detectChanges();
        return { fixture, emissions };
    }

    function mountForm(): ComponentFixture<FormSliderHost> {
        const fixture = TestBed.createComponent(FormSliderHost);
        document.body.appendChild(fixture.nativeElement);
        mounted.push(fixture);
        fixture.detectChanges();
        return fixture;
    }

    function range(fixture: ComponentFixture<unknown>): HTMLInputElement {
        return fixture.nativeElement.querySelector('input[type="range"]');
    }

    /** What the slider shows: the native range value and what a screen reader announces. */
    function shown(fixture: ComponentFixture<unknown>): [string, string | null] {
        const input = range(fixture);
        return [input.value, input.getAttribute('aria-valuetext')];
    }

    function press(fixture: ComponentFixture<unknown>, key: string): void {
        range(fixture).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
        fixture.detectChanges();
    }

    /**
     * The track's rendered box. The browser leg lays the slider out for real;
     * jsdom has no layout, so there a rect is pinned on the track element
     * itself — an own property, which dies with the element and cannot leak
     * into another file the way a prototype stub can.
     */
    function trackBox(fixture: ComponentFixture<unknown>): { track: HTMLElement; rect: DOMRect } {
        const track: HTMLElement = fixture.nativeElement.querySelector('[data-slot="slider"]');
        const real = track.getBoundingClientRect();
        if (real.width > 0) return { track, rect: real };
        const pinned = { left: 10, right: 210, width: 200, top: 0, bottom: 8, height: 8, x: 10, y: 0, toJSON: () => ({}) } as DOMRect;
        Object.defineProperty(track, 'getBoundingClientRect', { value: () => pinned, configurable: true });
        return { track, rect: pinned };
    }

    function touch(type: string, clientX: number): TouchEvent {
        const event = new Event(type, { bubbles: true, cancelable: true }) as unknown as TouchEvent;
        const lifted = type === 'touchend' || type === 'touchcancel';
        Object.defineProperty(event, 'touches', { value: lifted ? [] : [{ clientX, clientY: 0 }] });
        return event;
    }

    /** See 'inverts position mapping in RTL' above: jsdom does not cascade `dir` into computed direction. */
    function withRtl(fixture: ComponentFixture<unknown>, run: () => void): void {
        const originalGetComputedStyle = globalThis.getComputedStyle;
        globalThis.getComputedStyle = ((el: Element, pseudo?: string | null) => {
            const real = originalGetComputedStyle(el, pseudo ?? undefined);
            const dir = (el as HTMLElement).closest?.('[dir]')?.getAttribute('dir');
            if (!dir) return real;
            return new Proxy(real, {
                get: (target, prop) => (prop === 'direction' ? dir : Reflect.get(target, prop)),
            });
        }) as typeof getComputedStyle;
        fixture.nativeElement.setAttribute('dir', 'rtl');
        try {
            run();
        } finally {
            globalThis.getComputedStyle = originalGetComputedStyle;
        }
    }

    it('keyboard steps land on the grid for every key', () => {
        const cases: ReadonlyArray<readonly [SliderSetup, readonly string[]]> = [
            [{ min: 0, max: 1, step: 0.1, value: 0.2 }, ['ArrowUp']],
            [{ min: 0.5, max: 4, step: 0.1, value: 2.2 }, ['ArrowRight']],
            [{ min: 1, max: 10, step: 2, value: 5 }, ['Home']],
            [{ min: 1, max: 10, step: 2, value: 5 }, ['End']],
            [{ min: 1, max: 10, step: 2, value: 1 }, ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight']],
            [{ min: 1, max: 30, step: 2, value: 1 }, ['PageUp']],
            [{ min: -0.5, max: 10, step: 1, value: 2.5 }, ['PageDown']],
        ];
        const emitted = cases.map(([setup, keys]) => {
            const { fixture, emissions } = mount(setup);
            for (const key of keys) press(fixture, key);
            return emissions;
        });

        const rtl = mount({ min: 1, max: 10, step: 2, value: 5 });
        withRtl(rtl.fixture, () => press(rtl.fixture, 'ArrowRight'));

        expect([...emitted, rtl.emissions]).toEqual([[0.3], [2.3], [1], [9], [3, 5, 7, 9], [21], [-0.5], [3]]);
    });

    it('pointer position maps to a grid value', () => {
        const at = (setup: SliderSetup, fraction: number, by: 'mouse' | 'touch'): number => {
            const { fixture } = mount(setup);
            const { track, rect } = trackBox(fixture);
            const clientX = rect.left + fraction * rect.width;
            if (by === 'mouse') {
                track.dispatchEvent(new MouseEvent('mousedown', { clientX, bubbles: true, cancelable: true }));
                document.dispatchEvent(new MouseEvent('mouseup'));
            } else {
                track.dispatchEvent(touch('touchstart', clientX));
                document.dispatchEvent(touch('touchend', clientX));
            }
            fixture.detectChanges();
            return fixture.componentInstance.value();
        };

        expect([
            at({ min: 1, max: 10, step: 2 }, 0.5, 'mouse'),
            at({ min: 1, max: 10, step: 2 }, 1, 'mouse'),
            at({ min: 0.5, max: 4, step: 0.1 }, (2.3 - 0.5) / 3.5, 'mouse'),
            at({ min: 0, max: 1, step: 0.05 }, 0.33, 'touch'),
        ]).toEqual([5, 9, 2.3, 0.35]);
    });

    it('renders an off-grid written value snapped, steps from there, and does not echo it', () => {
        const { fixture, emissions } = mount({ min: 0, max: 1, step: 0.05, value: 0.625 });

        expect(shown(fixture)).toEqual(['0.65', '0.65']);
        expect(fixture.componentInstance.value()).toBe(0.625);
        expect(emissions).toEqual([]);

        press(fixture, 'ArrowUp');

        expect(emissions).toEqual([0.7]);
    });

    it('seeds from defaultValue silently, and a bound value wins over it', () => {
        const seeded = mount({ defaultValue: 40 });
        const snapped = mount({ defaultValue: 45, step: 10 });
        const bound = mount({ value: 20, defaultValue: 40 });

        expect([shown(seeded.fixture), shown(snapped.fixture), shown(bound.fixture)]).toEqual([
            ['40', '40'],
            ['50', '50'],
            ['20', '20'],
        ]);
        expect([seeded.emissions, snapped.emissions, bound.emissions]).toEqual([[], [], []]);
    });

    it('a value set on the hidden range input by assistive tech commits the snapped value', () => {
        const commit = (setup: SliderSetup, text: string): number[] => {
            const { fixture, emissions } = mount(setup);
            const input = range(fixture);
            input.value = text;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            fixture.detectChanges();
            return emissions;
        };

        expect([
            commit({ min: 1, max: 10, step: 2, value: 1 }, '6'),
            commit({ min: 0, max: 1, step: 0.1, value: 0 }, '0.7'),
        ]).toEqual([[7], [0.7]]);
    });

    it('a drag in progress stops affecting the slider once it is destroyed or the touch is cancelled', () => {
        const destroyed = mount({ min: 0, max: 100 });
        const mouseBox = trackBox(destroyed.fixture);
        const quarter = (rect: DOMRect): number => rect.left + rect.width / 4;
        mouseBox.track.dispatchEvent(new MouseEvent('mousedown', { clientX: quarter(mouseBox.rect), bubbles: true, cancelable: true }));
        const beforeDestroy = destroyed.fixture.componentInstance.value();
        destroyed.fixture.destroy();
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: mouseBox.rect.right }));

        const cancelled = mount({ min: 0, max: 100 });
        const touchBox = trackBox(cancelled.fixture);
        touchBox.track.dispatchEvent(touch('touchstart', quarter(touchBox.rect)));
        const beforeCancel = cancelled.fixture.componentInstance.value();
        document.dispatchEvent(touch('touchcancel', 0));
        document.dispatchEvent(touch('touchmove', touchBox.rect.right));
        cancelled.fixture.detectChanges();

        expect([beforeDestroy, beforeCancel]).toEqual([25, 25]);
        expect([destroyed.fixture.componentInstance.value(), cancelled.fixture.componentInstance.value()]).toEqual([25, 25]);
    });

    it('works with formControlName: renders the form value, reports each user change once, never echoes a write', async () => {
        const fixture = mountForm();
        await fixture.whenStable();
        const { control, emissions } = fixture.componentInstance;
        const formChanges: Array<number | null> = [];
        control.valueChanges.subscribe(v => formChanges.push(v));

        // The form's 30 wins over [defaultValue]="40", and the seed does not dirty the form.
        expect(shown(fixture)).toEqual(['30', '30']);
        expect(control.pristine).toBe(true);

        press(fixture, 'ArrowRight');
        const input = range(fixture);
        input.value = '40';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        fixture.detectChanges();

        expect(formChanges).toEqual([31, 40]);

        // An off-grid write renders snapped, but is neither rewritten in the form nor echoed.
        control.setValue(55.4);
        fixture.detectChanges();
        await fixture.whenStable();

        expect(shown(fixture)).toEqual(['55', '55']);
        expect([control.value]).toEqual([55.4]);
        expect(formChanges).toEqual([31, 40, 55.4]);
        expect(emissions).toEqual([31, 40]);
    });

    it('marks the form control touched on blur and at the end of a pointer drag', async () => {
        const touchedAfter = async (act: (fixture: ComponentFixture<FormSliderHost>) => void): Promise<boolean> => {
            const fixture = mountForm();
            await fixture.whenStable();
            act(fixture);
            fixture.detectChanges();
            return fixture.componentInstance.control.touched;
        };
        const drag = (fixture: ComponentFixture<FormSliderHost>, by: 'mouse' | 'touch', pointer: 'held' | 'released'): void => {
            const { track, rect } = trackBox(fixture);
            const middle = rect.left + rect.width / 2;
            if (by === 'mouse') {
                track.dispatchEvent(new MouseEvent('mousedown', { clientX: middle, bubbles: true, cancelable: true }));
                if (pointer === 'released') document.dispatchEvent(new MouseEvent('mouseup'));
            } else {
                track.dispatchEvent(touch('touchstart', middle));
                if (pointer === 'released') document.dispatchEvent(touch('touchend', 0));
            }
        };

        expect([
            await touchedAfter(fixture => range(fixture).dispatchEvent(new FocusEvent('focus'))),
            await touchedAfter(fixture => drag(fixture, 'mouse', 'held')),
            await touchedAfter(fixture => drag(fixture, 'touch', 'held')),
            await touchedAfter(fixture => range(fixture).dispatchEvent(new FocusEvent('blur'))),
            await touchedAfter(fixture => drag(fixture, 'mouse', 'released')),
            await touchedAfter(fixture => drag(fixture, 'touch', 'released')),
        ]).toEqual([false, false, false, true, true, true]);
    });

    it('form.disable() disables the range input and blocks keyboard and pointer', async () => {
        const fixture = mountForm();
        await fixture.whenStable();
        const { control } = fixture.componentInstance;

        control.disable();
        fixture.detectChanges();
        const { track, rect } = trackBox(fixture);
        press(fixture, 'ArrowRight');
        track.dispatchEvent(new MouseEvent('mousedown', { clientX: rect.right, bubbles: true, cancelable: true }));
        document.dispatchEvent(new MouseEvent('mouseup'));
        fixture.detectChanges();

        expect(range(fixture).disabled).toBe(true);
        expect(control.getRawValue()).toBe(30);

        control.enable();
        fixture.detectChanges();
        press(fixture, 'ArrowRight');

        expect(range(fixture).disabled).toBe(false);
        expect(control.value).toBe(31);
    });
});
