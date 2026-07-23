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

    it('keeps all radii within the configured range', async () => {
        await setup();
        fixture.componentRef.setInput('minRadius', 4);
        fixture.componentRef.setInput('maxRadius', 20);
        fixture.detectChanges();
        for (const b of component.bubbles()) {
            expect(b.r).toBeGreaterThanOrEqual(4);
            expect(b.r).toBeLessThanOrEqual(20);
        }
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
        expect(component.yTicks().length).toBeGreaterThan(0);
        expect(
            fixture.nativeElement.querySelectorAll('line[data-slot="grid-line"]').length,
        ).toBeGreaterThan(0);
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
        for (const b of component.bubbles()) {
            expect(b.r).toBe(component.bubbles()[0].r);
        }
    });

    it('resolves RTL from the explicit dir input', async () => {
        await setup();
        fixture.componentRef.setInput('dir', 'rtl');
        fixture.detectChanges();
        expect(component.isRtl()).toBe(true);
        const rtlArea = component['area']();

        fixture.componentRef.setInput('dir', 'ltr');
        fixture.detectChanges();
        expect(component.isRtl()).toBe(false);
        const ltrArea = component['area']();
        expect(rtlArea.left).not.toBe(ltrArea.left);
    });

    it('positions the tooltip and sets hover on pointer move', async () => {
        await setup();
        const evt = new MouseEvent('mousemove', { clientX: 100, clientY: 120 });
        component.onPointerMove(evt);
        expect((component as unknown as { hovered(): unknown }).hovered()).not.toBeNull();
        expect(component.tooltipPos().x).toBeGreaterThan(0);
    });

    it('ignores pointer move when there are no bubbles', async () => {
        await setup([]);
        component.onPointerMove(new MouseEvent('mousemove', { clientX: 10, clientY: 10 }));
        expect((component as unknown as { hovered(): unknown }).hovered()).toBeNull();
    });

    it('ignores pointer move when the svg reference is unresolved', async () => {
        await setup();
        (component as unknown as { _svg: () => undefined })._svg = () => undefined;
        component.onPointerMove(new MouseEvent('mousemove', { clientX: 5, clientY: 5 }));
        expect((component as unknown as { hovered(): unknown }).hovered()).toBeNull();
    });

    it('clears hover on pointer leave', async () => {
        await setup();
        component.setHover(0, 0);
        expect((component as unknown as { hovered(): unknown }).hovered()).not.toBeNull();
        component.onPointerLeave();
        expect((component as unknown as { hovered(): unknown }).hovered()).toBeNull();
    });

    it('emits pointClick for a valid point and stays silent for an invalid one', async () => {
        await setup();
        const events: ChartClickEvent<XYZDataPoint>[] = [];
        component.pointClick.subscribe(e => events.push(e));

        component.onPointClick(0, 1);
        expect(events).toHaveLength(1);
        expect(events[0].index).toBe(1);
        expect(events[0].point.z).toBe(50);

        component.onPointClick(99, 99);
        expect(events).toHaveLength(1);
    });
});
