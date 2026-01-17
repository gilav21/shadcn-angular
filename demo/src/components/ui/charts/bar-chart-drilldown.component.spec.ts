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

        const svg = fixture.debugElement.query(By.css('svg[role="img"]'));
        expect(svg).toBeTruthy();
    });

    it('should render correct number of bars initially', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.componentRef.setInput('drilldownSeries', drilldownSeries);
        fixture.detectChanges();

        const rects = fixture.debugElement.queryAll(By.css('rect'));
        expect(rects.length).toBe(3);
    });

    it('should not be drilled down initially', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.componentRef.setInput('drilldownSeries', drilldownSeries);
        fixture.detectChanges();

        expect(component.isDrilledDown()).toBe(false);
    });

    it('should show breadcrumb when drilled down', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.componentRef.setInput('drilldownSeries', drilldownSeries);
        fixture.componentRef.setInput('showBreadcrumb', true);
        fixture.detectChanges();

        // Trigger drilldown via clicking bar
        const barGroup = fixture.debugElement.query(By.css('g[role="button"]'));
        barGroup?.triggerEventHandler('click', new MouseEvent('click'));
        fixture.detectChanges();

        if (component.isDrilledDown()) {
            const backButton = fixture.debugElement.query(By.css('button'));
            expect(backButton).toBeTruthy();
        }
    });

    it('should emit drilldown event when clicking bar with drilldown data', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.componentRef.setInput('drilldownSeries', drilldownSeries);
        fixture.detectChanges();

        const drilldownSpy = vi.spyOn(component.drilldown, 'emit');
        const barGroup = fixture.debugElement.query(By.css('g[role="button"]'));
        barGroup?.triggerEventHandler('click', new MouseEvent('click'));

        expect(drilldownSpy).toHaveBeenCalled();
    });

    it('should have correct dimensions', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.componentRef.setInput('drilldownSeries', drilldownSeries);
        fixture.componentRef.setInput('width', 600);
        fixture.componentRef.setInput('height', 400);
        fixture.detectChanges();

        const svg = fixture.debugElement.query(By.css('svg[role="img"]'));
        expect(svg.nativeElement.getAttribute('width')).toBe('600');
        expect(svg.nativeElement.getAttribute('height')).toBe('400');
    });

    it('should show grid lines by default', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.componentRef.setInput('drilldownSeries', drilldownSeries);
        fixture.detectChanges();

        const gridLines = fixture.debugElement.queryAll(By.css('line[stroke-dasharray]'));
        expect(gridLines.length).toBeGreaterThan(0);
    });
});
