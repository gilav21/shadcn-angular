import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BarChartComponent } from './bar-chart.component';
import { ChartDataPoint } from '../../lib/chart.types';
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

describe('BarChartComponent', () => {
    let component: BarChartComponent;
    let fixture: ComponentFixture<BarChartComponent>;

    const sampleData: ChartDataPoint[] = [
        { name: 'A', value: 10 },
        { name: 'B', value: 20 },
        { name: 'C', value: 30 },
    ];

    async function createFixture(): Promise<void> {
        await TestBed.configureTestingModule({
            imports: [BarChartComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(BarChartComponent);
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

    it('should set aria-label on container', () => {
        const container = fixture.nativeElement.querySelector('[role="group"]');
        expect(container).toBeTruthy();
        expect(container.getAttribute('aria-label')).toContain('Column chart');
    });

    it('should switch to horizontal orientation and update aria-label', () => {
        expect(component.isVertical()).toBe(true);

        fixture.componentRef.setInput('orientation', 'horizontal');
        fixture.detectChanges();

        expect(component.isVertical()).toBe(false);
        expect(component.chartAriaLabel()).toContain('Bar chart');
    });

    it('should include title in aria-label when provided', () => {
        fixture.componentRef.setInput('title', 'Sales');
        fixture.detectChanges();
        expect(component.chartAriaLabel()).toContain('Sales');
    });

    it('should emit barClick with MouseEvent when onBarClick is called', () => {
        let emitted: unknown;
        component.barClick.subscribe(val => (emitted = val));

        const bar = component.bars()[1];
        const event = new MouseEvent('click');
        component.onBarClick(event, bar);

        expect(emitted).toBeDefined();
        expect(
            (emitted as { point: ChartDataPoint; index: number }).point
        ).toEqual({ name: 'B', value: 20 });
        expect(
            (emitted as { point: ChartDataPoint; index: number }).index
        ).toBe(1);
        expect(
            (emitted as { event?: MouseEvent }).event
        ).toBeInstanceOf(MouseEvent);
    });

    it('should emit undefined event when onBarClick receives a non-MouseEvent', () => {
        let emitted: unknown;
        component.barClick.subscribe(val => (emitted = val));

        const bar = component.bars()[0];
        const event = new KeyboardEvent('keydown', { key: 'Enter' });
        component.onBarClick(event, bar);

        expect((emitted as { event?: MouseEvent }).event).toBeUndefined();
    });

    it('should emit barHover and set hoveredIndex when onBarHover is called', () => {
        let emitted: unknown;
        component.barHover.subscribe(val => (emitted = val));

        const bar = component.bars()[0];
        component.onBarHover(bar);

        expect(component.hoveredIndex()).toBe(0);
        expect(emitted).toBeDefined();
        expect(
            (emitted as { point: ChartDataPoint; index: number }).point
        ).toEqual({ name: 'A', value: 10 });
        expect(
            (emitted as { point: ChartDataPoint; index: number }).index
        ).toBe(0);
    });

    it('should reset hoveredIndex and emit null on onBarLeave', () => {
        let emitted: unknown = 'not-set';
        component.barHover.subscribe(val => (emitted = val));

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

    it('should render the tooltip when a bar is hovered and showTooltip is true', () => {
        const bar = component.bars()[1];
        component.onBarHover(bar);
        fixture.detectChanges();

        const tooltip = fixture.nativeElement.querySelector('.z-50');
        expect(tooltip).toBeTruthy();
        expect(tooltip.textContent).toContain('B');
    });

    it('should not render the tooltip when showTooltip is false', () => {
        fixture.componentRef.setInput('showTooltip', false);
        component.onBarHover(component.bars()[1]);
        fixture.detectChanges();

        const tooltip = fixture.nativeElement.querySelector('.z-50');
        expect(tooltip).toBeNull();
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
        const labelTexts = Array.from(texts).map((t: unknown) =>
            (t as HTMLElement).textContent?.trim()
        );
        expect(labelTexts).toContain('Categories');
    });

    it('should render yAxisLabel in SVG text element', () => {
        fixture.componentRef.setInput('yAxisLabel', 'Amount');
        fixture.detectChanges();

        const texts = fixture.nativeElement.querySelectorAll('svg text');
        const labelTexts = Array.from(texts).map((t: unknown) =>
            (t as HTMLElement).textContent?.trim()
        );
        expect(labelTexts).toContain('Amount');
    });

    it('should widen padding on the bottom when xAxisLabel is set', () => {
        const before = component.padding().bottom;
        fixture.componentRef.setInput('xAxisLabel', 'Categories');
        fixture.detectChanges();
        expect(component.padding().bottom).toBeGreaterThan(before);
    });

    it('should hide grid lines when showGrid is false', () => {
        const gridLines = () => fixture.nativeElement.querySelectorAll('line');
        expect(component.axisTicks().length).toBeGreaterThan(1);
        expect(gridLines()).toHaveLength(component.axisTicks().length);

        fixture.componentRef.setInput('showGrid', false);
        fixture.detectChanges();
        expect(gridLines()).toHaveLength(0);
    });

    it('should hide value labels when showValues is false', () => {
        const withValues = fixture.nativeElement.querySelectorAll('svg text').length;
        fixture.componentRef.setInput('showValues', false);
        fixture.detectChanges();
        const withoutValues =
            fixture.nativeElement.querySelectorAll('svg text').length;
        expect(withoutValues).toBeLessThan(withValues);
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

    it('should place vertical value labels above the bar', () => {
        const bar = component.bars()[0];
        expect(bar.labelPosition.x).toBeCloseTo(bar.x + bar.width / 2);
        expect(bar.labelPosition.y).toBeLessThan(bar.y);
    });

    it('should format compact values for large numbers', () => {
        expect(component.formatValue(1500)).toBe('1.5K');
    });

    it('should format axis values without decimals', () => {
        expect(component.formatAxisValue(1500)).toBe('2K');
    });

    it('should produce a getBarAriaLabel string with name and value', () => {
        const label = component.getBarAriaLabel(component.bars()[1]);
        expect(label).toContain('B');
        expect(label).toContain('20');
    });

    it('should compute axis ticks covering the data range', () => {
        const ticks = component.axisTicks();
        expect(ticks.length).toBeGreaterThan(1);
        expect(ticks[0]).toBe(0);
        expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(30);
    });

    it('should position a tick along the vertical axis', () => {
        const area = component.chartArea();
        const bottomPos = component.getTickPosition(0);
        expect(bottomPos).toBeCloseTo(area.bottom);
        const topPos = component.getTickPosition(component.dataRange().max);
        expect(topPos).toBeCloseTo(area.top);
    });

    it('should position a tick along the horizontal axis (LTR)', () => {
        fixture.componentRef.setInput('orientation', 'horizontal');
        fixture.detectChanges();

        const area = component.chartArea();
        expect(component.getTickPosition(0)).toBeCloseTo(area.left);
        expect(
            component.getTickPosition(component.dataRange().max)
        ).toBeCloseTo(area.right);
    });

    describe('RTL', () => {
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

        it('should lay vertical bars right-to-left in RTL', () => {
            fixture.componentRef.setInput('dir', 'rtl');
            fixture.detectChanges();
            const bars = component.bars();
            expect(bars[0].x).toBeGreaterThan(bars[2].x);
        });

        it('should anchor horizontal bars to the right edge in RTL', () => {
            fixture.componentRef.setInput('orientation', 'horizontal');
            fixture.componentRef.setInput('dir', 'rtl');
            fixture.detectChanges();

            const area = component.chartArea();
            const bars = component.bars();
            for (const bar of bars) {
                expect(bar.x + bar.width).toBeCloseTo(area.right);
            }
            expect(bars[0].labelPosition.x).toBeLessThan(bars[0].x);
        });

        it('should position a tick along the horizontal axis (RTL)', () => {
            fixture.componentRef.setInput('orientation', 'horizontal');
            fixture.componentRef.setInput('dir', 'rtl');
            fixture.detectChanges();

            const area = component.chartArea();
            expect(component.getTickPosition(0)).toBeCloseTo(area.right);
            expect(
                component.getTickPosition(component.dataRange().max)
            ).toBeCloseTo(area.left);
        });
    });

    it('should honor a custom bar color', () => {
        fixture.componentRef.setInput('data', [
            { name: 'X', value: 5, color: '#ff0000' },
        ]);
        fixture.detectChanges();
        expect(component.bars()[0].color).toBe('#ff0000');
    });
});

describe('BarChartComponent zero baseline', () => {
    const CLASSES: Record<string, number[]> = {
        'all-positive': [1.97, 2.2, 2.4, 2.69],
        'all-negative': [-50, -10, -0.5],
        'mixed-sign': [-30, 45.5, -0.01, 12],
        'all-zero': [0, 0, 0],
        'single-negative': [-42],
    };

    function build(values: number[], orientation: 'vertical' | 'horizontal', dir: 'ltr' | 'rtl'): BarChartComponent {
        const fixture = TestBed.createComponent(BarChartComponent);
        fixture.componentRef.setInput('data', values.map((value, i) => ({ name: `C${i}`, value })));
        fixture.componentRef.setInput('orientation', orientation);
        fixture.componentRef.setInput('dir', dir);
        fixture.detectChanges();
        return fixture.componentInstance;
    }

    /** `[start, end]` of the bar along the value axis, in pixels. */
    function span(bar: { x: number; y: number; width: number; height: number }, vertical: boolean): [number, number] {
        return vertical ? [bar.y, bar.y + bar.height] : [bar.x, bar.x + bar.width];
    }

    beforeEach(() => {
        (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
    });

    afterEach(() => {
        (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver = originalResizeObserver;
    });

    for (const [className, values] of Object.entries(CLASSES)) {
        for (const orientation of ['vertical', 'horizontal'] as const) {
            for (const dir of ['ltr', 'rtl'] as const) {
                it(`should grow ${className} bars from the zero gridline (${orientation}, ${dir})`, () => {
                    const component = build(values, orientation, dir);
                    const zero = component.getTickPosition(0);
                    const perUnit = component.getTickPosition(1) - zero;
                    const bars = component.bars();

                    expect(bars).toHaveLength(values.length);
                    for (const bar of bars) {
                        const [a, b] = span(bar, orientation === 'vertical');
                        const [from, to] = [bar.value * perUnit + zero, zero].sort((p, q) => p - q);
                        expect(Math.min(a, b)).toBeCloseTo(from, 4);
                        expect(Math.max(a, b)).toBeCloseTo(to, 4);
                    }
                });
            }
        }
    }

    it('should draw at least two value ticks, all inside the plot, when every value is zero', () => {
        const component = build(CLASSES['all-zero'], 'vertical', 'ltr');
        const area = component.chartArea();
        const ticks = component.axisTicks();

        expect(ticks.length).toBeGreaterThanOrEqual(2);
        for (const tick of ticks) {
            const pos = component.getTickPosition(tick);
            expect(pos).toBeGreaterThanOrEqual(area.top - 0.001);
            expect(pos).toBeLessThanOrEqual(area.bottom + 0.001);
        }
    });

    it('should end the first and last tick of positive data on the plot edges', () => {
        const component = build(CLASSES['all-positive'], 'vertical', 'ltr');
        const area = component.chartArea();
        const ticks = component.axisTicks();

        expect(component.getTickPosition(ticks[0])).toBeCloseTo(area.bottom, 4);
        expect(component.getTickPosition(ticks.at(-1) as number)).toBeCloseTo(area.top, 4);
    });
});
