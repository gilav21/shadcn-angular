import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect } from 'vitest';
import { DatePickerComponent } from './date-picker.component';

@Component({
    template: `
        <div [style.position]="'fixed'" [style.left.px]="16" [style.top.px]="top()">
            <ui-date-picker />
        </div>
    `,
    imports: [DatePickerComponent],
})
class PlacedHost {
    readonly top = signal(10);
}

const twoFrames = (): Promise<void> =>
    new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

/**
 * Real-layout case for the non-top-layer fallback: the panel's side comes from
 * measured geometry, which jsdom does not compute.
 */
describe('DatePickerComponent — fallback popup placement', () => {
    async function openAt(top: (innerHeight: number) => number): Promise<{ panel: DOMRect; trigger: DOMRect; done: () => void }> {
        const fixture = TestBed.createComponent(PlacedHost);
        fixture.componentInstance.top.set(top(globalThis.innerHeight));
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();

        const picker = fixture.debugElement.query(By.directive(DatePickerComponent)).componentInstance as DatePickerComponent;
        picker.toggleOpen();
        fixture.detectChanges();
        const panelEl = fixture.nativeElement.querySelector('[data-slot="date-picker"] > [tabindex="-1"]') as HTMLElement;
        // Hide the Popover API from the panel so it takes the absolute-positioning fallback.
        Object.defineProperty(panelEl, 'showPopover', { value: undefined });
        await twoFrames();
        await twoFrames();
        fixture.detectChanges();

        const trigger = (fixture.nativeElement.querySelector('[data-slot="date-picker"] > button') as HTMLElement).getBoundingClientRect();
        return {
            panel: panelEl.getBoundingClientRect(),
            trigger,
            done: () => {
                fixture.destroy();
                fixture.nativeElement.remove();
            },
        };
    }

    it('opens below the trigger when it fits, and flips above it near the viewport bottom', async () => {
        const below = await openAt(() => 10);
        expect(below.panel.top).toBeGreaterThanOrEqual(below.trigger.bottom);
        below.done();

        const above = await openAt(h => h - 60);
        expect(above.panel.bottom).toBeLessThanOrEqual(above.trigger.top);
        above.done();
    });
});
