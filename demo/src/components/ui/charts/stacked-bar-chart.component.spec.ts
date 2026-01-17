import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StackedBarChartComponent } from './stacked-bar-chart.component';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { ChartSeries } from './chart.types';

const sampleSeries: ChartSeries[] = [
    {
        name: 'Desktop', data: [
            { name: 'Q1', value: 50 },
            { name: 'Q2', value: 60 },
            { name: 'Q3', value: 70 },
        ]
    },
    {
        name: 'Mobile', data: [
            { name: 'Q1', value: 40 },
            { name: 'Q2', value: 50 },
            { name: 'Q3', value: 55 },
        ]
    },
    {
        name: 'Tablet', data: [
            { name: 'Q1', value: 10 },
            { name: 'Q2', value: 12 },
            { name: 'Q3', value: 8 },
        ]
    },
];

const categories = ['Q1', 'Q2', 'Q3'];

describe('StackedBarChartComponent', () => {
    let component: StackedBarChartComponent;
    let fixture: ComponentFixture<StackedBarChartComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [StackedBarChartComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(StackedBarChartComponent);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        fixture.componentRef.setInput('series', sampleSeries);
        fixture.componentRef.setInput('categories', categories);
        fixture.detectChanges();
        expect(component).toBeTruthy();
    });

    it('should render SVG element', () => {
        fixture.componentRef.setInput('series', sampleSeries);
        fixture.componentRef.setInput('categories', categories);
        fixture.detectChanges();

        const svg = fixture.debugElement.query(By.css('svg[role="img"]'));
        expect(svg).toBeTruthy();
    });

    it('should render stacked segments', () => {
        fixture.componentRef.setInput('series', sampleSeries);
        fixture.componentRef.setInput('categories', categories);
        fixture.detectChanges();

        // 3 categories × 3 series = 9 segments
        const rects = fixture.debugElement.queryAll(By.css('rect'));
        expect(rects.length).toBe(9);
    });

    it('should show legend by default', () => {
        fixture.componentRef.setInput('series', sampleSeries);
        fixture.componentRef.setInput('categories', categories);
        fixture.detectChanges();

        // Legend items use div elements, not buttons
        const legendContainer = fixture.debugElement.query(By.css('.flex.flex-wrap'));
        expect(legendContainer).toBeTruthy();
    });

    it('should hide legend when showLegend is false', () => {
        fixture.componentRef.setInput('series', sampleSeries);
        fixture.componentRef.setInput('categories', categories);
        fixture.componentRef.setInput('showLegend', false);
        fixture.detectChanges();

        // Legend container should not exist
        const legendContainer = fixture.debugElement.query(By.css('.flex.flex-wrap'));
        expect(legendContainer).toBeFalsy();
    });

    it('should have role="img" for accessibility', () => {
        fixture.componentRef.setInput('series', sampleSeries);
        fixture.componentRef.setInput('categories', categories);
        fixture.detectChanges();

        const container = fixture.debugElement.query(By.css('[role="img"]'));
        expect(container).toBeTruthy();
    });

    it('should handle absolute stacking mode', () => {
        fixture.componentRef.setInput('series', sampleSeries);
        fixture.componentRef.setInput('categories', categories);
        fixture.componentRef.setInput('stacking', 'absolute');
        fixture.detectChanges();

        // Should render without errors
        const rects = fixture.debugElement.queryAll(By.css('rect'));
        expect(rects.length).toBe(9);
    });

    it('should handle percent stacking mode', () => {
        fixture.componentRef.setInput('series', sampleSeries);
        fixture.componentRef.setInput('categories', categories);
        fixture.componentRef.setInput('stacking', 'percent');
        fixture.detectChanges();

        // Should render without errors
        const rects = fixture.debugElement.queryAll(By.css('rect'));
        expect(rects.length).toBe(9);
    });

    it('should have correct dimensions', () => {
        fixture.componentRef.setInput('series', sampleSeries);
        fixture.componentRef.setInput('categories', categories);
        fixture.componentRef.setInput('width', 600);
        fixture.componentRef.setInput('height', 400);
        fixture.detectChanges();

        const svg = fixture.debugElement.query(By.css('svg[role="img"]'));
        expect(svg.nativeElement.getAttribute('width')).toBe('600');
        expect(svg.nativeElement.getAttribute('height')).toBe('400');
    });

    it('should show grid lines by default', () => {
        fixture.componentRef.setInput('series', sampleSeries);
        fixture.componentRef.setInput('categories', categories);
        fixture.detectChanges();

        const gridLines = fixture.debugElement.queryAll(By.css('line[stroke-dasharray]'));
        expect(gridLines.length).toBeGreaterThan(0);
    });
});
