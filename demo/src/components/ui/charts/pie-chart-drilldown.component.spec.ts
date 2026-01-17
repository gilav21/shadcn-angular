import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PieChartDrilldownComponent } from './pie-chart-drilldown.component';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DrilldownDataPoint, DrilldownSeries } from './chart.types';

const sampleData: DrilldownDataPoint[] = [
    { name: 'Chrome', value: 60, drilldown: 'chrome' },
    { name: 'Safari', value: 25, drilldown: 'safari' },
    { name: 'Firefox', value: 15 },
];

const drilldownSeries: DrilldownSeries[] = [
    {
        id: 'chrome', name: 'Chrome Versions', data: [
            { name: 'v120', value: 35 },
            { name: 'v119', value: 15 },
            { name: 'v118', value: 10 },
        ]
    },
    {
        id: 'safari', name: 'Safari Versions', data: [
            { name: 'v17', value: 18 },
            { name: 'v16', value: 7 },
        ]
    },
];

describe('PieChartDrilldownComponent', () => {
    let component: PieChartDrilldownComponent;
    let fixture: ComponentFixture<PieChartDrilldownComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [PieChartDrilldownComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(PieChartDrilldownComponent);
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

    it('should render correct number of slices initially', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.componentRef.setInput('drilldownSeries', drilldownSeries);
        fixture.detectChanges();

        const paths = fixture.debugElement.queryAll(By.css('path'));
        expect(paths.length).toBe(3);
    });

    it('should have drilldown cursor for slices with drilldown data', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.componentRef.setInput('drilldownSeries', drilldownSeries);
        fixture.detectChanges();

        // Check that Chrome and Safari slices can drill down
        expect(component.canDrillDown(sampleData[0])).toBe(true);
        expect(component.canDrillDown(sampleData[1])).toBe(true);
        expect(component.canDrillDown(sampleData[2])).toBe(false);
    });

    it('should drill down when clicking a slice with drilldown data', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.componentRef.setInput('drilldownSeries', drilldownSeries);
        fixture.detectChanges();

        const drilldownSpy = vi.spyOn(component.drilldown, 'emit');

        // Trigger drilldown
        component.handleSliceClick({ point: sampleData[0], index: 0 });
        fixture.detectChanges();

        expect(drilldownSpy).toHaveBeenCalled();
        expect(component.isDrilledDown()).toBe(true);
    });

    it('should show breadcrumb when drilled down', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.componentRef.setInput('drilldownSeries', drilldownSeries);
        fixture.componentRef.setInput('showBreadcrumb', true);
        fixture.detectChanges();

        // Drill down
        component.handleSliceClick({ point: sampleData[0], index: 0 });
        fixture.detectChanges();

        const backButton = fixture.debugElement.query(By.css('button'));
        expect(backButton).toBeTruthy();
    });

    it('should drill up when clicking back button', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.componentRef.setInput('drilldownSeries', drilldownSeries);
        fixture.detectChanges();

        // Drill down first
        component.handleSliceClick({ point: sampleData[0], index: 0 });
        fixture.detectChanges();
        expect(component.isDrilledDown()).toBe(true);

        // Drill up
        const drillupSpy = vi.spyOn(component.drillup, 'emit');
        component.drillUp();
        fixture.detectChanges();

        expect(drillupSpy).toHaveBeenCalled();
        expect(component.isDrilledDown()).toBe(false);
    });

    it('should have role="img" for accessibility', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.componentRef.setInput('drilldownSeries', drilldownSeries);
        fixture.detectChanges();

        const container = fixture.debugElement.query(By.css('[role="img"]'));
        expect(container).toBeTruthy();
    });
});
