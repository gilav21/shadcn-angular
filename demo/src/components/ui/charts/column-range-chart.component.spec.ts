import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ColumnRangeChartComponent } from './column-range-chart.component';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RangeDataPoint } from './chart.types';

const sampleData: RangeDataPoint[] = [
    { name: 'Jan', low: -5, high: 5 },
    { name: 'Feb', low: -3, high: 8 },
    { name: 'Mar', low: 2, high: 14 },
    { name: 'Apr', low: 8, high: 20 },
];

describe('ColumnRangeChartComponent', () => {
    let component: ColumnRangeChartComponent;
    let fixture: ComponentFixture<ColumnRangeChartComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ColumnRangeChartComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(ColumnRangeChartComponent);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.detectChanges();
        expect(component).toBeTruthy();
    });

    it('should render SVG element', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.detectChanges();

        const svg = fixture.debugElement.query(By.css('svg'));
        expect(svg).toBeTruthy();
    });

    it('should render correct number of range bars', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.detectChanges();

        const rects = fixture.debugElement.queryAll(By.css('rect'));
        expect(rects.length).toBe(4);
    });

    it('should compute bar data correctly', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.detectChanges();

        const bars = component.bars();
        expect(bars.length).toBe(4);
        expect(bars[0].data.low).toBe(-5);
        expect(bars[0].data.high).toBe(5);
    });

    it('should calculate data range including negatives', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.detectChanges();

        const range = component.dataRange();
        expect(range.min).toBeLessThan(0);
        expect(range.max).toBeGreaterThan(0);
    });

    it('should show range labels when enabled', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.componentRef.setInput('showRangeLabels', true);
        fixture.detectChanges();

        const texts = fixture.debugElement.queryAll(By.css('text'));
        expect(texts.length).toBeGreaterThan(4); // Axis labels + range labels
    });

    it('should hide range labels when disabled', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.componentRef.setInput('showRangeLabels', false);
        fixture.detectChanges();

        // Should only have axis and category labels, no range labels on bars
        const bars = component.bars();
        expect(bars.length).toBe(4);
    });

    it('should apply unit suffix to values', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.componentRef.setInput('unit', '°C');
        fixture.detectChanges();

        expect(component.formatWithUnit(10)).toBe('10°C');
        expect(component.formatWithUnit(-5)).toBe('-5°C');
    });

    it('should emit barClick when bar is clicked', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.detectChanges();

        const emitSpy = vi.spyOn(component.barClick, 'emit');
        const barGroup = fixture.debugElement.query(By.css('g[role="button"]'));
        barGroup.triggerEventHandler('click', new MouseEvent('click'));

        expect(emitSpy).toHaveBeenCalled();
    });

    it('should have role="img" for accessibility', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.detectChanges();

        const container = fixture.debugElement.query(By.css('[role="img"]'));
        expect(container).toBeTruthy();
    });

    it('should show grid lines when enabled', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.componentRef.setInput('showGrid', true);
        fixture.detectChanges();

        const gridLines = fixture.debugElement.queryAll(By.css('line[stroke-dasharray]'));
        expect(gridLines.length).toBeGreaterThan(0);
    });

    it('should have correct dimensions', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.componentRef.setInput('width', 600);
        fixture.componentRef.setInput('height', 400);
        fixture.detectChanges();

        const svg = fixture.debugElement.query(By.css('svg'));
        expect(svg.nativeElement.getAttribute('width')).toBe('600');
        expect(svg.nativeElement.getAttribute('height')).toBe('400');
    });
});
