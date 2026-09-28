import { TestBed } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { describe, it, expect } from 'vitest';
import { ResultComponent } from './index';

/**
 * Browser-only: asserts rendered RTL geometry, which jsdom does not lay out.
 */
@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div dir="rtl" style="width: 320px">
            <ui-result status="success" title="Payment received">
                <button data-testid="primary" style="width: 100px">Back</button>
                <button data-testid="secondary" style="width: 100px">Receipt</button>
            </ui-result>
        </div>
    `,
    imports: [ResultComponent],
})
class RtlHostComponent {}

describe('ResultComponent (browser layout)', () => {
    it('mirrors the actions row in RTL: primary on the right, row centred', async () => {
        await TestBed.configureTestingModule({ imports: [RtlHostComponent] }).compileComponents();
        const fixture = TestBed.createComponent(RtlHostComponent);
        fixture.detectChanges();
        const root = fixture.nativeElement as HTMLElement;
        const rect = (selector: string) =>
            (root.querySelector(selector) as HTMLElement).getBoundingClientRect();

        const panel = rect('[data-slot="result"]');
        const primary = rect('[data-testid="primary"]');
        const secondary = rect('[data-testid="secondary"]');

        expect(primary.top).toBe(secondary.top);
        expect(primary.left).toBeGreaterThan(secondary.left);
        // Physical padding or margin on one side would push the row off-centre.
        expect(Math.abs((secondary.left - panel.left) - (panel.right - primary.right))).toBeLessThanOrEqual(1);
        fixture.destroy();
    });
});
