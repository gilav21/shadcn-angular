import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
    describe,
    it,
    expect,
    vi,
    beforeEach,
    afterEach,
} from 'vitest';
import { WaterfallChartComponent } from './waterfall-chart.component';
import { WaterfallBar, ChartClickEvent } from '../../lib/chart.types';

class ResizeObserverStub {
    observe(): void {
        /* no-op: jsdom has no layout, so no resize callbacks fire */
    }
    disconnect(): void {
        /* no-op */
    }
}

interface GlobalWithBrowserApis {
    ResizeObserver?: unknown;
    matchMedia?: unknown;
}

const globalWithApis = globalThis as unknown as GlobalWithBrowserApis;
const originalResizeObserver = globalWithApis.ResizeObserver;
const originalMatchMedia = globalWithApis.matchMedia;
const originalGetBBox = (
    SVGElement.prototype as unknown as { getBBox?: unknown }
).getBBox;
const originalGetBoundingClientRect =
    Element.prototype.getBoundingClientRect;

const boundingRect: DOMRect = {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 520,
    bottom: 320,
    width: 520,
    height: 320,
    toJSON: () => ({}),
};

describe('WaterfallChartComponent', () => {
    let component: WaterfallChartComponent;
    let fixture: ComponentFixture<WaterfallChartComponent>;

    const data: WaterfallBar[] = [
        { name: 'Q1', value: 500 },
        { name: 'Q2', value: 300 },
        { name: 'Q3', value: -200 },
        { name: 'Total', value: 600, type: 'total' },
    ];

    async function createFixture(input: WaterfallBar[] = data): Promise<void> {
        await TestBed.configureTestingModule({
            imports: [WaterfallChartComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(WaterfallChartComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('data', input);
        fixture.detectChanges();
    }

    beforeEach(() => {
        globalWithApis.ResizeObserver = ResizeObserverStub;
        globalWithApis.matchMedia = vi.fn().mockReturnValue({
            matches: false,
            media: '',
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        });
        (
            SVGElement.prototype as unknown as { getBBox: () => DOMRect }
        ).getBBox = () => boundingRect;
        Element.prototype.getBoundingClientRect = () => boundingRect;
    });

    afterEach(() => {
        globalWithApis.ResizeObserver = originalResizeObserver;
        globalWithApis.matchMedia = originalMatchMedia;
        if (originalGetBBox === undefined) {
            delete (SVGElement.prototype as unknown as { getBBox?: unknown })
                .getBBox;
        } else {
            (SVGElement.prototype as unknown as { getBBox?: unknown }).getBBox =
                originalGetBBox;
        }
        Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    });

    it('renders with an accessible Waterfall chart label', async () => {
        await createFixture();
        const c = fixture.nativeElement.querySelector('[role="group"]');
        expect(c.getAttribute('aria-label')).toContain('Waterfall chart');
    });

    it('includes a provided title in the aria-label', async () => {
        await createFixture();
        fixture.componentRef.setInput('title', 'Revenue bridge');
        fixture.detectChanges();
        const c = fixture.nativeElement.querySelector('[role="group"]');
        expect(c.getAttribute('aria-label')).toContain('Revenue bridge');
    });

    it('renders one labelled bar per data point', async () => {
        await createFixture();
        const bars: SVGRectElement[] = Array.from(
            fixture.nativeElement.querySelectorAll('rect[data-slot="waterfall-bar"]'),
        );
        expect(bars.map(b => b.getAttribute('aria-label'))).toEqual([
            'Q1: 500 (total 500)',
            'Q2: 300 (total 800)',
            'Q3: -200 (total 600)',
            'Total: 600 (total 600)',
        ]);
    });

    it('accumulates running totals across relative bars', async () => {
        await createFixture();
        const bars = component.bars();
        expect(bars[0].toLevel).toBe(500);
        expect(bars[1].fromLevel).toBe(500);
        expect(bars[1].toLevel).toBe(800);
        expect(bars[2].toLevel).toBe(600);
    });

    it('treats a total bar as an absolute column from zero', async () => {
        await createFixture();
        const total = component.bars()[3];
        expect(total.fromLevel).toBe(0);
        expect(total.toLevel).toBe(600);
    });

    it('colors increases, decreases, totals, and custom bars', async () => {
        await createFixture([
            { name: 'Up', value: 500 },
            { name: 'Down', value: -200 },
            { name: 'End', value: 300, type: 'total' },
            { name: 'Custom', value: 100, color: '#123456' },
        ]);
        const bars = component.bars();
        expect(bars[0].color).toBe(component.positiveColor());
        expect(bars[1].color).toBe(component.negativeColor());
        expect(bars[2].color).toBe(component.totalColor());
        expect(bars[3].color).toBe('#123456');
    });

    it('respects custom positive/negative/total color inputs', async () => {
        await createFixture();
        fixture.componentRef.setInput('positiveColor', '#00ff00');
        fixture.componentRef.setInput('negativeColor', '#ff0000');
        fixture.componentRef.setInput('totalColor', '#0000ff');
        fixture.detectChanges();
        const bars = component.bars();
        expect(bars[0].color).toBe('#00ff00');
        expect(bars[2].color).toBe('#ff0000');
        expect(bars[3].color).toBe('#0000ff');
    });

    it('connects each bar at its closing level to the next bar', async () => {
        await createFixture();
        const num = (el: Element, attr: string): number => Number(el.getAttribute(attr));
        const bars: Element[] = Array.from(
            fixture.nativeElement.querySelectorAll('rect[data-slot="waterfall-bar"]'),
        );
        const lines: Element[] = Array.from(
            fixture.nativeElement.querySelectorAll('line[data-slot="waterfall-connector"]'),
        );
        expect(lines).toHaveLength(3);
        lines.forEach((line, i) => {
            const bar = bars[i];
            // A rise closes at the bar's top edge, a fall at its bottom edge.
            const closingY = data[i].value >= 0 ? num(bar, 'y') : num(bar, 'y') + num(bar, 'height');
            expect(num(line, 'x1')).toBeCloseTo(num(bar, 'x') + num(bar, 'width'), 6);
            expect(num(line, 'x2')).toBeCloseTo(num(bars[i + 1], 'x'), 6);
            expect(num(line, 'y1')).toBeCloseTo(closingY, 6);
            expect(num(line, 'y2')).toBeCloseTo(closingY, 6);
        });
    });

    it('hides connectors when showConnectors is false', async () => {
        await createFixture();
        fixture.componentRef.setInput('showConnectors', false);
        fixture.detectChanges();
        expect(
            fixture.nativeElement.querySelectorAll(
                'line[data-slot="waterfall-connector"]',
            ),
        ).toHaveLength(0);
    });

    it('renders value labels when showValues is enabled', async () => {
        await createFixture();
        const texts = (): string[] => Array.from(
            fixture.nativeElement.querySelectorAll('svg text'),
            t => (t as Element).textContent!.trim(),
        );
        const before = texts();
        fixture.componentRef.setInput('showValues', true);
        fixture.detectChanges();
        const added = texts();
        for (const t of before) added.splice(added.indexOf(t), 1);
        expect(added).toEqual(['500', '300', '-200', '600']);
    });

    it('scales the y-domain to include negative running levels', async () => {
        await createFixture([
            { name: 'Start', value: 100 },
            { name: 'Drop', value: -400 },
            { name: 'End', value: 50, type: 'total' },
        ]);
        const ticks = component.yTicks();
        const values = ticks.map(t => t.value);
        expect(Math.min(...values)).toBeLessThan(0);
        const bars = component.bars();
        expect(bars[1].height).toBeGreaterThan(0);
    });

    it('renders one labelled gridline per y-axis tick', async () => {
        await createFixture();
        const ticks = component.yTicks();
        const gridLines: Element[] = Array.from(fixture.nativeElement.querySelectorAll(
            'line:not([data-slot="waterfall-connector"])',
        ));
        const tickLabels: Element[] = Array.from(fixture.nativeElement.querySelectorAll('svg text[x="4"]'));
        expect(ticks.map(t => t.value)).toContain(800);
        expect(gridLines.map(l => Number(l.getAttribute('y1')))).toEqual(ticks.map(t => t.y));
        expect(tickLabels.map(t => t.textContent!.trim())).toEqual(ticks.map(t => String(t.value)));
    });

    it('renders category name labels for each bar', async () => {
        await createFixture();
        const texts = Array.from(
            fixture.nativeElement.querySelectorAll('svg text'),
        ).map(t => (t as HTMLElement).textContent?.trim());
        expect(texts).toContain('Q1');
        expect(texts).toContain('Total');
    });

    it('builds a tooltip row for the hovered bar', async () => {
        await createFixture();
        component.setHover(1);
        expect(component.tooltipRows()[0].value).toContain('300');
        expect(component.tooltipRows()[1].label).toBe('Total');
        expect(component.hoverTitle()).toContain('Q2');
    });

    it('returns empty tooltip rows when the hovered index is out of range', async () => {
        await createFixture();
        component.setHover(99);
        expect(component.tooltipRows()).toEqual([]);
    });

    /** clientX over bar i's centre: the stubbed svg rect is 520px wide, the viewBox svgWidth(). */
    function clientXOverBar(i: number): number {
        return (component.bars()[i].centerX * boundingRect.width) / component.svgWidth();
    }

    it('shows the tooltip for the bar under the pointer and hides it on leave', async () => {
        await createFixture();
        const svg = fixture.nativeElement.querySelector('svg') as SVGSVGElement;
        const tooltip = (): HTMLElement | null => fixture.nativeElement.querySelector('[data-slot="chart-tooltip"]');
        expect(tooltip()).toBeNull();

        svg.dispatchEvent(new MouseEvent('mousemove', { clientX: clientXOverBar(2), clientY: 100 }));
        fixture.detectChanges();
        expect(tooltip()!.textContent).toContain('Q3');

        svg.dispatchEvent(new MouseEvent('mouseleave'));
        fixture.detectChanges();
        expect(tooltip()).toBeNull();
    });

    it('does not render the tooltip element when showTooltip is false', async () => {
        await createFixture();
        fixture.componentRef.setInput('showTooltip', false);
        fixture.detectChanges();
        expect(
            fixture.nativeElement.querySelector('ui-chart-tooltip'),
        ).toBeNull();
    });

    it('hovers the nearest bar and anchors the tooltip 12px past its centre', async () => {
        await createFixture();
        const target = component.bars()[2];
        // A few px right of bar 2's centre is still nearer to it than to bar 3.
        const event = new MouseEvent('mousemove', {
            clientX: clientXOverBar(2) + 5,
            clientY: 100,
        });
        component.onPointerMove(event);
        expect(component.hovered()).toBe(2);
        expect(component.tooltipPos().x).toBeCloseTo(target.centerX + 12, 6);
    });

    it('emits barClick with the point and index for a valid bar', async () => {
        await createFixture();
        let emitted: ChartClickEvent | undefined;
        component.barClick.subscribe(v => (emitted = v));
        component.onBarClick(2);
        expect(emitted).toBeDefined();
        expect(emitted!.index).toBe(2);
        expect(emitted!.point).toEqual({ name: 'Q3', value: -200 });
    });

    it('does not emit barClick for an out-of-range index', async () => {
        await createFixture();
        let emitted: ChartClickEvent | undefined;
        component.barClick.subscribe(v => (emitted = v));
        component.onBarClick(99);
        expect(emitted).toBeUndefined();
    });

    it('renders no bars or connectors for empty data', async () => {
        await createFixture([]);
        expect(component.bars()).toEqual([]);
        expect(component.connectors()).toEqual([]);
        expect(
            fixture.nativeElement.querySelectorAll(
                'rect[data-slot="waterfall-bar"]',
            ),
        ).toHaveLength(0);
    });

    it('ignores pointer moves when there are no category centers', async () => {
        await createFixture([]);
        const event = new MouseEvent('mousemove', {
            clientX: 100,
            clientY: 100,
        });
        component.onPointerMove(event);
        expect(component.hovered()).toBeNull();
    });

    describe('RTL', () => {
        it('reports isRtl true when dir is rtl and lays bars right-to-left', async () => {
            await createFixture();
            fixture.componentRef.setInput('dir', 'rtl');
            fixture.detectChanges();
            expect(component.isRtl()).toBe(true);
            const bars = component.bars();
            expect(bars[0].x).toBeGreaterThan(bars[3].x);
        });
    });
});
