import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BarChartComponent } from './bar-chart.component';
import { ChartDataPoint } from '../../lib/chart.types';
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
        expect(component.bars()).toHaveLength(3);
    });

    it('should default to vertical orientation', () => {
        expect(component.isVertical()).toBe(true);
    });

    it('should render an SVG element', () => {
        const svg = fixture.nativeElement.querySelector('svg');
        expect(svg).toBeTruthy();
    });

    it('should set aria-label on container', () => {
        const container = fixture.nativeElement.querySelector('[role="group"]');
        expect(container).toBeTruthy();
        expect(container.getAttribute('aria-label')).toContain('chart');
    });

    it('should use "Column chart" in aria-label for vertical orientation', () => {
        expect(component.chartAriaLabel()).toContain('Column chart');
    });

    it('should switch to horizontal orientation and update aria-label', () => {
        fixture.componentRef.setInput('orientation', 'horizontal');
        fixture.detectChanges();

        expect(component.isVertical()).toBe(false);
        expect(component.chartAriaLabel()).toContain('Bar chart');
    });

    it('should emit barClick when onBarClick is called', () => {
        let emitted: unknown;
        component.barClick.subscribe(val => emitted = val);

        const bar = component.bars()[1];
        const event = new MouseEvent('click');
        component.onBarClick(event, bar);

        expect(emitted).toBeDefined();
        expect((emitted as { point: ChartDataPoint; index: number }).point).toEqual({ name: 'B', value: 20 });
        expect((emitted as { point: ChartDataPoint; index: number }).index).toBe(1);
    });

    it('should emit barHover and set hoveredIndex when onBarHover is called', () => {
        let emitted: unknown;
        component.barHover.subscribe(val => emitted = val);

        const bar = component.bars()[0];
        component.onBarHover(bar);

        expect(component.hoveredIndex()).toBe(0);
        expect(emitted).toBeDefined();
        expect((emitted as { point: ChartDataPoint; index: number }).point).toEqual({ name: 'A', value: 10 });
        expect((emitted as { point: ChartDataPoint; index: number }).index).toBe(0);
    });

    it('should reset hoveredIndex and emit null on onBarLeave', () => {
        let emitted: unknown = 'not-set';
        component.barHover.subscribe(val => emitted = val);

        const bar = component.bars()[0];
        component.onBarHover(bar);
        expect(component.hoveredIndex()).toBe(0);

        component.onBarLeave();
        expect(component.hoveredIndex()).toBeNull();
        expect(emitted).toBeNull();
    });

    it('should return the hovered bar from hoveredBar computed', () => {
        expect(component.hoveredBar()).toBeNull();

        const bar = component.bars()[2];
        component.onBarHover(bar);

        const hovered = component.hoveredBar();
        expect(hovered).toBeTruthy();
        expect(hovered!.data.name).toBe('C');
        expect(hovered!.value).toBe(30);
    });

    it('should return empty bars for empty data', () => {
        fixture.componentRef.setInput('data', []);
        fixture.detectChanges();

        expect(component.bars()).toEqual([]);
    });

    it('should render xAxisLabel in SVG text element', () => {
        fixture.componentRef.setInput('xAxisLabel', 'Categories');
        fixture.detectChanges();

        const texts = fixture.nativeElement.querySelectorAll('svg text');
        const labelTexts = Array.from(texts).map((t: unknown) => (t as HTMLElement).textContent?.trim());
        expect(labelTexts).toContain('Categories');
    });

    it('should compute bars with correct dimensions for vertical orientation', () => {
        const bars = component.bars();
        for (const bar of bars) {
            expect(bar.width).toBeGreaterThan(0);
            expect(bar.height).toBeGreaterThanOrEqual(0);
        }
        expect(bars[2].height).toBeGreaterThan(bars[0].height);
    });

    it('should compute bars with horizontal layout when orientation is horizontal', () => {
        fixture.componentRef.setInput('orientation', 'horizontal');
        fixture.detectChanges();

        const bars = component.bars();
        expect(bars).toHaveLength(3);
        expect(bars[2].width).toBeGreaterThan(bars[0].width);
    });
});
