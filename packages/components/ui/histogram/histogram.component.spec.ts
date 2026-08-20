import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HistogramComponent } from './histogram.component';

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

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

describe('HistogramComponent', () => {
    let component: HistogramComponent;
    let fixture: ComponentFixture<HistogramComponent>;

    async function createFixture(values: number[] = range(100)): Promise<void> {
        await TestBed.configureTestingModule({
            imports: [HistogramComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(HistogramComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('values', values);
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

    // T-1: auto-bins raw values into sensible bins
    describe('T-1 auto binning', () => {
        it('renders one bar per auto-derived bin without a binCount', async () => {
            await createFixture();
            expect(component.bins()).toHaveLength(8);
            expect(fixture.nativeElement.querySelectorAll('[data-slot="histogram-bar"]'))
                .toHaveLength(8);
        });

        it('gives every bar a positive width and a height proportional to its count', async () => {
            await createFixture([1, 1, 1, 2]);
            const bars = component.bars();
            expect(bars.length).toBeGreaterThan(0);
            for (const bar of bars) {
                expect(bar.width).toBeGreaterThan(0);
                expect(Number.isFinite(bar.height)).toBe(true);
                expect(bar.height).toBeGreaterThanOrEqual(0);
            }
            const tallest = bars.reduce((a, b) => (a.count >= b.count ? a : b), bars[0]);
            expect(tallest.count).toBe(3);
        });
    });

    // T-2: honours binCount and explicit binEdges
    describe('T-2 explicit binning', () => {
        it('follows an explicit binCount', async () => {
            await createFixture();
            fixture.componentRef.setInput('binCount', 20);
            fixture.detectChanges();
            expect(component.bins()).toHaveLength(20);
            expect(fixture.nativeElement.querySelectorAll('[data-slot="histogram-bar"]'))
                .toHaveLength(20);
        });

        it('follows explicit binEdges', async () => {
            await createFixture([1, 2, 3, 4, 5]);
            fixture.componentRef.setInput('binEdges', [0, 2, 4, 6]);
            fixture.detectChanges();
            expect(component.bins().map(b => b.count)).toEqual([1, 2, 2]);
        });
    });

    // T-3: tooltip shows bin range and count
    describe('T-3 tooltip', () => {
        it('shows the bin range as the title and the count as a row', async () => {
            await createFixture([1, 2, 3, 4, 5]);
            fixture.componentRef.setInput('binEdges', [0, 2, 4, 6]);
            fixture.detectChanges();

            component.onBarHover(component.bars()[1]);
            fixture.detectChanges();

            expect(component.tooltipTitle()).toBe('2 – 4');
            expect(component.tooltipRows()).toEqual([
                expect.objectContaining({ label: 'Count', value: '2' }),
            ]);
        });

        it('appends the unit to the bin range in the tooltip title', async () => {
            await createFixture([1, 2, 3, 4, 5]);
            fixture.componentRef.setInput('binEdges', [0, 2, 4, 6]);
            fixture.componentRef.setInput('unit', 'ms');
            fixture.detectChanges();

            component.onBarHover(component.bars()[0]);
            fixture.detectChanges();
            expect(component.tooltipTitle()).toBe('0ms – 2ms');
        });

        it('clears the tooltip on leave', async () => {
            await createFixture();
            component.onBarHover(component.bars()[0]);
            fixture.detectChanges();
            expect(component.hoveredIndex()).toBe(0);

            component.onBarLeave();
            fixture.detectChanges();
            expect(component.hoveredIndex()).toBeNull();
            expect(component.tooltipRows()).toEqual([]);
            expect(component.tooltipTitle()).toBeUndefined();
        });

        it('emits binHover with the bin on hover and null on leave', async () => {
            await createFixture();
            const seen: (number | null)[] = [];
            component.binHover.subscribe(e => seen.push(e === null ? null : e.index));

            component.onBarHover(component.bars()[2]);
            component.onBarLeave();
            expect(seen).toEqual([2, null]);
        });

        it('emits binClick with the bin data and forwards only real MouseEvents', async () => {
            await createFixture();
            const events: (MouseEvent | undefined)[] = [];
            const bins: number[] = [];
            component.binClick.subscribe(e => {
                events.push(e.event);
                bins.push(e.point.count);
            });

            component.onBarClick(new MouseEvent('click'), component.bars()[0]);
            component.onBarClick(new KeyboardEvent('keydown'), component.bars()[0]);

            expect(events[0]).toBeInstanceOf(MouseEvent);
            expect(events[1]).toBeUndefined();
            expect(bins).toHaveLength(2);
        });
    });

    // T-4: axis bounds are nice numbers
    describe('T-4 nice axis bounds', () => {
        it('rounds the value-axis bounds outward to nice numbers', async () => {
            await createFixture([3, 97]);
            expect(component.bins()[0].start).toBe(0);
            expect(component.bins().at(-1)!.end).toBe(100);
        });

        it('starts the count axis at zero and ends on a whole tick', async () => {
            await createFixture(range(100));
            const ticks = component.countTicks();
            expect(ticks[0]).toBe(0);
            expect(ticks.at(-1)!).toBeGreaterThanOrEqual(
                Math.max(...component.bins().map(b => b.count)),
            );
            for (const tick of ticks) expect(Number.isInteger(tick)).toBe(true);
        });
    });

    describe('accessibility', () => {
        it('labels the chart with a summary including the title', async () => {
            await createFixture();
            fixture.componentRef.setInput('title', 'Latency');
            fixture.detectChanges();
            expect(component.ariaLabel()).toContain('Latency');
            expect(component.ariaLabel()).toContain('Histogram');
        });

        it('gives every bar a focusable role and a range/count aria-label', async () => {
            await createFixture([1, 2, 3, 4, 5]);
            fixture.componentRef.setInput('binEdges', [0, 2, 4, 6]);
            fixture.detectChanges();

            const bars = fixture.nativeElement.querySelectorAll(
                '[data-slot="histogram-bar"]',
            );
            expect(bars[0].getAttribute('tabindex')).toBe('0');
            expect(bars[0].getAttribute('role')).toBe('button');
            expect(component.getBarAriaLabel(component.bars()[1])).toBe('2 – 4: 2');
        });
    });

    describe('edge cases', () => {
        it('renders an empty state and no bars for empty data', async () => {
            await createFixture([]);
            expect(component.bars()).toEqual([]);
            expect(component.isEmpty()).toBe(true);
            expect(
                fixture.nativeElement.querySelector('[data-slot="histogram-empty"]'),
            ).toBeTruthy();
        });

        it('renders a single data point without NaN geometry', async () => {
            await createFixture([42]);
            expect(component.isEmpty()).toBe(false);
            for (const bar of component.bars()) {
                expect(Number.isFinite(bar.x)).toBe(true);
                expect(Number.isFinite(bar.y)).toBe(true);
                expect(Number.isFinite(bar.width)).toBe(true);
                expect(Number.isFinite(bar.height)).toBe(true);
            }
        });

        it('renders zero-variance data without dividing by zero', async () => {
            await createFixture([7, 7, 7, 7]);
            for (const bar of component.bars()) {
                expect(Number.isFinite(bar.x)).toBe(true);
                expect(Number.isFinite(bar.height)).toBe(true);
            }
            expect(component.bars().filter(b => b.count > 0)).toHaveLength(1);
        });

        it('renders negative values', async () => {
            await createFixture([-10, -5, 0, 5, 10]);
            expect(component.bars().length).toBeGreaterThan(0);
            for (const bar of component.bars()) {
                expect(Number.isFinite(bar.x)).toBe(true);
            }
        });
    });

    // T-20: RTL
    describe('T-20 RTL', () => {
        it('mirrors the bar order when dir is rtl', async () => {
            await createFixture(range(100));
            const ltrFirst = component.bars()[0].x;
            fixture.componentRef.setInput('dir', 'rtl');
            fixture.detectChanges();
            const rtlFirst = component.bars()[0].x;
            expect(rtlFirst).toBeGreaterThan(ltrFirst);
        });

        it('keeps every bar inside the chart and ordered right-to-left in RTL', async () => {
            await createFixture(range(100));
            fixture.componentRef.setInput('dir', 'rtl');
            fixture.detectChanges();

            const bars = component.bars();
            for (const bar of bars) {
                expect(bar.x).toBeGreaterThanOrEqual(0);
                expect(bar.x + bar.width).toBeLessThanOrEqual(component.svgWidth() + 0.001);
            }
            for (let i = 1; i < bars.length; i++) {
                expect(bars[i].x).toBeLessThan(bars[i - 1].x);
            }
        });
    });

    // T-18: resize
    describe('T-18 resize', () => {
        it('falls back to the width input before the container is measured', async () => {
            await createFixture();
            fixture.componentRef.setInput('width', 640);
            fixture.detectChanges();
            expect(component.svgWidth()).toBe(640);
        });

        it('re-lays out the bars when the width changes', async () => {
            await createFixture();
            const before = component.bars().at(-1)!.x;
            fixture.componentRef.setInput('width', 1000);
            fixture.detectChanges();
            expect(component.bars().at(-1)!.x).toBeGreaterThan(before);
        });
    });

    describe('styling hooks', () => {
        it('merges the class input onto the container', async () => {
            await createFixture();
            fixture.componentRef.setInput('class', 'my-histogram');
            fixture.detectChanges();
            expect(component.classes()).toContain('my-histogram');
            expect(
                fixture.nativeElement.querySelector('[data-slot="histogram"].my-histogram'),
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
            const mark = fixture.nativeElement.querySelector('[data-slot="histogram-bar"]');
            expect(component.hoveredIndex()).toBeNull();

            mark.dispatchEvent(new TouchEvent('touchstart', { bubbles: true }));
            fixture.detectChanges();

            expect(component.hoveredIndex()).toBe(0);
        });
    });

});
