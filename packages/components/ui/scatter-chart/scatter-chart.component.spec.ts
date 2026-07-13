import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { ScatterChartComponent } from './scatter-chart.component';
import { XYSeries } from '../../lib/chart.types';

describe('ScatterChartComponent', () => {
    let component: ScatterChartComponent;
    let fixture: ComponentFixture<ScatterChartComponent>;

    const series: XYSeries[] = [
        { name: 'Group A', points: [{ x: 1, y: 2 }, { x: 3, y: 5 }, { x: 5, y: 1 }] },
        { name: 'Group B', points: [{ x: 2, y: 8 }, { x: 4, y: 6 }] },
    ];

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ScatterChartComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(ScatterChartComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('series', series);
        fixture.detectChanges();
    });

    it('renders with an accessible Scatter chart label', () => {
        const c = fixture.nativeElement.querySelector('[role="group"]');
        expect(c.getAttribute('aria-label')).toContain('Scatter chart');
    });

    it('renders one circle per point across all visible series', () => {
        expect(fixture.nativeElement.querySelectorAll('circle[data-slot="scatter-point"]')).toHaveLength(5);
    });

    it('derives x and y domains from the data extents', () => {
        expect(component.xDomain()[0]).toBeLessThanOrEqual(1);
        expect(component.xDomain()[1]).toBeGreaterThanOrEqual(5);
        expect(component.yDomain()[1]).toBeGreaterThanOrEqual(8);
    });

    it('places larger y values higher on screen (smaller pixel y)', () => {
        const pts = component.plottedPoints();
        const high = pts.find(p => p.datum.y === 8)!;
        const low = pts.find(p => p.datum.y === 1)!;
        expect(high.cy).toBeLessThan(low.cy);
    });

    it('hides a series when toggled off via the legend', () => {
        component.toggleSeries('Group B');
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelectorAll('circle[data-slot="scatter-point"]')).toHaveLength(3);
    });

    it('builds a tooltip row for the hovered point with its coordinates', () => {
        component.setHover(0, 1); // Group A point (3,5)
        const rows = component.tooltipRows();
        expect(rows[0].label).toBe('Group A');
        expect(rows[0].value).toContain('3');
        expect(rows[0].value).toContain('5');
    });

    it('honors an explicit rtl direction', () => {
        fixture.componentRef.setInput('dir', 'rtl');
        fixture.detectChanges();
        expect(component.isRtl()).toBe(true);
    });
});
