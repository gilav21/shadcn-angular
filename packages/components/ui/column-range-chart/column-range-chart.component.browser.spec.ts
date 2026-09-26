import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ColumnRangeChartComponent } from './column-range-chart.component';
import { ChartDirection } from '../../lib/chart.types';

/**
 * Browser-only: `dir="auto"` resolves from the computed `direction`, which
 * jsdom does not derive from an ancestor's `dir` attribute.
 */
describe('ColumnRangeChartComponent direction (browser)', () => {
    let wrapper: HTMLElement;
    let fixture: ComponentFixture<ColumnRangeChartComponent>;

    function render(dir: ChartDirection, ancestorDir: 'ltr' | 'rtl'): ColumnRangeChartComponent {
        wrapper = document.createElement('div');
        wrapper.dir = ancestorDir;
        document.body.appendChild(wrapper);
        fixture = TestBed.createComponent(ColumnRangeChartComponent);
        wrapper.appendChild(fixture.nativeElement);
        fixture.componentRef.setInput('data', [
            { name: 'Jan', low: -5, high: 10 },
            { name: 'Feb', low: -3, high: 12 },
        ]);
        fixture.componentRef.setInput('dir', dir);
        fixture.detectChanges();
        return fixture.componentInstance;
    }

    afterEach(() => {
        vi.useRealTimers();
        fixture.destroy();
        wrapper.remove();
    });

    it('should report isRtl false when dir is ltr, even inside an RTL ancestor', () => {
        expect(render('ltr', 'rtl').isRtl()).toBe(false);
    });

    it('should fall back to the DOM direction when dir is auto', () => {
        expect(render('auto', 'rtl').isRtl()).toBe(true);
    });

    it('should re-check direction on the deferred ngAfterViewInit timer', () => {
        vi.useFakeTimers();
        const chart = render('auto', 'ltr');
        expect(chart.isRtl()).toBe(false);

        // The direction lands after the first render, as when a parent sets `dir` late.
        wrapper.dir = 'rtl';
        vi.advanceTimersByTime(0);
        expect(chart.isRtl()).toBe(true);
    });
});
