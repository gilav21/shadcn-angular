import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { BadgeComponent } from '../badge';
import { DataListComponent, type DataListItem } from './data-list.component';
import { DataListItemComponent } from './sub/data-list-item.component';

const ITEMS: readonly DataListItem[] = [
    { label: 'Status', value: 'Active' },
    { label: 'Plan', value: 'Enterprise' },
    { label: 'Seats', value: '42' },
];

/** Custom mode: projected rows with arbitrary content (UC-11). */
@Component({
    template: `
        <ui-data-list [orientation]="orientation()">
            <ui-data-list-item label="Status">
                <ui-badge label="Active" data-testid="status-badge" />
            </ui-data-list-item>
            <ui-data-list-item label="Owner">
                <span data-testid="owner-name">Ada Lovelace</span>
            </ui-data-list-item>
        </ui-data-list>
    `,
    imports: [DataListComponent, DataListItemComponent, BadgeComponent],
})
class CustomModeHostComponent {
    readonly orientation = signal<'vertical' | 'horizontal'>('vertical');
}

describe('DataListComponent', () => {
    let fixture: ComponentFixture<DataListComponent>;
    let host: HTMLElement;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [DataListComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(DataListComponent);
        host = fixture.nativeElement as HTMLElement;
        fixture.componentRef.setInput('items', ITEMS);
        fixture.detectChanges();
    });

    // T-10 — UC-10, UC-13
    describe('T-10: simple mode renders items array as dl/dt/dd', () => {
        it('renders exactly one dl', () => {
            expect(host.querySelectorAll('dl')).toHaveLength(1);
        });

        it('renders one dt/dd pair per item, in order', () => {
            const dl = host.querySelector('dl')!;
            expect(dl.querySelectorAll('dt')).toHaveLength(ITEMS.length);
            expect(dl.querySelectorAll('dd')).toHaveLength(ITEMS.length);
            expect([...dl.querySelectorAll('dt')].map((el) => el.textContent?.trim())).toEqual(
                ITEMS.map((item) => item.label)
            );
            expect([...dl.querySelectorAll('dd')].map((el) => el.textContent?.trim())).toEqual(
                ITEMS.map((item) => item.value)
            );
        });

        it('keeps dt/dd as accessible children of the dl (R-4)', () => {
            const dl = host.querySelector('dl')!;
            for (const term of dl.querySelectorAll('dt')) {
                let node: HTMLElement | null = term.parentElement;
                while (node && node !== dl) {
                    expect(globalThis.getComputedStyle(node).display).toBe('contents');
                    node = node.parentElement;
                }
                expect(node).toBe(dl);
            }
        });

        it('pairs each dt immediately with its own dd', () => {
            const dl = host.querySelector('dl')!;
            for (const term of dl.querySelectorAll('dt')) {
                expect(term.nextElementSibling?.tagName).toBe('DD');
            }
        });

        // The `class` input lands on the <dl> — the element that carries the
        // layout — so a consumer's own grid utilities actually win.
        it('exposes a data-slot hook and merges the class input onto the dl', () => {
            expect(host.dataset['slot']).toBe('data-list');
            fixture.componentRef.setInput('class', 'custom-list-class');
            fixture.detectChanges();
            expect(host.querySelector('dl')!.className).toContain('custom-list-class');
        });
    });

    // T-12 — UC-12
    describe('T-12: horizontal orientation collapses to stacked at 640px', () => {
        it('defaults to vertical', () => {
            expect(fixture.componentInstance.orientation()).toBe('vertical');
        });

        it('uses a single column below the sm breakpoint when horizontal', () => {
            fixture.componentRef.setInput('orientation', 'horizontal');
            fixture.detectChanges();
            const dl = host.querySelector<HTMLElement>('dl')!;
            expect(dl.className).toContain('grid-cols-1');
            expect(dl.className).toMatch(/sm:grid-cols-/);
        });

        it('reflects the orientation on a data attribute', () => {
            fixture.componentRef.setInput('orientation', 'horizontal');
            fixture.detectChanges();
            expect(host.dataset['orientation']).toBe('horizontal');
        });

        it('computes a two-track grid only from the sm breakpoint up', () => {
            fixture.componentRef.setInput('orientation', 'horizontal');
            fixture.detectChanges();
            const dl = host.querySelector<HTMLElement>('dl')!;
            const tracks = globalThis
                .getComputedStyle(dl)
                .gridTemplateColumns.split(' ')
                .filter(Boolean).length;
            const isDesktop = globalThis.matchMedia('(min-width: 640px)').matches;
            expect(tracks).toBe(isDesktop ? 2 : 1);
        });
    });

    // Edge cases — 2.2
    describe('edge cases', () => {
        it('renders an empty dl for an empty items array', () => {
            fixture.componentRef.setInput('items', []);
            fixture.detectChanges();
            const dl = host.querySelector('dl')!;
            expect(dl.querySelectorAll('dt')).toHaveLength(0);
        });

        it('renders a single item without a trailing separator artefact', () => {
            fixture.componentRef.setInput('items', [ITEMS[0]]);
            fixture.detectChanges();
            expect(host.querySelectorAll('dt')).toHaveLength(1);
            expect(host.querySelectorAll('dd')).toHaveLength(1);
        });

        it('wraps an extremely long unbroken value instead of overflowing', () => {
            fixture.componentRef.setInput('items', [{ label: 'x'.repeat(200), value: 'y'.repeat(400) }]);
            fixture.detectChanges();
            const dd = host.querySelector<HTMLElement>('dd')!;
            const dt = host.querySelector<HTMLElement>('dt')!;
            expect(dd.className).toContain('break-words');
            expect(dt.className).toContain('break-words');
            expect(dd.scrollWidth).toBeLessThanOrEqual(dd.clientWidth + 1);
        });
    });
});

// T-11 — UC-11
describe('DataListComponent custom mode (T-11)', () => {
    async function setup(): Promise<ComponentFixture<CustomModeHostComponent>> {
        await TestBed.configureTestingModule({
            imports: [CustomModeHostComponent],
        }).compileComponents();
        const fixture = TestBed.createComponent(CustomModeHostComponent);
        fixture.detectChanges();
        return fixture;
    }

    it('renders projected data-list-items as dt/dd pairs', async () => {
        const fixture = await setup();
        const list = fixture.debugElement.query(By.directive(DataListComponent)).nativeElement as HTMLElement;
        const dl = list.querySelector('dl')!;

        expect(dl.querySelectorAll('dt')).toHaveLength(2);
        expect([...dl.querySelectorAll('dt')].map((el) => el.textContent?.trim())).toEqual([
            'Status',
            'Owner',
        ]);
    });

    it('renders arbitrary component content inside the dd', async () => {
        const fixture = await setup();
        const list = fixture.debugElement.query(By.directive(DataListComponent)).nativeElement as HTMLElement;

        const badge = list.querySelector('[data-testid="status-badge"]');
        const name = list.querySelector('[data-testid="owner-name"]');
        expect(badge).not.toBeNull();
        expect(name).not.toBeNull();
        expect(badge!.closest('dd')).not.toBeNull();
        expect(name!.closest('dd')).not.toBeNull();
    });

    // R-4, and the axe finding behind it: `definition-list` / `dlitem` inspect
    // the DOM tree, not the accessibility tree, so a `display: contents` custom
    // element between <dl> and <dt> is still a serious violation. The projected
    // row hosts must therefore never reach the document at all.
    it('puts no element between the dl and its dt/dd (R-4)', async () => {
        const fixture = await setup();
        const list = fixture.debugElement.query(By.directive(DataListComponent)).nativeElement as HTMLElement;
        const dl = list.querySelector('dl')!;

        expect(dl.querySelector('ui-data-list-item')).toBeNull();
        for (const child of dl.children) {
            expect(['DT', 'DD']).toContain(child.tagName);
        }
        for (const cell of dl.querySelectorAll('dt, dd')) {
            expect(cell.parentElement).toBe(dl);
        }
    });

    it('inherits the list orientation rather than styling each row separately', async () => {
        const fixture = await setup();
        fixture.componentInstance.orientation.set('horizontal');
        fixture.detectChanges();

        const list = fixture.debugElement.query(By.directive(DataListComponent)).nativeElement as HTMLElement;
        expect(list.dataset['orientation']).toBe('horizontal');
        expect(list.querySelector<HTMLElement>('dl')!.className).toContain('grid-cols-1');
    });
});
