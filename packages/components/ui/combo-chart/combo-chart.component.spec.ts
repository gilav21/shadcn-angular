import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { ComboChartComponent } from './combo-chart.component';
import { ChartSeries } from '../../lib/chart.types';

describe('ComboChartComponent', () => {
    let component: ComboChartComponent;
    let fixture: ComponentFixture<ComboChartComponent>;

    const barSeries: ChartSeries[] = [
        { name: 'Defects', data: [
            { name: 'A', value: 50 },
            { name: 'B', value: 30 },
            { name: 'C', value: 15 },
            { name: 'D', value: 5 },
        ] },
    ];

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ComboChartComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(ComboChartComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('barSeries', barSeries);
        fixture.detectChanges();
    });

    it('renders with an accessible Combo chart label', () => {
        const container = fixture.nativeElement.querySelector('[role="img"]');
        expect(container.getAttribute('aria-label')).toContain('Combo chart');
    });

    it('renders one bar per category per bar series', () => {
        const bars = fixture.nativeElement.querySelectorAll('rect[data-slot="combo-bar"]');
        expect(bars.length).toBe(4);
    });

    it('derives categories from the first bar series', () => {
        expect(component.categories()).toEqual(['A', 'B', 'C', 'D']);
    });

    it('sets the primary y-domain from the bar values', () => {
        expect(component.primaryMax()).toBe(50);
    });

    it('builds a cumulative Pareto line that reaches 100%', () => {
        fixture.componentRef.setInput('showCumulative', true);
        fixture.detectChanges();
        const cumulative = component.cumulativePercents();
        expect(cumulative.at(-1)).toBeCloseTo(100, 5);
        // 50 of 100 total = 50% at the first category
        expect(cumulative[0]).toBeCloseTo(50, 5);
        expect(fixture.nativeElement.querySelector('path[data-slot="combo-line"]')).toBeTruthy();
    });

    it('renders an explicit line series on the secondary axis', () => {
        const lineSeries: ChartSeries[] = [
            { name: 'Target', data: [
                { name: 'A', value: 40 }, { name: 'B', value: 35 },
                { name: 'C', value: 20 }, { name: 'D', value: 10 },
            ] },
        ];
        fixture.componentRef.setInput('lineSeries', lineSeries);
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelectorAll('path[data-slot="combo-line"]').length).toBe(1);
    });

    it('honors an explicit rtl direction', () => {
        fixture.componentRef.setInput('dir', 'rtl');
        fixture.detectChanges();
        expect(component.isRtl()).toBe(true);
    });
});
