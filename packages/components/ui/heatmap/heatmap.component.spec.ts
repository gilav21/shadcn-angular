import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { HeatmapComponent } from './heatmap.component';
import { HeatmapCell } from '../../lib/chart.types';

describe('HeatmapComponent', () => {
    let component: HeatmapComponent;
    let fixture: ComponentFixture<HeatmapComponent>;

    const data: HeatmapCell[] = [
        { row: 'Mon', col: 'AM', value: 1 },
        { row: 'Mon', col: 'PM', value: 5 },
        { row: 'Tue', col: 'AM', value: 9 },
        { row: 'Tue', col: 'PM', value: 3 },
    ];

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [HeatmapComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(HeatmapComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('data', data);
        fixture.detectChanges();
    });

    it('renders with an accessible Heatmap label', () => {
        const c = fixture.nativeElement.querySelector('[role="img"]');
        expect(c.getAttribute('aria-label')).toContain('Heatmap');
    });

    it('derives unique rows and columns in order of appearance', () => {
        expect(component.rows()).toEqual(['Mon', 'Tue']);
        expect(component.cols()).toEqual(['AM', 'PM']);
    });

    it('renders one cell per data point', () => {
        expect(fixture.nativeElement.querySelectorAll('rect[data-slot="heatmap-cell"]').length).toBe(4);
    });

    it('derives the value domain from the data', () => {
        expect(component.valueDomain()).toEqual([1, 9]);
    });

    it('maps the maximum value to the end color of the scale', () => {
        fixture.componentRef.setInput('fromColor', 'hsl(210, 90%, 95%)');
        fixture.componentRef.setInput('toColor', 'hsl(210, 90%, 35%)');
        fixture.detectChanges();
        expect(component.colorFor(9)).toBe('hsl(210, 90%, 35%)');
        expect(component.colorFor(1)).toBe('hsl(210, 90%, 95%)');
    });

    it('builds a tooltip row for the hovered cell', () => {
        component.setHover({ row: 'Tue', col: 'AM', value: 9 });
        const rows = component.tooltipRows();
        expect(rows[0].value).toContain('9');
        expect(component.hoverTitle()).toContain('Tue');
    });
});
