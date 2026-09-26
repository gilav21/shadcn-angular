import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ColumnRangeChartComponent } from './column-range-chart.component';
import { RangeDataPoint } from '../../lib/chart.types';
import {
    describe,
    it,
    expect,
    beforeEach,
    afterEach,
} from 'vitest';

class ResizeObserverStub {
    observe(): void {
        /* no-op: jsdom has no layout, so no resize callbacks fire */
    }
    disconnect(): void {
        /* no-op */
    }
}

const originalResizeObserver = (
    globalThis as unknown as { ResizeObserver?: unknown }
).ResizeObserver;

describe('ColumnRangeChartComponent', () => {
    let component: ColumnRangeChartComponent;
    let fixture: ComponentFixture<ColumnRangeChartComponent>;

    const sampleData: RangeDataPoint[] = [
        { name: 'Jan', low: -5, high: 10 },
        { name: 'Feb', low: -3, high: 12 },
        { name: 'Mar', low: 2, high: 18 },
    ];

    async function createFixture(): Promise<void> {
        await TestBed.configureTestingModule({
            imports: [ColumnRangeChartComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(ColumnRangeChartComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('data', sampleData);
        fixture.detectChanges();
    }

    beforeEach(async () => {
        (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
            ResizeObserverStub;
        await createFixture();
    });

    afterEach(() => {
        (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver =
            originalResizeObserver;
    });

    it('should set aria-label on SVG', () => {
        const svg = fixture.nativeElement.querySelector('svg[role="group"]');
        expect(svg).toBeTruthy();
        expect(svg.getAttribute('aria-label')).toContain('Column range chart');
    });

    it('should include the title in the aria-label when provided', () => {
        fixture.componentRef.setInput('title', 'Temperatures');
        fixture.detectChanges();
        expect(component.chartAriaLabel()).toContain('Temperatures');
    });

    it('should place each bar between its low and high on the padded value axis', () => {
        // Axis [-7.3, 20.3] (range plus 10% each side) over the 235px plot from y=30 to y=265.
        const jan = component.bars()[0];
        expect(jan.highY).toBeCloseTo(265 - (17.3 / 27.6) * 235, 6);
        expect(jan.lowY).toBeCloseTo(265 - (2.3 / 27.6) * 235, 6);
        expect(jan.y).toBe(jan.highY);
        expect(jan.height).toBeCloseTo(jan.lowY - jan.highY, 6);
        expect(jan.height).toBeCloseTo((15 / 27.6) * 235, 6);
    });

    it('should clamp bar height to a minimum of 1 for a zero-width range', () => {
        fixture.componentRef.setInput('data', [
            { name: 'Flat', low: 5, high: 5 },
        ]);
        fixture.detectChanges();
        expect(component.bars()[0].height).toBe(1);
    });

    it('should emit barClick with the MouseEvent when onBarClick is called', () => {
        let emitted: unknown;
        component.barClick.subscribe(val => (emitted = val));

        const bar = component.bars()[0];
        const event = new MouseEvent('click');
        component.onBarClick(event, bar);

        expect(emitted).toBeDefined();
        expect(
            (emitted as { point: RangeDataPoint; index: number }).point
        ).toEqual({ name: 'Jan', low: -5, high: 10 });
        expect((emitted as { index: number }).index).toBe(0);
        expect((emitted as { event?: MouseEvent }).event).toBeInstanceOf(
            MouseEvent
        );
    });

    it('should emit an undefined event when onBarClick receives a non-MouseEvent', () => {
        let emitted: unknown;
        component.barClick.subscribe(val => (emitted = val));

        const bar = component.bars()[0];
        const event = new KeyboardEvent('keydown', { key: 'Enter' });
        component.onBarClick(event, bar);

        expect((emitted as { event?: MouseEvent }).event).toBeUndefined();
    });

    it('should set hoveredIndex and hoveredBar on onBarHover', () => {
        expect(component.hoveredIndex()).toBeNull();
        expect(component.hoveredBar()).toBeNull();

        const bar = component.bars()[1];
        component.onBarHover(bar);

        expect(component.hoveredIndex()).toBe(1);
        const hovered = component.hoveredBar();
        expect(hovered).toBeTruthy();
        expect(hovered!.data.name).toBe('Feb');
    });

    it('should reset hoveredIndex on onBarLeave', () => {
        const bar = component.bars()[0];
        component.onBarHover(bar);
        expect(component.hoveredIndex()).toBe(0);

        component.onBarLeave();
        expect(component.hoveredIndex()).toBeNull();
        expect(component.hoveredBar()).toBeNull();
    });

    it('should render the tooltip when a bar is hovered', () => {
        component.onBarHover(component.bars()[1]);
        fixture.detectChanges();

        const tooltip = fixture.nativeElement.querySelector('.z-50');
        expect(tooltip).toBeTruthy();
        expect(tooltip.textContent).toContain('Feb');
        expect(tooltip.textContent).toContain('Range');
    });

    it('should append unit to formatValue output', () => {
        fixture.componentRef.setInput('unit', '°C');
        fixture.detectChanges();

        const formatted = component.formatValue(25);
        expect(formatted).toContain('25');
        expect(formatted).toContain('°C');
    });

    it('should append unit to formatAxisValue and compact large numbers', () => {
        fixture.componentRef.setInput('unit', '°C');
        fixture.detectChanges();
        const formatted = component.formatAxisValue(1500);
        expect(formatted).toContain('°C');
        expect(formatted).toContain('K');
    });

    it('should build a getBarAriaLabel string with name, low, high, and unit', () => {
        fixture.componentRef.setInput('unit', '°C');
        fixture.detectChanges();
        const label = component.getBarAriaLabel(component.bars()[0]);
        expect(label).toContain('Jan');
        expect(label).toContain('-5');
        expect(label).toContain('10');
        expect(label).toContain('°C');
    });

    it('should compute correct dataRange min and max from data', () => {
        const range = component.dataRange();
        const rawMin = -5;
        const rawMax = 18;
        const padding = (rawMax - rawMin) * 0.1;

        expect(range.min).toBeCloseTo(rawMin - padding, 5);
        expect(range.max).toBeCloseTo(rawMax + padding, 5);
    });

    it('should fall back to a default dataRange for empty data', () => {
        fixture.componentRef.setInput('data', []);
        fixture.detectChanges();
        expect(component.dataRange()).toEqual({ min: 0, max: 100 });
    });

    it('should return empty bars for empty data', () => {
        fixture.componentRef.setInput('data', []);
        fixture.detectChanges();

        expect(component.bars()).toEqual([]);
    });

    it('should compute axis ticks spanning the data range', () => {
        // [-7.3, 20.3] / 5 ticks -> a nice step of 5, widened outwards to whole steps.
        expect(component.axisTicks()).toEqual([-10, -5, 0, 5, 10, 15, 20, 25]);
    });

    it('should position the bottom tick near the chart bottom', () => {
        const area = component.chartArea();
        const range = component.dataRange();
        expect(component.getTickPosition(range.min)).toBeCloseTo(area.bottom);
        expect(component.getTickPosition(range.max)).toBeCloseTo(area.top);
    });

    it('should hide grid lines when showGrid is false', () => {
        fixture.componentRef.setInput('showGrid', false);
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelectorAll('line')).toHaveLength(0);
    });

    it('should hide range labels when showRangeLabels is false', () => {
        const texts = (): string[] =>
            Array.from(fixture.nativeElement.querySelectorAll('svg text') as NodeListOf<SVGTextElement>)
                .map(t => t.textContent?.trim() ?? '');
        const axisAndCategories = ['-10', '-5', '0', '5', '10', '15', '20', '25', 'Jan', 'Feb', 'Mar'];
        expect(texts()).toEqual([...axisAndCategories, '10', '-5', '12', '-3', '18', '2']);

        fixture.componentRef.setInput('showRangeLabels', false);
        fixture.detectChanges();
        expect(texts()).toEqual(axisAndCategories);
    });

    it('should honor a custom bar color', () => {
        fixture.componentRef.setInput('data', [
            { name: 'X', low: 1, high: 5, color: '#ff0000' },
        ]);
        fixture.detectChanges();
        expect(component.bars()[0].color).toBe('#ff0000');
    });

    it('should append the custom class to the container classes', () => {
        fixture.componentRef.setInput('class', 'my-extra-class');
        fixture.detectChanges();
        expect(component.containerClasses()).toContain('my-extra-class');
    });

    describe('RTL', () => {
        it('should report isRtl true when dir is rtl', () => {
            fixture.componentRef.setInput('dir', 'rtl');
            fixture.detectChanges();
            expect(component.isRtl()).toBe(true);
        });

        it('should swap left/right padding in RTL', () => {
            fixture.componentRef.setInput('dir', 'ltr');
            fixture.detectChanges();
            const ltr = component.padding();

            fixture.componentRef.setInput('dir', 'rtl');
            fixture.detectChanges();
            const rtl = component.padding();

            expect(rtl.right).toBeGreaterThan(ltr.right);
            expect(rtl.left).toBeLessThan(ltr.left);
        });

        it('should lay bars out right-to-left in RTL', () => {
            fixture.componentRef.setInput('dir', 'rtl');
            fixture.detectChanges();
            const bars = component.bars();
            expect(bars[0].x).toBeGreaterThan(bars[2].x);
        });

        it('should place axis labels on the right edge in RTL', () => {
            fixture.componentRef.setInput('dir', 'rtl');
            fixture.detectChanges();
            const area = component.chartArea();
            const texts = Array.from(
                fixture.nativeElement.querySelectorAll('svg text')
            ) as SVGTextElement[];
            const tickLabel = texts.find(
                t => Number(t.getAttribute('x')) > area.right
            );
            expect(tickLabel).toBeTruthy();
        });
    });
});
