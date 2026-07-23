import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ScatterChartComponent } from './scatter-chart.component';
import { XYSeries, ChartClickEvent, XYDataPoint } from '../../lib/chart.types';

/** Rect jsdom returns for getBoundingClientRect so pointer math has real dims. */
const RECT: DOMRect = {
    x: 0, y: 0, left: 0, top: 0, right: 520, bottom: 320,
    width: 520, height: 320, toJSON: () => ({}),
} as unknown as DOMRect;

describe('ScatterChartComponent', () => {
    let component: ScatterChartComponent;
    let fixture: ComponentFixture<ScatterChartComponent>;

    const series: XYSeries[] = [
        { id: 'a', name: 'Group A', color: '#ff0000', points: [{ x: 1, y: 2 }, { x: 3, y: 5 }, { x: 5, y: 1 }] },
        { name: 'Group B', points: [{ x: 2, y: 8 }, { x: 4, y: 6 }] },
    ];

    const savedResizeObserver = globalThis.ResizeObserver;
    const savedGetBBox = (SVGElement.prototype as { getBBox?: unknown }).getBBox;
    const savedGetBoundingClientRect = Element.prototype.getBoundingClientRect;
    const savedMatchMedia = globalThis.matchMedia;

    beforeEach(async () => {
        globalThis.ResizeObserver = class {
            observe(): void { /* noop */ }
            unobserve(): void { /* noop */ }
            disconnect(): void { /* noop */ }
        } as unknown as typeof ResizeObserver;
        (SVGElement.prototype as unknown as { getBBox: () => DOMRect }).getBBox =
            () => RECT;
        Element.prototype.getBoundingClientRect = () => RECT;
        globalThis.matchMedia = ((query: string) => ({
            matches: false, media: query, onchange: null,
            addListener: () => { /* noop */ }, removeListener: () => { /* noop */ },
            addEventListener: () => { /* noop */ }, removeEventListener: () => { /* noop */ },
            dispatchEvent: () => false,
        })) as unknown as typeof globalThis.matchMedia;

        await TestBed.configureTestingModule({
            imports: [ScatterChartComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(ScatterChartComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('series', series);
        fixture.detectChanges();
    });

    afterEach(() => {
        globalThis.ResizeObserver = savedResizeObserver;
        if (savedGetBBox) {
            (SVGElement.prototype as { getBBox?: unknown }).getBBox = savedGetBBox;
        } else {
            delete (SVGElement.prototype as { getBBox?: unknown }).getBBox;
        }
        Element.prototype.getBoundingClientRect = savedGetBoundingClientRect;
        globalThis.matchMedia = savedMatchMedia;
    });

    it('renders with an accessible Scatter chart label', () => {
        const c = fixture.nativeElement.querySelector('[role="group"]');
        expect(c.getAttribute('aria-label')).toContain('Scatter chart');
    });

    it('renders one circle per point across all visible series', () => {
        expect(fixture.nativeElement.querySelectorAll('circle[data-slot="scatter-point"]')).toHaveLength(5);
    });

    it('derives x and y domains from the data extents', () => {
        expect(component.xDomain()[0]).toBeLessThanOrEqual(1);
        expect(component.xDomain()[1]).toBeGreaterThanOrEqual(5);
        expect(component.yDomain()[1]).toBeGreaterThanOrEqual(8);
    });

    it('falls back to a [0,1] domain when there are no visible points', () => {
        fixture.componentRef.setInput('series', [{ name: 'Empty', points: [] }] as XYSeries[]);
        fixture.detectChanges();
        expect(component.xDomain()).toEqual([0, 1]);
        expect(component.yDomain()).toEqual([0, 1]);
    });

    it('renders x/y axis ticks and grid lines', () => {
        expect(component.xTicks().length).toBeGreaterThan(0);
        expect(component.yTicks().length).toBeGreaterThan(0);
        expect(fixture.nativeElement.querySelectorAll('line[data-slot="grid-line"]'))
            .toHaveLength(component.yTicks().length);
    });

    it('omits grid lines when showGrid is false', () => {
        fixture.componentRef.setInput('showGrid', false);
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelectorAll('line[data-slot="grid-line"]')).toHaveLength(0);
    });

    it('places larger y values higher on screen (smaller pixel y)', () => {
        const pts = component.plottedPoints();
        const high = pts.find(p => p.datum.y === 8)!;
        const low = pts.find(p => p.datum.y === 1)!;
        expect(high.cy).toBeLessThan(low.cy);
    });

    it('uses per-series color when provided and a palette color otherwise', () => {
        const pts = component.plottedPoints();
        expect(pts.find(p => p.seriesIndex === 0)!.color).toBe('#ff0000');
        expect(pts.find(p => p.seriesIndex === 1)!.color).toBeTruthy();
    });

    it('builds legend items keyed by id or name', () => {
        const items = component.legendItems();
        expect(items[0].key).toBe('a');
        expect(items[1].key).toBe('Group B');
    });

    it('hides a series when toggled off via the legend and restores it when toggled again', () => {
        component.toggleSeries('Group B');
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelectorAll('circle[data-slot="scatter-point"]')).toHaveLength(3);
        expect(component.hiddenSeries()).toContain('Group B');

        component.toggleSeries('Group B');
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelectorAll('circle[data-slot="scatter-point"]')).toHaveLength(5);
        expect(component.hiddenSeries()).not.toContain('Group B');
    });

    it('builds a tooltip row for the hovered point with its coordinates', () => {
        component.setHover(0, 1);
        const rows = component.tooltipRows();
        expect(rows[0].label).toBe('Group A');
        expect(rows[0].value).toContain('3');
        expect(rows[0].value).toContain('5');
    });

    it('returns no tooltip rows when nothing is hovered', () => {
        component.setHover(null);
        expect(component.tooltipRows()).toHaveLength(0);
    });

    it('returns no tooltip rows when the hovered indices are out of range', () => {
        component.setHover(99, 99);
        expect(component.tooltipRows()).toHaveLength(0);
    });

    it('enlarges the hovered point radius', () => {
        component.setHover(0, 0);
        fixture.detectChanges();
        const circle = fixture.nativeElement.querySelector('circle[data-slot="scatter-point"]');
        expect(Number(circle.getAttribute('r'))).toBe(component.plottedPoints()[0].r + 2);
    });

    it('clears the hover on pointer leave', () => {
        component.setHover(0, 0);
        component.onPointerLeave();
        expect(component.tooltipRows()).toHaveLength(0);
    });

    it('updates hover and tooltip position on pointer move', () => {
        component.onPointerMove(new MouseEvent('mousemove', { clientX: 60, clientY: 40 }));
        expect(component.tooltipRows()).toHaveLength(1);
        expect(component.tooltipPos().x).toBeGreaterThan(0);
    });

    it('ignores pointer move when the svg view is not available', () => {
        (component as unknown as { _svg: () => undefined })._svg = () => undefined;
        component.onPointerMove(new MouseEvent('mousemove', { clientX: 60, clientY: 40 }));
        expect(component.tooltipRows()).toHaveLength(0);
    });

    it('ignores pointer move when there are no plotted points', () => {
        fixture.componentRef.setInput('series', [{ name: 'Empty', points: [] }] as XYSeries[]);
        fixture.detectChanges();
        component.onPointerMove(new MouseEvent('mousemove', { clientX: 60, clientY: 40 }));
        expect(component.tooltipRows()).toHaveLength(0);
    });

    it('emits pointClick for a valid point and no-ops for an invalid one', () => {
        let emitted: ChartClickEvent<XYDataPoint> | undefined;
        component.pointClick.subscribe(e => (emitted = e));
        component.onPointClick(0, 1);
        expect(emitted?.index).toBe(1);
        expect(emitted?.point).toEqual({ x: 3, y: 5 });

        emitted = undefined;
        component.onPointClick(5, 5);
        expect(emitted).toBeUndefined();
    });

    it('emits pointClick when a rendered point is clicked', () => {
        const spy = vi.fn();
        component.pointClick.subscribe(spy);
        fixture.debugElement.query(By.css('circle[data-slot="scatter-point"]'))
            .nativeElement.dispatchEvent(new Event('click'));
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('honors an explicit rtl direction and mirrors the plot area', () => {
        fixture.componentRef.setInput('dir', 'rtl');
        fixture.detectChanges();
        expect(component.isRtl()).toBe(true);
        const pts = component.plottedPoints();
        const lowX = pts.find(p => p.datum.x === 1)!;
        const highX = pts.find(p => p.datum.x === 5)!;
        expect(lowX.cx).toBeGreaterThan(highX.cx);
    });

    it('honors an explicit ltr direction', () => {
        fixture.componentRef.setInput('dir', 'ltr');
        fixture.detectChanges();
        expect(component.isRtl()).toBe(false);
    });

    it('reflects the auto direction from the DOM after view init', () => {
        expect(component.isRtl()).toBe(false);
    });
});
