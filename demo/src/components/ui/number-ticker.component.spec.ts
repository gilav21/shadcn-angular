import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NumberTickerComponent } from './number-ticker.component';
import { Component, signal } from '@angular/core';
import { describe, it, expect, beforeEach } from 'vitest';

@Component({
    template: `
    <ui-number-ticker [value]="value()" [decimalPlaces]="decimals()" [delay]="delay()" />
  `,
    standalone: true,
    imports: [NumberTickerComponent]
})
class TestHostComponent {
    value = signal(100);
    decimals = signal(0);
    delay = signal(0);
}

describe('NumberTickerComponent', () => {
    let component: NumberTickerComponent;
    let fixture: ComponentFixture<NumberTickerComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [NumberTickerComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(NumberTickerComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('value', 100);
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have initial value of 0', () => {
        const span = fixture.nativeElement.querySelector('span');
        expect(span.textContent.trim()).toBe('0');
    });

    it('should animate to target value', async () => {
        fixture.componentRef.setInput('value', 1000);
        fixture.detectChanges();

        // Mock time passage for interpolation
        await new Promise(resolve => setTimeout(resolve, 100));
        fixture.detectChanges();

        // With new digit components, we check if text content inside span contains digits
        // The main span contains ui-number-ticker-digit elements
        const digits = fixture.nativeElement.querySelectorAll('ui-number-ticker-digit');
        expect(digits.length).toBeGreaterThan(0);

        // Check total text
        const span = fixture.nativeElement.querySelector('span');
        expect(span.textContent.trim()).not.toBe('0');
    });

    it('should respect decimal places', async () => {
        fixture = TestBed.createComponent(NumberTickerComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('value', 100);
        fixture.componentRef.setInput('decimalPlaces', 2);
        fixture.detectChanges();

        // Wait for setup
        await new Promise(resolve => setTimeout(resolve, 50));

        // Manually trigger animation end state for test
        // @ts-ignore
        component._setupAnimation(123.456, 0);
        // @ts-ignore
        component._animate(performance.now() + 5000);

        fixture.detectChanges();
        // Wait for digit components to update
        await new Promise(resolve => setTimeout(resolve, 50));
        fixture.detectChanges();

        const span = fixture.nativeElement.querySelector('span');
        // Text content will include newlines due to flex layout in digits but trim/replace helps
        const text = span.textContent.replace(/\s/g, '');
        expect(text).toContain('123.46');
    });
});
