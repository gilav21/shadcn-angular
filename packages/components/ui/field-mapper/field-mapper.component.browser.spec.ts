import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, it, expect } from 'vitest';
import { userEvent } from 'vitest/browser';
import { FieldMapperComponent } from './field-mapper.component';
import { FieldMapperLinkLabelDirective } from './sub/field-mapper-link-label.directive';
import type { FieldMapperItem, FieldMapperLink, FieldMapperMaxLinks } from './field-mapper.types';

/**
 * Browser-only: everything here reads real layout — where lines are drawn,
 * where items sit, what the pointer lands on — and asserts it as rendered
 * geometry, never as class names.
 */

const ORDERS: FieldMapperItem[] = [
    { id: 'customer_id', label: 'customer_id' },
    { id: 'region', label: 'region' },
    { id: 'order_id', label: 'order_id' },
    { id: 'placed_at', label: 'placed_at' },
];

const CUSTOMERS: FieldMapperItem[] = [
    { id: 'segment', label: 'segment' },
    { id: 'id', label: 'id' },
    { id: 'name', label: 'name' },
    { id: 'area', label: 'area' },
];

@Component({
    template: `
        <div [style.width.px]="width()" [attr.dir]="dir()" [style]="extraStyle()">
            <ui-field-mapper
                [start]="start()"
                [end]="end()"
                [(links)]="links"
                [maxLinks]="maxLinks()"
                [align]="align()"
                [searchable]="searchable()"
                startHeading="Column in orders"
                endHeading="Column in customers"
                (linkSelect)="selected.set($event)"
            >
                @if (withLabels()) {
                    <ng-template uiFieldMapperLinkLabel let-link>{{ link.startId }}~{{ link.endId }}</ng-template>
                }
            </ui-field-mapper>
        </div>
    `,
    imports: [FieldMapperComponent, FieldMapperLinkLabelDirective],
})
class Host {
    readonly width = signal(640);
    readonly dir = signal<'ltr' | 'rtl'>('ltr');
    readonly extraStyle = signal('');
    readonly start = signal<readonly FieldMapperItem[]>(ORDERS);
    readonly end = signal<readonly FieldMapperItem[]>(CUSTOMERS);
    readonly links = signal<readonly FieldMapperLink[]>([]);
    readonly maxLinks = signal<FieldMapperMaxLinks>({ start: 1, end: 1 });
    readonly align = signal(true);
    readonly searchable = signal(false);
    readonly withLabels = signal(false);
    readonly selected = signal<FieldMapperLink | null | undefined>(undefined);
}

const nextFrame = (): Promise<void> => new Promise(resolve => requestAnimationFrame(() => resolve()));

async function settle(fixture: ComponentFixture<Host>): Promise<void> {
    for (let pass = 0; pass < 3; pass++) {
        fixture.detectChanges();
        await fixture.whenStable();
        await nextFrame();
    }
    fixture.detectChanges();
}

let current: ComponentFixture<Host> | null = null;

async function mount(configure: (host: Host) => void = () => undefined): Promise<ComponentFixture<Host>> {
    const fixture = TestBed.createComponent(Host);
    configure(fixture.componentInstance);
    current = fixture;
    await settle(fixture);
    return fixture;
}

afterEach(() => {
    current?.destroy();
    current = null;
});

function root(fixture: ComponentFixture<Host>): HTMLElement {
    return fixture.nativeElement.querySelector('[data-slot="field-mapper"]');
}

function item(fixture: ComponentFixture<Host>, side: 'start' | 'end', id: string): HTMLElement {
    const found = Array.from(
        root(fixture).querySelectorAll<HTMLElement>(`[data-slot="field-mapper-item"][data-side="${side}"]`),
    ).find(el => el.dataset['id'] === id);
    if (!found) throw new Error(`no ${side} item ${id}`);
    return found;
}

function handle(fixture: ComponentFixture<Host>, side: 'start' | 'end', id: string): HTMLElement {
    return item(fixture, side, id).querySelector<HTMLElement>('[data-slot="field-mapper-handle"]')!;
}

function center(el: Element): { x: number; y: number } {
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** Both ends of every drawn line, in viewport coordinates. */
function lineEnds(fixture: ComponentFixture<Host>): { from: { x: number; y: number }; to: { x: number; y: number } }[] {
    const svg = root(fixture).querySelector<SVGSVGElement>('[data-slot="field-mapper-lines"]')!;
    const origin = svg.getBoundingClientRect();
    return Array.from(svg.querySelectorAll<SVGPathElement>('[data-slot="field-mapper-line"]')).map(path => {
        const numbers = (path.getAttribute('d') ?? '').match(/-?\d+(\.\d+)?/g)!.map(Number);
        return {
            from: { x: origin.left + numbers[0], y: origin.top + numbers[1] },
            to: { x: origin.left + numbers.at(-2)!, y: origin.top + numbers.at(-1)! },
        };
    });
}

/** Every line starts at its start item's handle and ends at its end item's handle. */
function expectLinesOnHandles(fixture: ComponentFixture<Host>, links: readonly FieldMapperLink[]): void {
    const ends = lineEnds(fixture);
    expect(ends).toHaveLength(links.length);
    links.forEach((link, index) => {
        const from = center(handle(fixture, 'start', link.startId));
        const to = center(handle(fixture, 'end', link.endId));
        expect(ends[index].from.x).toBeCloseTo(from.x, 0);
        expect(ends[index].from.y).toBeCloseTo(from.y, 0);
        expect(ends[index].to.x).toBeCloseTo(to.x, 0);
        expect(ends[index].to.y).toBeCloseTo(to.y, 0);
    });
}

describe('FieldMapperComponent (browser)', () => {
    it('produces the same links by pointer drag, tap-tap and keyboard, from either list', async () => {
        const expected = [
            { startId: 'customer_id', endId: 'id' },
            { startId: 'region', endId: 'area' },
        ];

        const dragged = await mount();
        await userEvent.dragAndDrop(handle(dragged, 'start', 'customer_id'), item(dragged, 'end', 'id'));
        await settle(dragged);
        await userEvent.dragAndDrop(handle(dragged, 'end', 'area'), item(dragged, 'start', 'region'));
        await settle(dragged);
        expect(dragged.componentInstance.links()).toEqual(expected);
        dragged.destroy();

        const tapped = await mount();
        await userEvent.click(item(tapped, 'start', 'customer_id'));
        await userEvent.click(item(tapped, 'end', 'id'));
        await userEvent.click(item(tapped, 'end', 'area'));
        await userEvent.click(item(tapped, 'start', 'region'));
        await settle(tapped);
        expect(tapped.componentInstance.links()).toEqual(expected);
        tapped.destroy();

        const typed = await mount();
        item(typed, 'start', 'customer_id').focus();
        await userEvent.keyboard('{Enter}{Tab}{ArrowDown}{Enter}');
        await settle(typed);
        // The end list is aligned now: id moved level with customer_id, so
        // area is the last row. Walk there, pick it, and link it back to region.
        await userEvent.keyboard('{End}{Enter}{Shift>}{Tab}{/Shift}{ArrowDown}{Enter}');
        await settle(typed);
        expect(typed.componentInstance.links()).toEqual(expected);
    });

    it('keeps every line on its two handles after the lists scroll, the container resizes, and an item grows', async () => {
        const many = Array.from({ length: 30 }, (_, i) => ({ id: `col_${i}`, label: `column_${i}` }));
        const links = [
            { startId: 'col_2', endId: 'col_20' },
            { startId: 'col_14', endId: 'col_3' },
            { startId: 'col_25', endId: 'col_9' },
        ];
        const fixture = await mount(host => {
            host.start.set(many);
            host.end.set(many);
            host.links.set(links);
            host.align.set(false);
            host.extraStyle.set('--field-mapper-max-height: 260px');
        });
        expectLinesOnHandles(fixture, links);

        const scroller = root(fixture).querySelector<HTMLElement>('[data-slot="field-mapper-scroll"]')!;
        scroller.scrollTop = 400;
        await settle(fixture);
        expect(scroller.scrollTop).toBeGreaterThan(0);
        expectLinesOnHandles(fixture, links);

        fixture.componentInstance.width.set(1100);
        await settle(fixture);
        expectLinesOnHandles(fixture, links);

        // Content that grows inside the fixed-height scroller changes nothing
        // outside it; the lines below it must still follow.
        item(fixture, 'start', 'col_2').style.minHeight = '120px';
        await settle(fixture);
        expectLinesOnHandles(fixture, links);
    });

    it('cancels a drag dropped on its own list or on empty space, even when the lists share ids', async () => {
        const fixture = await mount(host => host.start.set([...ORDERS, { id: 'id', label: 'id' }]));
        await userEvent.dragAndDrop(handle(fixture, 'start', 'customer_id'), item(fixture, 'start', 'id'));
        await settle(fixture);
        await userEvent.dragAndDrop(handle(fixture, 'start', 'region'), root(fixture).querySelector('[data-slot="field-mapper-heading"]')!);
        await settle(fixture);
        expect(fixture.componentInstance.links()).toEqual([]);
        expect(root(fixture).querySelector('[data-slot="field-mapper-rubber-band"]')).toBeNull();
    });

    it('aligns each linked end item level with its partner, keeps the unlinked in order, and labels the line at its midpoint', async () => {
        const links = [
            { startId: 'customer_id', endId: 'id' },
            { startId: 'order_id', endId: 'area' },
        ];
        const fixture = await mount(host => {
            host.links.set(links);
            host.withLabels.set(true);
        });

        for (const link of links) {
            expect(item(fixture, 'end', link.endId).getBoundingClientRect().top)
                .toBeCloseTo(item(fixture, 'start', link.startId).getBoundingClientRect().top, 0);
        }
        expect(item(fixture, 'end', 'segment').getBoundingClientRect().top)
            .toBeLessThan(item(fixture, 'end', 'name').getBoundingClientRect().top);
        expectLinesOnHandles(fixture, links);

        const labels = Array.from(root(fixture).querySelectorAll<HTMLElement>('[data-slot="field-mapper-link-label"]'));
        expect(labels.map(label => label.textContent?.trim())).toEqual(['customer_id~id', 'order_id~area']);
        const ends = lineEnds(fixture)[0];
        const labelCenter = center(labels[0]);
        expect(labelCenter.x).toBeCloseTo((ends.from.x + ends.to.x) / 2, 0);
        expect(labelCenter.y).toBeCloseTo((ends.from.y + ends.to.y) / 2, 0);
    });

    it('mirrors in RTL: the start list is on the right, lines join the inner edges, and each label keeps its own direction', async () => {
        const links = [{ startId: 'region', endId: 'name' }];
        const fixture = await mount(host => {
            host.dir.set('rtl');
            host.links.set(links);
            host.withLabels.set(true);
        });
        // English labels inside a right-to-left document still run left to right.
        const itemLabel = item(fixture, 'start', 'region').querySelector('[dir]')!;
        const linkLabel = root(fixture).querySelector('[data-slot="field-mapper-link-label"] [dir]')!;
        expect(getComputedStyle(itemLabel).direction).toBe('ltr');
        expect(getComputedStyle(linkLabel).direction).toBe('ltr');

        const start = item(fixture, 'start', 'region').getBoundingClientRect();
        const end = item(fixture, 'end', 'name').getBoundingClientRect();
        expect(start.left).toBeGreaterThan(end.right);
        // Centred on the padding edge, so within the 1px border of the box edge.
        expect(Math.abs(center(handle(fixture, 'start', 'region')).x - start.left)).toBeLessThanOrEqual(1.5);
        expect(Math.abs(center(handle(fixture, 'end', 'name')).x - end.right)).toBeLessThanOrEqual(1.5);
        expectLinesOnHandles(fixture, links);

        // The key toward the other list mirrors too: from the start list it is ArrowLeft.
        item(fixture, 'start', 'region').focus();
        await userEvent.keyboard('{ArrowLeft}');
        expect(fixture.componentInstance.selected()).toEqual({ startId: 'region', endId: 'name' });
    });

    it('selects a line by clicking its hit area, and removes it with the button beside it', async () => {
        const fixture = await mount(host => {
            host.links.set([
                { startId: 'customer_id', endId: 'id' },
                { startId: 'region', endId: 'area' },
            ]);
        });
        const host = fixture.componentInstance;
        const el = root(fixture);

        // Aim 20px off the line: inside the 44px hit stroke, outside the 2px visible one.
        const hit = el.querySelectorAll<SVGPathElement>('[data-slot="field-mapper-line-hit"]')[1];
        const middle = hit.getPointAtLength(hit.getTotalLength() / 2);
        const svgBox = el.querySelector('svg')!.getBoundingClientRect();
        const box = el.getBoundingClientRect();
        await userEvent.click(el, { position: { x: svgBox.left + middle.x - box.left, y: svgBox.top + middle.y + 20 - box.top } });
        await settle(fixture);
        expect(host.selected()).toEqual({ startId: 'region', endId: 'area' });

        await userEvent.click(el.querySelector<HTMLElement>('[data-slot="field-mapper-link-label"] button')!);
        await settle(fixture);
        expect(host.links()).toEqual([{ startId: 'customer_id', endId: 'id' }]);
        expect(host.selected()).toBeNull();
    });

    it('runs a line to a filtered-out item to the edge of its list, beside a count', async () => {
        const fixture = await mount(host => {
            host.searchable.set(true);
            host.links.set([{ startId: 'customer_id', endId: 'id' }]);
        });
        const filters = root(fixture).querySelectorAll<HTMLInputElement>('input');
        await userEvent.fill(filters[1], 'are');
        await settle(fixture);

        const note = root(fixture).querySelector<HTMLElement>('[data-slot="field-mapper-hidden-note"][data-side="end"]')!;
        expect(note.textContent?.trim()).toBe('1 more linked, hidden by the filter');
        const [line] = lineEnds(fixture);
        expect(line.from.x).toBeCloseTo(center(handle(fixture, 'start', 'customer_id')).x, 0);
        expect(line.to.x).toBeCloseTo(note.getBoundingClientRect().left, 0);
        expect(line.to.y).toBeCloseTo(center(note).y, 0);
    });

    it('switches to rows at 320px with no horizontal overflow and every control at least 44px', async () => {
        const fixture = await mount(host => {
            host.width.set(320);
            host.searchable.set(true);
            host.maxLinks.set({ start: Infinity, end: 1 });
            host.end.set([
                ...CUSTOMERS,
                { id: 'ltv', label: 'customer_lifetime_value_in_original_currency_before_discounts' },
            ]);
            host.links.set([
                { startId: 'customer_id', endId: 'ltv' },
                { startId: 'customer_id', endId: 'id' },
            ]);
        });
        const el = root(fixture);
        expect(el.dataset['layout']).toBe('rows');
        expect(el.scrollWidth).toBeLessThanOrEqual(el.clientWidth);
        const box = el.getBoundingClientRect();
        for (const control of Array.from(el.querySelectorAll<HTMLElement>('button, select, input'))) {
            const rect = control.getBoundingClientRect();
            expect(rect.height).toBeGreaterThanOrEqual(44);
            expect(rect.width).toBeGreaterThanOrEqual(44);
            expect(rect.right).toBeLessThanOrEqual(box.right + 0.5);
        }
    });
});
