import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BarChartDrilldownComponent } from './bar-chart-drilldown.component';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DrilldownDataPoint, DrilldownSeries } from './chart.types';

const sampleData: DrilldownDataPoint[] = [
    { name: 'Q1', value: 100, drilldown: 'q1' },
    { name: 'Q2', value: 150, drilldown: 'q2' },
    { name: 'Q3', value: 120 },
];

const drilldownSeries: DrilldownSeries[] = [
    {
        id: 'q1', name: 'Q1 Breakdown', data: [
            { name: 'Jan', value: 30 },
            { name: 'Feb', value: 35 },
            { name: 'Mar', value: 35 },
        ]
    },
    {
        id: 'q2', name: 'Q2 Breakdown', data: [
            { name: 'Apr', value: 45 },
            { name: 'May', value: 50 },
            { name: 'Jun', value: 55 },
        ]
    },
];

describe('BarChartDrilldownComponent', () => {
    let component: BarChartDrilldownComponent;
    let fixture: ComponentFixture<BarChartDrilldownComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [BarChartDrilldownComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(BarChartDrilldownComponent);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.componentRef.setInput('drilldownSeries', drilldownSeries);
        fixture.detectChanges();
        expect(component).toBeTruthy();
    });

    it('should render SVG element', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.componentRef.setInput('drilldownSeries', drilldownSeries);
        fixture.detectChanges();

        const svg = fixture.debugElement.query(By.css('svg'));
        expect(svg).toBeTruthy();
    });

    it('should render correct number of bars initially', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.componentRef.setInput('drilldownSeries', drilldownSeries);
        fixture.detectChanges();

        const rects = fixture.debugElement.queryAll(By.css('rect'));
        expect(rects.length).toBe(3);
    });

    it('should identify bars with drilldown capability', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.componentRef.setInput('drilldownSeries', drilldownSeries);
        fixture.detectChanges();

        expect(component.canDrillDown(sampleData[0])).toBe(true);
        expect(component.canDrillDown(sampleData[1])).toBe(true);
        expect(component.canDrillDown(sampleData[2])).toBe(false);
    });

    it('should drill down when clicking a bar with drilldown data', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.componentRef.setInput('drilldownSeries', drilldownSeries);
        fixture.detectChanges();

        const drilldownSpy = vi.spyOn(component.drilldown, 'emit');

        component.handleBarClick({ point: sampleData[0], index: 0 });
        fixture.detectChanges();

        expect(drilldownSpy).toHaveBeenCalled();
        expect(component.isDrilledDown()).toBe(true);
    });

    it('should show breadcrumb when drilled down', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.componentRef.setInput('drilldownSeries', drilldownSeries);
        fixture.componentRef.setInput('showBreadcrumb', true);
        fixture.detectChanges();

        component.handleBarClick({ point: sampleData[0], index: 0 });
        fixture.detectChanges();

        const backButton = fixture.debugElement.query(By.css('button'));
        expect(backButton).toBeTruthy();
    });

    it('should drill up when clicking back button', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.componentRef.setInput('drilldownSeries', drilldownSeries);
        fixture.detectChanges();

        component.handleBarClick({ point: sampleData[0], index: 0 });
        fixture.detectChanges();
        expect(component.isDrilledDown()).toBe(true);

        const drillupSpy = vi.spyOn(component.drillup, 'emit');
        component.drillUp();
        fixture.detectChanges();

        expect(drillupSpy).toHaveBeenCalled();
        expect(component.isDrilledDown()).toBe(false);
    });

    it('should have correct dimensions', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.componentRef.setInput('drilldownSeries', drilldownSeries);
        fixture.componentRef.setInput('width', 600);
        fixture.componentRef.setInput('height', 400);
        fixture.detectChanges();

        const svg = fixture.debugElement.query(By.css('svg'));
        expect(svg.nativeElement.getAttribute('width')).toBe('600');
        expect(svg.nativeElement.getAttribute('height')).toBe('400');
    });
});
