import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { CalendarHeatmapComponent } from './calendar-heatmap.component';
import { CalendarDay } from '../../lib/chart.types';

describe('CalendarHeatmapComponent', () => {
    let component: CalendarHeatmapComponent;
    let fixture: ComponentFixture<CalendarHeatmapComponent>;

    const data: CalendarDay[] = [
        { date: '2026-01-01', value: 2 }, // Thursday
        { date: '2026-01-02', value: 5 },
        { date: '2026-01-05', value: 9 }, // next week (Monday)
        { date: '2026-01-08', value: 1 },
    ];

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [CalendarHeatmapComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(CalendarHeatmapComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('data', data);
        fixture.detectChanges();
    });

    it('renders with an accessible Calendar heatmap label', () => {
        const c = fixture.nativeElement.querySelector('[role="img"]');
        expect(c.getAttribute('aria-label')).toContain('Calendar');
    });

    it('renders one cell per day', () => {
        expect(fixture.nativeElement.querySelectorAll('rect[data-slot="calendar-day"]')).toHaveLength(4);
    });

    it('derives the value domain from the data', () => {
        expect(component.valueDomain()).toEqual([1, 9]);
    });

    it('places days in different weeks in different columns', () => {
        const cells = component.cells();
        const jan1 = cells.find(c => c.day.date === '2026-01-01')!;
        const jan5 = cells.find(c => c.day.date === '2026-01-05')!;
        expect(jan5.x).toBeGreaterThan(jan1.x);
    });

    it('places the same week on the same column', () => {
        const cells = component.cells();
        const jan1 = cells.find(c => c.day.date === '2026-01-01')!;
        const jan2 = cells.find(c => c.day.date === '2026-01-02')!;
        expect(jan2.x).toBe(jan1.x);
        expect(jan2.y).toBeGreaterThan(jan1.y); // Friday below Thursday
    });

    it('maps the maximum value to the end color', () => {
        fixture.componentRef.setInput('fromColor', 'hsl(120, 60%, 92%)');
        fixture.componentRef.setInput('toColor', 'hsl(120, 60%, 30%)');
        fixture.detectChanges();
        expect(component.colorFor(9)).toBe('hsl(120, 60%, 30%)');
    });

    it('builds a tooltip with the date and value', () => {
        component.setHover({ date: '2026-01-05', value: 9 });
        expect(component.hoverTitle()).toContain('2026-01-05');
        expect(component.tooltipRows()[0].value).toContain('9');
    });
});
