import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CandlestickComponent } from './candlestick.component';
import { OhlcPoint } from './candlestick.types';

class ResizeObserverStub {
    observe(): void {
        /* no-op: the suite never resizes, so no callbacks are wanted */
    }
    disconnect(): void {
        /* no-op */
    }
}

const originalResizeObserver = (
    globalThis as unknown as { ResizeObserver?: unknown }
).ResizeObserver;

/** Mon 5 Jan 2026 … Fri 9 Jan, then Mon 12 Jan — a real weekend gap. */
const WEEK: OhlcPoint[] = [
    { date: '2026-01-05', open: 100, high: 106, low: 99, close: 104 },
    { date: '2026-01-06', open: 104, high: 108, low: 103, close: 105 },
    { date: '2026-01-07', open: 105, high: 106, low: 98, close: 99 },
    { date: '2026-01-08', open: 99, high: 103, low: 97, close: 102 },
    { date: '2026-01-09', open: 102, high: 110, low: 101, close: 109 },
    { date: '2026-01-12', open: 109, high: 112, low: 106, close: 107 },
];

const diffs = (xs: number[]): number[] =>
    xs.slice(1).map((x, i) => Math.abs(x - xs[i]));

describe('CandlestickComponent', () => {
    let component: CandlestickComponent;
    let fixture: ComponentFixture<CandlestickComponent>;

    async function createFixture(points: OhlcPoint[] = WEEK): Promise<void> {
        await TestBed.configureTestingModule({
            imports: [CandlestickComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(CandlestickComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('points', points);
        fixture.detectChanges();
    }

    beforeEach(() => {
        (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
            ResizeObserverStub;
    });

    afterEach(() => {
        (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver =
            originalResizeObserver;
    });

    // T-9: renders bodies and wicks from OHLC
    describe('T-9 bodies and wicks', () => {
        it('renders one candle per period', async () => {
            await createFixture();
            expect(component.candles()).toHaveLength(6);
            expect(fixture.nativeElement.querySelectorAll('[data-slot="candlestick-candle"]'))
                .toHaveLength(6);
            expect(fixture.nativeElement.querySelectorAll('[data-slot="candlestick-body"]'))
                .toHaveLength(6);
            expect(fixture.nativeElement.querySelectorAll('[data-slot="candlestick-wick"]'))
                .toHaveLength(6);
        });

        it('spans the body between open and close', async () => {
            await createFixture([{ date: 'A', open: 100, high: 110, low: 90, close: 105 }]);
            const c = component.candles()[0];
            expect(c.height).toBeGreaterThan(1);
            expect(c.y).toBeLessThan(c.y + c.height);
        });

        it('draws the wick from high to low, enclosing the body', async () => {
            await createFixture([{ date: 'A', open: 100, high: 110, low: 90, close: 105 }]);
            const c = component.candles()[0];
            expect(c.wickTop).toBeLessThanOrEqual(c.y + 0.001);
            expect(c.wickBottom).toBeGreaterThanOrEqual(c.y + c.height - 0.001);
        });

        it('drops rows whose prices are not all finite', async () => {
            await createFixture([
                { date: 'A', open: 1, high: 2, low: 0, close: 1.5 },
                { date: 'B', open: Number.NaN, high: 2, low: 0, close: 1 },
            ]);
            expect(component.candles()).toHaveLength(1);
        });
    });

    // T-10: rising/falling colours differ and are themeable
    describe('T-10 rising and falling colours', () => {
        it('uses different default colours for rising and falling candles', async () => {
            await createFixture([
                { date: 'up', open: 100, high: 110, low: 99, close: 105 },
                { date: 'down', open: 105, high: 106, low: 95, close: 98 },
            ]);
            const [up, down] = component.candles();
            expect(up.rising).toBe(true);
            expect(down.rising).toBe(false);
            expect(up.color).not.toBe(down.color);
        });

        it('marks the direction on the DOM for styling hooks', async () => {
            await createFixture([
                { date: 'up', open: 100, high: 110, low: 99, close: 105 },
                { date: 'down', open: 105, high: 106, low: 95, close: 98 },
            ]);
            const groups = fixture.nativeElement.querySelectorAll(
                '[data-slot="candlestick-candle"]',
            );
            expect(groups[0].getAttribute('data-direction')).toBe('rising');
            expect(groups[1].getAttribute('data-direction')).toBe('falling');
        });

        it('takes themeable colours from the inputs', async () => {
            await createFixture([
                { date: 'up', open: 100, high: 110, low: 99, close: 105 },
                { date: 'down', open: 105, high: 106, low: 95, close: 98 },
            ]);
            fixture.componentRef.setInput('risingColor', 'var(--chart-2)');
            fixture.componentRef.setInput('fallingColor', 'var(--destructive)');
            fixture.detectChanges();
            expect(component.candles()[0].color).toBe('var(--chart-2)');
            expect(component.candles()[1].color).toBe('var(--destructive)');
            expect(
                fixture.nativeElement
                    .querySelector('[data-slot="candlestick-body"]')
                    .getAttribute('fill'),
            ).toBe('var(--chart-2)');
        });
    });

    // T-11: tooltip shows O/H/L/C
    describe('T-11 tooltip', () => {
        it('lists open, high, low and close', async () => {
            await createFixture();
            component.onCandleHover(component.candles()[0]);
            fixture.detectChanges();
            expect(component.tooltipRows().map(r => r.label)).toEqual([
                'Open', 'High', 'Low', 'Close',
            ]);
            expect(component.tooltipRows().map(r => r.value)).toEqual([
                '100', '106', '99', '104',
            ]);
        });

        it('titles the tooltip with the period label', async () => {
            await createFixture([{ date: 'Week 1', open: 1, high: 2, low: 0, close: 1 }]);
            component.onCandleHover(component.candles()[0]);
            expect(component.tooltipTitle()).toBe('Week 1');
        });

        it('appends the unit to every price', async () => {
            await createFixture([{ date: 'A', open: 1, high: 2, low: 0, close: 1 }]);
            fixture.componentRef.setInput('unit', '$');
            fixture.detectChanges();
            component.onCandleHover(component.candles()[0]);
            expect(component.tooltipRows()[0].value).toBe('1$');
        });

        it('clears the tooltip on leave', async () => {
            await createFixture();
            component.onCandleHover(component.candles()[0]);
            component.onCandleLeave();
            expect(component.tooltipRows()).toEqual([]);
            expect(component.tooltipTitle()).toBeUndefined();
        });

        it('emits candleHover with the point and null on leave', async () => {
            await createFixture();
            const seen: (number | null)[] = [];
            component.candleHover.subscribe(e => seen.push(e === null ? null : e.index));
            component.onCandleHover(component.candles()[2]);
            component.onCandleLeave();
            expect(seen).toEqual([2, null]);
        });

        it('emits candleClick and forwards only real MouseEvents', async () => {
            await createFixture();
            const events: (MouseEvent | undefined)[] = [];
            component.candleClick.subscribe(e => events.push(e.event));
            component.onCandleClick(new MouseEvent('click'), component.candles()[0]);
            component.onCandleClick(new KeyboardEvent('keydown'), component.candles()[0]);
            expect(events[0]).toBeInstanceOf(MouseEvent);
            expect(events[1]).toBeUndefined();
        });
    });

    // T-12: time axis omits gaps for missing periods
    describe('T-12 axis modes', () => {
        it('spaces candles evenly on the default ordinal axis, ignoring the weekend', async () => {
            await createFixture();
            expect(component.isTimeAxis()).toBe(false);
            const gaps = diffs(component.candles().map(c => c.centre));
            for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0], 6);
        });

        it('shows the real weekend gap on the time axis', async () => {
            await createFixture();
            fixture.componentRef.setInput('axisMode', 'time');
            fixture.detectChanges();
            const gaps = diffs(component.candles().map(c => c.centre));
            expect(gaps.at(-1)!).toBeGreaterThan(gaps[0] * 2);
        });

        it('drops label-only periods on the time axis but keeps them on the ordinal axis', async () => {
            await createFixture([
                { date: 'Week 1', open: 1, high: 2, low: 0, close: 1 },
                { date: '2026-01-05', open: 1, high: 2, low: 0, close: 1 },
            ]);
            expect(component.candles()).toHaveLength(2);
            fixture.componentRef.setInput('axisMode', 'time');
            fixture.detectChanges();
            expect(component.candles()).toHaveLength(1);
        });

        it('labels the axis with formatted dates', async () => {
            await createFixture();
            expect(component.axisTicks()[0].label).toContain('Jan');
        });

        it('thins the ordinal axis labels on a long series', async () => {
            const many: OhlcPoint[] = Array.from({ length: 40 }, (_, i) => ({
                date: `d${i}`, open: 1, high: 2, low: 0, close: 1,
            }));
            await createFixture(many);
            expect(component.candles()).toHaveLength(40);
            expect(component.axisTicks().length).toBeLessThanOrEqual(8);
        });
    });

    describe('accessibility', () => {
        it('labels the chart with a summary including the title', async () => {
            await createFixture();
            fixture.componentRef.setInput('title', 'ACME');
            fixture.detectChanges();
            expect(component.ariaLabel()).toContain('ACME');
            expect(component.ariaLabel()).toContain('Candlestick chart');
        });

        it('announces all four prices on each candle', async () => {
            await createFixture([{ date: 'A', open: 1, high: 2, low: 0, close: 1.5 }]);
            const label = component.getCandleAriaLabel(component.candles()[0]);
            expect(label).toContain('open 1');
            expect(label).toContain('high 2');
            expect(label).toContain('low 0');
            expect(label).toContain('close 1.5');
        });

        it('makes every candle focusable', async () => {
            await createFixture();
            const g = fixture.nativeElement.querySelector(
                '[data-slot="candlestick-candle"]',
            );
            expect(g.getAttribute('tabindex')).toBe('0');
            expect(g.getAttribute('role')).toBe('button');
        });
    });

    describe('edge cases', () => {
        it('renders an empty state for no points', async () => {
            await createFixture([]);
            expect(component.isEmpty()).toBe(true);
            expect(fixture.nativeElement.querySelector('[data-slot="candlestick-empty"]'))
                .toBeTruthy();
        });

        // §2.2 edge case — doji
        it('keeps a doji body visible as a line', async () => {
            await createFixture([{ date: 'A', open: 100, high: 105, low: 95, close: 100 }]);
            const c = component.candles()[0];
            expect(c.height).toBeGreaterThanOrEqual(1);
            expect(Number.isFinite(c.y)).toBe(true);
        });

        it('renders a single period without NaN geometry', async () => {
            await createFixture([{ date: 'A', open: 5, high: 5, low: 5, close: 5 }]);
            const c = component.candles()[0];
            for (const n of [c.x, c.y, c.width, c.height, c.centre, c.wickTop, c.wickBottom]) {
                expect(Number.isFinite(n)).toBe(true);
            }
            expect(c.width).toBeGreaterThan(0);
        });

        it('renders a flat series on the time axis without dividing by zero', async () => {
            await createFixture([{ date: '2026-01-05', open: 5, high: 5, low: 5, close: 5 }]);
            fixture.componentRef.setInput('axisMode', 'time');
            fixture.detectChanges();
            const c = component.candles()[0];
            expect(Number.isFinite(c.centre)).toBe(true);
            expect(Number.isFinite(c.y)).toBe(true);
        });

        it('renders negative prices', async () => {
            await createFixture([{ date: 'A', open: -2, high: -1, low: -8, close: -5 }]);
            const c = component.candles()[0];
            expect(Number.isFinite(c.y)).toBe(true);
            expect(c.wickBottom).toBeGreaterThan(c.wickTop);
        });
    });

    // T-20: RTL
    describe('T-20 RTL', () => {
        it('mirrors the period order when dir is rtl', async () => {
            await createFixture();
            const ltrFirst = component.candles()[0].centre;
            fixture.componentRef.setInput('dir', 'rtl');
            fixture.detectChanges();
            expect(component.candles()[0].centre).toBeGreaterThan(ltrFirst);
        });

        it('mirrors the time axis too', async () => {
            await createFixture();
            fixture.componentRef.setInput('axisMode', 'time');
            fixture.detectChanges();
            const ltrFirst = component.candles()[0].centre;
            fixture.componentRef.setInput('dir', 'rtl');
            fixture.detectChanges();
            expect(component.candles()[0].centre).toBeGreaterThan(ltrFirst);
        });
    });

    // T-18: resize
    // T-18 / UC-18: the chart fills, and re-lays out with, its measured width.
    //
    // `observeChartWidth` reads the host's clientWidth SYNCHRONOUSLY at
    // construction, so in a real browser the measured width always wins and the
    // `width` input is only the pre-measurement fallback. Asserting
    // `svgWidth() === width()` outright therefore passes under jsdom
    // (clientWidth 0) and fails in the browser suite. Both paths are asserted
    // honestly instead by driving the measured-width signal directly — the same
    // trick line-chart.component.spec.ts uses.
    describe('T-18 resize', () => {
        function setMeasuredWidth(value: number | null): void {
            (component as unknown as {
                _measuredWidth: { set(v: number | null): void };
            })._measuredWidth.set(value);
            fixture.detectChanges();
        }

        it('falls back to the width input before the container is measured', async () => {
            await createFixture();
            fixture.componentRef.setInput('width', 640);
            setMeasuredWidth(null);
            expect(component.svgWidth()).toBe(640);
        });

        it('prefers the measured container width over the width input', async () => {
            await createFixture();
            fixture.componentRef.setInput('width', 640);
            setMeasuredWidth(900);
            expect(component.svgWidth()).toBe(900);
        });

        it('re-lays out the candles when the measured width changes', async () => {
            await createFixture();
            setMeasuredWidth(400);
            const narrow = Math.max(...component.candles().map(m => m.x + m.width));

            setMeasuredWidth(900);
            const wide = Math.max(...component.candles().map(m => m.x + m.width));

            expect(wide).toBeGreaterThan(narrow);
        });

        it('lays every mark out inside the measured width, and fills it', async () => {
            await createFixture();
            setMeasuredWidth(600);
            const marks = component.candles();
            const rightmost = Math.max(...marks.map(m => m.x + m.width));
            expect(rightmost).toBeLessThanOrEqual(600.001);
            expect(rightmost).toBeGreaterThan(300);
        });
    });

    describe('styling hooks', () => {
        it('merges the class input onto the container', async () => {
            await createFixture();
            fixture.componentRef.setInput('class', 'my-candles');
            fixture.detectChanges();
            expect(
                fixture.nativeElement.querySelector('[data-slot="candlestick"].my-candles'),
            ).toBeTruthy();
        });

        it('hides the gridlines when showGrid is false', async () => {
            await createFixture();
            expect(
                fixture.nativeElement.querySelectorAll('[data-slot="grid-line"]').length,
            ).toBeGreaterThan(0);
            fixture.componentRef.setInput('showGrid', false);
            fixture.detectChanges();
            expect(
                fixture.nativeElement.querySelectorAll('[data-slot="grid-line"]'),
            ).toHaveLength(0);
        });
    });
    // CLAUDE.md section 6 — the tooltip is hover-revealed, so touch needs its own path
    describe('touch', () => {
        it('reveals the tooltip on touchstart, not only on mouseenter', async () => {
            await createFixture();
            const mark = fixture.nativeElement.querySelector('[data-slot="candlestick-candle"]');
            expect(component.hoveredIndex()).toBeNull();

            mark.dispatchEvent(new TouchEvent('touchstart', { bubbles: true }));
            fixture.detectChanges();

            expect(component.hoveredIndex()).toBe(0);
        });
    });

});
