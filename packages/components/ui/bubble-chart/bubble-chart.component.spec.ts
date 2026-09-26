import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BubbleChartComponent } from './bubble-chart.component';
import { XYZSeries, ChartClickEvent, XYZDataPoint } from '../../lib/chart.types';

interface Restorable {
    proto: object;
    key: string;
    had: boolean;
    original: unknown;
}

const stubbed: Restorable[] = [];

function stubProto(proto: object, key: string, value: unknown): void {
    const had = Object.prototype.hasOwnProperty.call(proto, key);
    stubbed.push({ proto, key, had, original: (proto as Record<string, unknown>)[key] });
    Object.defineProperty(proto, key, { value, configurable: true, writable: true });
}

function restoreStubs(): void {
    while (stubbed.length) {
        const s = stubbed.pop()!;
        if (s.had) {
            Object.defineProperty(s.proto, s.key, {
                value: s.original,
                configurable: true,
                writable: true,
            });
        } else {
            delete (s.proto as Record<string, unknown>)[s.key];
        }
    }
}

class FakeResizeObserver {
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

describe('BubbleChartComponent', () => {
    let component: BubbleChartComponent;
    let fixture: ComponentFixture<BubbleChartComponent>;

    const series: XYZSeries[] = [
        {
            name: 'Markets',
            points: [
                { x: 1, y: 2, z: 5 },
                { x: 3, y: 5, z: 50 },
                { x: 5, y: 1, z: 20 },
            ],
        },
        {
            id: 'trade',
            name: 'Trade',
            color: '#ff0000',
            points: [
                { x: 2, y: 4, z: 10 },
                { x: 4, y: 6, z: 30 },
            ],
        },
    ];

    beforeEach(() => {
        vi.stubGlobal('ResizeObserver', FakeResizeObserver);
        vi.stubGlobal(
            'matchMedia',
            vi.fn().mockReturnValue({
                matches: false,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
            }),
        );
        stubProto(
            Element.prototype,
            'getBoundingClientRect',
            vi.fn().mockReturnValue({ left: 0, top: 0, width: 540, height: 340 }),
        );
        stubProto(SVGElement.prototype, 'getBBox', vi.fn().mockReturnValue({ x: 0, y: 0, width: 10, height: 10 }));
    });

    afterEach(() => {
        restoreStubs();
        vi.unstubAllGlobals();
    });

    async function setup(input: XYZSeries[] = series): Promise<void> {
        await TestBed.configureTestingModule({
            imports: [BubbleChartComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(BubbleChartComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('series', input);
        fixture.detectChanges();
    }

    const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
    const svg = (): SVGSVGElement => root().querySelector('svg')!;
    /** The rendered bubble whose aria-label names this data point. */
    const circle = (label: string): SVGCircleElement =>
        root().querySelector<SVGCircleElement>(`circle[aria-label="${label}"]`)!;
    const tooltip = (): HTMLElement | null => root().querySelector('[data-slot="chart-tooltip"]');

    /** A real mouse event at a bubble's centre, mapped from viewBox units to client pixels. */
    function mouseAt(type: string, target: SVGCircleElement): MouseEvent {
        const rect = svg().getBoundingClientRect();
        const box = svg().viewBox.baseVal;
        const cx = Number(target.getAttribute('cx'));
        const cy = Number(target.getAttribute('cy'));
        return new MouseEvent(type, {
            bubbles: true,
            clientX: rect.left + (cx / box.width) * rect.width,
            clientY: rect.top + (cy / box.height) * rect.height,
        });
    }

    it('renders with an accessible Bubble chart label', async () => {
        await setup();
        const c = fixture.nativeElement.querySelector('[role="group"]');
        expect(c.getAttribute('aria-label')).toContain('Bubble chart');
    });

    it('renders one bubble per visible point across series', async () => {
        await setup();
        expect(
            fixture.nativeElement.querySelectorAll('circle[data-slot="bubble-point"]'),
        ).toHaveLength(5);
    });

    it('maps larger z values to larger radii', async () => {
        await setup();
        const bubbles = component.bubbles();
        const big = bubbles.find(b => b.datum.z === 50)!;
        const small = bubbles.find(b => b.datum.z === 5)!;
        expect(big.r).toBeGreaterThan(small.r);
    });

    it('maps the z extremes onto minRadius and maxRadius', async () => {
        await setup();
        fixture.componentRef.setInput('minRadius', 4);
        fixture.componentRef.setInput('maxRadius', 20);
        fixture.detectChanges();
        const bubbles = component.bubbles();
        expect(bubbles.find(b => b.datum.z === 5)!.r).toBe(4);
        expect(bubbles.find(b => b.datum.z === 50)!.r).toBe(20);
    });

    it('uses palette colors by index and a custom series color', async () => {
        await setup();
        const bubbles = component.bubbles();
        const custom = bubbles.find(b => b.seriesIndex === 1)!;
        expect(custom.color).toBe('#ff0000');
        const paletteColor = bubbles.find(b => b.seriesIndex === 0)!.color;
        expect(paletteColor).toMatch(/hsl\(|#/);
    });

    it('builds legend items keyed by id or name', async () => {
        await setup();
        const items = component.legendItems();
        expect(items.map(i => i.key)).toEqual(['Markets', 'trade']);
        expect(items[1].color).toBe('#ff0000');
    });

    it('renders y-axis ticks with grid lines when enabled', async () => {
        await setup();
        const ticks = component.yTicks();
        const lines = [...root().querySelectorAll('line[data-slot="grid-line"]')];
        expect(lines.map(l => Number(l.getAttribute('y1')))).toEqual(ticks.map(t => t.y));
        expect([...svg().querySelectorAll('text')].map(t => t.textContent!.trim()))
            .toEqual(ticks.map(t => String(t.value)));
    });

    it('omits grid lines when showGrid is false', async () => {
        await setup();
        fixture.componentRef.setInput('showGrid', false);
        fixture.detectChanges();
        expect(
            fixture.nativeElement.querySelectorAll('line[data-slot="grid-line"]'),
        ).toHaveLength(0);
    });

    it('includes the z magnitude in the tooltip', async () => {
        await setup();
        component.setHover(0, 1); // z = 50
        const rows = component.tooltipRows();
        expect(rows.some(r => r.value.includes('50'))).toBe(true);
        expect(component.hoverTitle()).toBe('Markets');
    });

    it('returns no tooltip rows or title when nothing is hovered', async () => {
        await setup();
        component.setHover(null);
        expect(component.tooltipRows()).toEqual([]);
        expect(component.hoverTitle()).toBeUndefined();
    });

    it('returns no tooltip rows when the hovered series/point is out of range', async () => {
        await setup();
        component.setHover(99, 99);
        expect(component.tooltipRows()).toEqual([]);
    });

    it('hides a series when toggled off, then restores it when toggled on', async () => {
        await setup();
        component.toggleSeries('Markets');
        fixture.detectChanges();
        expect(component.hiddenSeries()).toContain('Markets');
        expect(
            fixture.nativeElement.querySelectorAll('circle[data-slot="bubble-point"]'),
        ).toHaveLength(2);

        component.toggleSeries('Markets');
        fixture.detectChanges();
        expect(component.hiddenSeries()).not.toContain('Markets');
        expect(
            fixture.nativeElement.querySelectorAll('circle[data-slot="bubble-point"]'),
        ).toHaveLength(5);
    });

    it('falls back to a default domain and radii for empty data', async () => {
        await setup([]);
        expect(component.bubbles()).toEqual([]);
        expect(component.legendItems()).toEqual([]);
        expect(component.yTicks().length).toBeGreaterThan(0);
    });

    it('clamps radii to minRadius when all z values are equal', async () => {
        await setup([{ name: 'Flat', points: [{ x: 1, y: 1, z: 7 }, { x: 2, y: 2, z: 7 }] }]);
        expect(component.bubbles().map(b => b.r)).toEqual([6, 6]);
    });

    it('mirrors the x axis and the tick labels for an explicit dir', async () => {
        await setup();
        const cx = (label: string): number => Number(circle(label).getAttribute('cx'));
        const anchors = (): string[] => [...svg().querySelectorAll('text')].map(t => t.getAttribute('text-anchor')!);

        fixture.componentRef.setInput('dir', 'rtl');
        fixture.detectChanges();
        expect(cx('Markets: (1, 2, 5)')).toBeGreaterThan(cx('Markets: (5, 1, 20)'));
        expect(new Set(anchors())).toEqual(new Set(['start']));

        fixture.componentRef.setInput('dir', 'ltr');
        fixture.detectChanges();
        expect(cx('Markets: (1, 2, 5)')).toBeLessThan(cx('Markets: (5, 1, 20)'));
        expect(new Set(anchors())).toEqual(new Set(['end']));
    });

    it('highlights the bubble under the pointer and shows its tooltip', async () => {
        await setup();
        const target = circle('Markets: (3, 5, 50)');
        svg().dispatchEvent(mouseAt('mousemove', target));
        fixture.detectChanges();

        expect(target.getAttribute('fill-opacity')).toBe('0.85');
        expect(circle('Trade: (4, 6, 30)').getAttribute('fill-opacity')).toBe('0.55');
        expect(tooltip()?.textContent).toContain('Markets');
        expect(tooltip()?.textContent).toContain('50');
    });

    it('ignores pointer move when there are no bubbles', async () => {
        await setup([]);
        svg().dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 10, clientY: 10 }));
        fixture.detectChanges();
        expect(tooltip()).toBeNull();
    });

    it('clears hover on pointer leave', async () => {
        await setup();
        const target = circle('Markets: (3, 5, 50)');
        svg().dispatchEvent(mouseAt('mousemove', target));
        fixture.detectChanges();
        expect(tooltip()).not.toBeNull();

        svg().dispatchEvent(new MouseEvent('mouseleave'));
        fixture.detectChanges();
        expect(target.getAttribute('fill-opacity')).toBe('0.55');
        expect(tooltip()).toBeNull();
    });

    it('emits pointClick on click and on Enter, and stays silent for an invalid point', async () => {
        await setup();
        const events: ChartClickEvent<XYZDataPoint>[] = [];
        component.pointClick.subscribe(e => events.push(e));

        circle('Markets: (3, 5, 50)').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        circle('Trade: (2, 4, 10)').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(events).toEqual([
            { point: { x: 3, y: 5, z: 50 }, index: 1 },
            { point: { x: 2, y: 4, z: 10 }, index: 0 },
        ]);

        component.onPointClick(99, 99);
        expect(events).toHaveLength(2);
    });
});
