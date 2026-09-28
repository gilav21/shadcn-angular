import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { ScatterChartComponent } from './scatter-chart.component';
import { XYSeries } from '../../lib/chart.types';

/**
 * Browser-only: `dir="auto"` reads the host's computed `direction`, which only
 * a real browser derives from an ancestor's `dir` attribute (jsdom does not).
 */
describe('ScatterChartComponent (browser)', () => {
    const series: XYSeries[] = [
        { name: 'Group A', points: [{ x: 1, y: 2 }, { x: 5, y: 1 }] },
    ];

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ScatterChartComponent],
        }).compileComponents();
    });

    /** A chart whose host sits inside a `dir="rtl"` ancestor. */
    function createInRtlContainer(dir: 'auto' | 'ltr'): ScatterChartComponent {
        const fixture = TestBed.createComponent(ScatterChartComponent);
        (fixture.nativeElement as HTMLElement).parentElement!.setAttribute('dir', 'rtl');
        fixture.componentRef.setInput('series', series);
        fixture.componentRef.setInput('dir', dir);
        fixture.detectChanges();
        return fixture.componentInstance;
    }

    it('honors an explicit ltr direction inside an rtl container', () => {
        const chart = createInRtlContainer('ltr');
        expect(chart.isRtl()).toBe(false);
        const pts = chart.plottedPoints();
        expect(pts.find(p => p.datum.x === 1)!.cx).toBeLessThan(pts.find(p => p.datum.x === 5)!.cx);
    });

    it('reflects the auto direction from the DOM after view init', () => {
        expect(createInRtlContainer('auto').isRtl()).toBe(true);
    });
});
