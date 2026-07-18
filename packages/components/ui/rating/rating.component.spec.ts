import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ElementRef, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RatingComponent } from './rating.component';

// ── jsdom stubs ────────────────────────────────────────────────────────────
// Half-step math and closest-star detection read getBoundingClientRect; jsdom
// returns zeroed rects, so we give every `button[data-star]` a deterministic
// rect keyed on its sibling index (20px wide, laid out from x=100).
const STAR_WIDTH = 20;
const STAR_ORIGIN = 100;

function makeRect(left: number, width: number): DOMRect {
    return {
        left,
        right: left + width,
        width,
        top: 0,
        bottom: 0,
        height: 0,
        x: left,
        y: 0,
        toJSON: () => ({}),
    } as DOMRect;
}

function starRect(el: Element): DOMRect {
    const parent = el.parentElement;
    const buttons = parent ? Array.from(parent.querySelectorAll('button[data-star]')) : [];
    const idx = buttons.indexOf(el);
    return makeRect(STAR_ORIGIN + idx * STAR_WIDTH, STAR_WIDTH);
}

// `isTouchDevice()` reads matchMedia('(pointer: coarse)'); toggle this to
// simulate a touch device inside individual tests.
let coarsePointer = false;

function fakeMatchMedia(query: string): MediaQueryList {
    return {
        matches: /coarse/.test(query) ? coarsePointer : false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
    } as unknown as MediaQueryList;
}

interface RatingInternals {
    el: ElementRef<HTMLElement>;
    getRatingFromPoint(clientX: number): number | null;
    onKeydown(event: KeyboardEvent): void;
}

function internals(r: RatingComponent): RatingInternals {
    return r as unknown as RatingInternals;
}

// Test host
@Component({
    template: `
        <div [dir]="dir()">
            <ui-rating
                [ngModel]="value()"
                (ngModelChange)="value.set($event)"
                [max]="max()"
                [precision]="precision()"
                [readonly]="readonly()"
                [disabled]="disabled()"
                [size]="size()"
                [class]="cls()"
            />
        </div>
    `,
    imports: [RatingComponent, FormsModule]
})
class RatingTestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
    value = signal(3);
    max = signal(5);
    precision = signal<0.5 | 1>(1);
    readonly = signal(false);
    disabled = signal(false);
    size = signal<'sm' | 'md' | 'lg'>('md');
    cls = signal('');
}

describe('RatingComponent', () => {
    let fixture: ComponentFixture<RatingTestHostComponent>;
    let component: RatingTestHostComponent;
    let originalRect: typeof Element.prototype.getBoundingClientRect;
    let originalMatchMedia: typeof globalThis.matchMedia;

    function rating(): RatingComponent {
        return fixture.debugElement.query(By.directive(RatingComponent)).componentInstance as RatingComponent;
    }
    function buttons(): HTMLElement[] {
        return fixture.debugElement.queryAll(By.css('button')).map(d => d.nativeElement as HTMLElement);
    }
    function rangeInput(): HTMLInputElement {
        return fixture.debugElement.query(By.css('input[type="range"]')).nativeElement as HTMLInputElement;
    }
    function mouse(type: string, clientX: number): MouseEvent {
        return new MouseEvent(type, { clientX, bubbles: true });
    }
    function touchEvent(type: string, clientX: number): TouchEvent {
        const ev = new Event(type, { bubbles: true, cancelable: true }) as unknown as TouchEvent;
        Object.defineProperty(ev, 'touches', { value: [{ clientX, clientY: 0 }] });
        return ev;
    }

    beforeEach(async () => {
        coarsePointer = false;
        originalRect = Element.prototype.getBoundingClientRect;
        originalMatchMedia = globalThis.matchMedia;
        Element.prototype.getBoundingClientRect = function (this: Element): DOMRect {
            if (this.tagName === 'BUTTON' && this.hasAttribute('data-star')) {
                return starRect(this);
            }
            return makeRect(0, 0);
        };
        globalThis.matchMedia = fakeMatchMedia;
        (globalThis.window as Window & typeof globalThis).matchMedia = fakeMatchMedia;

        await TestBed.configureTestingModule({
            imports: [RatingTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(RatingTestHostComponent);
        component = fixture.componentInstance;
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();
        await fixture.whenStable();
    });

    afterEach(() => {
        fixture.nativeElement.remove();
        document.documentElement.removeAttribute('dir');
        Element.prototype.getBoundingClientRect = originalRect;
        globalThis.matchMedia = originalMatchMedia;
        (globalThis.window as Window & typeof globalThis).matchMedia = originalMatchMedia;
    });

    describe('Basic Rendering', () => {
        it('should create rating component', () => {
            const r = fixture.debugElement.query(By.directive(RatingComponent));
            expect(r).toBeTruthy();
        });

        it('should have data-slot="rating"', () => {
            const r = fixture.debugElement.query(By.css('[data-slot="rating"]'));
            expect(r).toBeTruthy();
        });

        it('should render correct number of stars', () => {
            expect(buttons()).toHaveLength(5);
        });

        it('should render 10 stars when max is 10', async () => {
            component.max.set(10);
            fixture.detectChanges();
            await fixture.whenStable();
            expect(buttons()).toHaveLength(10);
        });

        it('reflects size on star classes for sm and lg', async () => {
            component.size.set('sm');
            fixture.detectChanges();
            await fixture.whenStable();
            const smClass = buttons()[0].getAttribute('class') ?? '';
            expect(smClass).toContain('h-4');
            expect(smClass).toContain('w-4');

            component.size.set('lg');
            fixture.detectChanges();
            await fixture.whenStable();
            const lgClass = buttons()[0].getAttribute('class') ?? '';
            expect(lgClass).toContain('h-6');
            expect(lgClass).toContain('w-6');
        });
    });

    describe('Value Handling', () => {
        it('should display correct filled stars', async () => {
            await fixture.whenStable();
            fixture.detectChanges();
            const filledStars = fixture.debugElement.queryAll(By.css('[fill="currentColor"]'));
            expect(filledStars).toHaveLength(3); // value is 3
        });

        it('should update value on click', async () => {
            buttons()[4].dispatchEvent(mouse('click', STAR_ORIGIN + 4 * STAR_WIDTH + STAR_WIDTH));
            fixture.detectChanges();
            await fixture.whenStable();
            expect(component.value()).toBe(5);
        });

        it('should toggle off when clicking same value', async () => {
            buttons()[2].dispatchEvent(mouse('click', STAR_ORIGIN + 2 * STAR_WIDTH + STAR_WIDTH));
            fixture.detectChanges();
            await fixture.whenStable();
            expect(component.value()).toBe(0);
        });

        it('exposes the current value via toString()', () => {
            expect(rating().toString()).toBe('3');
        });
    });

    describe('Readonly Mode', () => {
        beforeEach(async () => {
            component.readonly.set(true);
            fixture.detectChanges();
            await fixture.whenStable();
        });

        it('should have disabled buttons in readonly mode', () => {
            buttons().forEach(btn => {
                expect((btn as HTMLButtonElement).disabled).toBe(true);
            });
        });

        it('should not change value on click in readonly mode', () => {
            const initialValue = component.value();
            buttons()[4].dispatchEvent(mouse('click', 0));
            fixture.detectChanges();
            expect(component.value()).toBe(initialValue);
        });

        it('should have data-readonly attribute', () => {
            const r = fixture.debugElement.query(By.css('[data-slot="rating"]'));
            expect(r.nativeElement.dataset.readonly).toBeTruthy();
        });
    });

    describe('Disabled Mode', () => {
        beforeEach(async () => {
            component.disabled.set(true);
            fixture.detectChanges();
            await fixture.whenStable();
        });

        it('should have disabled buttons', () => {
            buttons().forEach(btn => {
                expect((btn as HTMLButtonElement).disabled).toBe(true);
            });
        });

        it('should have data-disabled attribute', () => {
            const r = fixture.debugElement.query(By.css('[data-slot="rating"]'));
            expect(r.nativeElement.dataset.disabled).toBeTruthy();
        });

        it('should have opacity-50 class', () => {
            const r = fixture.debugElement.query(By.css('[data-slot="rating"]'));
            expect((r.nativeElement.getAttribute('class') ?? '')).toContain('opacity-50');
        });

        it('ignores keyboard when disabled', () => {
            const before = component.value();
            internals(rating()).onKeydown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
            fixture.detectChanges();
            expect(component.value()).toBe(before);
        });

        it('ignores touchstart on a star when disabled', () => {
            buttons()[2].dispatchEvent(touchEvent('touchstart', 0));
            fixture.detectChanges();
            expect(rating().hoverValue()).toBeNull();
        });

        it('ignores hover when disabled', () => {
            buttons()[2].dispatchEvent(mouse('mousemove', STAR_ORIGIN));
            fixture.detectChanges();
            expect(rating().hoverValue()).toBeNull();
        });
    });

    describe('Keyboard Navigation', () => {
        it('should increase value on ArrowRight', async () => {
            rangeInput().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
            fixture.detectChanges();
            await fixture.whenStable();
            expect(component.value()).toBe(4);
        });

        it('should increase value on ArrowUp', async () => {
            rangeInput().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
            fixture.detectChanges();
            await fixture.whenStable();
            expect(component.value()).toBe(4);
        });

        it('should decrease value on ArrowLeft', async () => {
            rangeInput().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
            fixture.detectChanges();
            await fixture.whenStable();
            expect(component.value()).toBe(2);
        });

        it('should decrease value on ArrowDown', async () => {
            rangeInput().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
            fixture.detectChanges();
            await fixture.whenStable();
            expect(component.value()).toBe(2);
        });

        it('clamps at max on ArrowUp', async () => {
            component.value.set(5);
            fixture.detectChanges();
            await fixture.whenStable();
            rangeInput().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
            fixture.detectChanges();
            expect(component.value()).toBe(5);
        });

        it('clamps at zero on ArrowDown', async () => {
            component.value.set(0);
            fixture.detectChanges();
            await fixture.whenStable();
            rangeInput().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
            fixture.detectChanges();
            expect(component.value()).toBe(0);
        });

        it('should go to min on Home', async () => {
            rangeInput().dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
            fixture.detectChanges();
            await fixture.whenStable();
            expect(component.value()).toBe(0);
        });

        it('should go to max on End', async () => {
            rangeInput().dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
            fixture.detectChanges();
            await fixture.whenStable();
            expect(component.value()).toBe(5);
        });
    });

    describe('RTL Support', () => {
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

        it('should maintain rating structure in RTL', async () => {
            component.dir.set('rtl');
            fixture.detectChanges();
            await fixture.whenStable();
            expect(fixture.debugElement.query(By.directive(RatingComponent))).toBeTruthy();
            expect(buttons()).toHaveLength(5);
        });
    });

    describe('Accessibility', () => {
        it('exposes a native range input as the slider control', () => {
            expect(rangeInput()).toBeTruthy();
        });

        it('reflects the current value on the range input', async () => {
            // NgModel writes the initial value asynchronously (zone leg), so
            // flush once more before reading the native range reflection.
            await fixture.whenStable();
            fixture.detectChanges();
            await fixture.whenStable();
            expect(rangeInput().value).toBe('3');
        });

        it('exposes min on the range input', () => {
            expect(rangeInput().min).toBe('0');
        });

        it('exposes max on the range input', () => {
            expect(rangeInput().max).toBe('5');
        });

        it('should have aria-label on rating', () => {
            expect(rangeInput().getAttribute('aria-label')).toBe('Rating');
        });

        it('should have aria-label on each star button', () => {
            buttons().forEach((btn, index) => {
                expect(btn.getAttribute('aria-label')).toContain(`Rate ${index + 1}`);
            });
        });

        it('should be focusable when not disabled', () => {
            expect(rangeInput().disabled).toBe(false);
        });

        it('should not be focusable when disabled', async () => {
            component.disabled.set(true);
            fixture.detectChanges();
            await fixture.whenStable();
            expect(rangeInput().disabled).toBe(true);
        });
    });

    describe('Hover behavior', () => {
        it('sets hoverValue and previews fill on full-precision hover', () => {
            const r = rating();
            const btn = buttons()[4];
            const rect = btn.getBoundingClientRect();
            btn.dispatchEvent(mouse('mousemove', rect.left + rect.width / 2));
            fixture.detectChanges();
            expect(r.hoverValue()).toBe(5);
            expect(r.displayValue()).toBe(5);
        });

        it('clears hoverValue on mouse leave', () => {
            const r = rating();
            r.hoverValue.set(4);
            r.onMouseLeave();
            expect(r.hoverValue()).toBeNull();
            expect(r.displayValue()).toBe(component.value());
        });

        it('does not hover when readonly', async () => {
            component.readonly.set(true);
            fixture.detectChanges();
            await fixture.whenStable();
            const r = rating();
            buttons()[0].dispatchEvent(mouse('mousemove', 0));
            expect(r.hoverValue()).toBeNull();
        });

        it('ignores hover and mouse-leave on a coarse-pointer (touch) device', () => {
            coarsePointer = true;
            const r = rating();
            r.hoverValue.set(2);
            buttons()[4].dispatchEvent(mouse('mousemove', STAR_ORIGIN));
            r.onMouseLeave();
            expect(r.hoverValue()).toBe(2);
        });
    });

    describe('Half precision', () => {
        beforeEach(async () => {
            component.precision.set(0.5);
            component.value.set(0);
            fixture.detectChanges();
            await fixture.whenStable();
        });

        it('selects a half value when clicking the left half of a star', () => {
            const btn = buttons()[2];
            const rect = btn.getBoundingClientRect();
            btn.dispatchEvent(mouse('click', rect.left + 2));
            fixture.detectChanges();
            expect(component.value()).toBe(2.5);
        });

        it('selects a full value when clicking the right half of a star', () => {
            const btn = buttons()[2];
            const rect = btn.getBoundingClientRect();
            btn.dispatchEvent(mouse('click', rect.right - 2));
            fixture.detectChanges();
            expect(component.value()).toBe(3);
        });

        it('previews a half value on hover of the left half', () => {
            const r = rating();
            const btn = buttons()[0];
            const rect = btn.getBoundingClientRect();
            btn.dispatchEvent(mouse('mousemove', rect.left + 1));
            fixture.detectChanges();
            expect(r.hoverValue()).toBe(0.5);
            expect(r.getStarFill({ index: 0, value: 1 })).toBe('half');
        });

        it('steps by half on keyboard arrow', async () => {
            component.value.set(2);
            fixture.detectChanges();
            await fixture.whenStable();
            rangeInput().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
            fixture.detectChanges();
            await fixture.whenStable();
            expect(component.value()).toBe(2.5);
        });

        it('reports empty fill below the half threshold', () => {
            expect(rating().getStarFill({ index: 4, value: 5 })).toBe('empty');
        });
    });

    describe('RTL interactions', () => {
        beforeEach(async () => {
            component.precision.set(0.5);
            component.value.set(0);
            fixture.detectChanges();
            await fixture.whenStable();
        });

        it('treats the right half as the lower value on RTL click', () => {
            const r = rating();
            vi.spyOn(r, 'isRtl').mockReturnValue(true);
            const btn = buttons()[2];
            const rect = btn.getBoundingClientRect();
            btn.dispatchEvent(mouse('click', rect.right - 2));
            fixture.detectChanges();
            expect(component.value()).toBe(2.5);
        });

        it('treats the right half as the lower value on RTL hover', () => {
            const r = rating();
            vi.spyOn(r, 'isRtl').mockReturnValue(true);
            const btn = buttons()[2];
            const rect = btn.getBoundingClientRect();
            btn.dispatchEvent(mouse('mousemove', rect.right - 2));
            fixture.detectChanges();
            expect(r.hoverValue()).toBe(2.5);
        });

        it('ArrowLeft increases value in RTL', () => {
            const r = rating();
            vi.spyOn(r, 'isRtl').mockReturnValue(true);
            r.value.set(2);
            internals(r).onKeydown(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
            fixture.detectChanges();
            expect(component.value()).toBe(2.5);
        });

        it('ArrowRight decreases value in RTL', () => {
            const r = rating();
            vi.spyOn(r, 'isRtl').mockReturnValue(true);
            r.value.set(2);
            internals(r).onKeydown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
            fixture.detectChanges();
            expect(component.value()).toBe(1.5);
        });

        it('renders an RTL half-fill gradient', () => {
            const r = rating();
            vi.spyOn(r, 'isRtl').mockReturnValue(true);
            r.value.set(2.5);
            fixture.detectChanges();
            const gradientStops = fixture.debugElement.queryAll(By.css('stop'));
            expect(gradientStops.length).toBeGreaterThan(0);
        });

        it('ignores unrelated keys', () => {
            const r = rating();
            const before = r.value();
            rangeInput().dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
            fixture.detectChanges();
            expect(r.value()).toBe(before);
        });
    });

    describe('Touch interactions', () => {
        it('previews on touchstart of a star', () => {
            const r = rating();
            buttons()[3].dispatchEvent(touchEvent('touchstart', 0));
            fixture.detectChanges();
            expect(r.hoverValue()).toBe(4);
        });

        it('tracks hover across touchmove using the closest star', () => {
            const r = rating();
            const target = buttons()[2].getBoundingClientRect();
            const root = fixture.debugElement.query(By.css('[data-slot="rating"]')).nativeElement as HTMLElement;
            root.dispatchEvent(touchEvent('touchmove', target.left + target.width / 2));
            fixture.detectChanges();
            expect(r.hoverValue()).toBe(3);
        });

        it('tracks a half value across touchmove in half precision', async () => {
            component.precision.set(0.5);
            fixture.detectChanges();
            await fixture.whenStable();
            const r = rating();
            const target = buttons()[2].getBoundingClientRect();
            const root = fixture.debugElement.query(By.css('[data-slot="rating"]')).nativeElement as HTMLElement;
            root.dispatchEvent(touchEvent('touchmove', target.left + 1));
            fixture.detectChanges();
            expect(r.hoverValue()).toBe(2.5);
        });

        it('commits the value on touchend', () => {
            const r = rating();
            r.hoverValue.set(4);
            const root = fixture.debugElement.query(By.css('[data-slot="rating"]')).nativeElement as HTMLElement;
            root.dispatchEvent(touchEvent('touchend', 0));
            fixture.detectChanges();
            expect(component.value()).toBe(4);
            expect(r.hoverValue()).toBeNull();
        });

        it('toggles off on touchend when committing the same value', async () => {
            component.value.set(2);
            fixture.detectChanges();
            await fixture.whenStable();
            const r = rating();
            r.hoverValue.set(2);
            const root = fixture.debugElement.query(By.css('[data-slot="rating"]')).nativeElement as HTMLElement;
            root.dispatchEvent(touchEvent('touchend', 0));
            fixture.detectChanges();
            expect(component.value()).toBe(0);
        });

        it('ignores touchmove when disabled', async () => {
            component.disabled.set(true);
            fixture.detectChanges();
            await fixture.whenStable();
            const r = rating();
            const root = fixture.debugElement.query(By.css('[data-slot="rating"]')).nativeElement as HTMLElement;
            root.dispatchEvent(touchEvent('touchmove', 50));
            expect(r.hoverValue()).toBeNull();
        });

        it('ignores touchend when disabled', async () => {
            component.disabled.set(true);
            fixture.detectChanges();
            await fixture.whenStable();
            const r = rating();
            r.hoverValue.set(3);
            const root = fixture.debugElement.query(By.css('[data-slot="rating"]')).nativeElement as HTMLElement;
            root.dispatchEvent(touchEvent('touchend', 0));
            expect(component.value()).toBe(3);
        });
    });

    describe('getRatingFromPoint edge cases', () => {
        it('returns null when there is no rating container', () => {
            const r = rating();
            vi.spyOn(internals(r).el.nativeElement, 'querySelector').mockReturnValue(null);
            expect(internals(r).getRatingFromPoint(120)).toBeNull();
        });

        it('returns null when there are no star buttons', async () => {
            component.max.set(0);
            fixture.detectChanges();
            await fixture.whenStable();
            expect(internals(rating()).getRatingFromPoint(120)).toBeNull();
        });

        it('returns null when the pointer position is not a number', () => {
            expect(internals(rating()).getRatingFromPoint(Number.NaN)).toBeNull();
        });
    });

    describe('ControlValueAccessor', () => {
        it('writeValue updates the displayed value', () => {
            const r = rating();
            r.writeValue(4);
            expect(r.value()).toBe(4);
        });

        it('writeValue coerces null to zero', () => {
            const r = rating();
            r.writeValue(null as unknown as number);
            expect(r.value()).toBe(0);
        });

        it('registerOnChange is invoked when the value changes', () => {
            const r = rating();
            const onChange = vi.fn();
            r.registerOnChange(onChange);
            buttons()[4].dispatchEvent(mouse('click', STAR_ORIGIN + 4 * STAR_WIDTH + STAR_WIDTH));
            expect(onChange).toHaveBeenCalledWith(5);
        });

        it('registerOnTouched is invoked when the value changes', () => {
            const r = rating();
            const onTouched = vi.fn();
            r.registerOnTouched(onTouched);
            buttons()[4].dispatchEvent(mouse('click', STAR_ORIGIN + 4 * STAR_WIDTH + STAR_WIDTH));
            expect(onTouched).toHaveBeenCalled();
        });

        it('setDisabledState disables interaction', () => {
            const r = rating();
            r.setDisabledState(true);
            fixture.detectChanges();
            expect(r.isDisabled()).toBe(true);
            expect(rangeInput().disabled).toBe(true);
        });

        it('emits ratingChange when a star is clicked', () => {
            const r = rating();
            const emitted: number[] = [];
            r.ratingChange.subscribe(v => emitted.push(v));
            buttons()[4].dispatchEvent(mouse('click', STAR_ORIGIN + 4 * STAR_WIDTH + STAR_WIDTH));
            expect(emitted).toEqual([5]);
        });
    });

    describe('Custom class', () => {
        it('merges a custom class onto the rating group', async () => {
            component.cls.set('my-custom-class');
            fixture.detectChanges();
            await fixture.whenStable();
            const root = fixture.debugElement.query(By.css('[data-slot="rating"]')).nativeElement as HTMLElement;
            expect(root.getAttribute('class') ?? '').toContain('my-custom-class');
        });
    });

    describe('Security', () => {
        it('should not execute scripts', () => {
            const r = fixture.debugElement.query(By.css('[data-slot="rating"]'));
            expect(r.nativeElement.innerHTML).not.toContain('<script>');
        });

        it('should handle numeric bounds correctly', () => {
            const r = rating();
            r.writeValue(100);
            fixture.detectChanges();
            expect(r.value()).toBeLessThanOrEqual(100);
        });
    });
});

describe('RatingComponent — i18n integration', () => {
    async function setup(opts: { locale?: string; providerLocale?: string } = {}) {
        const { provideUiLocale } = await import('../../lib/i18n');
        await TestBed.configureTestingModule({
            imports: [RatingComponent],
            providers: opts.providerLocale ? [provideUiLocale(opts.providerLocale)] : [],
        }).compileComponents();
        const fixture = TestBed.createComponent(RatingComponent);
        if (opts.locale) fixture.componentRef.setInput('locale', opts.locale);
        fixture.detectChanges();
        return fixture;
    }

    it('defaults group aria-label to English "Rating" and per-star to "Rate {n} out of {total}"', async () => {
        const fixture = await setup();
        const root = fixture.nativeElement.querySelector('[data-slot="rating"]');
        expect(root.querySelector('input[type="range"]')?.getAttribute('aria-label')).toBe('Rating');
        const stars = root.querySelectorAll('button[data-star]');
        expect(stars[0].getAttribute('aria-label')).toBe('Rate 1 out of 5');
        expect(stars[4].getAttribute('aria-label')).toBe('Rate 5 out of 5');
    });

    it('localises group + per-star aria-labels when locale="he" with dir="rtl"', async () => {
        const fixture = await setup({ locale: 'he' });
        const root = fixture.nativeElement.querySelector('[data-slot="rating"]');
        expect(root.querySelector('input[type="range"]')?.getAttribute('aria-label')).toBe('דירוג');
        expect(root.getAttribute('dir')).toBe('rtl');
        const stars = root.querySelectorAll('button[data-star]');
        expect(stars[2].getAttribute('aria-label')).toBe('דרג 3 מתוך 5');
    });

    it('explicit ariaLabel input overrides the locale, but per-star still localises', async () => {
        const fixture = await setup({ locale: 'fr' });
        fixture.componentRef.setInput('ariaLabel', 'Custom rating');
        fixture.detectChanges();
        const root = fixture.nativeElement.querySelector('[data-slot="rating"]');
        expect(root.querySelector('input[type="range"]')?.getAttribute('aria-label')).toBe('Custom rating');
        const stars = root.querySelectorAll('button[data-star]');
        expect(stars[0].getAttribute('aria-label')).toBe('Évaluer 1 sur 5');
    });

    it('falls back to UI_LOCALE_ID when no locale input is set', async () => {
        const fixture = await setup({ providerLocale: 'es' });
        const root = fixture.nativeElement.querySelector('[data-slot="rating"]');
        expect(root.querySelector('input[type="range"]')?.getAttribute('aria-label')).toBe('Calificación');
    });

    it('accepts a fully custom RatingLocale object', async () => {
        const fixture = await setup();
        fixture.componentRef.setInput('locale', {
            code: 'xx',
            rating: 'XX_RATING',
            rateAriaLabel: 'XX_{n}/{total}',
        });
        fixture.detectChanges();
        const root = fixture.nativeElement.querySelector('[data-slot="rating"]');
        expect(root.querySelector('input[type="range"]')?.getAttribute('aria-label')).toBe('XX_RATING');
        const stars = root.querySelectorAll('button[data-star]');
        expect(stars[2].getAttribute('aria-label')).toBe('XX_3/5');
    });
});
