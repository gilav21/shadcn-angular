import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BarChartComponent } from './bar-chart.component';
import { ChartDataPoint } from './chart.types';
import { describe, it, expect, beforeEach } from 'vitest';

describe('BarChartComponent', () => {
    let component: BarChartComponent;
    let fixture: ComponentFixture<BarChartComponent>;

    const sampleData: ChartDataPoint[] = [
        { name: 'A', value: 10 },
        { name: 'B', value: 20 },
        { name: 'C', value: 30 },
    ];

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [BarChartComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(BarChartComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('data', sampleData);
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should compute bars from data', () => {
        expect(component.bars().length).toBe(3);
    });

    it('should default to vertical orientation', () => {
        expect(component.isVertical()).toBe(true);
    });

    it('should render an SVG element', () => {
        const svg = fixture.nativeElement.querySelector('svg');
        expect(svg).toBeTruthy();
    });

    it('should set aria-label on container', () => {
        const container = fixture.nativeElement.querySelector('[role="img"]');
        expect(container).toBeTruthy();
        expect(container.getAttribute('aria-label')).toContain('chart');
    });
});
