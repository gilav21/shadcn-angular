import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { GaugeChartComponent } from './gauge-chart.component';

describe('GaugeChartComponent', () => {
    let component: GaugeChartComponent;
    let fixture: ComponentFixture<GaugeChartComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [GaugeChartComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(GaugeChartComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('value', 70);
        fixture.detectChanges();
    });

    it('renders with an accessible label that includes the value', () => {
        const c = fixture.nativeElement.querySelector('[role="img"]');
        expect(c).toBeTruthy();
        expect(c.getAttribute('aria-label')).toContain('70');
    });

    it('computes the fill ratio from value within min/max', () => {
        expect(component.ratio()).toBeCloseTo(0.7, 5);
    });

    it('clamps the ratio to the 0..1 range', () => {
        fixture.componentRef.setInput('value', 250);
        fixture.detectChanges();
        expect(component.ratio()).toBe(1);
        fixture.componentRef.setInput('value', -50);
        fixture.detectChanges();
        expect(component.ratio()).toBe(0);
    });

    it('respects an explicit min and max', () => {
        fixture.componentRef.setInput('min', 0);
        fixture.componentRef.setInput('max', 200);
        fixture.componentRef.setInput('value', 50);
        fixture.detectChanges();
        expect(component.ratio()).toBeCloseTo(0.25, 5);
    });

    it('renders a track arc and a value arc', () => {
        expect(fixture.nativeElement.querySelector('path[data-slot="gauge-track"]')).toBeTruthy();
        expect(fixture.nativeElement.querySelector('path[data-slot="gauge-value"]')).toBeTruthy();
    });

    it('selects the active threshold color for the value', () => {
        fixture.componentRef.setInput('thresholds', [
            { value: 0, color: 'green' },
            { value: 60, color: 'orange' },
            { value: 90, color: 'red' },
        ]);
        fixture.componentRef.setInput('value', 70);
        fixture.detectChanges();
        expect(component.activeColor()).toBe('orange');
    });

    it('shows the formatted value with its unit', () => {
        fixture.componentRef.setInput('unit', '%');
        fixture.detectChanges();
        expect(component.displayValue()).toContain('70');
        expect(component.displayValue()).toContain('%');
    });
});
