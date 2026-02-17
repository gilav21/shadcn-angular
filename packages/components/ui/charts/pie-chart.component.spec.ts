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

    it('should compute correct percentages for slices', () => {
        const slices = component.slices();
        expect(slices[0].percentage).toBe(40);
        expect(slices[1].percentage).toBe(30);
        expect(slices[2].percentage).toBe(30);
    });

    it('should emit sliceClick when onSliceClick is called', () => {
        let emitted: unknown;
        component.sliceClick.subscribe(val => emitted = val);

        const slice = component.slices()[0];
        const event = new MouseEvent('click');
        component.onSliceClick(event, slice);

        expect(emitted).toBeDefined();
        expect((emitted as { point: ChartDataPoint; index: number }).point).toEqual({ name: 'Apples', value: 40 });
        expect((emitted as { point: ChartDataPoint; index: number }).index).toBe(0);
    });

    it('should set hoveredIndex and emit sliceHover on onSliceHover', () => {
        let emitted: unknown;
        component.sliceHover.subscribe(val => emitted = val);

        const slice = component.slices()[1];
        component.onSliceHover(slice);

        expect(component.hoveredIndex()).toBe(1);
        expect(emitted).toBeDefined();
        expect((emitted as { point: ChartDataPoint; index: number }).point).toEqual({ name: 'Bananas', value: 30 });
    });

    it('should return hoveredSlice computed after hover', () => {
        expect(component.hoveredSlice()).toBeNull();

        const slice = component.slices()[2];
        component.onSliceHover(slice);

        const hovered = component.hoveredSlice();
        expect(hovered).toBeTruthy();
        expect(hovered!.data.name).toBe('Cherries');
        expect(hovered!.percentage).toBe(30);
    });

    it('should reset hoveredIndex and emit null on onSliceLeave', () => {
        let emitted: unknown = 'not-set';
        component.sliceHover.subscribe(val => emitted = val);

        const slice = component.slices()[0];
        component.onSliceHover(slice);
        expect(component.hoveredIndex()).toBe(0);

        component.onSliceLeave();
        expect(component.hoveredIndex()).toBeNull();
        expect(emitted).toBeNull();
        expect(component.hoveredSlice()).toBeNull();
    });

    it('should render legend buttons when showLegend is true', () => {
        fixture.componentRef.setInput('showLegend', true);
        fixture.componentRef.setInput('legendPosition', 'right');
        fixture.detectChanges();

        const buttons = fixture.nativeElement.querySelectorAll('button');
        expect(buttons.length).toBe(3);
    });

    it('should not render legend buttons when legendPosition is none', () => {
        fixture.componentRef.setInput('legendPosition', 'none');
        fixture.detectChanges();

        const buttons = fixture.nativeElement.querySelectorAll('button');
        expect(buttons.length).toBe(0);
    });

    it('should return empty slices for empty data', () => {
        fixture.componentRef.setInput('data', []);
        fixture.detectChanges();

        expect(component.slices()).toEqual([]);
    });

    it('should return empty slices when total is zero', () => {
        fixture.componentRef.setInput('data', [{ name: 'A', value: 0 }]);
        fixture.detectChanges();

        expect(component.total()).toBe(0);
        expect(component.slices()).toEqual([]);
    });
});
