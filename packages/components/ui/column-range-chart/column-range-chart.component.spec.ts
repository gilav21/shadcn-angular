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

    it('should place each bar between its low and high on the nice value axis', () => {
        // Axis [-5, 20] (the nice bounds of the data, no padding) over the 235px plot from y=30 to y=265.
        const jan = component.bars()[0];
        expect(jan.highY).toBeCloseTo(265 - (15 / 25) * 235, 6);
        expect(jan.lowY).toBeCloseTo(265, 6);
        expect(jan.y).toBe(jan.highY);
        expect(jan.height).toBeCloseTo(jan.lowY - jan.highY, 6);
        expect(jan.height).toBeCloseTo((15 / 25) * 235, 6);
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

    it('should end the dataRange on the nice bounds of the lows and highs', () => {
        expect(component.dataRange()).toEqual({ min: -5, max: 20 });
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

    it('should compute axis ticks that start and end on the data range', () => {
        expect(component.axisTicks()).toEqual([-5, 0, 5, 10, 15, 20]);
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
        const axisAndCategories = ['-5', '0', '5', '10', '15', '20', 'Jan', 'Feb', 'Mar'];
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

describe('ColumnRangeChartComponent range ordering', () => {
    const CLASSES: Record<string, [number, number][]> = {
        ascending: [[9, 21], [12, 15.5], [-4, 6]],
        descending: [[21, 9], [15.5, 12], [6, -4]],
        'zero-span': [[7, 7], [-3, -3], [0, 0]],
        negative: [[-50, -10], [-30, -0.5]],
        mixed: [[4, 4], [-8, 12], [20, -15]],
        'all-zero': [[0, 0], [0, 0], [0, 0]],
    };

    let host: HTMLElement;

    function build(ranges: [number, number][]): ColumnRangeChartComponent {
        const fixture = TestBed.createComponent(ColumnRangeChartComponent);
        host = fixture.nativeElement;
        fixture.componentRef.setInput(
            'data',
            ranges.map(([low, high], i) => ({ name: `P${i}`, low, high })),
        );
        fixture.detectChanges();
        return fixture.componentInstance;
    }

    beforeEach(() => {
        (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
    });

    afterEach(() => {
        (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver = originalResizeObserver;
    });

    for (const [className, ranges] of Object.entries(CLASSES)) {
        it(`should draw ${className} ranges between their values inside the plot`, () => {
            const component = build(ranges);
            const area = component.chartArea();

            component.bars().forEach((bar, i) => {
                const [low, high] = ranges[i];
                const top = component.getTickPosition(Math.max(low, high));
                const bottom = component.getTickPosition(Math.min(low, high));
                if (low === high) {
                    // A zero-span range is a 1px line centred on its value.
                    expect(bar.height).toBe(1);
                    expect(bar.y + bar.height / 2).toBeCloseTo(top, 4);
                } else {
                    expect(bar.y).toBeCloseTo(top, 4);
                    expect(bar.y + bar.height).toBeCloseTo(bottom, 4);
                }
                expect(bar.y).toBeGreaterThanOrEqual(area.top - 0.5);
                expect(bar.y + bar.height).toBeLessThanOrEqual(area.bottom + 0.5);
            });
        });

        it(`should label ${className} ranges with the larger end on top and the smaller below`, () => {
            const component = build(ranges);
            const labels = Array.from(host.querySelectorAll('g[role="button"] text')).map(t => t.textContent?.trim());

            expect(labels).toEqual(
                ranges.flatMap(([low, high]) => [component.formatValue(Math.max(low, high)), component.formatValue(Math.min(low, high))]),
            );
            expect(component.getBarAriaLabel(component.bars()[0])).toBe(
                `P0: ${Math.min(...ranges[0])} to ${Math.max(...ranges[0])}`,
            );
        });

        it(`should keep the ${className} low labels off the category labels`, () => {
            const component = build(ranges);

            for (const bar of component.bars()) {
                const below = bar.lowY + 14;
                // Under the column while it fits above the category labels, else just inside its bottom end.
                expect(component.lowLabelY(bar)).toBeCloseTo(below <= component.chartArea().bottom + 2 ? below : bar.lowY - 6, 6);
            }
        });

        it(`should keep every ${className} tick inside the plot`, () => {
            const component = build(ranges);
            const area = component.chartArea();

            expect(component.axisTicks().length).toBeGreaterThanOrEqual(2);
            for (const tick of component.axisTicks()) {
                const pos = component.getTickPosition(tick);
                expect(pos).toBeGreaterThanOrEqual(area.top - 0.001);
                expect(pos).toBeLessThanOrEqual(area.bottom + 0.001);
            }
        });
    }
});
