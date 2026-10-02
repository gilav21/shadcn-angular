import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
    describe,
    it,
    expect,
    beforeEach,
    afterEach,
    vi,
} from 'vitest';
import { AreaChartComponent } from './area-chart.component';
import { ChartSeries, ChartClickEvent } from '../../lib/chart.types';
import { getChartColor } from '../../lib/chart.utils';

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

describe('AreaChartComponent', () => {
    let component: AreaChartComponent;
    let fixture: ComponentFixture<AreaChartComponent>;

    const series: ChartSeries[] = [
        { name: 'Desktop', data: [{ name: 'Q1', value: 100 }, { name: 'Q2', value: 200 }] },
        { name: 'Mobile', data: [{ name: 'Q1', value: 50 }, { name: 'Q2', value: 120 }] },
    ];

    let bboxDescriptor: PropertyDescriptor | undefined;
    let rectDescriptor: PropertyDescriptor | undefined;

    beforeEach(async () => {
        vi.stubGlobal('ResizeObserver', ResizeObserverStub);

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
                right: 500,
                bottom: 300,
                width: 500,
                height: 300,
                toJSON: () => ({}),
            }),
        });

        await TestBed.configureTestingModule({
            imports: [AreaChartComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(AreaChartComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('series', series);
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
            delete (SVGElement.prototype as unknown as Record<string, unknown>)['getBBox'];
        }
        if (rectDescriptor) {
            Object.defineProperty(
                Element.prototype,
                'getBoundingClientRect',
                rectDescriptor,
            );
        }
        vi.unstubAllGlobals();
    });

    it('renders with an accessible Area chart label', () => {
        const container = fixture.nativeElement.querySelector('[role="group"]');
        expect(container.getAttribute('aria-label')).toContain('Area chart');
    });

    it('includes the title in the accessible label', () => {
        fixture.componentRef.setInput('title', 'Traffic');
        fixture.detectChanges();
        const container = fixture.nativeElement.querySelector('[role="group"]');
        expect(container.getAttribute('aria-label')).toContain('Traffic');
    });

    it('renders one area path per visible series', () => {
        expect(
            fixture.nativeElement.querySelectorAll('path[data-slot="area-series"]'),
        ).toHaveLength(2);
    });

    it('renders y-axis grid lines and category ticks', () => {
        expect(
            fixture.nativeElement.querySelectorAll('line[data-slot="grid-line"]').length,
        ).toBeGreaterThan(0);
        const labels = Array.from(
            fixture.nativeElement.querySelectorAll('text'),
        ).map((t) => (t as SVGTextElement).textContent);
        expect(labels).toContain('Q1');
        expect(labels).toContain('Q2');
    });

    it('hides grid lines when showGrid is false', () => {
        fixture.componentRef.setInput('showGrid', false);
        fixture.detectChanges();
        expect(
            fixture.nativeElement.querySelectorAll('line[data-slot="grid-line"]'),
        ).toHaveLength(0);
    });

    it('draws the Desktop area through its values and closes it on the baseline', () => {
        const area = fixture.nativeElement.querySelector('path[data-slot="area-series"]');
        // The plot spans x 44..(width - 12) and y 12..272 over the domain 0..200
        // (the width is the measured host width in a browser, 500 in jsdom):
        // Q1=100 sits mid-height, Q2=200 at the top-right corner.
        const right = component.svgWidth() - 12;
        expect(area.getAttribute('d')).toBe(`M 44 142 L ${right} 12 L ${right} 272 L 44 272 Z`);
    });

    it('exposes nice y-axis ticks from zero to the domain max', () => {
        expect(component.yTicks()).toEqual([0, 50, 100, 150, 200]);
    });

    it('uses each series max for the y-domain when not stacked', () => {
        expect(component.yDomainMax()).toBe(200);
    });

    it('uses category totals for the y-domain when stacked', () => {
        fixture.componentRef.setInput('stacked', true);
        fixture.detectChanges();
        expect(component.yDomainMax()).toBe(320);
    });

    it('normalizes the stacked percent domain to 100', () => {
        fixture.componentRef.setInput('stacked', true);
        fixture.componentRef.setInput('stackingMode', 'percent');
        fixture.detectChanges();
        expect(component.yDomainMax()).toBe(100);
    });

    it('stacks the Mobile band on top of the Desktop band', () => {
        fixture.componentRef.setInput('stacked', true);
        fixture.detectChanges();
        const points = (el: Element): string[] =>
            (el.getAttribute('d') ?? '').split(/[A-Z]/).map(p => p.trim()).filter(Boolean);
        const [desktop, mobile] = Array.from(
            fixture.nativeElement.querySelectorAll('path[data-slot="area-series"]'),
        ) as Element[];
        const desktopTop = points(desktop).slice(0, 2);
        // Desktop's band rests on the baseline; Mobile's lower edge (traced back
        // right-to-left) retraces Desktop's upper edge.
        expect(points(desktop).slice(2)).toEqual([`${component.svgWidth() - 12} 272`, '44 272']);
        expect(points(mobile).slice(2)).toEqual([...desktopTop].reverse());
        expect(points(mobile).slice(0, 2)).not.toEqual(desktopTop);
    });

    it('falls back to a domain of 1 when all series are hidden', () => {
        component.toggleSeries('Desktop');
        component.toggleSeries('Mobile');
        fixture.detectChanges();
        expect(component.yDomainMax()).toBe(1);
        expect(
            fixture.nativeElement.querySelectorAll('path[data-slot="area-series"]'),
        ).toHaveLength(0);
    });

    it('hides a series when toggled off via the legend', () => {
        component.toggleSeries('Mobile');
        fixture.detectChanges();
        const areas = fixture.nativeElement.querySelectorAll('path[data-slot="area-series"]');
        expect(areas).toHaveLength(1);
        expect(areas[0].getAttribute('fill')).toBe(getChartColor(0));
        component.setHover(1);
        expect(component.tooltipRows().map((r) => r.label)).toEqual(['Desktop']);
    });

    it('re-shows a series when toggled back on', () => {
        component.toggleSeries('Mobile');
        component.toggleSeries('Mobile');
        fixture.detectChanges();
        expect(component.hiddenSeries()).toHaveLength(0);
        expect(
            fixture.nativeElement.querySelectorAll('path[data-slot="area-series"]'),
        ).toHaveLength(2);
    });

    it('applies the configured fill opacity to areas', () => {
        fixture.componentRef.setInput('fillOpacity', 0.5);
        fixture.detectChanges();
        const area = fixture.nativeElement.querySelector('path[data-slot="area-series"]');
        expect(area.getAttribute('fill-opacity')).toBe('0.5');
    });

    it('exposes legend items for every series', () => {
        expect(component.legendItems().map((l) => l.label)).toEqual([
            'Desktop',
            'Mobile',
        ]);
    });

    it('builds tooltip rows for the hovered category', () => {
        component.setHover(1);
        expect(component.tooltipRows().map((r) => r.label)).toEqual([
            'Desktop',
            'Mobile',
        ]);
        expect(component.tooltipRows()[0].value).toContain('200');
    });

    it('exposes the hovered category title and crosshair position', () => {
        component.setHover(0);
        expect(component.hoverTitle()).toBe('Q1');
        expect(component.crosshairX()).not.toBeNull();
    });

    it('emits the hovered point via pointHover', () => {
        const events: (ChartClickEvent | null)[] = [];
        component.pointHover.subscribe((e) => events.push(e));
        component.setHover(1);
        component.setHover(null);
        expect(events[0]?.index).toBe(1);
        expect(events[0]?.point.value).toBe(200);
        expect(events[1]).toBeNull();
    });

    it('updates hover state and tooltip position on pointer move', () => {
        const svg = fixture.nativeElement.querySelector('svg') as SVGSVGElement;
        svg.dispatchEvent(
            new MouseEvent('mousemove', { clientX: 480, clientY: 100 }),
        );
        fixture.detectChanges();
        // clientX 480 of the 500px rect is nearest the Q2 tick at the plot's
        // right edge (width - 12); the tooltip parks 12px past it.
        expect(component.hoveredIndex()).toBe(1);
        expect(component.tooltipPos().x).toBe(component.svgWidth());
    });

    it('clears hover state on pointer leave', () => {
        component.setHover(1);
        component.onPointerLeave();
        expect(component.hoveredIndex()).toBeNull();
        expect(component.tooltipRows()).toHaveLength(0);
        expect(component.hoverTitle()).toBeUndefined();
        expect(component.crosshairX()).toBeNull();
    });

    it('ignores pointer moves when there are no categories', () => {
        fixture.componentRef.setInput('series', [{ name: 'Empty', data: [] }]);
        fixture.detectChanges();
        const svg = fixture.nativeElement.querySelector('svg') as SVGSVGElement;
        svg.dispatchEvent(
            new MouseEvent('mousemove', { clientX: 100, clientY: 100 }),
        );
        expect(component.hoveredIndex()).toBeNull();
    });

    it('reverses the category axis when dir is rtl', () => {
        const labelX = (name: string): number => {
            const text = Array.from(
                fixture.nativeElement.querySelectorAll('text') as NodeListOf<SVGTextElement>,
            ).find((t) => t.textContent?.trim() === name);
            return Number(text?.getAttribute('x'));
        };
        expect(labelX('Q1')).toBeLessThan(labelX('Q2'));
        fixture.componentRef.setInput('dir', 'rtl');
        fixture.detectChanges();
        expect(labelX('Q1')).toBeGreaterThan(labelX('Q2'));
        fixture.componentRef.setInput('dir', 'ltr');
        fixture.detectChanges();
        expect(labelX('Q1')).toBeLessThan(labelX('Q2'));
    });
});
