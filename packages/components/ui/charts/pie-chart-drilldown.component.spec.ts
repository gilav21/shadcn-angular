import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PieChartDrilldownComponent } from './pie-chart-drilldown.component';
import { DrilldownDataPoint } from './chart.types';
import { describe, it, expect, beforeEach } from 'vitest';

describe('PieChartDrilldownComponent', () => {
    let component: PieChartDrilldownComponent;
    let fixture: ComponentFixture<PieChartDrilldownComponent>;

    const sampleData: DrilldownDataPoint[] = [
        { name: 'Fruits', value: 60, drilldown: 'fruits-detail' },
        { name: 'Vegetables', value: 40 },
    ];

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [PieChartDrilldownComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(PieChartDrilldownComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('data', sampleData);
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should compute slices from data', () => {
        expect(component.currentSlices().length).toBe(2);
    });

    it('should not be drilled down initially', () => {
        expect(component.isDrilledDown()).toBe(false);
    });

    it('should render an SVG element', () => {
        const svg = fixture.nativeElement.querySelector('svg');
        expect(svg).toBeTruthy();
    });

    it('should set aria-label on SVG', () => {
        const svg = fixture.nativeElement.querySelector('svg[role="img"]');
        expect(svg).toBeTruthy();
        expect(svg.getAttribute('aria-label')).toContain('Pie chart with drilldown');
    });
});
