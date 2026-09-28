import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { FunnelChartComponent } from './funnel-chart.component';
import { ChartDataPoint } from '../../lib/chart.types';

@Component({
    template: `<div style="width: 720px"><ui-funnel-chart [data]="data" [width]="440" /></div>`,
    imports: [FunnelChartComponent],
})
class WideHost {
    readonly data: ChartDataPoint[] = [
        { name: 'Visits', value: 1000 },
        { name: 'Signups', value: 600 },
    ];
}

/** Real-layout case: a real ResizeObserver measuring a real box, which jsdom has neither of. */
describe('FunnelChartComponent — responsive width', () => {
    it('sizes the chart to its measured container rather than the width input', async () => {
        const fixture = TestBed.createComponent(WideHost);
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        fixture.detectChanges();

        expect(fixture.nativeElement.querySelector('svg').getAttribute('viewBox')).toBe('0 0 720 300');

        fixture.destroy();
        fixture.nativeElement.remove();
    });
});
