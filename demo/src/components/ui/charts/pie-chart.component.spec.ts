import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PieChartComponent } from './pie-chart.component';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { ChartDataPoint } from './chart.types';

const sampleData: ChartDataPoint[] = [
    { name: 'Chrome', value: 60 },
    { name: 'Safari', value: 25 },
    { name: 'Firefox', value: 15 },
];

describe('PieChartComponent', () => {
    let component: PieChartComponent;
    let fixture: ComponentFixture<PieChartComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [PieChartComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(PieChartComponent);
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

    it('should render correct number of slices', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.detectChanges();

        const paths = fixture.debugElement.queryAll(By.css('path'));
        expect(paths.length).toBe(3);
    });

    it('should have correct size', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.componentRef.setInput('size', 400);
        fixture.detectChanges();

        const svg = fixture.debugElement.query(By.css('svg'));
        expect(svg.nativeElement.getAttribute('width')).toBe('400');
        expect(svg.nativeElement.getAttribute('height')).toBe('400');
    });

    it('should have role="img" for accessibility', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.detectChanges();

        const container = fixture.debugElement.query(By.css('[role="img"]'));
        expect(container).toBeTruthy();
    });

    it('should show legend by default', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.detectChanges();

        const legendItems = fixture.debugElement.queryAll(By.css('button'));
        expect(legendItems.length).toBeGreaterThanOrEqual(3);
    });

    it('should hide legend when showLegend is false', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.componentRef.setInput('showLegend', false);
        fixture.detectChanges();

        // Legend buttons should not be present
        const legendButtons = fixture.debugElement.queryAll(By.css('button')).filter(
            el => el.nativeElement.textContent.includes('Chrome')
        );
        expect(legendButtons.length).toBe(0);
    });

    it('should calculate percentages correctly', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.detectChanges();

        const slices = component.slices();
        expect(slices[0].percentage).toBe(60);
        expect(slices[1].percentage).toBe(25);
        expect(slices[2].percentage).toBe(15);
    });

    it('should calculate total correctly', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.detectChanges();

        expect(component.total()).toBe(100);
    });

    it('should handle empty data', () => {
        fixture.componentRef.setInput('data', []);
        fixture.detectChanges();

        const paths = fixture.debugElement.queryAll(By.css('path'));
        expect(paths.length).toBe(0);
    });

    it('should apply custom class', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.componentRef.setInput('class', 'custom-class');
        fixture.detectChanges();

        const container = fixture.debugElement.query(By.css('.custom-class'));
        expect(container).toBeTruthy();
    });

    it('should emit sliceClick when slice is clicked', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.detectChanges();

        const emitSpy = vi.spyOn(component.sliceClick, 'emit');
        const sliceGroup = fixture.debugElement.query(By.css('g[role="button"]'));
        sliceGroup.triggerEventHandler('click', new MouseEvent('click'));

        expect(emitSpy).toHaveBeenCalled();
    });
});

describe('PieChartComponent Donut Mode', () => {
    let fixture: ComponentFixture<PieChartComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [PieChartComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(PieChartComponent);
    });

    it('should create donut hole when innerRadius > 0', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.componentRef.setInput('innerRadius', 0.5);
        fixture.detectChanges();

        // A donut path has a different structure than a pie slice
        // The path should contain arc commands for both inner and outer radii
        const path = fixture.debugElement.query(By.css('path'));
        const d = path.nativeElement.getAttribute('d');

        // Donut slices have more arc commands
        expect(d.match(/A/g)?.length).toBeGreaterThan(1);
    });
});
