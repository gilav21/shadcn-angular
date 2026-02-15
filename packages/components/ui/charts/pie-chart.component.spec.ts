import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PieChartComponent } from './pie-chart.component';
import { ChartDataPoint } from './chart.types';
import { describe, it, expect, beforeEach } from 'vitest';

describe('PieChartComponent', () => {
    let component: PieChartComponent;
    let fixture: ComponentFixture<PieChartComponent>;

    const sampleData: ChartDataPoint[] = [
        { name: 'Apples', value: 40 },
        { name: 'Bananas', value: 30 },
        { name: 'Cherries', value: 30 },
    ];

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [PieChartComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(PieChartComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('data', sampleData);
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should compute slices from data', () => {
        expect(component.slices().length).toBe(3);
    });

    it('should compute total correctly', () => {
        expect(component.total()).toBe(100);
    });

    it('should render an SVG element', () => {
        const svg = fixture.nativeElement.querySelector('svg');
        expect(svg).toBeTruthy();
    });

    it('should set aria-label on container', () => {
        const container = fixture.nativeElement.querySelector('[role="img"]');
        expect(container).toBeTruthy();
        expect(container.getAttribute('aria-label')).toContain('Pie chart');
    });
});
