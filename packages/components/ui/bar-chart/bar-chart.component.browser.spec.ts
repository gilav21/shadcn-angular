import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi } from 'vitest';
import { BarChartComponent } from './bar-chart.component';

/** Real-browser check: auto direction reads the inherited computed `direction`, which jsdom does not cascade. */
describe('BarChartComponent auto direction (browser)', () => {
    it('should re-check direction on the deferred ngAfterViewInit timer', () => {
        vi.useFakeTimers();
        try {
            const fixture = TestBed.createComponent(BarChartComponent);
            fixture.componentRef.setInput('data', [
                { name: 'A', value: 10 },
                { name: 'B', value: 20 },
            ]);
            fixture.detectChanges();
            expect(fixture.componentInstance.isRtl()).toBe(false);

            // An ancestor that turns RTL after the first render (e.g. a layout
            // shell applying dir late) is picked up by the deferred re-check.
            (fixture.nativeElement as HTMLElement).parentElement!.dir = 'rtl';
            vi.advanceTimersByTime(0);

            expect(fixture.componentInstance.isRtl()).toBe(true);
            fixture.destroy();
        } finally {
            vi.useRealTimers();
        }
    });
});
