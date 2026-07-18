import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { LineChartComponent } from './line-chart.component';
import { ChartSeries, ChartClickEvent } from '../../lib/chart.types';

type GlobalRecord = Record<string, unknown>;

const savedResizeObserver = (globalThis as unknown as GlobalRecord)['ResizeObserver'];
const savedGetBBox = (globalThis as unknown as GlobalRecord)['SVGElement'] !== undefined
    ? (SVGElement.prototype as unknown as { getBBox?: unknown }).getBBox
    : undefined;
const savedGetBoundingClientRect = Element.prototype.getBoundingClientRect;
const savedMatchMedia = (globalThis as unknown as GlobalRecord)['matchMedia'];

beforeAll(() => {
    (globalThis as unknown as GlobalRecord)['ResizeObserver'] = class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
    };
    (SVGElement.prototype as unknown as { getBBox: () => DOMRect }).getBBox = () =>
        ({ x: 0, y: 0, width: 500, height: 300, top: 0, left: 0, right: 500, bottom: 300, toJSON: () => ({}) }) as DOMRect;
    Element.prototype.getBoundingClientRect = () =>
        ({ x: 0, y: 0, width: 500, height: 300, top: 0, left: 0, right: 500, bottom: 300, toJSON: () => ({}) }) as DOMRect;
    (globalThis as unknown as GlobalRecord)['matchMedia'] = (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
    });
});

afterAll(() => {
    (globalThis as unknown as GlobalRecord)['ResizeObserver'] = savedResizeObserver;
    if (savedGetBBox === undefined) {
        delete (SVGElement.prototype as unknown as { getBBox?: unknown }).getBBox;
    } else {
        (SVGElement.prototype as unknown as { getBBox?: unknown }).getBBox = savedGetBBox;
    }
    Element.prototype.getBoundingClientRect = savedGetBoundingClientRect;
    (globalThis as unknown as GlobalRecord)['matchMedia'] = savedMatchMedia;
});

describe('LineChartComponent', () => {
    let component: LineChartComponent;
    let fixture: ComponentFixture<LineChartComponent>;

    const series: ChartSeries[] = [
        {
            name: 'Revenue',
            data: [
                { name: 'Q1', value: 100 },
                { name: 'Q2', value: 200 },
                { name: 'Q3', value: 150 },
            ],
        },
        {
            name: 'Cost',
            data: [
                { name: 'Q1', value: 80 },
                { name: 'Q2', value: 120 },
                { name: 'Q3', value: 90 },
            ],
        },
    ];

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [LineChartComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(LineChartComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('series', series);
        fixture.detectChanges();
    });

    it('renders an svg with an accessible role and label', () => {
        const container = fixture.nativeElement.querySelector('[role="group"]');
        expect(container).toBeTruthy();
        expect(container.getAttribute('aria-label')).toContain('Line chart');
        expect(fixture.nativeElement.querySelector('svg')).toBeTruthy();
    });

    it('derives the category axis from the first series', () => {
        expect(component.categories()).toEqual(['Q1', 'Q2', 'Q3']);
    });

    it('computes one path per visible series', () => {
        expect(component.seriesPaths()).toHaveLength(2);
        const paths = fixture.nativeElement.querySelectorAll('path[data-slot="line-series"]');
        expect(paths).toHaveLength(2);
    });

    it('builds a non-empty path string for each series', () => {
        for (const sp of component.seriesPaths()) {
            expect(sp.path.startsWith('M')).toBe(true);
        }
    });

    it('maps the maximum value near the top of the plot area', () => {
        const rev = component.seriesPaths().find(s => s.name === 'Revenue')!;
        const q2 = rev.points[1]; // value 200 is the max
        const q1 = rev.points[0]; // value 100
        expect(q2.y).toBeLessThan(q1.y); // smaller y = higher on screen
    });

    it('applies a smooth curve path when curve is monotone', () => {
        fixture.componentRef.setInput('curve', 'monotone');
        fixture.detectChanges();
        const linearPath = component.seriesPaths()[0].path;
        expect(linearPath).toContain('C');
    });

    it('hides a series when toggled off via the legend', () => {
        component.toggleSeries('Cost');
        fixture.detectChanges();
        expect(component.hiddenSeries()).toContain('Cost');
        expect(component.seriesPaths()).toHaveLength(1);
        component.toggleSeries('Cost');
        expect(component.hiddenSeries()).not.toContain('Cost');
        expect(component.seriesPaths()).toHaveLength(2);
    });

    it('exposes legend items for every series regardless of hidden state', () => {
        component.toggleSeries('Cost');
        expect(component.legendItems().map(i => i.label)).toEqual(['Revenue', 'Cost']);
    });

    it('uses the series id as the legend/hidden key when present', () => {
        const idSeries: ChartSeries[] = [
            { id: 's1', name: 'Alpha', data: [{ name: 'A', value: 1 }] },
        ];
        fixture.componentRef.setInput('series', idSeries);
        fixture.detectChanges();
        expect(component.legendItems()[0].key).toBe('s1');
        component.toggleSeries('s1');
        expect(component.hiddenSeries()).toContain('s1');
        expect(component.seriesPaths()).toHaveLength(0);
    });

    it('builds tooltip rows for the hovered category across visible series', () => {
        component.setHover(1); // Q2
        const rows = component.tooltipRows();
        expect(rows.map(r => r.label)).toEqual(['Revenue', 'Cost']);
        expect(rows[0].value).toContain('200');
        expect(rows[1].value).toContain('120');
    });

    it('omits hidden series from tooltip rows', () => {
        component.toggleSeries('Cost');
        component.setHover(0);
        expect(component.tooltipRows().map(r => r.label)).toEqual(['Revenue']);
    });

    it('returns no tooltip rows or hover title when nothing is hovered', () => {
        expect(component.tooltipRows()).toEqual([]);
        expect(component.hoverTitle()).toBeUndefined();
        expect(component.crosshairX()).toBeNull();
    });

    it('exposes crosshair position and hover title while hovering', () => {
        component.setHover(2);
        expect(component.hoverTitle()).toBe('Q3');
        expect(component.crosshairX()).not.toBeNull();
    });

    it('falls back to zero when a series lacks a value at the hovered index', () => {
        const ragged: ChartSeries[] = [
            { name: 'Full', data: [{ name: 'A', value: 5 }, { name: 'B', value: 6 }, { name: 'C', value: 7 }] },
            { name: 'Short', data: [{ name: 'A', value: 1 }] },
        ];
        fixture.componentRef.setInput('series', ragged);
        fixture.detectChanges();
        component.setHover(2);
        const shortRow = component.tooltipRows().find(r => r.label === 'Short')!;
        expect(shortRow.value).toContain('0');
    });

    it('emits pointHover with the hovered category and clears on leave', () => {
        const events: (number | null)[] = [];
        component.pointHover.subscribe(e => events.push(e ? e.index : null));
        component.setHover(2);
        component.setHover(null);
        expect(events).toEqual([2, null]);
    });

    it('does not emit a hovered point when there are no visible series', () => {
        component.toggleSeries('Revenue');
        component.toggleSeries('Cost');
        fixture.detectChanges();
        const emitted: (ChartClickEvent | null)[] = [];
        component.pointHover.subscribe(e => emitted.push(e));
        component.setHover(1);
        expect(emitted).toEqual([]);
        expect(component.seriesPaths()).toHaveLength(0);
    });

    it('emits pointClick for a valid series/point and ignores out-of-range clicks', () => {
        const clicks: ChartClickEvent[] = [];
        component.pointClick.subscribe(e => clicks.push(e));
        component.onPointClick(0, 1);
        expect(clicks).toHaveLength(1);
        expect(clicks[0].index).toBe(1);
        expect(clicks[0].point.value).toBe(200);
        component.onPointClick(0, 99);
        expect(clicks).toHaveLength(1);
    });

    it('updates hover and tooltip position on pointer move', () => {
        const svg: SVGSVGElement = fixture.nativeElement.querySelector('svg');
        const evt = new MouseEvent('mousemove', { clientX: 250, clientY: 120 });
        Object.defineProperty(evt, 'target', { value: svg });
        component.onPointerMove(evt);
        expect(component.hoveredIndex()).not.toBeNull();
        expect(component.tooltipPos().x).toBeGreaterThan(0);
        component.onPointerLeave();
        expect(component.hoveredIndex()).toBeNull();
    });

    it('ignores pointer move before the svg view is available', () => {
        (component as unknown as { _svg: () => undefined })._svg = () => undefined;
        const evt = new MouseEvent('mousemove', { clientX: 10, clientY: 10 });
        expect(() => component.onPointerMove(evt)).not.toThrow();
        expect(component.hoveredIndex()).toBeNull();
    });

    it('ignores pointer move when there are no category ticks', () => {
        fixture.componentRef.setInput('series', [{ name: 'Empty', data: [] }] as ChartSeries[]);
        fixture.detectChanges();
        const svg: SVGSVGElement = fixture.nativeElement.querySelector('svg');
        const evt = new MouseEvent('mousemove', { clientX: 100, clientY: 100 });
        Object.defineProperty(evt, 'target', { value: svg });
        component.onPointerMove(evt);
        expect(component.hoveredIndex()).toBeNull();
    });

    it('computes a nice y-axis tick set', () => {
        expect(component.yTicks().length).toBeGreaterThan(1);
        expect(component.yTicks()[0]).toBe(0);
    });

    it('falls back to a default y-domain when every series is hidden', () => {
        component.toggleSeries('Revenue');
        component.toggleSeries('Cost');
        fixture.detectChanges();
        expect(component.yTicks()[0]).toBe(0);
        expect(component.gridLines().length).toBeGreaterThan(0);
    });

    it('honors an explicit rtl direction', () => {
        fixture.componentRef.setInput('dir', 'rtl');
        fixture.detectChanges();
        expect(component.isRtl()).toBe(true);
        // rtl flips the plot area so the axis padding sits on the right.
        const rtlLeft = component.seriesPaths()[0].points[0].x;
        fixture.componentRef.setInput('dir', 'ltr');
        fixture.detectChanges();
        expect(component.isRtl()).toBe(false);
        const ltrLeft = component.seriesPaths()[0].points[0].x;
        expect(rtlLeft).not.toBe(ltrLeft);
    });

    it('resolves direction from the DOM when set to auto', () => {
        fixture.componentRef.setInput('dir', 'auto');
        fixture.detectChanges();
        expect(component.isRtl()).toBe(false);
    });

    it('drops grid lines when showGrid is false', () => {
        fixture.componentRef.setInput('showGrid', false);
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelectorAll('line[data-slot="grid-line"]')).toHaveLength(0);
    });

    it('renders point markers only when showPoints is enabled', () => {
        expect(fixture.nativeElement.querySelectorAll('circle').length).toBeGreaterThan(0);
        fixture.componentRef.setInput('showPoints', false);
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelectorAll('circle')).toHaveLength(0);
    });

    it('exposes the viewBox and responsive width', () => {
        expect(component.viewBox()).toBe(`0 0 ${component.svgWidth()} 300`);
        expect(component.svgWidth()).toBe(500);
    });

    it('reflects a custom class on the root element', () => {
        fixture.componentRef.setInput('class', 'my-chart');
        fixture.detectChanges();
        expect(component.classes()).toContain('my-chart');
    });
});
