import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect } from 'vitest';
import { LineChartComponent } from './line-chart.component';
import type { ChartSeries } from '../../lib/chart.types';

/** Browser-only: `dir="auto"` reads the inherited computed direction, which only a real browser derives from `dir`. */
@Component({
    template: `
        <div dir="rtl">
            <ui-line-chart [series]="series" />
        </div>
    `,
    imports: [LineChartComponent],
})
class RtlPageHost {
    readonly series: ChartSeries[] = [{ name: 'Revenue', data: [{ name: 'Q1', value: 100 }, { name: 'Q2', value: 200 }] }];
}

describe('LineChart direction (real browser)', () => {
    it('resolves the default dir (auto) to RTL under a dir="rtl" ancestor', async () => {
        await TestBed.configureTestingModule({ imports: [RtlPageHost] }).compileComponents();
        const fixture = TestBed.createComponent(RtlPageHost);
        fixture.detectChanges();
        await fixture.whenStable();

        const chart: LineChartComponent = fixture.debugElement.query(By.directive(LineChartComponent)).componentInstance;
        expect(chart.isRtl()).toBe(true);
    });
});
