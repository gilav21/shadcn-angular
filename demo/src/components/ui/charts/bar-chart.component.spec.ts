import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BarChartComponent } from './bar-chart.component';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { ChartDataPoint } from './chart.types';

const sampleData: ChartDataPoint[] = [
    { name: 'Jan', value: 100 },
    { name: 'Feb', value: 200 },
    { name: 'Mar', value: 150 },
];

describe('BarChartComponent', () => {
    let component: BarChartComponent;
    let fixture: ComponentFixture<BarChartComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [BarChartComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(BarChartComponent);
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

    it('should render correct number of bars', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.detectChanges();

        const rects = fixture.debugElement.queryAll(By.css('rect'));
        expect(rects.length).toBe(3);
    });

    it('should have correct dimensions', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.componentRef.setInput('width', 600);
        fixture.componentRef.setInput('height', 400);
        fixture.detectChanges();

        const svg = fixture.debugElement.query(By.css('svg'));
        expect(svg.nativeElement.getAttribute('width')).toBe('600');
        expect(svg.nativeElement.getAttribute('height')).toBe('400');
    });

    it('should render vertical bars by default', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.detectChanges();

        expect(component.isVertical()).toBe(true);
    });

    it('should render horizontal bars when orientation is horizontal', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.componentRef.setInput('orientation', 'horizontal');
        fixture.detectChanges();

        expect(component.isVertical()).toBe(false);
    });

    it('should have role="img" for accessibility', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.detectChanges();

        const container = fixture.debugElement.query(By.css('[role="img"]'));
        expect(container).toBeTruthy();
    });

    it('should compute axis ticks', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.detectChanges();

        const ticks = component.axisTicks();
        expect(ticks.length).toBeGreaterThan(0);
    });

    it('should compute bar positions', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.detectChanges();

        const bars = component.bars();
        expect(bars.length).toBe(3);
        expect(bars[0].width).toBeGreaterThan(0);
        expect(bars[0].height).toBeGreaterThan(0);
    });

    it('should handle empty data', () => {
        fixture.componentRef.setInput('data', []);
        fixture.detectChanges();

        const bars = component.bars();
        expect(bars.length).toBe(0);
    });

    it('should emit barClick when bar is clicked', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.detectChanges();

        const emitSpy = vi.spyOn(component.barClick, 'emit');
        const barGroup = fixture.debugElement.query(By.css('g[role="button"]'));
        barGroup.triggerEventHandler('click', new MouseEvent('click'));

        expect(emitSpy).toHaveBeenCalled();
    });

    it('should show grid lines by default', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.detectChanges();

        const gridLines = fixture.debugElement.queryAll(By.css('line[stroke-dasharray]'));
        expect(gridLines.length).toBeGreaterThan(0);
    });

    it('should hide grid lines when showGrid is false', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.componentRef.setInput('showGrid', false);
        fixture.detectChanges();

        const gridLines = fixture.debugElement.queryAll(By.css('line[stroke-dasharray]'));
        expect(gridLines.length).toBe(0);
    });
});
