import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { FieldMapperComponent } from './field-mapper.component';
import { FieldMapperItemDirective } from './sub/field-mapper-item.directive';
import type { FieldMapperItem, FieldMapperLayout, FieldMapperLink, FieldMapperMaxLinks } from './field-mapper.types';

/**
 * Model and interaction behaviour that needs no layout, so these run the same
 * in a consumer's jest or vitest (jsdom) as in the browser. Geometry, drag and
 * the automatic layout switch live in the `.browser.spec.ts`.
 */
@Component({
    template: `
        <div style="width: 320px">
            <ui-field-mapper
                [start]="start"
                [end]="end"
                [(links)]="links"
                [maxLinks]="maxLinks()"
                [layout]="layout()"
                (linkSelect)="selected.set($event)"
            >
                @if (custom()) {
                    <ng-template uiFieldMapperItem let-item let-side="side">
                        <strong class="custom">{{ side }}:{{ item.label }}</strong>
                    </ng-template>
                }
            </ui-field-mapper>
        </div>
    `,
    imports: [FieldMapperComponent, FieldMapperItemDirective],
})
class RowsHost {
    readonly start: FieldMapperItem[] = [
        { id: 'customer_id', label: 'customer_id' },
        { id: 'region', label: 'region' },
    ];
    readonly end: FieldMapperItem[] = [
        { id: 'id', label: 'id' },
        { id: 'area', label: 'area' },
        { id: 'legacy_code', label: 'legacy_code', disabled: true },
    ];
    readonly links = signal<readonly FieldMapperLink[]>([]);
    readonly maxLinks = signal<FieldMapperMaxLinks>({ start: 1, end: 1 });
    readonly custom = signal(false);
    readonly layout = signal<FieldMapperLayout>('rows');
    readonly selected = signal<FieldMapperLink | null | undefined>(undefined);
}

async function mount(configure: (host: RowsHost) => void = () => undefined): Promise<ComponentFixture<RowsHost>> {
    const fixture = TestBed.createComponent(RowsHost);
    configure(fixture.componentInstance);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
}

function rows(fixture: ComponentFixture<RowsHost>): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('[data-slot="field-mapper-row"]'));
}

async function choose(fixture: ComponentFixture<RowsHost>, row: number, endId: string): Promise<void> {
    const select = rows(fixture)[row].querySelector('select')!;
    select.value = endId;
    select.dispatchEvent(new Event('change'));
    // NgModel writes a changed binding back to its control a microtask later.
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
}

function announced(fixture: ComponentFixture<RowsHost>): string {
    return (fixture.nativeElement.querySelector('[data-slot="field-mapper-live"]').textContent ?? '').trim();
}

describe('FieldMapperComponent (rows layout)', () => {
    it('links through each row’s picker under the same limits, and announces every link and unlink', async () => {
        const fixture = await mount();
        expect(fixture.nativeElement.querySelector('[data-slot="field-mapper"]').dataset.layout).toBe('rows');

        await choose(fixture, 0, 'id');
        expect(fixture.componentInstance.links()).toEqual([{ startId: 'customer_id', endId: 'id' }]);
        expect(announced(fixture)).toBe('customer_id linked to id');

        // `id` is taken: region takes it, customer_id loses it.
        await choose(fixture, 1, 'id');
        expect(fixture.componentInstance.links()).toEqual([{ startId: 'region', endId: 'id' }]);
        expect(announced(fixture)).toBe('region linked to id. customer_id no longer linked to id');
        expect(rows(fixture).map(row => row.querySelector('select')!.value)).toEqual(['', 'id']);

        await choose(fixture, 1, '');
        expect(fixture.componentInstance.links()).toEqual([]);
        expect(announced(fixture)).toBe('region no longer linked to id');
    });

    it('renders items through the item template, and removes one of several links from its chip', async () => {
        const fixture = await mount(host => {
            host.custom.set(true);
            host.maxLinks.set({ start: Infinity, end: 1 });
            host.links.set([
                { startId: 'customer_id', endId: 'id' },
                { startId: 'customer_id', endId: 'area' },
            ]);
        });
        const first = rows(fixture)[0];
        expect(first.querySelector('.custom')!.textContent).toBe('start:customer_id');

        const remove = first.querySelector<HTMLButtonElement>('button[aria-label="Remove the link to id"]')!;
        remove.click();
        fixture.detectChanges();
        expect(fixture.componentInstance.links()).toEqual([{ startId: 'customer_id', endId: 'area' }]);
        expect(announced(fixture)).toBe('customer_id no longer linked to id');
    });
});

describe('FieldMapperComponent (columns layout, no geometry)', () => {
    function option(fixture: ComponentFixture<RowsHost>, side: 'start' | 'end', id: string): HTMLElement {
        return fixture.nativeElement.querySelector(`[role="option"][data-side="${side}"][data-id="${id}"]`);
    }

    function press(fixture: ComponentFixture<RowsHost>, target: HTMLElement, key: string): void {
        target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
        fixture.detectChanges();
    }

    it('picks an item by tap or Enter, cancels when it is picked again or on Escape, and announces each step', async () => {
        const fixture = await mount(host => host.layout.set('columns'));
        const customerId = option(fixture, 'start', 'customer_id');

        customerId.click();
        fixture.detectChanges();
        expect(customerId.getAttribute('aria-selected')).toBe('true');
        expect(announced(fixture)).toBe('customer_id picked. Choose an item in To to link it.');

        customerId.click();
        fixture.detectChanges();
        expect(customerId.getAttribute('aria-selected')).toBe('false');
        expect(announced(fixture)).toBe('Linking cancelled');

        // A disabled item can be neither picked nor linked to.
        const legacy = option(fixture, 'end', 'legacy_code');
        legacy.click();
        fixture.detectChanges();
        expect(legacy.getAttribute('aria-selected')).toBe('false');
        customerId.click();
        legacy.click();
        fixture.detectChanges();
        expect(fixture.componentInstance.links()).toEqual([]);
        press(fixture, customerId, 'Escape');

        const area = option(fixture, 'end', 'area');
        press(fixture, area, 'Enter');
        expect(area.getAttribute('aria-selected')).toBe('true');
        press(fixture, area, 'Escape');
        expect(area.getAttribute('aria-selected')).toBe('false');
        expect(fixture.componentInstance.links()).toEqual([]);
    });

    it('cycles an item’s lines with the key toward the other list; Delete removes the selected line, or all of the item’s links', async () => {
        const fixture = await mount(host => {
            host.layout.set('columns');
            host.maxLinks.set({ start: Infinity, end: 1 });
            host.links.set([
                { startId: 'customer_id', endId: 'id' },
                { startId: 'customer_id', endId: 'area' },
            ]);
        });
        const host = fixture.componentInstance;
        const customerId = option(fixture, 'start', 'customer_id');

        press(fixture, customerId, 'ArrowRight');
        expect(host.selected()).toEqual({ startId: 'customer_id', endId: 'id' });
        press(fixture, customerId, 'ArrowRight');
        expect(host.selected()).toEqual({ startId: 'customer_id', endId: 'area' });
        expect(announced(fixture)).toBe('Link from customer_id to area selected. Press Delete to remove it.');

        press(fixture, customerId, 'Delete');
        expect(host.links()).toEqual([{ startId: 'customer_id', endId: 'id' }]);
        expect(host.selected()).toBeNull();

        host.links.set([...host.links(), { startId: 'customer_id', endId: 'area' }]);
        fixture.detectChanges();
        press(fixture, customerId, 'Backspace');
        expect(host.links()).toEqual([]);
        expect(announced(fixture)).toBe('customer_id no longer linked to id. customer_id no longer linked to area');
    });
});
