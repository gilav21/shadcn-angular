import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StackedBarChartComponent } from './stacked-bar-chart.component';
import { ChartSeries } from '../../lib/chart.types';
import { CHART_COLORS } from '../../lib/chart.utils';
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
    unobserve(): void {
        /* no-op */
    }
    disconnect(): void {
        /* no-op */
    }
}

const originalResizeObserver = (
    globalThis as unknown as { ResizeObserver?: unknown }
).ResizeObserver;

describe('StackedBarChartComponent', () => {
    let component: StackedBarChartComponent;
    let fixture: ComponentFixture<StackedBarChartComponent>;

    const sampleSeries: ChartSeries[] = [
        {
            name: 'Series A',
            data: [
                { name: 'Q1', value: 10 },
                { name: 'Q2', value: 20 },
            ],
        },
        {
            name: 'Series B',
            data: [
                { name: 'Q1', value: 15 },
                { name: 'Q2', value: 25 },
            ],
        },
    ];
    const sampleCategories = ['Q1', 'Q2'];

    beforeEach(async () => {
        (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
            ResizeObserverStub;
        await TestBed.configureTestingModule({
            imports: [StackedBarChartComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(StackedBarChartComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('series', sampleSeries);
        fixture.componentRef.setInput('categories', sampleCategories);
        fixture.detectChanges();
    });

    afterEach(() => {
        (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver =
            originalResizeObserver;
    });

    it('should set aria-label on SVG', () => {
        const svg = fixture.nativeElement.querySelector('svg[role="group"]');
        expect(svg).toBeTruthy();
        expect(svg.getAttribute('aria-label')).toContain('Stacked column chart');
    });

    describe('stackedBars computed', () => {
        it('should create one stacked bar per category', () => {
            const bars = component.stackedBars();
            expect(bars).toHaveLength(2);
            expect(bars[0].category).toBe('Q1');
            expect(bars[0].categoryIndex).toBe(0);
            expect(bars[1].category).toBe('Q2');
            expect(bars[1].categoryIndex).toBe(1);
        });

        it('should create one segment per series in each bar', () => {
            const bars = component.stackedBars();
            expect(bars[0].segments).toHaveLength(2);
            expect(bars[0].segments[0].seriesName).toBe('Series A');
            expect(bars[0].segments[1].seriesName).toBe('Series B');
        });

        it('should compute correct totals per category', () => {
            const bars = component.stackedBars();
            expect(bars[0].total).toBe(25);
            expect(bars[1].total).toBe(45);
        });

        it('should assign correct values to segments', () => {
            const bars = component.stackedBars();
            expect(bars[0].segments[0].value).toBe(10);
            expect(bars[0].segments[1].value).toBe(15);
            expect(bars[1].segments[0].value).toBe(20);
            expect(bars[1].segments[1].value).toBe(25);
        });

        it('should assign correct percentages to segments', () => {
            const bars = component.stackedBars();
            expect(bars[0].segments[0].percentage).toBe(40);
            expect(bars[0].segments[1].percentage).toBe(60);
        });

        it('should stack segments vertically without overlap', () => {
            // Chart area: 300 tall minus 20 top / 35 bottom padding -> bottom 265, height 245.
            const [first, second] = component.stackedBars()[0].segments;

            expect(first.y + first.height).toBeCloseTo(265, 5);
            expect(second.y + second.height).toBeCloseTo(first.y, 5);
            expect(first.height).toBeCloseTo((10 / 49.5) * 245, 5);
            expect(second.height).toBeCloseTo((15 / 49.5) * 245, 5);
        });
    });

    describe('absolute stacking mode', () => {
        it('should calculate maxValue as max total * 1.1', () => {
            const maxTotal = 45;
            expect(component.maxValue()).toBeCloseTo(maxTotal * 1.1, 5);
        });

        it('should use calculated axis ticks', () => {
            expect(component.axisTicks()).toEqual([0, 10, 20, 30, 40, 50]);
        });

        it('should format axis values as compact numbers without percent sign', () => {
            expect(component.formatAxisValue(50)).toBe('50');
            expect(component.formatAxisValue(1200)).toBe('1K');
        });
    });

    describe('percent stacking mode', () => {
        beforeEach(() => {
            fixture.componentRef.setInput('stacking', 'percent');
            fixture.detectChanges();
        });

        it('should return 100 as maxValue', () => {
            expect(component.maxValue()).toBe(100);
        });

        it('should return [0, 25, 50, 75, 100] as axisTicks', () => {
            expect(component.axisTicks()).toEqual([0, 25, 50, 75, 100]);
        });

        it('should format axis values with percent sign', () => {
            const formatted = component.formatAxisValue(50);
            expect(formatted).toBe('50%');
        });

        it('should fill the chart height with every stack, split by share', () => {
            const areaHeight = 245;
            for (const bar of component.stackedBars()) {
                const stackHeight = bar.segments.reduce((sum, s) => sum + s.height, 0);
                expect(stackHeight).toBeCloseTo(areaHeight, 5);
            }
            const [first, second] = component.stackedBars()[0].segments;
            expect(first.height).toBeCloseTo(areaHeight * 0.4, 5);
            expect(second.height).toBeCloseTo(areaHeight * 0.6, 5);
        });
    });

    describe('segmentClick output', () => {
        it('should emit segment data on click', () => {
            const clickEvents: {
                series: string;
                category: string;
                value: number;
            }[] = [];
            component.segmentClick.subscribe(event => clickEvents.push(event));

            const bar = component.stackedBars()[0];
            const segment = bar.segments[0];
            component.onSegmentClick(new MouseEvent('click'), segment, bar);

            expect(clickEvents).toHaveLength(1);
            expect(clickEvents[0]).toEqual({
                series: 'Series A',
                category: 'Q1',
                value: 10,
            });
        });
    });

    describe('hover behavior', () => {
        it('should set hoveredSegment on onSegmentHover', () => {
            expect(component.hoveredSegment()).toBeNull();

            const bar = component.stackedBars()[0];
            const segment = bar.segments[0];
            component.onSegmentHover(bar.categoryIndex, segment);

            expect(component.hoveredSegment()).toBeTruthy();
            expect(component.hoveredSegment()!.seriesName).toBe('Series A');
            expect(component.hoveredSegment()!.value).toBe(10);
        });

        it('should reset hoveredSegment on onSegmentLeave', () => {
            const bar = component.stackedBars()[0];
            const segment = bar.segments[0];
            component.onSegmentHover(bar.categoryIndex, segment);
            expect(component.hoveredSegment()).toBeTruthy();

            component.onSegmentLeave();

            expect(component.hoveredSegment()).toBeNull();
        });

        it('should correctly identify hovered segment with isHovered', () => {
            const bar = component.stackedBars()[0];
            const segment = bar.segments[1];
            component.onSegmentHover(bar.categoryIndex, segment);

            expect(component.isHovered(0, 1)).toBe(true);
            expect(component.isHovered(0, 0)).toBe(false);
            expect(component.isHovered(1, 1)).toBe(false);
        });

        it('should return false for isHovered when nothing is hovered', () => {
            expect(component.isHovered(0, 0)).toBe(false);
        });
    });

    describe('legend rendering', () => {
        it('should render legend when showLegend is true', () => {
            fixture.componentRef.setInput('showLegend', true);
            fixture.detectChanges();

            const legendText = fixture.nativeElement.textContent;
            expect(legendText).toContain('Series A');
            expect(legendText).toContain('Series B');
        });

        it('should not render the legend when showLegend is false', () => {
            fixture.componentRef.setInput('showLegend', false);
            fixture.detectChanges();

            const text = fixture.nativeElement.textContent;
            expect(text).not.toContain('Series A');
            expect(text).not.toContain('Series B');
        });
    });

    describe('getSeriesColor', () => {
        it('should use a series colour override and the palette otherwise', () => {
            fixture.componentRef.setInput('series', [
                { ...sampleSeries[0], color: '#123456' },
                sampleSeries[1],
            ]);
            fixture.detectChanges();

            expect(component.getSeriesColor(0)).toBe('#123456');
            expect(component.getSeriesColor(1)).toBe(CHART_COLORS[1]);
        });
    });

    describe('getSegmentAriaLabel', () => {
        it('should include series name, category and value', () => {
            const bar = component.stackedBars()[0];
            const segment = bar.segments[0];
            const label = component.getSegmentAriaLabel(segment, bar);

            expect(label).toContain('Series A');
            expect(label).toContain('Q1');
        });
    });

    describe('direction (RTL/LTR)', () => {
        it('should be RTL when dir is rtl', () => {
            fixture.componentRef.setInput('dir', 'rtl');
            fixture.detectChanges();
            expect(component.isRtl()).toBe(true);
        });

        it('should reverse bar positions in RTL', () => {
            fixture.componentRef.setInput('dir', 'ltr');
            fixture.detectChanges();
            const [ltrQ1, ltrQ2] = component.stackedBars();
            expect(ltrQ1.segments[0].x).toBeLessThan(ltrQ2.segments[0].x);

            fixture.componentRef.setInput('dir', 'rtl');
            fixture.detectChanges();
            const [rtlQ1, rtlQ2] = component.stackedBars();
            expect(rtlQ1.segments[0].x).toBeGreaterThan(rtlQ2.segments[0].x);
        });
    });

    describe('total labels (getBarTopY / formatValue)', () => {
        it('should render total labels when showTotal is true', () => {
            fixture.componentRef.setInput('showTotal', true);
            fixture.detectChanges();

            const bar = component.stackedBars()[0];
            expect(component.getBarTopY(bar)).toBe(bar.segments.at(-1)!.y);
            expect(fixture.nativeElement.textContent).toContain(
                component.formatValue(bar.total),
            );
        });

        it('should return 0 from getBarTopY when a bar has no segments', () => {
            const emptyBar = { segments: [] } as unknown as Parameters<
                typeof component.getBarTopY
            >[0];
            expect(component.getBarTopY(emptyBar)).toBe(0);
        });

        it('should return 0 from getBarCenterX when a bar has no segments', () => {
            const emptyBar = { segments: [] } as unknown as Parameters<
                typeof component.getBarCenterX
            >[0];
            expect(component.getBarCenterX(emptyBar)).toBe(0);
        });

        it('should format numeric totals compactly', () => {
            expect(component.formatValue(1200)).toBe('1.2K');
        });
    });

    describe('percent tooltip (formatPercentage)', () => {
        it('should render a percentage in the tooltip in percent mode', () => {
            fixture.componentRef.setInput('stacking', 'percent');
            fixture.detectChanges();

            const bar = component.stackedBars()[0];
            component.onSegmentHover(bar.categoryIndex, bar.segments[0]);
            fixture.detectChanges();

            const tooltip = fixture.nativeElement.querySelector('.z-50');
            expect(tooltip).toBeTruthy();
            expect(tooltip.textContent).toContain(
                component.formatPercentage(bar.segments[0].percentage),
            );
        });

        it('should format a percentage value with one decimal', () => {
            expect(component.formatPercentage(40)).toBe('40.0%');
        });
    });

    describe('empty and zero data', () => {
        it('should produce no bars when categories are empty', () => {
            fixture.componentRef.setInput('series', [] as ChartSeries[]);
            fixture.componentRef.setInput('categories', [] as string[]);
            fixture.detectChanges();
            expect(component.stackedBars()).toHaveLength(0);
        });

        it('should assign zero percentage when a category total is zero', () => {
            const zeroSeries: ChartSeries[] = [
                { name: 'Z', data: [{ name: 'Q1', value: 0 }] },
            ];
            fixture.componentRef.setInput('series', zeroSeries);
            fixture.componentRef.setInput('categories', ['Q1']);
            fixture.detectChanges();

            const bar = component.stackedBars()[0];
            expect(bar.total).toBe(0);
            expect(bar.segments[0].percentage).toBe(0);
            expect(bar.segments[0].height).toBe(0);
        });
    });
});
