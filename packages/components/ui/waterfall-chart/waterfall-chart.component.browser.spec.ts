import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect } from 'vitest';
import { WaterfallChartComponent } from './waterfall-chart.component';
import { ChartDirection, WaterfallBar } from '../../lib/chart.types';

/**
 * Browser-only: `dir="auto"` reads the computed CSS direction, which only a
 * real engine inherits from a `dir` attribute on an ancestor.
 */
@Component({
    template: `
        <div dir="rtl">
            <ui-waterfall-chart [data]="data" [dir]="dir()" />
        </div>
    `,
    imports: [WaterfallChartComponent],
})
class RtlAncestorHost {
    readonly dir = input<ChartDirection>('auto');
    readonly data: WaterfallBar[] = [
        { name: 'Q1', value: 500 },
        { name: 'Q2', value: -200 },
    ];
}

function chartInRtlAncestor(dir: ChartDirection): WaterfallChartComponent {
    const fixture = TestBed.createComponent(RtlAncestorHost);
    fixture.componentRef.setInput('dir', dir);
    fixture.detectChanges();
    return fixture.debugElement.query(By.directive(WaterfallChartComponent)).componentInstance as WaterfallChartComponent;
}

describe('WaterfallChart direction inside an RTL ancestor', () => {
    it('follows the DOM direction when dir is auto', () => {
        expect(chartInRtlAncestor('auto').isRtl()).toBe(true);
    });

    it('stays LTR when dir is ltr', () => {
        expect(chartInRtlAncestor('ltr').isRtl()).toBe(false);
    });
});
