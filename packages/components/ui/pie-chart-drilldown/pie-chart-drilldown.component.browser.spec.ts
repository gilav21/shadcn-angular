import { ComponentFixture, TestBed } from '@angular/core/testing';
import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PieChartDrilldownComponent } from './pie-chart-drilldown.component';
import { LegendPosition } from '../../lib/chart.types';

/**
 * Legend placement is layout, so it is asserted as rendered geometry in the
 * real browser, at a viewport past the `sm` breakpoint where the side legends
 * leave the stacked mobile layout.
 */
describe('PieChartDrilldownComponent legend placement', () => {
    let fixture: ComponentFixture<PieChartDrilldownComponent>;

    beforeEach(async () => {
        await page.viewport(1024, 768);
        await TestBed.configureTestingModule({ imports: [PieChartDrilldownComponent] }).compileComponents();
    });

    afterEach(() => fixture?.destroy());

    function render(legendPosition: LegendPosition) {
        fixture = TestBed.createComponent(PieChartDrilldownComponent);
        fixture.componentRef.setInput('data', [
            { name: 'Fruits', value: 60 },
            { name: 'Vegetables', value: 40 },
            { name: 'Grains', value: 20 },
        ]);
        fixture.componentRef.setInput('legendPosition', legendPosition);
        fixture.detectChanges();
        const host: HTMLElement = fixture.nativeElement;
        const rows = Array.from(host.querySelectorAll('button')).map(b => b.getBoundingClientRect());
        const svg = host.querySelector('svg[role="group"]')!.getBoundingClientRect();
        const legend = host.querySelector('button')!.parentElement!.getBoundingClientRect();
        return { rows, svg, legend };
    }

    it('places a left legend before the disc', () => {
        const { svg, legend } = render('left');
        expect(legend.right).toBeLessThanOrEqual(svg.left);
    });

    it('places a top legend above the disc, its rows on one line', () => {
        const { rows, svg, legend } = render('top');
        expect(legend.bottom).toBeLessThanOrEqual(svg.top);
        expect(rows.map(r => r.top)).toEqual([rows[0].top, rows[0].top, rows[0].top]);
    });

    it('places a right legend after the disc, its rows stacked', () => {
        const { rows, svg, legend } = render('right');
        expect(legend.left).toBeGreaterThanOrEqual(svg.right);
        expect(rows[1].top).toBeGreaterThan(rows[0].top);
        expect(rows[2].top).toBeGreaterThan(rows[1].top);
    });
});
