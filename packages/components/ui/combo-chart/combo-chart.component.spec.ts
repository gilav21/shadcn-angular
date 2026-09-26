import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
    describe,
    it,
    expect,
    beforeEach,
    afterEach,
    vi,
} from 'vitest';
import { ComboChartComponent } from './combo-chart.component';
import { ChartSeries, ChartClickEvent } from '../../lib/chart.types';

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

describe('ComboChartComponent', () => {
    let component: ComboChartComponent;
    let fixture: ComponentFixture<ComboChartComponent>;

    const barSeries: ChartSeries[] = [
        {
            name: 'Defects',
            data: [
                { name: 'A', value: 50 },
                { name: 'B', value: 30 },
                { name: 'C', value: 15 },
                { name: 'D', value: 5 },
            ],
        },
    ];

    const lineSeries: ChartSeries[] = [
        {
            name: 'Target',
            data: [
                { name: 'A', value: 40 },
                { name: 'B', value: 35 },
                { name: 'C', value: 20 },
                { name: 'D', value: 10 },
            ],
        },
    ];

    let bboxDescriptor: PropertyDescriptor | undefined;
    let rectDescriptor: PropertyDescriptor | undefined;
    let matchMediaDescriptor: PropertyDescriptor | undefined;

    beforeEach(async () => {
        vi.stubGlobal('ResizeObserver', ResizeObserverStub);

        matchMediaDescriptor = Object.getOwnPropertyDescriptor(
            globalThis,
            'matchMedia',
        );
        Object.defineProperty(globalThis, 'matchMedia', {
            configurable: true,
            writable: true,
            value: (query: string) =>
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
        });

        bboxDescriptor = Object.getOwnPropertyDescriptor(
            SVGElement.prototype,
            'getBBox',
        );
        Object.defineProperty(SVGElement.prototype, 'getBBox', {
            configurable: true,
            value: () => ({ x: 0, y: 0, width: 100, height: 20 }),
        });

        rectDescriptor = Object.getOwnPropertyDescriptor(
            Element.prototype,
            'getBoundingClientRect',
        );
        Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
            configurable: true,
            value: () => ({
                x: 0,
                y: 0,
                left: 0,
                top: 0,
                right: 540,
                bottom: 320,
                width: 540,
                height: 320,
                toJSON: () => ({}),
            }),
        });

        await TestBed.configureTestingModule({
            imports: [ComboChartComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(ComboChartComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('barSeries', barSeries);
        fixture.detectChanges();
    });

    afterEach(() => {
        if (rectDescriptor) {
            Object.defineProperty(Element.prototype, 'getBoundingClientRect', rectDescriptor);
        } else {
            delete (Element.prototype as unknown as Record<string, unknown>)['getBoundingClientRect'];
        }
        if (bboxDescriptor) {
            Object.defineProperty(SVGElement.prototype, 'getBBox', bboxDescriptor);
        } else {
            delete (SVGElement.prototype as unknown as Record<string, unknown>)[
                'getBBox'
            ];
        }
        if (rectDescriptor) {
            Object.defineProperty(
                Element.prototype,
                'getBoundingClientRect',
                rectDescriptor,
            );
        }
        if (matchMediaDescriptor) {
            Object.defineProperty(globalThis, 'matchMedia', matchMediaDescriptor);
        } else {
            delete (globalThis as unknown as Record<string, unknown>)['matchMedia'];
        }
        vi.unstubAllGlobals();
    });

    it('includes the title in the accessible label', () => {
        fixture.componentRef.setInput('title', 'Pareto');
        fixture.detectChanges();
        const container = fixture.nativeElement.querySelector('[role="group"]');
        expect(container.getAttribute('aria-label')).toContain('Combo chart');
        expect(container.getAttribute('aria-label')).toContain('Pareto');
    });

    it('renders side-by-side bars for multiple bar series', () => {
        const secondBar: ChartSeries[] = [
            barSeries[0],
            {
                name: 'Rework',
                data: [
                    { name: 'A', value: 20 },
                    { name: 'B', value: 18 },
                    { name: 'C', value: 9 },
                    { name: 'D', value: 3 },
                ],
            },
        ];
        fixture.componentRef.setInput('barSeries', secondBar);
        fixture.detectChanges();
        const bars = fixture.nativeElement.querySelectorAll(
            'rect[data-slot="combo-bar"]',
        );
        expect(bars).toHaveLength(8);
        expect(component.bars()[0].width).toBeCloseTo(component.bars()[1].width, 5);
        expect(component.bars()[1].x).toBeGreaterThan(component.bars()[0].x);
    });

    it('derives categories from the first bar series', () => {
        expect(component.categories()).toEqual(['A', 'B', 'C', 'D']);
    });

    it('sets the primary y-domain from the max across every bar series', () => {
        fixture.componentRef.setInput('barSeries', [
            barSeries[0],
            { name: 'Rework', data: [{ name: 'A', value: 20 }, { name: 'B', value: 72 }, { name: 'C', value: 9 }, { name: 'D', value: 3 }] },
        ]);
        fixture.detectChanges();
        expect(component.primaryMax()).toBe(72);
    });

    it('falls back to a primary max of 1 when the bar data is empty', () => {
        fixture.componentRef.setInput('barSeries', [{ name: 'Empty', data: [] }]);
        fixture.detectChanges();
        expect(component.primaryMax()).toBe(1);
        expect(component.categories()).toEqual([]);
    });

    it('renders y-axis grid lines and primary ticks', () => {
        expect(component.primaryTicks().map((t) => t.value)).toEqual([0, 10, 20, 30, 40, 50]);
        expect(
            fixture.nativeElement.querySelectorAll('line[data-slot="grid-line"]'),
        ).toHaveLength(component.primaryTicks().length);
    });

    it('hides grid lines when showGrid is false', () => {
        fixture.componentRef.setInput('showGrid', false);
        fixture.detectChanges();
        expect(
            fixture.nativeElement.querySelectorAll('line[data-slot="grid-line"]'),
        ).toHaveLength(0);
    });

    it('renders category ticks as text labels', () => {
        const labels = Array.from(
            fixture.nativeElement.querySelectorAll('text'),
        ).map((t) => (t as SVGTextElement).textContent);
        expect(labels).toContain('A');
        expect(labels).toContain('D');
    });

    it('builds a cumulative Pareto line that reaches 100%', () => {
        fixture.componentRef.setInput('showCumulative', true);
        fixture.detectChanges();
        const cumulative = component.cumulativePercents();
        expect(cumulative.at(-1)).toBeCloseTo(100, 5);
        expect(cumulative[0]).toBeCloseTo(50, 5);
        expect(component.secondaryMax()).toBe(100);
        const cumulativeLine = fixture.nativeElement.querySelector(
            'path[data-slot="combo-line"]',
        );
        expect(cumulativeLine).toBeTruthy();
        expect(cumulativeLine.getAttribute('d')).toMatch(/^M/);
    });

    it('returns no cumulative percents when there is no bar series', () => {
        fixture.componentRef.setInput('barSeries', []);
        fixture.detectChanges();
        expect(component.cumulativePercents()).toEqual([]);
        expect(component.lines()).toEqual([]);
    });

    it('prepends the cumulative line and honours a custom label', () => {
        fixture.componentRef.setInput('lineSeries', lineSeries);
        fixture.componentRef.setInput('showCumulative', true);
        fixture.componentRef.setInput('cumulativeLabel', 'Running total');
        fixture.detectChanges();
        expect(component.lines()).toHaveLength(2);
        expect(component.lines()[0].key).toBe('__cumulative__');
        expect(component.lines()[0].name).toBe('Running total');
        expect(component.lines()[1].name).toBe('Target');
    });

    it('renders an explicit line series on the secondary axis', () => {
        fixture.componentRef.setInput('lineSeries', lineSeries);
        fixture.detectChanges();
        expect(
            fixture.nativeElement.querySelectorAll('path[data-slot="combo-line"]'),
        ).toHaveLength(1);
        expect(component.secondaryMax()).toBe(40);
    });

    it('uses a secondary max of 100 when there are no line values', () => {
        expect(component.secondaryMax()).toBe(100);
        expect(component.lines()).toEqual([]);
    });

    it('uses the series id as the line key when present', () => {
        const idSeries: ChartSeries[] = [
            { id: 'target-id', name: 'Target', data: lineSeries[0].data },
        ];
        fixture.componentRef.setInput('lineSeries', idSeries);
        fixture.detectChanges();
        expect(component.lines()[0].key).toBe('target-id');
    });

    it('exposes legend items for bars and lines by type', () => {
        fixture.componentRef.setInput('lineSeries', lineSeries);
        fixture.detectChanges();
        expect(component.legendItems().map((l) => l.label)).toEqual([
            'Defects',
            'Target',
        ]);
    });

    it('builds tooltip rows for the hovered category including lines', () => {
        fixture.componentRef.setInput('lineSeries', lineSeries);
        fixture.detectChanges();
        component.setHover(0);
        const rows = component.tooltipRows();
        expect(rows.map((r) => r.label)).toEqual(['Defects', 'Target']);
        expect(rows[0].value).toContain('50');
        expect(rows[1].value).toContain('40');
        expect(component.hoverTitle()).toBe('A');
    });

    it('adds a cumulative tooltip row when cumulative is enabled', () => {
        fixture.componentRef.setInput('showCumulative', true);
        fixture.detectChanges();
        component.setHover(0);
        const rows = component.tooltipRows();
        expect(rows.map((r) => r.label)).toContain('Cumulative');
        expect(rows.at(-1)?.value).toBe('50%');
    });

    it('returns no tooltip rows and no hover title when nothing is hovered', () => {
        expect(component.tooltipRows()).toHaveLength(0);
        expect(component.hoverTitle()).toBeUndefined();
        expect(component.crosshairX()).toBeNull();
    });

    it('exposes the hovered crosshair position and renders the crosshair', () => {
        component.setHover(1);
        fixture.detectChanges();
        const centreB = component.categoryCenters()[1].x;
        expect(component.crosshairX()).toBe(centreB);
        const line = fixture.nativeElement.querySelector('line[data-slot="crosshair"]');
        expect(Number(line.getAttribute('x1'))).toBeCloseTo(centreB, 5);
    });

    it('updates hover state and tooltip position on pointer move', () => {
        const svg = fixture.nativeElement.querySelector('svg') as SVGSVGElement;
        svg.dispatchEvent(
            new MouseEvent('mousemove', { clientX: 480, clientY: 100 }),
        );
        fixture.detectChanges();
        expect(component.hoveredIndex()).toBe(3);
        expect(component.tooltipPos().x).toBeCloseTo(component.categoryCenters()[3].x + 12, 5);
    });

    it('ignores pointer moves when there are no categories', () => {
        fixture.componentRef.setInput('barSeries', [{ name: 'Empty', data: [] }]);
        fixture.detectChanges();
        expect(() =>
            component.onPointerMove(new MouseEvent('mousemove', { clientX: 100, clientY: 100 })),
        ).not.toThrow();
        expect(component.hoveredIndex()).toBeNull();
    });

    it('clears hover state on pointer leave', () => {
        component.setHover(1);
        component.onPointerLeave();
        expect(component.hoveredIndex()).toBeNull();
    });

    it('emits the clicked bar datum via barClick', () => {
        const events: ChartClickEvent[] = [];
        component.barClick.subscribe((e) => events.push(e));
        component.onBarClick(0, 1);
        expect(events).toHaveLength(1);
        expect(events[0].index).toBe(1);
        expect(events[0].point.value).toBe(30);
    });

    it('does not emit barClick for an out-of-range bar', () => {
        const events: ChartClickEvent[] = [];
        component.barClick.subscribe((e) => events.push(e));
        component.onBarClick(9, 9);
        expect(events).toHaveLength(0);
    });

    it('clicking a rendered bar emits its datum', () => {
        const events: ChartClickEvent[] = [];
        component.barClick.subscribe((e) => events.push(e));
        const bars = fixture.nativeElement.querySelectorAll(
            'rect[data-slot="combo-bar"]',
        );
        (bars[2] as SVGRectElement).dispatchEvent(new MouseEvent('click'));
        expect(events).toHaveLength(1);
        expect(events[0].index).toBe(2);
        expect(events[0].point.value).toBe(15);
    });

    it('resolves rtl layout from the dir input', () => {
        fixture.componentRef.setInput('dir', 'rtl');
        fixture.detectChanges();
        expect(component.isRtl()).toBe(true);
        const bandBars = component.bars();
        expect(bandBars[0].x).toBeGreaterThan(bandBars[3].x);
    });

    it('hides the tooltip and legend when disabled', () => {
        fixture.componentRef.setInput('showTooltip', false);
        fixture.componentRef.setInput('showLegend', false);
        fixture.detectChanges();
        expect(
            fixture.nativeElement.querySelector('ui-chart-tooltip'),
        ).toBeNull();
        expect(fixture.nativeElement.querySelector('ui-chart-legend')).toBeNull();
    });
});
