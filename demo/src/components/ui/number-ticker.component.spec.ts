import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NumberTickerComponent } from './number-ticker.component';
import { describe, it, expect, beforeEach } from 'vitest';

describe('NumberTickerComponent', () => {
    let component: NumberTickerComponent;
    let fixture: ComponentFixture<NumberTickerComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [NumberTickerComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(NumberTickerComponent);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        fixture.componentRef.setInput('value', 100);
        fixture.detectChanges();
        expect(component).toBeTruthy();
    });

    it('should render digit components', () => {
        fixture.componentRef.setInput('value', 100);
        fixture.detectChanges();

        // Check that digit components are rendered
        const digits = fixture.nativeElement.querySelectorAll('ui-number-ticker-digit');
        expect(digits.length).toBeGreaterThan(0);
    });

    it('should have displayValue signal', () => {
        fixture.componentRef.setInput('value', 100);
        fixture.detectChanges();

        // The displayValue signal should exist and start with '0'
        expect(component.displayValue).toBeDefined();
    });

    it('should update displayValue after animation', async () => {
        fixture.componentRef.setInput('value', 100);
        fixture.componentRef.setInput('duration', 0.05); // Very short duration
        fixture.detectChanges();

        // Wait for animation frames to process
        await new Promise(resolve => setTimeout(resolve, 150));
        fixture.detectChanges();

        // Check the signal value directly
        const displayValue = component.displayValue();
        expect(displayValue).toBe('100');
    });

    it('should respect decimal places in displayValue', async () => {
        fixture.componentRef.setInput('value', 123.456);
        fixture.componentRef.setInput('decimalPlaces', 2);
        fixture.componentRef.setInput('duration', 0.05);
        fixture.detectChanges();

        // Wait for animation
        await new Promise(resolve => setTimeout(resolve, 150));
        fixture.detectChanges();

        const displayValue = component.displayValue();
        expect(displayValue).toBe('123.46');
    });

    it('should format with commas for large numbers', async () => {
        fixture.componentRef.setInput('value', 1234567);
        fixture.componentRef.setInput('duration', 0.05);
        fixture.detectChanges();

        // Wait for animation
        await new Promise(resolve => setTimeout(resolve, 150));
        fixture.detectChanges();

        const displayValue = component.displayValue();
        expect(displayValue).toBe('1,234,567');
    });
});
