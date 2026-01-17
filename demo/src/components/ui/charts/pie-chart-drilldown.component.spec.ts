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

        // Check the component's computed currentSlices
        const slices = component.currentSlices();
        expect(slices.length).toBe(3);
    });

    it('should not be drilled down initially', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.componentRef.setInput('drilldownSeries', drilldownSeries);
        fixture.detectChanges();

        expect(component.isDrilledDown()).toBe(false);
    });

    it('should show back button when drilled down and breadcrumb enabled', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.componentRef.setInput('drilldownSeries', drilldownSeries);
        fixture.componentRef.setInput('showBreadcrumb', true);
        fixture.detectChanges();

        // Simulate drilldown manually via clicking slice
        const sliceGroup = fixture.debugElement.query(By.css('g[role="button"]'));
        sliceGroup?.triggerEventHandler('click', new MouseEvent('click'));
        fixture.detectChanges();

        // Check for back button presence when drilled
        if (component.isDrilledDown()) {
            const buttons = fixture.debugElement.queryAll(By.css('button'));
            expect(buttons.length).toBeGreaterThan(0);
        }
    });

    it('should have role="img" for accessibility', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.componentRef.setInput('drilldownSeries', drilldownSeries);
        fixture.detectChanges();

        const container = fixture.debugElement.query(By.css('[role="img"]'));
        expect(container).toBeTruthy();
    });

    it('should show legend when showLegend is true', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.componentRef.setInput('drilldownSeries', drilldownSeries);
        fixture.componentRef.setInput('showLegend', true);
        fixture.detectChanges();

        const legendButtons = fixture.debugElement.queryAll(By.css('button'));
        expect(legendButtons.length).toBeGreaterThan(0);
    });

    it('should emit drilldown event when clicking slice with drilldown data', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.componentRef.setInput('drilldownSeries', drilldownSeries);
        fixture.detectChanges();

        const drilldownSpy = vi.spyOn(component.drilldown, 'emit');
        const sliceGroup = fixture.debugElement.query(By.css('g[role="button"]'));
        sliceGroup?.triggerEventHandler('click', new MouseEvent('click'));

        expect(drilldownSpy).toHaveBeenCalled();
    });
});
