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

        const svg = fixture.debugElement.query(By.css('svg'));
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

    it('should calculate totals correctly in absolute mode', () => {
        fixture.componentRef.setInput('series', sampleSeries);
        fixture.componentRef.setInput('categories', categories);
        fixture.componentRef.setInput('stacking', 'absolute');
        fixture.detectChanges();

        const stacks = component.stacks();
        // Q1: 50 + 40 + 10 = 100
        expect(stacks[0].total).toBe(100);
        // Q2: 60 + 50 + 12 = 122
        expect(stacks[1].total).toBe(122);
        // Q3: 70 + 55 + 8 = 133
        expect(stacks[2].total).toBe(133);
    });

    it('should show legend by default', () => {
        fixture.componentRef.setInput('series', sampleSeries);
        fixture.componentRef.setInput('categories', categories);
        fixture.detectChanges();

        const legendItems = fixture.debugElement.queryAll(By.css('.flex.gap-2 button'));
        expect(legendItems.length).toBe(3);
    });

    it('should hide legend when showLegend is false', () => {
        fixture.componentRef.setInput('series', sampleSeries);
        fixture.componentRef.setInput('categories', categories);
        fixture.componentRef.setInput('showLegend', false);
        fixture.detectChanges();

        const legendButtons = fixture.debugElement.queryAll(By.css('button'));
        expect(legendButtons.length).toBe(0);
    });

    it('should display totals on bars when showTotal is true', () => {
        fixture.componentRef.setInput('series', sampleSeries);
        fixture.componentRef.setInput('categories', categories);
        fixture.componentRef.setInput('showTotal', true);
        fixture.detectChanges();

        // Total labels should be displayed
        const texts = fixture.debugElement.queryAll(By.css('text'));
        expect(texts.length).toBeGreaterThan(0);
    });

    it('should have role="img" for accessibility', () => {
        fixture.componentRef.setInput('series', sampleSeries);
        fixture.componentRef.setInput('categories', categories);
        fixture.detectChanges();

        const container = fixture.debugElement.query(By.css('[role="img"]'));
        expect(container).toBeTruthy();
    });

    it('should handle percent stacking mode', () => {
        fixture.componentRef.setInput('series', sampleSeries);
        fixture.componentRef.setInput('categories', categories);
        fixture.componentRef.setInput('stacking', 'percent');
        fixture.detectChanges();

        // In percent mode, all stacks should visually fill to 100%
        const stacks = component.stacks();
        expect(stacks.length).toBe(3);
    });

    it('should have correct dimensions', () => {
        fixture.componentRef.setInput('series', sampleSeries);
        fixture.componentRef.setInput('categories', categories);
        fixture.componentRef.setInput('width', 600);
        fixture.componentRef.setInput('height', 400);
        fixture.detectChanges();

        const svg = fixture.debugElement.query(By.css('svg'));
        expect(svg.nativeElement.getAttribute('width')).toBe('600');
        expect(svg.nativeElement.getAttribute('height')).toBe('400');
    });
});
