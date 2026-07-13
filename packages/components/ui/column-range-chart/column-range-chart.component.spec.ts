import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ColumnRangeChartComponent } from './column-range-chart.component';
import { RangeDataPoint } from '../../lib/chart.types';
import { describe, it, expect, beforeEach } from 'vitest';

describe('ColumnRangeChartComponent', () => {
    let component: ColumnRangeChartComponent;
    let fixture: ComponentFixture<ColumnRangeChartComponent>;

    const sampleData: RangeDataPoint[] = [
        { name: 'Jan', low: -5, high: 10 },
        { name: 'Feb', low: -3, high: 12 },
        { name: 'Mar', low: 2, high: 18 },
    ];

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ColumnRangeChartComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(ColumnRangeChartComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('data', sampleData);
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should compute bars from data', () => {
        expect(component.bars()).toHaveLength(3);
    });

    it('should render an SVG element', () => {
        const svg = fixture.nativeElement.querySelector('svg');
        expect(svg).toBeTruthy();
    });

    it('should set aria-label on SVG', () => {
        const svg = fixture.nativeElement.querySelector('svg[role="group"]');
        expect(svg).toBeTruthy();
        expect(svg.getAttribute('aria-label')).toContain('Column range chart');
    });

    it('should compute bars with positive height based on data range', () => {
        const bars = component.bars();
        for (const bar of bars) {
            expect(bar.height).toBeGreaterThan(0);
        }
    });

    it('should give taller bars to data points with wider ranges', () => {
        const bars = component.bars();
        const janBar = bars[0];
        const marBar = bars[2];

        // Jan range = 10 - (-5) = 15; Mar range = 18 - 2 = 16 (wider) => Mar bar is taller.
        expect(marBar.height).toBeGreaterThan(janBar.height);
    });

    it('should emit barClick when onBarClick is called', () => {
        let emitted: unknown;
        component.barClick.subscribe(val => emitted = val);

        const bar = component.bars()[0];
        const event = new MouseEvent('click');
        component.onBarClick(event, bar);

        expect(emitted).toBeDefined();
        expect((emitted as { point: RangeDataPoint; index: number }).point).toEqual({ name: 'Jan', low: -5, high: 10 });
        expect((emitted as { point: RangeDataPoint; index: number }).index).toBe(0);
    });

    it('should set hoveredIndex and hoveredBar on onBarHover', () => {
        expect(component.hoveredIndex()).toBeNull();
        expect(component.hoveredBar()).toBeNull();

        const bar = component.bars()[1];
        component.onBarHover(bar);

        expect(component.hoveredIndex()).toBe(1);
        const hovered = component.hoveredBar();
        expect(hovered).toBeTruthy();
        expect(hovered!.data.name).toBe('Feb');
    });

    it('should reset hoveredIndex on onBarLeave', () => {
        const bar = component.bars()[0];
        component.onBarHover(bar);
        expect(component.hoveredIndex()).toBe(0);

        component.onBarLeave();
        expect(component.hoveredIndex()).toBeNull();
        expect(component.hoveredBar()).toBeNull();
    });

    it('should append unit to formatValue output', () => {
        fixture.componentRef.setInput('unit', '\u00B0C');
        fixture.detectChanges();

        const formatted = component.formatValue(25);
        expect(formatted).toContain('25');
        expect(formatted).toContain('\u00B0C');
    });

    it('should compute correct dataRange min and max from data', () => {
        const range = component.dataRange();
        const rawMin = -5;
        const rawMax = 18;
        const padding = (rawMax - rawMin) * 0.1;

        expect(range.min).toBeCloseTo(rawMin - padding, 5);
        expect(range.max).toBeCloseTo(rawMax + padding, 5);
    });

    it('should return empty bars for empty data', () => {
        fixture.componentRef.setInput('data', []);
        fixture.detectChanges();

        expect(component.bars()).toEqual([]);
    });

    it('should compute lowY greater than highY for each bar', () => {
        const bars = component.bars();
        for (const bar of bars) {
            expect(bar.lowY).toBeGreaterThan(bar.highY);
        }
    });
});
