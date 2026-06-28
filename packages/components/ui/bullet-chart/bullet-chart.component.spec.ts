import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { BulletChartComponent } from './bullet-chart.component';

describe('BulletChartComponent', () => {
    let component: BulletChartComponent;
    let fixture: ComponentFixture<BulletChartComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [BulletChartComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(BulletChartComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('value', 70);
        fixture.componentRef.setInput('target', 80);
        fixture.componentRef.setInput('ranges', [50, 75, 100]);
        fixture.detectChanges();
    });

    it('renders with an accessible Bullet label including value and target', () => {
        const c = fixture.nativeElement.querySelector('[role="img"]');
        expect(c.getAttribute('aria-label')).toContain('70');
        expect(c.getAttribute('aria-label')).toContain('80');
    });

    it('derives the max from ranges, value, and target', () => {
        expect(component.maxValue()).toBe(100);
    });

    it('renders one qualitative band per range', () => {
        expect(fixture.nativeElement.querySelectorAll('rect[data-slot="bullet-range"]').length).toBe(3);
    });

    it('renders a measure bar whose width reflects the value', () => {
        const measure = fixture.nativeElement.querySelector('rect[data-slot="bullet-measure"]');
        expect(measure).toBeTruthy();
        expect(component.measureWidth()).toBeGreaterThan(0);
    });

    it('positions the target marker proportionally to the target value', () => {
        const expected = (80 / 100) * component.trackWidth();
        expect(component.targetX()).toBeCloseTo(expected, 0);
    });

    it('renders a target marker element', () => {
        expect(fixture.nativeElement.querySelector('[data-slot="bullet-target"]')).toBeTruthy();
    });

    it('caps the measure width at the track width when value exceeds max', () => {
        fixture.componentRef.setInput('value', 500);
        fixture.detectChanges();
        expect(component.measureWidth()).toBeLessThanOrEqual(component.trackWidth() + 0.001);
    });
});
