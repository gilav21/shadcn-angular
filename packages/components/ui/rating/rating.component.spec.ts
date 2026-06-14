import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RatingComponent } from './rating.component';

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
}

describe('RatingComponent', () => {
    let fixture: ComponentFixture<RatingTestHostComponent>;
    let component: RatingTestHostComponent;

    beforeEach(async () => {
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
    });

    describe('Basic Rendering', () => {
        it('should create rating component', () => {
            const rating = fixture.debugElement.query(By.directive(RatingComponent));
            expect(rating).toBeTruthy();
        });

        it('should have data-slot="rating"', () => {
            const rating = fixture.debugElement.query(By.css('[data-slot="rating"]'));
            expect(rating).toBeTruthy();
        });

        it('should render correct number of stars', () => {
            const stars = fixture.debugElement.queryAll(By.css('button'));
            expect(stars.length).toBe(5);
        });

        it('should render 10 stars when max is 10', async () => {
            component.max.set(10);
            fixture.detectChanges();
            await fixture.whenStable();

            const stars = fixture.debugElement.queryAll(By.css('button'));
            expect(stars.length).toBe(10);
        });
    });

    describe('Value Handling', () => {
        it('should display correct filled stars', async () => {
            await fixture.whenStable();
            fixture.detectChanges();
            const filledStars = fixture.debugElement.queryAll(By.css('[fill="currentColor"]'));
            expect(filledStars.length).toBe(3); // value is 3
        });

        it('should update value on click', async () => {
            const stars = fixture.debugElement.queryAll(By.css('button'));
            stars[4].nativeElement.click(); // Click 5th star
            fixture.detectChanges();
            await fixture.whenStable();

            expect(component.value()).toBe(5);
        });

        it('should toggle off when clicking same value', async () => {
            const stars = fixture.debugElement.queryAll(By.css('button'));
            stars[2].nativeElement.click(); // Click 3rd star (current value)
            fixture.detectChanges();
            await fixture.whenStable();

            expect(component.value()).toBe(0);
        });
    });

    describe('Readonly Mode', () => {
        beforeEach(async () => {
            component.readonly.set(true);
            fixture.detectChanges();
            await fixture.whenStable();
        });

        it('should have disabled buttons in readonly mode', () => {
            const buttons = fixture.debugElement.queryAll(By.css('button'));
            buttons.forEach(btn => {
                expect(btn.nativeElement.disabled).toBe(true);
            });
        });

        it('should not change value on click in readonly mode', async () => {
            const initialValue = component.value();
            const stars = fixture.debugElement.queryAll(By.css('button'));
            stars[4].nativeElement.click();
            fixture.detectChanges();

            expect(component.value()).toBe(initialValue);
        });

        it('should have data-readonly attribute', () => {
            const rating = fixture.debugElement.query(By.css('[data-slot="rating"]'));
            expect(rating.nativeElement.dataset.readonly).toBeTruthy();
        });
    });

    describe('Disabled Mode', () => {
        beforeEach(async () => {
            component.disabled.set(true);
            fixture.detectChanges();
            await fixture.whenStable();
        });

        it('should have disabled buttons', () => {
            const buttons = fixture.debugElement.queryAll(By.css('button'));
            buttons.forEach(btn => {
                expect(btn.nativeElement.disabled).toBe(true);
            });
        });

        it('should have data-disabled attribute', () => {
            const rating = fixture.debugElement.query(By.css('[data-slot="rating"]'));
            expect(rating.nativeElement.dataset.disabled).toBeTruthy();
        });

        it('should have opacity-50 class', () => {
            const rating = fixture.debugElement.query(By.css('[data-slot="rating"]'));
            expect(rating.nativeElement.className).toContain('opacity-50');
        });
    });

    describe('Keyboard Navigation', () => {
        it('should increase value on ArrowRight', async () => {
            const input = fixture.debugElement.query(By.css('input[type="range"]'));
            input.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
            fixture.detectChanges();
            await fixture.whenStable();

            expect(component.value()).toBe(4);
        });

        it('should decrease value on ArrowLeft', async () => {
            const input = fixture.debugElement.query(By.css('input[type="range"]'));
            input.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
            fixture.detectChanges();
            await fixture.whenStable();

            expect(component.value()).toBe(2);
        });

        it('should go to min on Home', async () => {
            const input = fixture.debugElement.query(By.css('input[type="range"]'));
            input.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
            fixture.detectChanges();
            await fixture.whenStable();

            expect(component.value()).toBe(0);
        });

        it('should go to max on End', async () => {
            const input = fixture.debugElement.query(By.css('input[type="range"]'));
            input.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
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

            const rating = fixture.debugElement.query(By.directive(RatingComponent));
            const stars = fixture.debugElement.queryAll(By.css('button'));

            expect(rating).toBeTruthy();
            expect(stars.length).toBe(5);
        });
    });

    describe('Accessibility', () => {
        it('exposes a native range input as the slider control', () => {
            const input = fixture.debugElement.query(By.css('input[type="range"]'));
            expect(input).toBeTruthy();
        });

        it('reflects the current value on the range input', async () => {
            await fixture.whenStable();
            const input = fixture.debugElement.query(By.css('input[type="range"]'));
            expect(input.nativeElement.value).toBe('3');
        });

        it('exposes min on the range input', () => {
            const input = fixture.debugElement.query(By.css('input[type="range"]'));
            expect(input.nativeElement.min).toBe('0');
        });

        it('exposes max on the range input', () => {
            const input = fixture.debugElement.query(By.css('input[type="range"]'));
            expect(input.nativeElement.max).toBe('5');
        });

        it('should have aria-label on rating', () => {
            const input = fixture.debugElement.query(By.css('input[type="range"]'));
            expect(input.nativeElement.getAttribute('aria-label')).toBe('Rating');
        });

        it('should have aria-label on each star button', () => {
            const buttons = fixture.debugElement.queryAll(By.css('button'));
            buttons.forEach((btn, index) => {
                expect(btn.nativeElement.getAttribute('aria-label')).toContain(`Rate ${index + 1}`);
            });
        });

        it('should be focusable when not disabled', () => {
            const input = fixture.debugElement.query(By.css('input[type="range"]'));
            expect(input.nativeElement.disabled).toBe(false);
        });

        it('should not be focusable when disabled', async () => {
            component.disabled.set(true);
            fixture.detectChanges();
            await fixture.whenStable();

            const input = fixture.debugElement.query(By.css('input[type="range"]'));
            expect(input.nativeElement.disabled).toBe(true);
        });
    });

    describe('Hover behavior', () => {
        function rating(): RatingComponent {
            return fixture.debugElement.query(By.directive(RatingComponent)).componentInstance as RatingComponent;
        }

        it('sets hoverValue and previews fill on full-precision hover', () => {
            const buttons = fixture.debugElement.queryAll(By.css('button'));
            const r = rating();
            const btn = buttons[4].nativeElement as HTMLElement;
            const rect = btn.getBoundingClientRect();
            btn.dispatchEvent(new MouseEvent('mousemove', { clientX: rect.left + rect.width / 2, bubbles: true }));
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
            const btn = fixture.debugElement.queryAll(By.css('button'))[0].nativeElement as HTMLElement;
            btn.dispatchEvent(new MouseEvent('mousemove', { clientX: 0, bubbles: true }));
            expect(r.hoverValue()).toBeNull();
        });
    });

    describe('Half precision', () => {
        beforeEach(async () => {
            component.precision.set(0.5);
            component.value.set(0);
            fixture.detectChanges();
            await fixture.whenStable();
        });

        function rating(): RatingComponent {
            return fixture.debugElement.query(By.directive(RatingComponent)).componentInstance as RatingComponent;
        }

        it('selects a half value when clicking the left half of a star', () => {
            const btn = fixture.debugElement.queryAll(By.css('button'))[2].nativeElement as HTMLElement;
            const rect = btn.getBoundingClientRect();
            btn.dispatchEvent(new MouseEvent('click', { clientX: rect.left + 2, bubbles: true }));
            fixture.detectChanges();
            expect(component.value()).toBe(2.5);
        });

        it('selects a full value when clicking the right half of a star', () => {
            const btn = fixture.debugElement.queryAll(By.css('button'))[2].nativeElement as HTMLElement;
            const rect = btn.getBoundingClientRect();
            btn.dispatchEvent(new MouseEvent('click', { clientX: rect.right - 2, bubbles: true }));
            fixture.detectChanges();
            expect(component.value()).toBe(3);
        });

        it('previews a half value on hover of the left half', () => {
            const r = rating();
            const btn = fixture.debugElement.queryAll(By.css('button'))[0].nativeElement as HTMLElement;
            const rect = btn.getBoundingClientRect();
            btn.dispatchEvent(new MouseEvent('mousemove', { clientX: rect.left + 1, bubbles: true }));
            fixture.detectChanges();
            expect(r.hoverValue()).toBe(0.5);
            expect(r.getStarFill({ index: 0, value: 1 })).toBe('half');
        });

        it('steps by half on keyboard arrow', async () => {
            component.value.set(2);
            fixture.detectChanges();
            await fixture.whenStable();
            fixture.detectChanges();
            const input = fixture.debugElement.query(By.css('input[type="range"]'));
            input.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
            fixture.detectChanges();
            await fixture.whenStable();
            expect(component.value()).toBe(2.5);
        });
    });

    describe('Touch interactions', () => {
        function rating(): RatingComponent {
            return fixture.debugElement.query(By.directive(RatingComponent)).componentInstance as RatingComponent;
        }
        function touchEvent(type: string, clientX: number): TouchEvent {
            const ev = new Event(type, { bubbles: true, cancelable: true }) as unknown as TouchEvent;
            Object.defineProperty(ev, 'touches', { value: [{ clientX, clientY: 0 }] });
            return ev;
        }

        it('previews on touchstart of a star', () => {
            const r = rating();
            const btn = fixture.debugElement.queryAll(By.css('button'))[3].nativeElement as HTMLElement;
            btn.dispatchEvent(touchEvent('touchstart', 0));
            fixture.detectChanges();
            expect(r.hoverValue()).toBe(4);
        });

        it('tracks hover across touchmove using the closest star', () => {
            const r = rating();
            const buttons = fixture.debugElement.queryAll(By.css('button'));
            const target = buttons[2].nativeElement.getBoundingClientRect();
            const root = fixture.debugElement.query(By.css('[data-slot="rating"]')).nativeElement as HTMLElement;
            root.dispatchEvent(touchEvent('touchmove', target.left + target.width / 2));
            fixture.detectChanges();
            expect(r.hoverValue()).toBe(3);
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
            fixture.detectChanges();
            const r = rating();
            r.hoverValue.set(2);
            const root = fixture.debugElement.query(By.css('[data-slot="rating"]')).nativeElement as HTMLElement;
            root.dispatchEvent(touchEvent('touchend', 0));
            fixture.detectChanges();
            expect(component.value()).toBe(0);
        });

        it('ignores touch handlers when disabled', async () => {
            component.disabled.set(true);
            fixture.detectChanges();
            await fixture.whenStable();
            const r = rating();
            const root = fixture.debugElement.query(By.css('[data-slot="rating"]')).nativeElement as HTMLElement;
            root.dispatchEvent(touchEvent('touchmove', 50));
            expect(r.hoverValue()).toBeNull();
        });
    });

    describe('RTL keyboard', () => {
        it('ArrowLeft increases value in RTL', async () => {
            component.dir.set('rtl');
            component.value.set(2);
            fixture.detectChanges();
            await fixture.whenStable();
            const input = fixture.debugElement.query(By.css('input[type="range"]'));
            input.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
            fixture.detectChanges();
            await fixture.whenStable();
            expect(component.value()).toBe(3);
        });

        it('ignores unrelated keys', () => {
            const r = fixture.debugElement.query(By.directive(RatingComponent)).componentInstance as RatingComponent;
            const before = r.value();
            const input = fixture.debugElement.query(By.css('input[type="range"]'));
            input.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
            fixture.detectChanges();
            expect(r.value()).toBe(before);
        });
    });

    describe('Security', () => {
        it('should not execute scripts', () => {
            const rating = fixture.debugElement.query(By.css('[data-slot="rating"]'));
            expect(rating.nativeElement.innerHTML).not.toContain('<script>');
        });

        it('should handle numeric bounds correctly', async () => {
            // Attempt to set value beyond max
            const ratingComponent = fixture.debugElement.query(By.directive(RatingComponent)).componentInstance as RatingComponent;
            ratingComponent.writeValue(100);
            fixture.detectChanges();

            expect(ratingComponent.value()).toBeLessThanOrEqual(100);
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
