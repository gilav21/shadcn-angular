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

    it('renders one bar per data point', async () => {
        await createFixture();
        expect(
            fixture.nativeElement.querySelectorAll(
                'rect[data-slot="waterfall-bar"]',
            ),
        ).toHaveLength(4);
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

    it('renders connectors between consecutive bars when enabled', async () => {
        await createFixture();
        expect(component.connectors()).toHaveLength(3);
        expect(
            fixture.nativeElement.querySelectorAll(
                'line[data-slot="waterfall-connector"]',
            ),
        ).toHaveLength(3);
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
        const before = fixture.nativeElement.querySelectorAll('svg text').length;
        fixture.componentRef.setInput('showValues', true);
        fixture.detectChanges();
        const after = fixture.nativeElement.querySelectorAll('svg text').length;
        expect(after).toBeGreaterThan(before);
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

    it('renders y-axis gridline ticks', async () => {
        await createFixture();
        expect(component.yTicks().length).toBeGreaterThan(1);
        const gridLines = fixture.nativeElement.querySelectorAll(
            'line:not([data-slot="waterfall-connector"])',
        );
        expect(gridLines.length).toBeGreaterThan(0);
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

    it('returns empty tooltip rows and no title when nothing is hovered', async () => {
        await createFixture();
        expect(component.tooltipRows()).toEqual([]);
        expect(component.hoverTitle()).toBeUndefined();
    });

    it('returns empty tooltip rows when the hovered index is out of range', async () => {
        await createFixture();
        component.setHover(99);
        expect(component.tooltipRows()).toEqual([]);
    });

    it('shows the tooltip when hovering and hides it on leave', async () => {
        await createFixture();
        component.setHover(2);
        fixture.detectChanges();
        expect(component.hovered()).toBe(2);
        component.onPointerLeave();
        expect(component.hovered()).toBeNull();
    });

    it('does not render the tooltip element when showTooltip is false', async () => {
        await createFixture();
        fixture.componentRef.setInput('showTooltip', false);
        fixture.detectChanges();
        expect(
            fixture.nativeElement.querySelector('ui-chart-tooltip'),
        ).toBeNull();
    });

    it('updates hover and tooltip position on pointer move', async () => {
        await createFixture();
        const event = new MouseEvent('mousemove', {
            clientX: 300,
            clientY: 100,
        });
        component.onPointerMove(event);
        expect(component.hovered()).not.toBeNull();
        expect(component.tooltipPos().x).toBeGreaterThan(0);
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

        it('reports isRtl false when dir is ltr', async () => {
            await createFixture();
            fixture.componentRef.setInput('dir', 'ltr');
            fixture.detectChanges();
            expect(component.isRtl()).toBe(false);
        });

        it('falls back to the DOM direction when dir is auto', async () => {
            await createFixture();
            fixture.componentRef.setInput('dir', 'auto');
            fixture.detectChanges();
            expect(component.isRtl()).toBe(false);
        });
    });
});
