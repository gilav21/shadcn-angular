import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StackedBarChartComponent } from './stacked-bar-chart.component';
import { ChartSeries } from './chart.types';
import { describe, it, expect, beforeEach } from 'vitest';

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
        await TestBed.configureTestingModule({
            imports: [StackedBarChartComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(StackedBarChartComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('series', sampleSeries);
        fixture.componentRef.setInput('categories', sampleCategories);
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should compute stacked bars from series and categories', () => {
        expect(component.stackedBars().length).toBe(2);
    });

    it('should render an SVG element', () => {
        const svg = fixture.nativeElement.querySelector('svg');
        expect(svg).toBeTruthy();
    });

    it('should set aria-label on SVG', () => {
        const svg = fixture.nativeElement.querySelector('svg[role="img"]');
        expect(svg).toBeTruthy();
        expect(svg.getAttribute('aria-label')).toContain('Stacked column chart');
    });

    describe('stackedBars computed', () => {
        it('should create one stacked bar per category', () => {
            const bars = component.stackedBars();
            expect(bars.length).toBe(2);
            expect(bars[0].category).toBe('Q1');
            expect(bars[1].category).toBe('Q2');
        });

        it('should create one segment per series in each bar', () => {
            const bars = component.stackedBars();
            expect(bars[0].segments.length).toBe(2);
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

        it('should assign sequential category indices', () => {
            const bars = component.stackedBars();
            expect(bars[0].categoryIndex).toBe(0);
            expect(bars[1].categoryIndex).toBe(1);
        });

        it('should assign positive dimensions to segments', () => {
            const bars = component.stackedBars();
            for (const bar of bars) {
                for (const segment of bar.segments) {
                    expect(segment.width).toBeGreaterThan(0);
                    expect(segment.height).toBeGreaterThan(0);
                }
            }
        });

        it('should stack segments vertically without overlap', () => {
            const bars = component.stackedBars();
            const q1Segments = bars[0].segments;
            const firstSegmentTop = q1Segments[0].y;
            const firstSegmentBottom = q1Segments[0].y + q1Segments[0].height;
            const secondSegmentTop = q1Segments[1].y;
            const secondSegmentBottom =
                q1Segments[1].y + q1Segments[1].height;

            expect(secondSegmentTop).toBeLessThanOrEqual(firstSegmentBottom);
            expect(firstSegmentTop).toBeLessThanOrEqual(secondSegmentBottom);
        });
    });

    describe('absolute stacking mode', () => {
        it('should use absolute stacking by default', () => {
            expect(component.stacking()).toBe('absolute');
        });

        it('should calculate maxValue as max total * 1.1', () => {
            const maxTotal = 45;
            expect(component.maxValue()).toBeCloseTo(maxTotal * 1.1, 5);
        });

        it('should use calculated axis ticks', () => {
            const ticks = component.axisTicks();
            expect(ticks.length).toBeGreaterThan(0);
            expect(ticks[0]).toBe(0);
        });

        it('should format axis values without percent sign', () => {
            const formatted = component.formatAxisValue(50);
            expect(formatted).not.toContain('%');
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

        it('should format 0 with percent sign', () => {
            expect(component.formatAxisValue(0)).toBe('0%');
        });

        it('should format 100 with percent sign', () => {
            expect(component.formatAxisValue(100)).toBe('100%');
        });

        it('should still compute correct segment percentages', () => {
            const bars = component.stackedBars();
            const q1Segments = bars[0].segments;
            const totalPercentage = q1Segments.reduce(
                (sum, s) => sum + s.percentage,
                0,
            );
            expect(totalPercentage).toBeCloseTo(100, 5);
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

            expect(clickEvents.length).toBe(1);
            expect(clickEvents[0]).toEqual({
                series: 'Series A',
                category: 'Q1',
                value: 10,
            });
        });

        it('should emit correct data for second series segment', () => {
            const clickEvents: {
                series: string;
                category: string;
                value: number;
            }[] = [];
            component.segmentClick.subscribe(event => clickEvents.push(event));

            const bar = component.stackedBars()[1];
            const segment = bar.segments[1];
            component.onSegmentClick(new MouseEvent('click'), segment, bar);

            expect(clickEvents.length).toBe(1);
            expect(clickEvents[0]).toEqual({
                series: 'Series B',
                category: 'Q2',
                value: 25,
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

        it('should not render legend color indicators when showLegend is false', () => {
            fixture.componentRef.setInput('showLegend', false);
            fixture.detectChanges();

            const legendDots = fixture.nativeElement.querySelectorAll(
                '.w-3.h-3.rounded-sm',
            );
            expect(legendDots.length).toBe(0);
        });
    });

    describe('getSeriesColor', () => {
        it('should return a color string for each series', () => {
            const color0 = component.getSeriesColor(0);
            const color1 = component.getSeriesColor(1);
            expect(typeof color0).toBe('string');
            expect(typeof color1).toBe('string');
            expect(color0.length).toBeGreaterThan(0);
            expect(color1.length).toBeGreaterThan(0);
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

    describe('with three series', () => {
        beforeEach(() => {
            const threeSeries: ChartSeries[] = [
                {
                    name: 'Alpha',
                    data: [
                        { name: 'Jan', value: 100 },
                        { name: 'Feb', value: 200 },
                    ],
                },
                {
                    name: 'Beta',
                    data: [
                        { name: 'Jan', value: 50 },
                        { name: 'Feb', value: 100 },
                    ],
                },
                {
                    name: 'Gamma',
                    data: [
                        { name: 'Jan', value: 50 },
                        { name: 'Feb', value: 50 },
                    ],
                },
            ];
            fixture.componentRef.setInput('series', threeSeries);
            fixture.componentRef.setInput('categories', ['Jan', 'Feb']);
            fixture.detectChanges();
        });

        it('should create three segments per category', () => {
            const bars = component.stackedBars();
            expect(bars[0].segments.length).toBe(3);
            expect(bars[1].segments.length).toBe(3);
        });

        it('should compute correct totals', () => {
            const bars = component.stackedBars();
            expect(bars[0].total).toBe(200);
            expect(bars[1].total).toBe(350);
        });

        it('should compute correct percentages for first category', () => {
            const bars = component.stackedBars();
            const segments = bars[0].segments;
            expect(segments[0].percentage).toBe(50);
            expect(segments[1].percentage).toBe(25);
            expect(segments[2].percentage).toBe(25);
        });
    });
});
