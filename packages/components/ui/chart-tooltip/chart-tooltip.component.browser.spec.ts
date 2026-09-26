import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, afterEach } from 'vitest';
import { ChartTooltipComponent, ChartTooltipRow } from './chart-tooltip.component';

@Component({
    template: `
        <div data-testid="anchor-box" style="position: relative; margin: 200px 0 0 300px; width: 10px; height: 10px">
            <ui-chart-tooltip [visible]="true" [x]="0" [y]="0" [flipX]="flipX()" [flipY]="flipY()" [rows]="rows()" title="Q1" />
        </div>
    `,
    imports: [ChartTooltipComponent],
})
class TooltipHost {
    readonly flipX = signal(false);
    readonly flipY = signal(false);
    readonly rows = signal<ChartTooltipRow[]>([{ label: 'Revenue', value: '1.2K' }]);
}

/** Real-layout cases: the tooltip's geometry, which jsdom does not compute. */
describe('ChartTooltipComponent — placement', () => {
    let fixture: ComponentFixture<TooltipHost>;

    function render(): void {
        fixture = TestBed.createComponent(TooltipHost);
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();
    }

    function rects(): { tip: DOMRect; anchor: DOMRect } {
        return {
            tip: (fixture.nativeElement.querySelector('[data-slot="chart-tooltip"]') as HTMLElement).getBoundingClientRect(),
            anchor: (fixture.nativeElement.querySelector('[data-testid="anchor-box"]') as HTMLElement).getBoundingClientRect(),
        };
    }

    afterEach(() => {
        fixture.destroy();
        fixture.nativeElement.remove();
    });

    it('never grows wider than the viewport minus its margin', () => {
        render();
        // One unbreakable token: without the cap its min-content width alone would exceed the viewport.
        fixture.componentInstance.rows.set([{ label: 'x'.repeat(400), value: '1' }]);
        fixture.detectChanges();

        expect(rects().tip.width).toBeLessThanOrEqual(globalThis.innerWidth - 32);
    });

    it('sits right of and below the anchor, and flips each axis on request', () => {
        render();
        let { tip, anchor } = rects();
        expect(tip.left).toBeCloseTo(anchor.left, 0);
        expect(tip.top).toBeCloseTo(anchor.top, 0);

        fixture.componentInstance.flipX.set(true);
        fixture.detectChanges();
        ({ tip, anchor } = rects());
        expect(tip.right).toBeCloseTo(anchor.left, 0);
        expect(tip.top).toBeCloseTo(anchor.top, 0);

        fixture.componentInstance.flipY.set(true);
        fixture.detectChanges();
        ({ tip, anchor } = rects());
        expect(tip.right).toBeCloseTo(anchor.left, 0);
        expect(tip.bottom).toBeCloseTo(anchor.top, 0);
    });
});
