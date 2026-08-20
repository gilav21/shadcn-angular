import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BoxplotComponent } from './boxplot.component';
import { BoxplotGroup } from './boxplot.types';
import { computeStats } from './boxplot.utils';

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

const RAW: BoxplotGroup[] = [
    { label: 'A', values: [1, 2, 3, 4, 5] },
    { label: 'B', values: [2, 4, 6, 8, 10, 40] },
];

describe('BoxplotComponent', () => {
    let component: BoxplotComponent;
    let fixture: ComponentFixture<BoxplotComponent>;

    async function createFixture(groups: BoxplotGroup[] = RAW): Promise<void> {
        await TestBed.configureTestingModule({
            imports: [BoxplotComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(BoxplotComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('groups', groups);
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

    // T-5: box, median, whiskers and outliers per group
    describe('T-5 raw values', () => {
        it('renders one box per group', async () => {
            await createFixture();
            expect(component.boxes()).toHaveLength(2);
            expect(fixture.nativeElement.querySelectorAll('[data-slot="boxplot-box"]'))
                .toHaveLength(2);
        });

        it('derives the summary from the raw values', async () => {
            await createFixture();
            expect(component.boxes()[0].stats).toEqual(computeStats([1, 2, 3, 4, 5]));
        });

        it('draws a median line inside the box', async () => {
            await createFixture();
            const box = component.boxes()[0];
            expect(box.medianLine.y1).toBeGreaterThanOrEqual(box.y - 0.001);
            expect(box.medianLine.y1).toBeLessThanOrEqual(box.y + box.height + 0.001);
            expect(fixture.nativeElement.querySelector('[data-slot="boxplot-median"]'))
                .toBeTruthy();
        });

        it('draws whiskers spanning min to max around the box', async () => {
            await createFixture();
            const box = component.boxes()[0];
            expect(box.whiskerLine.y1).toBeLessThan(box.whiskerLine.y2);
            expect(box.whiskerLine.y1).toBeLessThanOrEqual(box.y + 0.001);
            expect(box.whiskerLine.y2).toBeGreaterThanOrEqual(box.y + box.height - 0.001);
            expect(
                fixture.nativeElement.querySelectorAll('[data-slot="boxplot-whisker"]').length,
            ).toBeGreaterThan(0);
        });

        it('skips groups with neither values nor stats', async () => {
            await createFixture([{ label: 'A', values: [1, 2, 3] }, { label: 'Empty' }]);
            expect(component.boxes()).toHaveLength(1);
            expect(component.boxes()[0].group.label).toBe('A');
        });
    });

    // T-6: pre-computed quartiles render identically to raw
    describe('T-6 pre-computed stats', () => {
        it('lays out pre-computed stats identically to the same raw sample', async () => {
            await createFixture(RAW);
            const fromRaw = component.boxes().map(b => ({
                y: b.y, height: b.height, median: b.medianLine.y1,
            }));

            const precomputed: BoxplotGroup[] = RAW.map(g => ({
                label: g.label,
                stats: computeStats(g.values!)!,
            }));
            fixture.componentRef.setInput('groups', precomputed);
            fixture.detectChanges();

            expect(
                component.boxes().map(b => ({ y: b.y, height: b.height, median: b.medianLine.y1 })),
            ).toEqual(fromRaw);
        });
    });

    // T-7: outliers beyond 1.5 IQR render as individual, hoverable points
    describe('T-7 outliers', () => {
        it('renders each outlier as its own point', async () => {
            await createFixture();
            expect(component.boxes()[1].outliers).toHaveLength(1);
            expect(component.boxes()[1].outliers[0].value).toBe(40);
            expect(fixture.nativeElement.querySelectorAll('[data-slot="boxplot-outlier"]'))
                .toHaveLength(1);
        });

        it('gives each outlier a focusable role and an aria-label', async () => {
            await createFixture();
            const point = fixture.nativeElement.querySelector(
                '[data-slot="boxplot-outlier"]',
            );
            expect(point.getAttribute('tabindex')).toBe('0');
            expect(point.getAttribute('role')).toBe('button');
            expect(point.getAttribute('aria-label')).toContain('40');
        });

        it('hides the outlier points when showOutliers is false', async () => {
            await createFixture();
            fixture.componentRef.setInput('showOutliers', false);
            fixture.detectChanges();
            expect(fixture.nativeElement.querySelectorAll('[data-slot="boxplot-outlier"]'))
                .toHaveLength(0);
        });

        it('reports no outliers for a zero-IQR group', async () => {
            await createFixture([{ label: 'flat', values: [7, 7, 7, 7] }]);
            expect(component.boxes()[0].outliers).toEqual([]);
        });
    });

    // T-8: horizontal orientation transposes
    describe('T-8 orientation', () => {
        it('lays the category axis across the width when vertical', async () => {
            await createFixture();
            const box = component.boxes()[0];
            expect(box.width).toBeCloseTo(component.bandwidth(), 6);
            expect(box.height).not.toBeCloseTo(component.bandwidth(), 6);
        });

        it('transposes the box when orientation is horizontal', async () => {
            await createFixture();
            fixture.componentRef.setInput('orientation', 'horizontal');
            fixture.detectChanges();
            const box = component.boxes()[0];
            expect(box.height).toBeCloseTo(component.bandwidth(), 6);
            expect(box.whiskerLine.x1).toBeLessThan(box.whiskerLine.x2);
            expect(box.whiskerLine.y1).toBeCloseTo(box.whiskerLine.y2, 6);
        });

        it('keeps the median line perpendicular to the value axis in both orientations', async () => {
            await createFixture();
            expect(component.boxes()[0].medianLine.y1)
                .toBeCloseTo(component.boxes()[0].medianLine.y2, 6);

            fixture.componentRef.setInput('orientation', 'horizontal');
            fixture.detectChanges();
            expect(component.boxes()[0].medianLine.x1)
                .toBeCloseTo(component.boxes()[0].medianLine.x2, 6);
        });
    });

    describe('interaction', () => {
        it('emits groupHover with the group on hover and null on leave', async () => {
            await createFixture();
            const seen: (string | null)[] = [];
            component.groupHover.subscribe(e => seen.push(e === null ? null : e.point.label));

            component.onBoxHover(component.boxes()[1]);
            component.onBoxLeave();
            expect(seen).toEqual(['B', null]);
        });

        it('emits groupClick and forwards only real MouseEvents', async () => {
            await createFixture();
            const events: (MouseEvent | undefined)[] = [];
            component.groupClick.subscribe(e => events.push(e.event));

            component.onBoxClick(new MouseEvent('click'), component.boxes()[0]);
            component.onBoxClick(new KeyboardEvent('keydown'), component.boxes()[0]);
            expect(events[0]).toBeInstanceOf(MouseEvent);
            expect(events[1]).toBeUndefined();
        });

        it('lists the five-number summary in the tooltip', async () => {
            await createFixture();
            component.onBoxHover(component.boxes()[0]);
            fixture.detectChanges();
            expect(component.tooltipTitle()).toBe('A');
            expect(component.tooltipRows().map(r => r.label)).toEqual([
                'Max', 'Q3', 'Median', 'Q1', 'Min',
            ]);
            expect(component.tooltipRows().map(r => r.value)).toEqual([
                '5', '4', '3', '2', '1',
            ]);
        });

        it('clears the tooltip on leave', async () => {
            await createFixture();
            component.onBoxHover(component.boxes()[0]);
            component.onBoxLeave();
            expect(component.tooltipRows()).toEqual([]);
            expect(component.tooltipTitle()).toBeUndefined();
        });
    });

    describe('accessibility', () => {
        it('labels the chart with a summary including the title', async () => {
            await createFixture();
            fixture.componentRef.setInput('title', 'Response times');
            fixture.detectChanges();
            expect(component.ariaLabel()).toContain('Response times');
            expect(component.ariaLabel()).toContain('Box plot');
        });

        it('announces the five-number summary on each box', async () => {
            await createFixture();
            const label = component.getBoxAriaLabel(component.boxes()[0]);
            expect(label).toContain('A');
            expect(label).toContain('median 3');
        });

        it('makes every box focusable', async () => {
            await createFixture();
            const box = fixture.nativeElement.querySelector(
                '[data-slot="boxplot-box"]',
            );
            expect(box.getAttribute('tabindex')).toBe('0');
            expect(box.getAttribute('role')).toBe('button');
        });
    });

    describe('edge cases', () => {
        it('renders an empty state for no groups', async () => {
            await createFixture([]);
            expect(component.boxes()).toEqual([]);
            expect(component.isEmpty()).toBe(true);
            expect(fixture.nativeElement.querySelector('[data-slot="boxplot-empty"]'))
                .toBeTruthy();
        });

        it('renders an empty state when every group is unusable', async () => {
            await createFixture([{ label: 'A' }, { label: 'B', values: [] }]);
            expect(component.isEmpty()).toBe(true);
        });

        it('renders a single data point without NaN geometry', async () => {
            await createFixture([{ label: 'one', values: [42] }]);
            const box = component.boxes()[0];
            for (const n of [box.x, box.y, box.width, box.height]) {
                expect(Number.isFinite(n)).toBe(true);
            }
            expect(box.height).toBeGreaterThan(0);
        });

        it('renders a zero-IQR group as a visible flat box', async () => {
            await createFixture([{ label: 'flat', values: [7, 7, 7, 7] }]);
            const box = component.boxes()[0];
            expect(box.height).toBeGreaterThan(0);
            expect(Number.isFinite(box.y)).toBe(true);
        });

        it('renders negative values', async () => {
            await createFixture([{ label: 'neg', values: [-5, -4, -3, -2, -1] }]);
            const box = component.boxes()[0];
            expect(Number.isFinite(box.y)).toBe(true);
            expect(box.height).toBeGreaterThan(0);
        });
    });

    // T-20: RTL
    describe('T-20 RTL', () => {
        it('mirrors the category order when dir is rtl', async () => {
            await createFixture();
            const ltrFirst = component.boxes()[0].x;
            fixture.componentRef.setInput('dir', 'rtl');
            fixture.detectChanges();
            expect(component.boxes()[0].x).toBeGreaterThan(ltrFirst);
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

        it('re-lays out the boxes when the width changes', async () => {
            await createFixture();
            const before = component.boxes()[1].x;
            fixture.componentRef.setInput('width', 1000);
            fixture.detectChanges();
            expect(component.boxes()[1].x).toBeGreaterThan(before);
        });
    });

    describe('styling hooks', () => {
        it('merges the class input onto the container', async () => {
            await createFixture();
            fixture.componentRef.setInput('class', 'my-boxplot');
            fixture.detectChanges();
            expect(
                fixture.nativeElement.querySelector('[data-slot="boxplot"].my-boxplot'),
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
});
