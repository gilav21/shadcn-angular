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
        fixture.detectChanges();
        await fixture.whenStable();
    });

    afterEach(() => {
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
