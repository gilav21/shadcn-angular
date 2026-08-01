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

    it('produces area path d-attributes with move + line commands', () => {
        const area = fixture.nativeElement.querySelector('path[data-slot="area-series"]');
        const d = area.getAttribute('d') ?? '';
        expect(d).toMatch(/^M/);
        expect(d).toContain('L');
    });

    it('exposes nice y-axis ticks starting at zero', () => {
        expect(component.yTicks()[0]).toBe(0);
        expect(component.yTicks().length).toBeGreaterThan(1);
    });

    it('uses each series max for the y-domain when not stacked', () => {
        expect(component.yDomainMax()).toBe(200);
    });

    it('uses category totals for the y-domain when stacked', () => {
        fixture.componentRef.setInput('stacked', true);
        fixture.detectChanges();
        expect(component.yDomainMax()).toBeGreaterThanOrEqual(320);
    });

    it('normalizes the stacked percent domain to 100', () => {
        fixture.componentRef.setInput('stacked', true);
        fixture.componentRef.setInput('stackingMode', 'percent');
        fixture.detectChanges();
        expect(component.yDomainMax()).toBe(100);
    });

    it('builds stacked band area paths', () => {
        fixture.componentRef.setInput('stacked', true);
        fixture.detectChanges();
        expect(
            fixture.nativeElement.querySelectorAll('path[data-slot="area-series"]'),
        ).toHaveLength(2);
        const d = fixture.nativeElement
            .querySelector('path[data-slot="area-series"]')
            .getAttribute('d');
        expect(d).toMatch(/^M/);
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
        expect(
            fixture.nativeElement.querySelectorAll('path[data-slot="area-series"]'),
        ).toHaveLength(1);
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

    it('returns no tooltip rows and no hover title when nothing is hovered', () => {
        expect(component.tooltipRows()).toHaveLength(0);
        expect(component.hoverTitle()).toBeUndefined();
        expect(component.crosshairX()).toBeNull();
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
        expect(component.hoveredIndex()).not.toBeNull();
        expect(component.tooltipPos().x).toBeGreaterThan(0);
    });

    it('clears hover state on pointer leave', () => {
        component.setHover(1);
        component.onPointerLeave();
        expect(component.hoveredIndex()).toBeNull();
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

    it('resolves rtl layout from the dir input', () => {
        fixture.componentRef.setInput('dir', 'rtl');
        fixture.detectChanges();
        expect(component.isRtl()).toBe(true);
    });

    it('forces ltr layout when dir is ltr', () => {
        fixture.componentRef.setInput('dir', 'ltr');
        fixture.detectChanges();
        expect(component.isRtl()).toBe(false);
    });
});
