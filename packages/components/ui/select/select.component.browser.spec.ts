import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect } from 'vitest';
import {
    SelectComponent,
    SelectTriggerComponent,
    SelectContentComponent,
    SelectValueComponent,
    SelectItemComponent,
} from '../select';

/**
 * Browser-only select cases: where the open content lands relative to its
 * trigger. They need real layout — the placement math reads live rects and
 * `offsetTop`, and the outcome is asserted as rendered geometry.
 */
@Component({
    template: `
        <div [attr.dir]="dir()" [style]="wrapperStyle()">
            <ui-select [value]="value()" [position]="position()" style="width: 80px">
                <ui-select-trigger class="w-full">
                    <ui-select-value />
                </ui-select-trigger>
                <ui-select-content [side]="side()">
                    <ui-select-item value="a">Alpha</ui-select-item>
                    <ui-select-item value="b">Bravo</ui-select-item>
                    <ui-select-item value="c">Charlie</ui-select-item>
                </ui-select-content>
            </ui-select>
        </div>
    `,
    imports: [SelectComponent, SelectTriggerComponent, SelectContentComponent, SelectValueComponent, SelectItemComponent],
})
class PlacementHost {
    readonly dir = signal<'ltr' | 'rtl'>('ltr');
    readonly wrapperStyle = signal('padding-top: 200px');
    readonly value = signal<string | undefined>(undefined);
    readonly position = signal<'popper' | 'item-aligned'>('item-aligned');
    readonly side = signal<'top' | 'bottom'>('bottom');
}

async function openPlaced(
    configure: (host: PlacementHost) => void,
): Promise<{ trigger: DOMRect; content: DOMRect; fixture: ComponentFixture<PlacementHost> }> {
    await TestBed.configureTestingModule({ imports: [PlacementHost] }).compileComponents();
    const fixture = TestBed.createComponent(PlacementHost);
    configure(fixture.componentInstance);
    fixture.detectChanges();
    await fixture.whenStable();

    const triggerEl: HTMLElement = fixture.nativeElement.querySelector('[data-slot="select-trigger"]');
    triggerEl.click();
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise(resolve => setTimeout(resolve, 0));
    fixture.detectChanges();
    await fixture.whenStable();

    const contentEl: HTMLElement = fixture.nativeElement.querySelector('[data-slot="select-content"]');
    return { trigger: triggerEl.getBoundingClientRect(), content: contentEl.getBoundingClientRect(), fixture };
}

describe('Select content placement (real layout)', () => {
    it.each(['ltr', 'rtl'] as const)('reads its direction from the ancestor dir and anchors content wider than the trigger to its inline-start edge (%s)', async dir => {
        const { trigger, content, fixture } = await openPlaced(h => {
            h.dir.set(dir);
            h.position.set('popper');
        });

        // The direction comes from the wrapper's dir, not the select's locale input.
        const select = fixture.debugElement.query(By.directive(SelectComponent)).componentInstance as SelectComponent<string>;
        expect(select.isRtl()).toBe(dir === 'rtl');
        expect(content.width).toBeGreaterThan(trigger.width + 10);
        if (dir === 'rtl') {
            expect(Math.abs(content.right - trigger.right)).toBeLessThan(1);
        } else {
            expect(Math.abs(content.left - trigger.left)).toBeLessThan(1);
        }
    });

    it('item-aligned overlays the content so the selected row sits on the trigger', async () => {
        const { trigger, content, fixture } = await openPlaced(h => h.value.set('c'));

        const selectedRow = (fixture.nativeElement as HTMLElement)
            .querySelector('[data-slot="select-item"][data-state="checked"]')!.getBoundingClientRect();
        expect(content.top).toBeLessThan(trigger.top - 40);
        expect(Math.abs(selectedRow.top - trigger.top)).toBeLessThan(6);
    });

    it('flips to popper below the trigger when item-aligned would overflow the clipping ancestor', async () => {
        const { trigger, content } = await openPlaced(h => {
            h.wrapperStyle.set('overflow: hidden; height: 160px; padding-top: 4px');
            h.value.set('c');
        });

        expect(content.top).toBeGreaterThanOrEqual(trigger.bottom);
    });

    it('honours an explicit popper position with a top side preference', async () => {
        const { trigger, content } = await openPlaced(h => {
            h.wrapperStyle.set('padding-top: 400px');
            h.position.set('popper');
            h.side.set('top');
        });

        expect(content.bottom).toBeLessThanOrEqual(trigger.top);
    });
});
