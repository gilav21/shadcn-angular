import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { DataListComponent, type DataListItem, type DataListOrientation } from './data-list.component';
import { DataListItemComponent } from './sub/data-list-item.component';

/**
 * Browser-only data-list layout: grid tracks per breakpoint, wrapping of long
 * values, and row geometry. These need real layout and a resizable viewport.
 */
@Component({
    imports: [DataListComponent],
    template: `
        <div style="width: 300px">
            <ui-data-list [items]="items()" [orientation]="orientation()" />
        </div>
    `,
})
class SimpleHostComponent {
    readonly items = signal<readonly DataListItem[]>([
        { label: 'Status', value: 'Active' },
        { label: 'Plan', value: 'Enterprise' },
    ]);
    readonly orientation = signal<DataListOrientation>('vertical');
}

@Component({
    imports: [DataListComponent, DataListItemComponent],
    template: `
        <ui-data-list [orientation]="orientation()">
            <ui-data-list-item label="Status">Active</ui-data-list-item>
            <ui-data-list-item label="Owner"><span>Ada Lovelace</span></ui-data-list-item>
        </ui-data-list>
    `,
})
class CustomModeHostComponent {
    readonly orientation = signal<DataListOrientation>('vertical');
}

describe('DataListComponent layout (browser)', () => {
    let initialSize: readonly [number, number];

    beforeEach(() => {
        initialSize = [globalThis.innerWidth, globalThis.innerHeight];
    });

    afterEach(async () => {
        await page.viewport(initialSize[0], initialSize[1]);
    });

    const trackCount = (root: HTMLElement): number =>
        getComputedStyle(root.querySelector('dl')!).gridTemplateColumns.split(' ').filter(Boolean).length;

    it('computes a two-track grid only from the sm breakpoint up', async () => {
        await TestBed.configureTestingModule({ imports: [SimpleHostComponent] }).compileComponents();
        const fixture = TestBed.createComponent(SimpleHostComponent);
        const root = fixture.nativeElement as HTMLElement;

        await page.viewport(1024, 768);
        fixture.componentInstance.orientation.set('horizontal');
        fixture.detectChanges();
        expect(trackCount(root)).toBe(2);

        fixture.componentInstance.orientation.set('vertical');
        fixture.detectChanges();
        expect(trackCount(root)).toBe(1);

        await page.viewport(375, 700);
        fixture.componentInstance.orientation.set('horizontal');
        fixture.detectChanges();
        expect(trackCount(root)).toBe(1);
    });

    it('wraps an extremely long unbroken label and value instead of overflowing', async () => {
        await TestBed.configureTestingModule({ imports: [SimpleHostComponent] }).compileComponents();
        const fixture = TestBed.createComponent(SimpleHostComponent);
        fixture.componentInstance.items.set([{ label: 'x'.repeat(200), value: 'y'.repeat(400) }]);
        fixture.detectChanges();

        const root = fixture.nativeElement as HTMLElement;
        const containerRight = root.firstElementChild!.getBoundingClientRect().right;
        for (const cell of root.querySelectorAll<HTMLElement>('dt, dd')) {
            expect(cell.scrollWidth).toBeLessThanOrEqual(cell.clientWidth + 1);
            expect(cell.getBoundingClientRect().right).toBeLessThanOrEqual(containerRight + 1);
        }
    });

    it('inherits the list orientation rather than styling each row separately', async () => {
        await page.viewport(1024, 768);
        await TestBed.configureTestingModule({ imports: [CustomModeHostComponent] }).compileComponents();
        const fixture = TestBed.createComponent(CustomModeHostComponent);
        fixture.componentInstance.orientation.set('horizontal');
        fixture.detectChanges();

        const list = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('ui-data-list')!;
        expect(list.dataset['orientation']).toBe('horizontal');
        const terms = [...list.querySelectorAll('dt')];
        expect(terms).toHaveLength(2);
        for (const term of terms) {
            const termRect = term.getBoundingClientRect();
            const valueRect = term.nextElementSibling!.getBoundingClientRect();
            expect(valueRect.top).toBeCloseTo(termRect.top, 0);
            expect(valueRect.left).toBeGreaterThanOrEqual(termRect.right);
        }
    });
});
