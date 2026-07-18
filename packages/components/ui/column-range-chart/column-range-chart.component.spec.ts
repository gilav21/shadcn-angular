import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ColumnRangeChartComponent } from './column-range-chart.component';
import { RangeDataPoint } from '../../lib/chart.types';
import {
    describe,
    it,
    expect,
    vi,
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

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should compute bars from data', () => {
        expect(component.bars()).toHaveLength(3);
    });

    it('should render an SVG element', () => {
        const svg = fixture.nativeElement.querySelector('svg');
        expect(svg).toBeTruthy();
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

    it('should compute bars with positive height based on data range', () => {
        const bars = component.bars();
        for (const bar of bars) {
            expect(bar.height).toBeGreaterThan(0);
        }
    });

    it('should give taller bars to data points with wider ranges', () => {
        const bars = component.bars();
        const janBar = bars[0];
        const marBar = bars[2];

        // Jan range = 10 - (-5) = 15; Mar range = 18 - 2 = 16 (wider) => Mar bar is taller.
        expect(marBar.height).toBeGreaterThan(janBar.height);
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

    it('should compute lowY greater than highY for each bar', () => {
        const bars = component.bars();
        for (const bar of bars) {
            expect(bar.lowY).toBeGreaterThan(bar.highY);
        }
    });

    it('should compute axis ticks spanning the data range', () => {
        const ticks = component.axisTicks();
        expect(ticks.length).toBeGreaterThan(1);
        expect(ticks[0]).toBeLessThanOrEqual(component.dataRange().min + 1e-6);
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
        const withLabels =
            fixture.nativeElement.querySelectorAll('svg text').length;
        fixture.componentRef.setInput('showRangeLabels', false);
        fixture.detectChanges();
        const withoutLabels =
            fixture.nativeElement.querySelectorAll('svg text').length;
        expect(withoutLabels).toBeLessThan(withLabels);
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

    it('should re-check direction on the deferred ngAfterViewInit timer', () => {
        vi.useFakeTimers();
        const local = TestBed.createComponent(ColumnRangeChartComponent);
        local.componentRef.setInput('data', sampleData);
        local.detectChanges();
        vi.advanceTimersByTime(0);
        vi.useRealTimers();
        expect(local.componentInstance.isRtl()).toBe(false);
        local.destroy();
    });

    describe('RTL', () => {
        it('should report isRtl true when dir is rtl', () => {
            fixture.componentRef.setInput('dir', 'rtl');
            fixture.detectChanges();
            expect(component.isRtl()).toBe(true);
        });

        it('should report isRtl false when dir is ltr', () => {
            fixture.componentRef.setInput('dir', 'ltr');
            fixture.detectChanges();
            expect(component.isRtl()).toBe(false);
        });

        it('should fall back to the DOM direction when dir is auto', () => {
            fixture.componentRef.setInput('dir', 'auto');
            fixture.detectChanges();
            expect(component.isRtl()).toBe(false);
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
