import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BarChartDrilldownComponent } from './bar-chart-drilldown.component';
import { DrilldownDataPoint, DrilldownSeries } from '../../lib/chart.types';
import {
  describe,
  it,
  expect,
  beforeEach,
  beforeAll,
  afterAll,
  vi,
} from 'vitest';

interface SvgWithBBox {
  getBBox?: () => DOMRect;
}

interface Restorable {
  ResizeObserver: typeof globalThis.ResizeObserver;
  getBBox: (() => DOMRect) | undefined;
  getBoundingClientRect: typeof Element.prototype.getBoundingClientRect;
  matchMedia: typeof globalThis.matchMedia;
}

const saved: Restorable = {} as Restorable;

beforeAll(() => {
  saved.ResizeObserver = globalThis.ResizeObserver;
  saved.getBBox = (SVGElement.prototype as unknown as SvgWithBBox).getBBox;
  saved.getBoundingClientRect = Element.prototype.getBoundingClientRect;
  saved.matchMedia = globalThis.matchMedia;

  class ResizeObserverStub {
    observe(): void {
      /* no-op */
    }
    unobserve(): void {
      /* no-op */
    }
    disconnect(): void {
      /* no-op */
    }
  }
  globalThis.ResizeObserver =
    ResizeObserverStub as unknown as typeof globalThis.ResizeObserver;

  (SVGElement.prototype as unknown as SvgWithBBox).getBBox = vi.fn(
    () => ({ x: 0, y: 0, width: 100, height: 20 }) as DOMRect,
  ) as unknown as () => DOMRect;

  Element.prototype.getBoundingClientRect = vi.fn(
    () => ({
      x: 0,
      y: 0,
      width: 500,
      height: 300,
      top: 0,
      left: 0,
      right: 500,
      bottom: 300,
      toJSON: () => ({}),
    }) as DOMRect,
  ) as unknown as typeof Element.prototype.getBoundingClientRect;

  globalThis.matchMedia = vi.fn(
    (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  ) as unknown as typeof globalThis.matchMedia;
});

afterAll(() => {
  globalThis.ResizeObserver = saved.ResizeObserver;
  if (saved.getBBox) {
    (SVGElement.prototype as unknown as SvgWithBBox).getBBox = saved.getBBox;
  } else {
    delete (SVGElement.prototype as unknown as SvgWithBBox).getBBox;
  }
  Element.prototype.getBoundingClientRect = saved.getBoundingClientRect;
  globalThis.matchMedia = saved.matchMedia;
});

describe('BarChartDrilldownComponent', () => {
    let component: BarChartDrilldownComponent;
    let fixture: ComponentFixture<BarChartDrilldownComponent>;

    const sampleData: DrilldownDataPoint[] = [
        { name: 'Category A', value: 50, drilldown: 'a-detail' },
        { name: 'Category B', value: 30 },
    ];

    const sampleDrilldownSeries: DrilldownSeries[] = [
        {
            id: 'a-detail',
            name: 'Category A Details',
            data: [
                { name: 'Sub A1', value: 20 },
                { name: 'Sub A2', value: 15 },
                { name: 'Sub A3', value: 15 },
            ],
        },
    ];

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [BarChartDrilldownComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(BarChartDrilldownComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('data', sampleData);
        fixture.componentRef.setInput('drilldownSeries', sampleDrilldownSeries);
        fixture.detectChanges();
    });

    describe('onBarClick with drillable bar', () => {
        it('should drill down when clicking a bar with a drilldown property', () => {
            const drillableBar = component.bars()[0];
            const drilldownEvents: unknown[] = [];
            component.drilldown.subscribe(event => drilldownEvents.push(event));

            component.onBarClick(new MouseEvent('click'), drillableBar);

            expect(component.isDrilledDown()).toBe(true);
            expect(component.currentDrilldownId()).toBe('a-detail');
            expect(drilldownEvents).toHaveLength(1);
            expect(drilldownEvents[0]).toEqual({
                seriesId: 'a-detail',
                parentPoint: sampleData[0],
            });
        });

        it('should update currentSeriesName to the drilldown series name', () => {
            const drillableBar = component.bars()[0];
            component.onBarClick(new MouseEvent('click'), drillableBar);

            expect(component.currentSeriesName()).toBe('Category A Details');
        });

        it('should recompute bars for the drilled-down data', () => {
            const drillableBar = component.bars()[0];
            component.onBarClick(new MouseEvent('click'), drillableBar);

            expect(component.bars()).toHaveLength(3);
            expect(component.bars()[0].data.name).toBe('Sub A1');
        });

        it('should reset hoveredIndex when drilling down', () => {
            const drillableBar = component.bars()[0];
            component.hoveredIndex.set(0);
            component.onBarClick(new MouseEvent('click'), drillableBar);

            expect(component.hoveredIndex()).toBeNull();
        });
    });

    describe('onBarClick with non-drillable bar', () => {
        it('should not drill down when clicking a bar without drilldown property', () => {
            const nonDrillableBar = component.bars()[1];
            component.onBarClick(new MouseEvent('click'), nonDrillableBar);

            expect(component.isDrilledDown()).toBe(false);
            expect(component.currentDrilldownId()).toBeNull();
        });

        it('should still emit barClick for non-drillable bars', () => {
            const nonDrillableBar = component.bars()[1];
            const clickEvents: unknown[] = [];
            component.barClick.subscribe(event => clickEvents.push(event));

            component.onBarClick(new MouseEvent('click'), nonDrillableBar);

            expect(clickEvents).toHaveLength(1);
            expect(clickEvents[0]).toEqual(
                expect.objectContaining({ point: sampleData[1], index: 1 }),
            );
        });
    });

    describe('barClick output', () => {
        it('should include the MouseEvent in the emitted click event', () => {
            const clickEvents: { event?: MouseEvent }[] = [];
            component.barClick.subscribe(event => clickEvents.push(event));

            const mouseEvent = new MouseEvent('click');
            component.onBarClick(mouseEvent, component.bars()[0]);

            expect(clickEvents[0].event).toBe(mouseEvent);
        });
    });

    describe('onDrillUp', () => {
        it('should reset isDrilledDown to false', () => {
            const drillableBar = component.bars()[0];
            component.onBarClick(new MouseEvent('click'), drillableBar);
            expect(component.isDrilledDown()).toBe(true);

            component.onDrillUp();

            expect(component.isDrilledDown()).toBe(false);
            expect(component.currentDrilldownId()).toBeNull();
        });

        it('should emit the drillup event', () => {
            const drillupEvents: void[] = [];
            component.drillup.subscribe(() => drillupEvents.push(undefined));

            const drillableBar = component.bars()[0];
            component.onBarClick(new MouseEvent('click'), drillableBar);
            component.onDrillUp();

            expect(drillupEvents).toHaveLength(1);
        });

        it('should restore currentData to the original top-level data', () => {
            const drillableBar = component.bars()[0];
            component.onBarClick(new MouseEvent('click'), drillableBar);
            expect(component.currentData()).toEqual(sampleDrilldownSeries[0].data);

            component.onDrillUp();

            expect(component.currentData()).toEqual(sampleData);
        });

        it('should reset hoveredIndex on drill up', () => {
            const drillableBar = component.bars()[0];
            component.onBarClick(new MouseEvent('click'), drillableBar);
            component.hoveredIndex.set(1);

            component.onDrillUp();

            expect(component.hoveredIndex()).toBeNull();
        });
    });

    describe('onBarClick when already drilled down', () => {
        it('should not drill down further if already in drilled-down state', () => {
            // Sub A1 is itself drillable into a real series, so only the
            // one-level guard can stop the second drill.
            fixture.componentRef.setInput('drilldownSeries', [
                {
                    ...sampleDrilldownSeries[0],
                    data: [{ name: 'Sub A1', value: 20, drilldown: 'a1-detail' }],
                },
                { id: 'a1-detail', name: 'Sub A1 Details', data: [{ name: 'Leaf', value: 5 }] },
            ]);
            fixture.detectChanges();
            const drillableBar = component.bars()[0];
            component.onBarClick(new MouseEvent('click'), drillableBar);
            expect(component.isDrilledDown()).toBe(true);

            const drilldownEvents: unknown[] = [];
            component.drilldown.subscribe(event => drilldownEvents.push(event));

            const drilledBars = component.bars();
            component.onBarClick(new MouseEvent('click'), drilledBars[0]);

            expect(drilldownEvents).toHaveLength(0);
            expect(component.currentDrilldownId()).toBe('a-detail');
        });
    });

    describe('hover behavior', () => {
        it('should emit barHover with the bar data on hover', () => {
            const hoverEvents: unknown[] = [];
            component.barHover.subscribe(event => hoverEvents.push(event));

            const bar = component.bars()[1];
            component.onBarHover(bar);

            expect(hoverEvents).toHaveLength(1);
            expect(hoverEvents[0]).toEqual(
                expect.objectContaining({ point: sampleData[1], index: 1 }),
            );
        });

        it('should reset hoveredIndex to null on onBarLeave', () => {
            const bar = component.bars()[0];
            component.onBarHover(bar);
            expect(component.hoveredIndex()).toBe(0);

            component.onBarLeave();

            expect(component.hoveredIndex()).toBeNull();
        });

        it('should emit barHover with null on leave', () => {
            const hoverEvents: unknown[] = [];
            component.barHover.subscribe(event => hoverEvents.push(event));

            component.onBarLeave();

            expect(hoverEvents).toHaveLength(1);
            expect(hoverEvents[0]).toBeNull();
        });

        it('should update hoveredBar computed when hoveredIndex changes', () => {
            expect(component.hoveredBar()).toBeNull();

            const bar = component.bars()[0];
            component.onBarHover(bar);

            expect(component.hoveredBar()).toBeTruthy();
            expect(component.hoveredBar()!.index).toBe(0);
        });
    });

    describe('hasDrilldown', () => {
        it('should return true for a bar that has a matching drilldown series', () => {
            const drillableBar = component.bars()[0];
            expect(component.hasDrilldown(drillableBar)).toBe(true);
        });

        it('should return false for a bar without a drilldown property', () => {
            const nonDrillableBar = component.bars()[1];
            expect(component.hasDrilldown(nonDrillableBar)).toBe(false);
        });

        it('should return false for a bar with a drilldown id that has no matching series', () => {
            fixture.componentRef.setInput('data', [
                { name: 'Orphan', value: 10, drilldown: 'nonexistent-id' },
            ]);
            fixture.detectChanges();

            const orphanBar = component.bars()[0];
            expect(component.hasDrilldown(orphanBar)).toBe(false);
        });
    });

    describe('breadcrumb visibility', () => {
        it('should not show breadcrumb when not drilled down', () => {
            fixture.detectChanges();
            const backButton = fixture.nativeElement.querySelector(
                'button[type="button"]',
            );
            expect(backButton).toBeNull();
        });

        it('should display the drilldown series name in the breadcrumb', () => {
            const drillableBar = component.bars()[0];
            component.onBarClick(new MouseEvent('click'), drillableBar);
            fixture.detectChanges();

            const breadcrumbText = fixture.nativeElement.textContent;
            expect(breadcrumbText).toContain('Category A Details');
        });

        it('should not show breadcrumb when showBreadcrumb is false even if drilled down', () => {
            fixture.componentRef.setInput('showBreadcrumb', false);
            const drillableBar = component.bars()[0];
            component.onBarClick(new MouseEvent('click'), drillableBar);
            fixture.detectChanges();

            const buttons = fixture.nativeElement.querySelectorAll(
                'button[type="button"]',
            );
            const backButton = Array.from(buttons).find(
                (btn: unknown) => (btn as HTMLElement).textContent?.includes('Back'),
            ) as HTMLElement | undefined;
            expect(backButton).toBeFalsy();
        });

        it('should drill up when the breadcrumb back button is clicked', () => {
            const drillableBar = component.bars()[0];
            component.onBarClick(new MouseEvent('click'), drillableBar);
            fixture.detectChanges();

            const buttons = fixture.nativeElement.querySelectorAll(
                'button[type="button"]',
            );
            const backButton = Array.from(buttons).find(
                (btn: unknown) => (btn as HTMLElement).textContent?.includes('Back'),
            ) as HTMLElement | undefined;
            expect(backButton).toBeTruthy();

            backButton!.click();
            fixture.detectChanges();

            expect(component.isDrilledDown()).toBe(false);
        });
    });

    describe('bars computed', () => {
        it('should generate bar rects with correct data references', () => {
            const bars = component.bars();
            expect(bars).toHaveLength(2);
            expect(bars[0].data.name).toBe('Category A');
            expect(bars[0].value).toBe(50);
            expect(bars[1].data.name).toBe('Category B');
            expect(bars[1].value).toBe(30);
        });

        it('should size bars from the plot area and mirror their x under rtl', () => {
            // Plot = width - 90 (70 axis + 20 edge) wide, 300 - 55 = 245 tall;
            // domain max 55 (50 * 1.1); two bars share the width minus one 8px
            // gap. The width is the measured host width (500 in jsdom).
            const width = component.svgWidth();
            const barWidth = (width - 90 - 8) / 2;
            const geometry = () =>
                component.bars().map(b => ({ x: b.x, width: b.width, height: b.height }));
            expect(geometry()).toEqual([
                { x: 70, width: barWidth, height: expect.closeTo(222.727, 3) },
                { x: 70 + barWidth + 8, width: barWidth, height: expect.closeTo(133.636, 3) },
            ]);

            fixture.componentRef.setInput('dir', 'rtl');
            fixture.detectChanges();
            // RTL moves the axis to the right edge and runs bars right-to-left.
            expect(geometry().map(b => b.x)).toEqual([width - 70 - barWidth, 20]);
        });
    });

    describe('currentSeriesName', () => {
        it('should return title or Overview when not drilled down', () => {
            expect(component.currentSeriesName()).toBe('Overview');
        });

        it('should return the provided title when not drilled down', () => {
            fixture.componentRef.setInput('title', 'My Chart');
            fixture.detectChanges();

            expect(component.currentSeriesName()).toBe('My Chart');
        });
    });
});
