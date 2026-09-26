import { TestBed } from '@angular/core/testing';
import { describe, it, expect, afterEach } from 'vitest';
import { ComboChartComponent } from './combo-chart.component';
import type { ChartDirection } from '../../lib/chart.types';

/**
 * Browser-only: `dir="auto"` reads the computed `direction` of the host, which
 * jsdom does not derive from a `dir` attribute on an ancestor.
 */
describe('ComboChartComponent — DOM direction', () => {
    const wrappers: HTMLElement[] = [];

    afterEach(() => {
        for (const w of wrappers.splice(0)) w.remove();
    });

    function renderUnderRtlAncestor(dir: ChartDirection): ComboChartComponent {
        const fixture = TestBed.createComponent(ComboChartComponent);
        const wrapper = document.createElement('div');
        wrapper.dir = 'rtl';
        document.body.appendChild(wrapper);
        wrappers.push(wrapper);
        wrapper.appendChild(fixture.nativeElement);
        fixture.componentRef.setInput('barSeries', [
            { name: 'Defects', data: [{ name: 'A', value: 50 }, { name: 'B', value: 30 }] },
        ]);
        fixture.componentRef.setInput('dir', dir);
        fixture.detectChanges();
        return fixture.componentInstance;
    }

    it('forces ltr layout when dir is ltr, even under an rtl ancestor', () => {
        expect(renderUnderRtlAncestor('ltr').isRtl()).toBe(false);
    });

    it('falls back to DOM direction when dir is auto', () => {
        expect(renderUnderRtlAncestor('auto').isRtl()).toBe(true);
    });
});
