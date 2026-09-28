import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect } from 'vitest';
import { TooltipComponent, TooltipTriggerComponent, TooltipContentComponent } from './index';

type Side = 'top' | 'right' | 'bottom' | 'left';

@Component({
    template: `
        <div [dir]="dir()" style="padding: 80px 160px">
            @if (side(); as s) {
                <ui-tooltip [side]="s">
                    <ui-tooltip-trigger>Hover me</ui-tooltip-trigger>
                    <ui-tooltip-content>Tooltip text</ui-tooltip-content>
                </ui-tooltip>
            } @else {
                <ui-tooltip>
                    <ui-tooltip-trigger>Hover me</ui-tooltip-trigger>
                    <ui-tooltip-content>Tooltip text</ui-tooltip-content>
                </ui-tooltip>
            }
        </div>
    `,
    imports: [TooltipComponent, TooltipTriggerComponent, TooltipContentComponent],
})
class SideHost {
    readonly dir = signal<'ltr' | 'rtl'>('ltr');
    readonly side = signal<Side | null>(null);
}

/** Opens the tooltip and returns the gap between the trigger box and the bubble on each side. */
function openAndMeasure(side: Side | null, dir: 'ltr' | 'rtl') {
    const fixture = TestBed.createComponent(SideHost);
    fixture.componentInstance.side.set(side);
    fixture.componentInstance.dir.set(dir);
    fixture.detectChanges();
    const tooltip = fixture.debugElement.query(By.directive(TooltipComponent));
    (tooltip.componentInstance as TooltipComponent).show();
    fixture.detectChanges();

    const box = (tooltip.nativeElement as HTMLElement).getBoundingClientRect();
    const bubble = (fixture.nativeElement as HTMLElement)
        .querySelector('[data-slot="tooltip-content"]')!.getBoundingClientRect();
    return {
        top: box.top - bubble.bottom,
        bottom: bubble.top - box.bottom,
        left: box.left - bubble.right,
        right: bubble.left - box.right,
    };
}

describe('Tooltip content placement (browser)', () => {
    for (const side of [null, 'top', 'bottom', 'left', 'right'] as const) {
        const expected: Side = side ?? 'top';
        it(`sits ${expected} of the trigger with an 8px gap (side=${side ?? 'unset'})`, () => {
            expect(openAndMeasure(side, 'ltr')[expected]).toBeCloseTo(8, 0);
        });
    }

    for (const side of ['left', 'right'] as const) {
        it(`keeps side="${side}" on the physical ${side} with an 8px gap under dir="rtl"`, () => {
            expect(openAndMeasure(side, 'rtl')[side]).toBeCloseTo(8, 0);
        });
    }
});
