import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FunnelChartComponent } from './funnel-chart.component';
import { ChartDataPoint, ChartClickEvent } from '../../lib/chart.types';

@Component({
    template: `<div style="width: 440px"><ui-funnel-chart [data]="data" /></div>`,
    imports: [FunnelChartComponent],
})
class SizedFunnelHost {
    readonly data: ChartDataPoint[] = [
        { name: 'Visits', value: 1000 },
        { name: 'Signups', value: 600 },
        { name: 'Trials', value: 300 },
        { name: 'Paid', value: 120 },
    ];
}

interface Restorable {
    proto: object;
    key: string;
    had: boolean;
    original: unknown;
}

describe('FunnelChartComponent', () => {
    let component: FunnelChartComponent;
    let fixture: ComponentFixture<FunnelChartComponent>;
    const restorables: Restorable[] = [];

    const data: ChartDataPoint[] = [
        { name: 'Visits', value: 1000 },
        { name: 'Signups', value: 600 },
        { name: 'Trials', value: 300 },
        { name: 'Paid', value: 120 },
    ];

    function stub(proto: object, key: string, value: unknown): void {
        const target = proto as Record<string, unknown>;
        restorables.push({
            proto,
            key,
            had: Object.prototype.hasOwnProperty.call(proto, key),
            original: target[key],
        });
        target[key] = value;
    }

    beforeEach(async () => {
        stub(SVGElement.prototype, 'getBBox', () => ({ x: 0, y: 0, width: 100, height: 20 }));
        stub(Element.prototype, 'getBoundingClientRect', () =>
            ({ x: 0, y: 0, top: 0, left: 0, right: 100, bottom: 40, width: 100, height: 40, toJSON: () => ({}) }),
        );
        stub(globalThis, 'ResizeObserver', class {
            observe(): void { /* noop */ }
            unobserve(): void { /* noop */ }
            disconnect(): void { /* noop */ }
        });
        stub(globalThis, 'matchMedia', (query: string) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: () => { /* noop */ },
            removeListener: () => { /* noop */ },
            addEventListener: () => { /* noop */ },
            removeEventListener: () => { /* noop */ },
            dispatchEvent: () => false,
        }) as unknown as MediaQueryList);

        await TestBed.configureTestingModule({
            imports: [FunnelChartComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(FunnelChartComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('data', data);
        fixture.detectChanges();
    });

    afterEach(() => {
        while (restorables.length) {
            const r = restorables.pop() as Restorable;
            const target = r.proto as Record<string, unknown>;
            if (r.had) {
                target[r.key] = r.original;
            } else {
                delete target[r.key];
            }
        }
    });

    it('includes the title in the aria label when provided', () => {
        fixture.componentRef.setInput('title', 'Conversion');
        fixture.detectChanges();
        const c = fixture.nativeElement.querySelector('[role="group"]');
        expect(c.getAttribute('aria-label')).toBe('Conversion. Funnel chart with 4 data points.');
    });

    it('renders one trapezoid per stage', () => {
        expect(fixture.nativeElement.querySelectorAll('polygon[data-slot="funnel-stage"]')).toHaveLength(4);
    });

    it('builds a 4-point trapezoid polygon per stage', () => {
        const sized = TestBed.createComponent(SizedFunnelHost);
        sized.detectChanges();
        expect(sized.nativeElement.querySelector('svg').getAttribute('viewBox')).toBe('0 0 440 300');

        const polygons = [...sized.nativeElement.querySelectorAll('polygon[data-slot="funnel-stage"]')] as SVGPolygonElement[];
        const actual = polygons.map(p => (p.getAttribute('points') ?? '').trim().split(' ').map(pt => pt.split(',').map(Number)));
        // width 440 / height 300 / gap 2: inner width 424 centred on 220, stage height 69.5.
        // The max stage spans the full inner width; each bottom edge is the next stage's top.
        const expected = [
            [[8, 8], [432, 8], [347.2, 77.5], [92.8, 77.5]],
            [[92.8, 79.5], [347.2, 79.5], [283.6, 149], [156.4, 149]],
            [[156.4, 151], [283.6, 151], [245.44, 220.5], [194.56, 220.5]],
            [[194.56, 222.5], [245.44, 222.5], [245.44, 292], [194.56, 292]],
        ];
        expect(actual).toHaveLength(expected.length);
        expected.forEach((stage, i) => stage.forEach(([x, y], j) => {
            expect(actual[i][j][0]).toBeCloseTo(x, 6);
            expect(actual[i][j][1]).toBeCloseTo(y, 6);
        }));
    });

    it('stacks stages vertically with increasing midY', () => {
        const midYs = component.stages().map(s => s.midY);
        for (let i = 1; i < midYs.length; i++) {
            expect(midYs[i]).toBeGreaterThan(midYs[i - 1]);
        }
    });

    it('assigns palette colors and honors custom color overrides', () => {
        const overridden: ChartDataPoint[] = [
            { name: 'A', value: 100, color: '#ff0000' },
            { name: 'B', value: 50 },
        ];
        fixture.componentRef.setInput('data', overridden);
        fixture.detectChanges();
        const stages = component.stages();
        expect(stages[0].color).toBe('#ff0000');
        expect(stages[1].color).toMatch(/^(#|hsl|rgb)/);
    });

    it('computes percentages relative to the first stage by default', () => {
        const stages = component.stages();
        expect(stages[0].percent).toBeCloseTo(100, 5);
        expect(stages[1].percent).toBeCloseTo(60, 5);
        expect(stages[3].percent).toBeCloseTo(12, 5);
    });

    it('computes percentages relative to the previous stage when configured', () => {
        fixture.componentRef.setInput('percentageMode', 'previous');
        fixture.detectChanges();
        const stages = component.stages();
        expect(stages[0].percent).toBeCloseTo(100, 5);
        expect(stages[1].percent).toBeCloseTo(60, 5); // 600/1000
        expect(stages[2].percent).toBeCloseTo(50, 5); // 300/600
    });

    it('returns 0 percent when the reference stage value is 0', () => {
        fixture.componentRef.setInput('data', [
            { name: 'Zero', value: 0 },
            { name: 'Next', value: 10 },
        ]);
        fixture.detectChanges();
        const stages = component.stages();
        expect(stages[0].percent).toBeCloseTo(100, 5);
        expect(stages[1].percent).toBe(0);
    });

    it('returns no stages for empty data', () => {
        fixture.componentRef.setInput('data', []);
        fixture.detectChanges();
        expect(component.stages()).toEqual([]);
        expect(fixture.nativeElement.querySelectorAll('polygon[data-slot="funnel-stage"]')).toHaveLength(0);
    });

    it('renders stage value labels when showValues is true and hides them when false', () => {
        const labels = [...fixture.nativeElement.querySelectorAll('text')].map(t => (t as SVGTextElement).textContent?.trim());
        expect(labels).toEqual(['Visits · 100.0%', 'Signups · 60.0%', 'Trials · 30.0%', 'Paid · 12.0%']);
        fixture.componentRef.setInput('showValues', false);
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelectorAll('text')).toHaveLength(0);
    });

    it('formats a percentage value with a trailing percent sign', () => {
        expect(component.formatPercent(42.5)).toBe('42.5%');
    });

    it('widens the gap between stages when the gap input grows', () => {
        const tight = component.stages()[3].midY;
        fixture.componentRef.setInput('gap', 20);
        fixture.detectChanges();
        const loose = component.stages()[3].midY;
        expect(loose).toBeGreaterThan(tight);
    });

    it('builds tooltip rows for the hovered stage', () => {
        component.setHover(1);
        const rows = component.tooltipRows();
        expect(rows[0].value).toContain('600');
        expect(rows[1].value).toContain('%');
        expect(component.hoverTitle()).toContain('Signups');
    });

    it('returns no tooltip rows when the hovered index has no data point', () => {
        component.setHover(99);
        expect(component.tooltipRows()).toEqual([]);
    });

    it('positions the tooltip on stage enter and clears it on leave', () => {
        const stage = component.stages()[2];
        component.onStageEnter(stage);
        expect(component.hovered()).toBe(2);
        expect(component.tooltipPos().x).toBeCloseTo(stage.centerX, 5);
        expect(component.tooltipPos().y).toBe(Math.max(8, stage.midY - 8));
        component.onLeave();
        expect(component.hovered()).toBeNull();
    });

    it('reflects hover opacity on the polygons', () => {
        component.onStageEnter(component.stages()[0]);
        fixture.detectChanges();
        const polys = fixture.nativeElement.querySelectorAll('polygon[data-slot="funnel-stage"]');
        expect(polys[0].getAttribute('fill-opacity')).toBe('0.9');
        expect(polys[1].getAttribute('fill-opacity')).toBe('0.55');
    });

    it('hides the tooltip element entirely when showTooltip is false', () => {
        fixture.componentRef.setInput('showTooltip', false);
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('ui-chart-tooltip')).toBeNull();
    });

    it('emits stageClick with the stage data', () => {
        let emitted: ChartClickEvent | undefined;
        component.stageClick.subscribe((e: ChartClickEvent) => (emitted = e));
        component.onStageClick(2);
        expect(emitted?.index).toBe(2);
        expect(emitted?.point.name).toBe('Trials');
    });

    it('does not emit stageClick for an out-of-range index', () => {
        let emitted: ChartClickEvent | undefined;
        component.stageClick.subscribe((e: ChartClickEvent) => (emitted = e));
        component.onStageClick(99);
        expect(emitted).toBeUndefined();
    });

    it('falls back to the width input when no measured width is present', () => {
        component['_measuredWidth'].set(null);
        fixture.componentRef.setInput('width', 500);
        fixture.detectChanges();
        expect(component.svgWidth()).toBe(500);
    });

    it('appends a custom class to the container', () => {
        fixture.componentRef.setInput('class', 'my-funnel');
        fixture.detectChanges();
        expect(component.classes()).toContain('my-funnel');
    });
});
