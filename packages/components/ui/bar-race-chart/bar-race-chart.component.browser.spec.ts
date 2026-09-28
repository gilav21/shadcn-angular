import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect } from 'vitest';
import { BarRaceChartComponent } from './bar-race-chart.component';
import type { ChartDirection } from '../../lib/chart.types';

/** Browser-only: 'auto' reads the inherited computed direction, which only a real browser derives from `dir`. */
@Component({
    template: `
        <div dir="rtl">
            <ui-bar-race-chart [frames]="frames" [dir]="direction()" />
        </div>
    `,
    imports: [BarRaceChartComponent],
})
class RtlPageHost {
    readonly frames = [[{ name: 'A', value: 1 }, { name: 'B', value: 2 }]];
    readonly direction = signal<ChartDirection>('auto');
}

describe('BarRaceChart direction (real browser)', () => {
    it.each([
        ['auto', true],
        ['ltr', false],
    ] as const)('under a dir="rtl" page, dir="%s" resolves isRtl to %s', async (direction, expected) => {
        await TestBed.configureTestingModule({ imports: [RtlPageHost] }).compileComponents();
        const fixture = TestBed.createComponent(RtlPageHost);
        fixture.componentInstance.direction.set(direction);
        fixture.detectChanges();
        await new Promise(resolve => setTimeout(resolve, 0));
        fixture.detectChanges();

        const chart: BarRaceChartComponent = fixture.debugElement.query(By.directive(BarRaceChartComponent)).componentInstance;
        expect(chart.isRtl()).toBe(expected);
    });
});
