import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { AreaChartComponent } from './area-chart.component';
import { ChartSeries } from '../../lib/chart.types';

describe('AreaChartComponent', () => {
    let component: AreaChartComponent;
    let fixture: ComponentFixture<AreaChartComponent>;

    const series: ChartSeries[] = [
        { name: 'Desktop', data: [{ name: 'Q1', value: 100 }, { name: 'Q2', value: 200 }] },
        { name: 'Mobile', data: [{ name: 'Q1', value: 50 }, { name: 'Q2', value: 120 }] },
    ];

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [AreaChartComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(AreaChartComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('series', series);
        fixture.detectChanges();
    });

    it('renders with an accessible Area chart label', () => {
        const container = fixture.nativeElement.querySelector('[role="img"]');
        expect(container.getAttribute('aria-label')).toContain('Area chart');
    });

    it('renders one area path per visible series', () => {
        expect(fixture.nativeElement.querySelectorAll('path[data-slot="area-series"]')).toHaveLength(2);
    });

    it('uses each series max for the y-domain when not stacked', () => {
        // overlapping mode: domain top is the largest single value (200)
        expect(component.yDomainMax()).toBe(200);
    });

    it('uses category totals for the y-domain when stacked', () => {
        fixture.componentRef.setInput('stacked', true);
        fixture.detectChanges();
        // Q2 total = 200 + 120 = 320
        expect(component.yDomainMax()).toBeGreaterThanOrEqual(320);
    });

    it('normalizes the stacked percent domain to 100', () => {
        fixture.componentRef.setInput('stacked', true);
        fixture.componentRef.setInput('stackingMode', 'percent');
        fixture.detectChanges();
        expect(component.yDomainMax()).toBe(100);
    });

    it('hides a series when toggled off via the legend', () => {
        component.toggleSeries('Mobile');
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelectorAll('path[data-slot="area-series"]')).toHaveLength(1);
    });

    it('applies the configured fill opacity to areas', () => {
        fixture.componentRef.setInput('fillOpacity', 0.5);
        fixture.detectChanges();
        const area = fixture.nativeElement.querySelector('path[data-slot="area-series"]');
        expect(area.getAttribute('fill-opacity')).toBe('0.5');
    });

    it('builds tooltip rows for the hovered category', () => {
        component.setHover(1);
        expect(component.tooltipRows().map(r => r.label)).toEqual(['Desktop', 'Mobile']);
        expect(component.tooltipRows()[0].value).toContain('200');
    });
});
