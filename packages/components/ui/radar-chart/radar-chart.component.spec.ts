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

describe('RadarChartComponent vertices on their own axis', () => {
    const CLASSES: Record<string, { values: number[][]; maxValueInput?: number }> = {
        'mixed sign': { values: [[8, -6, 3, -1], [5, 2, -9, 4]] },
        'all negative': { values: [[-8, -6, -3, -1], [-5, -2, -9, -4]] },
        'all zero': { values: [[0, 0, 0], [0, 0, 0]] },
        'above an explicit maxValue': { values: [[8, 6, 30, 1], [5, 2, 9, 4]], maxValueInput: 10 },
    };

    function build(values: number[][], maxValueInput?: number): RadarChartComponent {
        const instance = TestBed.createComponent(RadarChartComponent);
        const axes = values[0].map((_, i) => `Axis ${i}`);
        instance.componentRef.setInput(
            'series',
            values.map((row, s) => ({ name: `S${s}`, data: row.map((value, i) => ({ name: axes[i], value })) })),
        );
        if (maxValueInput !== undefined) instance.componentRef.setInput('maxValueInput', maxValueInput);
        instance.detectChanges();
        return instance.componentInstance;
    }

    for (const [className, { values, maxValueInput }] of Object.entries(CLASSES)) {
        it(`should place every vertex on its axis ray at R·(v-lo)/(hi-lo), inside the ring (${className})`, () => {
            const component = build(values, maxValueInput);
            const lo = Math.min(0, ...values.flat());
            const hi = maxValueInput ?? Math.max(...values.flat());
            const center = component.center();
            const radius = component.radius();

            component.seriesPolygons().forEach((polygon, s) => {
                polygon.vertices.forEach((vertex, axis) => {
                    const angle = -Math.PI / 2 + (axis / values[s].length) * Math.PI * 2;
                    const ratio = hi === lo ? 0 : Math.min(1, Math.max(0, (values[s][axis] - lo) / (hi - lo)));
                    expect(vertex.x - center).toBeCloseTo(radius * ratio * Math.cos(angle), 6);
                    expect(vertex.y - center).toBeCloseTo(radius * ratio * Math.sin(angle), 6);
                });
            });
        });
    }
});
