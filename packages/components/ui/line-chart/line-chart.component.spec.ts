import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { LineChartComponent } from './line-chart.component';
import { ChartSeries } from '../../lib/chart.types';

describe('LineChartComponent', () => {
    let component: LineChartComponent;
    let fixture: ComponentFixture<LineChartComponent>;

    const series: ChartSeries[] = [
        {
            name: 'Revenue',
            data: [
                { name: 'Q1', value: 100 },
                { name: 'Q2', value: 200 },
                { name: 'Q3', value: 150 },
            ],
        },
        {
            name: 'Cost',
            data: [
                { name: 'Q1', value: 80 },
                { name: 'Q2', value: 120 },
                { name: 'Q3', value: 90 },
            ],
        },
    ];

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [LineChartComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(LineChartComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('series', series);
        fixture.detectChanges();
    });

    it('renders an svg with an accessible role and label', () => {
        const container = fixture.nativeElement.querySelector('[role="group"]');
        expect(container).toBeTruthy();
        expect(container.getAttribute('aria-label')).toContain('Line chart');
        expect(fixture.nativeElement.querySelector('svg')).toBeTruthy();
    });

    it('derives the category axis from the first series', () => {
        expect(component.categories()).toEqual(['Q1', 'Q2', 'Q3']);
    });

    it('computes one path per visible series', () => {
        expect(component.seriesPaths()).toHaveLength(2);
        const paths = fixture.nativeElement.querySelectorAll('path[data-slot="line-series"]');
        expect(paths).toHaveLength(2);
    });

    it('builds a non-empty path string for each series', () => {
        for (const sp of component.seriesPaths()) {
            expect(sp.path.startsWith('M')).toBe(true);
        }
    });

    it('maps the maximum value near the top of the plot area', () => {
        const rev = component.seriesPaths().find(s => s.name === 'Revenue')!;
        const q2 = rev.points[1]; // value 200 is the max
        const q1 = rev.points[0]; // value 100
        expect(q2.y).toBeLessThan(q1.y); // smaller y = higher on screen
    });

    it('hides a series when toggled off via the legend', () => {
        component.toggleSeries('Cost');
        fixture.detectChanges();
        expect(component.hiddenSeries()).toContain('Cost');
        expect(component.seriesPaths()).toHaveLength(1);
        component.toggleSeries('Cost');
        expect(component.hiddenSeries()).not.toContain('Cost');
        expect(component.seriesPaths()).toHaveLength(2);
    });

    it('exposes legend items for every series regardless of hidden state', () => {
        component.toggleSeries('Cost');
        expect(component.legendItems().map(i => i.label)).toEqual(['Revenue', 'Cost']);
    });

    it('builds tooltip rows for the hovered category across visible series', () => {
        component.setHover(1); // Q2
        const rows = component.tooltipRows();
        expect(rows.map(r => r.label)).toEqual(['Revenue', 'Cost']);
        expect(rows[0].value).toContain('200');
        expect(rows[1].value).toContain('120');
    });

    it('omits hidden series from tooltip rows', () => {
        component.toggleSeries('Cost');
        component.setHover(0);
        expect(component.tooltipRows().map(r => r.label)).toEqual(['Revenue']);
    });

    it('emits pointHover with the hovered category and clears on leave', () => {
        const events: (number | null)[] = [];
        component.pointHover.subscribe(e => events.push(e ? e.index : null));
        component.setHover(2);
        component.setHover(null);
        expect(events).toEqual([2, null]);
    });

    it('computes a nice y-axis tick set', () => {
        expect(component.yTicks().length).toBeGreaterThan(1);
        expect(component.yTicks()[0]).toBe(0);
    });

    it('honors an explicit rtl direction', () => {
        fixture.componentRef.setInput('dir', 'rtl');
        fixture.detectChanges();
        expect(component.isRtl()).toBe(true);
    });

    it('drops grid lines when showGrid is false', () => {
        fixture.componentRef.setInput('showGrid', false);
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelectorAll('line[data-slot="grid-line"]')).toHaveLength(0);
    });
});
