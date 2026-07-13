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

    it('derives the max value across all series', () => {
        expect(component.maxValue()).toBe(9);
    });

    it('renders the configured number of grid rings', () => {
        fixture.componentRef.setInput('levels', 5);
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelectorAll('polygon[data-slot="radar-ring"]')).toHaveLength(5);
    });

    it('hides a series when toggled off via the legend', () => {
        component.toggleSeries('Product B');
        fixture.detectChanges();
        expect(component.seriesPolygons()).toHaveLength(1);
    });

    it('builds a non-empty polygon path for each series', () => {
        for (const p of component.seriesPolygons()) {
            expect(p.path.startsWith('M')).toBe(true);
            expect(p.path.trim().endsWith('Z')).toBe(true);
        }
    });
});
