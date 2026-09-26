import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { RadarChartComponent } from './radar-chart.component';
import { ChartSeries } from '../../lib/chart.types';

describe('RadarChartComponent', () => {
    let component: RadarChartComponent;
    let fixture: ComponentFixture<RadarChartComponent>;

    const series: ChartSeries[] = [
        { name: 'Product A', data: [
            { name: 'Speed', value: 8 }, { name: 'Power', value: 6 },
            { name: 'Range', value: 9 }, { name: 'Comfort', value: 5 },
        ] },
        { name: 'Product B', data: [
            { name: 'Speed', value: 5 }, { name: 'Power', value: 9 },
            { name: 'Range', value: 4 }, { name: 'Comfort', value: 8 },
        ] },
    ];

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RadarChartComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(RadarChartComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('series', series);
        fixture.detectChanges();
    });

    it('renders with an accessible Radar chart label', () => {
        const c = fixture.nativeElement.querySelector('[role="group"]');
        expect(c.getAttribute('aria-label')).toContain('Radar chart');
    });

    it('derives the axes from the first series', () => {
        expect(component.axes()).toEqual(['Speed', 'Power', 'Range', 'Comfort']);
    });

    it('renders one polygon per visible series', () => {
        expect(component.seriesPolygons()).toHaveLength(2);
        expect(fixture.nativeElement.querySelectorAll('path[data-slot="radar-series"]')).toHaveLength(2);
    });

    it('derives the max value across all series, hidden ones included', () => {
        fixture.componentRef.setInput('series', [
            series[0],
            { ...series[1], data: series[1].data.map(d => (d.name === 'Power' ? { ...d, value: 12 } : d)) },
        ]);
        component.toggleSeries('Product B');
        fixture.detectChanges();
        expect(component.maxValue()).toBe(12);
    });

    it('renders the configured number of grid rings', () => {
        fixture.componentRef.setInput('levels', 5);
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelectorAll('polygon[data-slot="radar-ring"]')).toHaveLength(5);
    });

    it('places each vertex at value / max of the radius along its axis', () => {
        const path = fixture.nativeElement.querySelector('path[data-slot="radar-series"]').getAttribute('d') as string;
        const numbers = (path.match(/-?\d+(\.\d+)?(e-?\d+)?/g) ?? []).map(Number);
        const distances = [0, 2, 4, 6].map(i =>
            Math.hypot(numbers[i] - component.center(), numbers[i + 1] - component.center()));
        // Product A: Speed 8, Power 6, Range 9, Comfort 5, against a max of 9.
        [8, 6, 9, 5].forEach((value, i) =>
            expect(distances[i]).toBeCloseTo((component.radius() * value) / 9, 6));
    });

    it('uses the explicit max value input when provided', () => {
        fixture.componentRef.setInput('maxValueInput', 20);
        fixture.detectChanges();
        expect(component.maxValue()).toBe(20);
    });

    it('re-shows a hidden series when toggled again', () => {
        component.toggleSeries('Product B');
        fixture.detectChanges();
        expect(component.seriesPolygons().map(p => p.name)).toEqual(['Product A']);
        component.toggleSeries('Product B');
        fixture.detectChanges();
        expect(component.seriesPolygons().map(p => p.name)).toEqual(['Product A', 'Product B']);
        expect(component.hiddenSeries()).toEqual([]);
    });

    it('falls back to empty axes and a max of 1 when there are no series', () => {
        fixture.componentRef.setInput('series', [] as ChartSeries[]);
        fixture.detectChanges();
        expect(component.axes()).toEqual([]);
        expect(component.maxValue()).toBe(1);
    });
});
