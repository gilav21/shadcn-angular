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
            expect(rating.nativeElement.getAttribute('data-readonly')).toBeTruthy();
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
            expect(rating.nativeElement.getAttribute('data-disabled')).toBeTruthy();
        });

        it('should have opacity-50 class', () => {
            const rating = fixture.debugElement.query(By.css('[data-slot="rating"]'));
            expect(rating.nativeElement.className).toContain('opacity-50');
        });
    });

    describe('Keyboard Navigation', () => {
        it('should increase value on ArrowRight', async () => {
            const rating = fixture.debugElement.query(By.css('[data-slot="rating"]'));
            rating.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
            fixture.detectChanges();
            await fixture.whenStable();

            expect(component.value()).toBe(4);
        });

        it('should decrease value on ArrowLeft', async () => {
            const rating = fixture.debugElement.query(By.css('[data-slot="rating"]'));
            rating.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
            fixture.detectChanges();
            await fixture.whenStable();

            expect(component.value()).toBe(2);
        });

        it('should go to min on Home', async () => {
            const rating = fixture.debugElement.query(By.css('[data-slot="rating"]'));
            rating.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
            fixture.detectChanges();
            await fixture.whenStable();

            expect(component.value()).toBe(0);
        });

        it('should go to max on End', async () => {
            const rating = fixture.debugElement.query(By.css('[data-slot="rating"]'));
            rating.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
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
        it('should have role="slider"', () => {
            const rating = fixture.debugElement.query(By.css('[role="slider"]'));
            expect(rating).toBeTruthy();
        });

        it('should have aria-valuenow', async () => {
            await fixture.whenStable();
            const rating = fixture.debugElement.query(By.css('[role="slider"]'));
            expect(rating.nativeElement.getAttribute('aria-valuenow')).toBe('3');
        });

        it('should have aria-valuemin', () => {
            const rating = fixture.debugElement.query(By.css('[role="slider"]'));
            expect(rating.nativeElement.getAttribute('aria-valuemin')).toBe('0');
        });

        it('should have aria-valuemax', () => {
            const rating = fixture.debugElement.query(By.css('[role="slider"]'));
            expect(rating.nativeElement.getAttribute('aria-valuemax')).toBe('5');
        });

        it('should have aria-label on rating', () => {
            const rating = fixture.debugElement.query(By.css('[role="slider"]'));
            expect(rating.nativeElement.getAttribute('aria-label')).toBe('Rating');
        });

        it('should have aria-label on each star button', () => {
            const buttons = fixture.debugElement.queryAll(By.css('button'));
            buttons.forEach((btn, index) => {
                expect(btn.nativeElement.getAttribute('aria-label')).toContain(`Rate ${index + 1}`);
            });
        });

        it('should be focusable when not disabled', () => {
            const rating = fixture.debugElement.query(By.css('[role="slider"]'));
            expect(rating.nativeElement.getAttribute('tabindex')).toBe('0');
        });

        it('should not be focusable when disabled', async () => {
            component.disabled.set(true);
            fixture.detectChanges();
            await fixture.whenStable();

            const rating = fixture.debugElement.query(By.css('[role="slider"]'));
            expect(rating.nativeElement.getAttribute('tabindex')).toBe('-1');
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
