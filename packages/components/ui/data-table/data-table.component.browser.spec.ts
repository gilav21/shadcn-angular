import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, it, expect } from 'vitest';
import { cdp, userEvent } from 'vitest/browser';
import { DataTableComponent } from './data-table.component';
import { ColumnDef, SortDirection } from './data-table.types';
import { DataTableFilterBuilderComponent } from './sub/data-table-filter-builder.component';
import { DataTableDateFilterComponent } from './sub/data-table-date-filter.component';
import { DataTableDateRangeFilterComponent } from './sub/data-table-date-range-filter.component';
import { DataTableMultiselectFilterComponent } from './sub/data-table-multiselect-filter.component';
import type { Type } from '@angular/core';

interface TestData {
    id: string;
    name: string;
    role: string;
}

const TEST_DATA: TestData[] = [
    { id: '1', name: 'Alice', role: 'Admin' },
    { id: '2', name: 'Bob', role: 'User' },
];

const TEST_COLUMNS: ColumnDef<TestData>[] = [
    { accessorKey: 'id', header: 'ID' },
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'role', header: 'Role' },
];

interface WideRow {
    id: string;
    customer: string;
    email: string;
    region: string;
    status: string;
    notes: string;
}

const WIDE_ROWS: WideRow[] = Array.from({ length: 60 }, (_, i) => ({
    id: `ORD-${1000 + i}`,
    customer: `Customer ${i + 1}`,
    email: `customer${i + 1}@example.com`,
    region: ['North', 'South', 'East', 'West'][i % 4],
    status: i % 3 === 0 ? 'Shipped' : 'Pending',
    notes: `Follow up on order ${1000 + i}`,
}));

/** A data table in a fixed-size box, the shape a consumer app gives it: a panel of set height, narrower than the columns. */
@Component({
    template: `
    <div style="height: 350px; width: 420px">
      <ui-data-table [data]="rows" [columns]="columns()" [showPagination]="false" />
    </div>
  `,
    imports: [DataTableComponent],
})
class BoxedTableHost {
    readonly rows = WIDE_ROWS;
    readonly columns = input.required<ColumnDef<WideRow>[]>();
}

function renderBoxed(columns: ColumnDef<WideRow>[]): HTMLElement {
    TestBed.configureTestingModule({ imports: [BoxedTableHost] });
    const fixture = TestBed.createComponent(BoxedTableHost);
    fixture.componentRef.setInput('columns', columns);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
}

/** The nearest ancestor of `el` that clips and scrolls overflowing content along x. */
function horizontalScroller(el: HTMLElement): HTMLElement | null {
    for (let node = el.parentElement; node; node = node.parentElement) {
        const overflowX = getComputedStyle(node).overflowX;
        if (overflowX !== 'visible' && overflowX !== 'clip') return node;
    }
    return null;
}

/** Browser-only data-table cases: they read rendered geometry and resolved style, which jsdom cannot produce. */
describe('DataTableComponent (browser)', () => {
    it('gives the resize handle a wide touch hit area around a thin visual line', async () => {
        await TestBed.configureTestingModule({ imports: [DataTableComponent] }).compileComponents();
        const fixture = TestBed.createComponent(DataTableComponent<TestData>);
        fixture.componentRef.setInput('data', TEST_DATA);
        fixture.componentRef.setInput('columns', TEST_COLUMNS);
        fixture.componentRef.setInput('enableColumnResize', true);
        fixture.detectChanges();

        const handle = fixture.nativeElement.querySelector('[role="separator"]') as HTMLElement;
        const line = handle.querySelector('div') as HTMLElement;

        expect(handle.getBoundingClientRect().width).toBeGreaterThanOrEqual(16);
        expect(getComputedStyle(handle).touchAction).toBe('none');
        expect(line.getBoundingClientRect().width).toBe(1);
    });

    it('centres the fill handle on the bottom-right corner of the selected range', async () => {
        interface FillRow { id: string; n: number; label: string }
        await TestBed.configureTestingModule({ imports: [DataTableComponent] }).compileComponents();
        const fixture = TestBed.createComponent(DataTableComponent<FillRow>);
        fixture.componentRef.setInput('data', [
            { id: '1', n: 1, label: 'Item 1' },
            { id: '2', n: 2, label: 'Item 2' },
            { id: '3', n: 0, label: '' },
        ]);
        fixture.componentRef.setInput('columns', [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'n', header: 'N' },
            { accessorKey: 'label', header: 'Label' },
        ] as ColumnDef<FillRow>[]);
        fixture.componentRef.setInput('enableCellRangeSelection', true);
        fixture.componentRef.setInput('enableFillHandle', true);
        fixture.detectChanges();

        fixture.componentInstance.cellRange.set({ startRow: 0, startCol: 'n', endRow: 1, endCol: 'label' });
        fixture.detectChanges();
        await fixture.whenStable();

        const host = fixture.nativeElement as HTMLElement;
        const corner = host.querySelector('[data-row-index="1"] [data-column="label"]')!.getBoundingClientRect();
        const handle = host.querySelector('[data-slot="fill-handle"]')!.getBoundingClientRect();
        // within the scroll container's 1px border; a neighbouring cell is tens of pixels away
        expect(Math.abs(handle.left + handle.width / 2 - corner.right)).toBeLessThanOrEqual(2);
        expect(Math.abs(handle.top + handle.height / 2 - corner.bottom)).toBeLessThanOrEqual(2);
    });

    it('activates a sort header and a page button exactly once per Enter or Space press', async () => {
        await TestBed.configureTestingModule({ imports: [DataTableComponent] }).compileComponents();
        const fixture = TestBed.createComponent(DataTableComponent<TestData>);
        fixture.componentRef.setInput('data', Array.from({ length: 35 }, (_, i) => ({ id: String(i + 1), name: `Person ${i + 1}`, role: 'User' })));
        fixture.componentRef.setInput('columns', TEST_COLUMNS);
        fixture.detectChanges();
        const sorts: SortDirection[] = [];
        const pages: number[] = [];
        fixture.componentInstance.sortChange.subscribe((s) => sorts.push(s.direction));
        fixture.componentInstance.pageChange.subscribe((p) => pages.push(p.pageIndex));
        const host = fixture.nativeElement as HTMLElement;
        const press = async (target: HTMLElement, key: string): Promise<void> => {
            target.focus();
            await userEvent.keyboard(key);
            fixture.detectChanges();
            await fixture.whenStable();
        };

        const sortButton = (): HTMLElement =>
            host.querySelectorAll<HTMLElement>('ui-data-table-column-header button')[1];
        await press(sortButton(), '{Enter}');
        await press(sortButton(), ' ');
        // the Space press starts from asc, so it must move exactly one step, to desc
        expect(sorts).toEqual(['asc', 'desc']);

        const nextPage = (): HTMLElement =>
            [...host.querySelectorAll<HTMLElement>('ui-data-table-pagination button')]
                .find((b) => b.textContent?.includes('Go to next page'))!;
        await press(nextPage(), '{Enter}');
        await press(nextPage(), ' ');
        expect(pages).toEqual([1, 2]);
    });

    it('outlines the cells a fill-handle drag previews with a dashed line, and only those', async () => {
        interface FillRow { id: string; n: number; label: string }
        await TestBed.configureTestingModule({ imports: [DataTableComponent] }).compileComponents();
        const fixture = TestBed.createComponent(DataTableComponent<FillRow>);
        fixture.componentRef.setInput('data', [1, 2, 3, 4].map((n) => ({ id: String(n), n, label: `Item ${n}` })));
        fixture.componentRef.setInput('columns', [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'n', header: 'N' },
            { accessorKey: 'label', header: 'Label' },
        ] as ColumnDef<FillRow>[]);
        fixture.componentRef.setInput('enableFillHandle', true);
        fixture.detectChanges();
        fixture.componentInstance.focusedCell.set({ rowIndex: 0, columnKey: 'n' });
        fixture.detectChanges();
        await fixture.whenStable();

        const host = fixture.nativeElement as HTMLElement;
        const cell = (row: number, key: string): HTMLElement =>
            host.querySelector<HTMLElement>(`[data-row-index="${row}"] [data-column="${key}"]`)!;
        const target = cell(2, 'n').getBoundingClientRect();
        host.querySelector('[data-slot="fill-handle"]')!.dispatchEvent(
            new MouseEvent('mousedown', { bubbles: true, cancelable: true }),
        );
        document.dispatchEvent(new MouseEvent('mousemove', {
            clientX: target.left + target.width / 2,
            clientY: target.top + target.height / 2,
        }));
        fixture.detectChanges();

        const outline = (row: number, key: string): string => getComputedStyle(cell(row, key)).outlineStyle;
        try {
            expect([outline(1, 'n'), outline(2, 'n')]).toEqual(['dashed', 'dashed']);
            expect([outline(0, 'n'), outline(3, 'n'), outline(1, 'label')]).toEqual(['none', 'none', 'none']);
        } finally {
            document.dispatchEvent(new MouseEvent('mouseup'));
        }
    });

    it('scrolls the grid only in its scroll container, keeping the header at its top and the horizontal scrollbar in view', () => {
        const host = renderBoxed(
            (['id', 'customer', 'email', 'region', 'status', 'notes'] as const).map((key) => ({
                accessorKey: key,
                header: key,
                width: '200px',
                pin: key === 'id' ? 'left' : undefined,
            })),
        );
        const container = host.querySelector<HTMLElement>('[data-slot="table"]')!.closest<HTMLElement>('.overflow-auto')!;
        const bodyCell = host.querySelector<HTMLElement>('[data-row-index="0"] [data-column="email"]')!;

        container.scrollTop = 600;
        container.scrollLeft = 150;

        const scroller = horizontalScroller(bodyCell)!;
        expect(scroller.clientHeight).toBeLessThanOrEqual(container.clientHeight);
        expect(scroller).toBe(container);
        expect(container.scrollTop).toBe(600);
        const viewport = container.getBoundingClientRect();
        const header = host.querySelector<HTMLElement>('ui-table-header')!.getBoundingClientRect();
        expect(header.top).toBeCloseTo(viewport.top + container.clientTop, 0);
        // the pinned column sticks to the same scroll container, so it stays at its left edge
        const pinnedCell = host.querySelector<HTMLElement>('[data-row-index="20"] [data-column="id"]')!.getBoundingClientRect();
        expect(pinnedCell.left).toBeCloseTo(viewport.left + container.clientLeft, 0);
    });

    it('never renders an auto-width column narrower than its minWidth', () => {
        const host = renderBoxed([
            { accessorKey: 'id', header: 'Order' },
            { accessorKey: 'customer', header: 'Customer' },
            { accessorKey: 'email', header: 'Customer email address', minWidth: '128px' },
            { accessorKey: 'region', header: 'Region' },
            { accessorKey: 'status', header: 'Status' },
        ]);

        const widthOf = (selector: string): number => host.querySelector(selector)!.getBoundingClientRect().width;
        expect(widthOf('ui-table-header [data-column-id="email"]')).toBeGreaterThanOrEqual(128);
        expect(widthOf('[data-row-index="0"] [data-column="email"]')).toBeGreaterThanOrEqual(128);
        expect(widthOf('ui-table-header [data-column-id="region"]')).toBeGreaterThanOrEqual(80);
    });
});

/**
 * Switches Chromium's touch emulation, which is what flips `(pointer: coarse)`
 * — `Emulation.setEmulatedMedia` silently ignores the `pointer` feature.
 */
async function emulateTouch(enabled: boolean): Promise<void> {
    await cdp().send('Emulation.setTouchEmulationEnabled', { enabled, maxTouchPoints: 1 });
}

@Component({ selector: 'dt-touch-filter', template: '<input aria-label="Filter value" />' })
class TouchFilterComponent {}

interface TouchRow {
    id: string;
    name: string;
    n: number;
    children?: TouchRow[];
}

const TOUCH_ROWS: TouchRow[] = [
    { id: '1', name: 'Alpha', n: 3, children: [{ id: '1-1', name: 'Alpha child', n: 1 }] },
    { id: '2', name: 'Beta', n: 5 },
];

interface Rendered {
    host: HTMLElement;
    destroy: () => void;
}

/** A table carrying every built-in control that can render, in one of its row modes. */
async function renderTouchTable(mode: 'flat' | 'tree' | 'grouped' | 'virtual' | 'floating'): Promise<Rendered> {
    const fixture = TestBed.createComponent(DataTableComponent<TouchRow>);
    const ref = fixture.componentRef;
    ref.setInput('data', TOUCH_ROWS);
    ref.setInput('columns', [
        { accessorKey: 'name', header: 'Name', enableFiltering: true, filterComponent: TouchFilterComponent },
        { accessorKey: 'n', header: 'N' },
    ] satisfies ColumnDef<TouchRow>[]);
    ref.setInput('enableAdvancedFilter', true);
    if (mode === 'tree') {
        ref.setInput('enableSubRows', true);
    } else if (mode === 'grouped') {
        ref.setInput('groupBy', 'name');
    } else if (mode === 'virtual') {
        // fixed-height rows, left at the table's own default height
        (fixture.nativeElement as HTMLElement).style.height = '400px';
        ref.setInput('enableVirtualScroll', true);
        ref.setInput('showPagination', false);
    } else if (mode === 'floating') {
        ref.setInput('enableFloatingFilters', true);
        ref.setInput('columns', [
            { accessorKey: 'name', header: 'Name', enableFiltering: true },
            { accessorKey: 'n', header: 'N' },
        ] satisfies ColumnDef<TouchRow>[]);
    } else {
        ref.setInput('enableRowExpansion', true);
        ref.setInput('enableCellRangeSelection', true);
        ref.setInput('enableRangeActions', true);
    }
    const table = fixture.componentInstance;
    table.registerCellAction({ id: 'touch', ariaLabel: 'Row actions', onClick: () => undefined });
    table.registerHeaderAction({ id: 'touch', onClick: () => undefined });
    fixture.detectChanges();
    if (mode === 'flat') table.cellRange.set({ startRow: 0, startCol: 'name', endRow: 1, endCol: 'n' });
    fixture.detectChanges();
    await fixture.whenStable();
    return { host: fixture.nativeElement as HTMLElement, destroy: () => fixture.destroy() };
}

async function renderFilterBuilder(): Promise<Rendered> {
    const fixture = TestBed.createComponent(DataTableFilterBuilderComponent);
    fixture.componentRef.setInput('group', {
        type: 'group',
        combinator: 'and',
        rules: [
            { type: 'condition', column: 'name', operator: 'contains', value: 'Al' },
            { type: 'group', combinator: 'or', rules: [{ type: 'condition', column: 'name', operator: 'equals', value: 'Beta' }] },
        ],
    });
    fixture.componentRef.setInput('columns', [{ key: 'name', header: 'Name' }]);
    fixture.detectChanges();
    await fixture.whenStable();
    return { host: fixture.nativeElement as HTMLElement, destroy: () => fixture.destroy() };
}

/** One of the column filter components a consumer drops into a header popover, rendered on its own. */
function renderFilter(component: Type<unknown>, inputs: Record<string, unknown> = {}): () => Promise<Rendered> {
    return async () => {
        const fixture = TestBed.createComponent(component);
        for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
        fixture.detectChanges();
        await fixture.whenStable();
        return { host: fixture.nativeElement as HTMLElement, destroy: () => fixture.destroy() };
    };
}

const labelled = (host: HTMLElement, label: string): HTMLElement =>
    host.querySelector<HTMLElement>(`button[aria-label="${label}"]`)!;

const byText = (selector: string, text: string) => (host: HTMLElement): HTMLElement =>
    [...host.querySelectorAll<HTMLElement>(selector)].find((el) => el.textContent?.trim() === text)!;

interface Target {
    width: number;
    height: number;
    /** A tap 1px inside each edge of the control lands on it — nothing covers any part of it. */
    uncovered: boolean;
    /** A tap 1px inside each edge of the 44x44 square centred on the control lands on it — nothing clips or covers it. */
    reachable: boolean;
}

/** Whether a tap at each point lands on `control` (or inside it). */
function landsOn(control: HTMLElement, points: number[][]): boolean {
    return points.every(([x, y]) => {
        const hit = document.elementFromPoint(x, y);
        return !!hit && control.contains(hit);
    });
}

/** Renders fresh, measures `find`'s control, and tears down — once per pointer kind. */
async function measure(render: () => Promise<Rendered>, find: (host: HTMLElement) => HTMLElement): Promise<Target> {
    const { host, destroy } = await render();
    const control = find(host);
    // the test frame is phone-narrow: scroll to the control as a user would
    control.scrollIntoView({ block: 'center', inline: 'center' });
    const { left, right, top, bottom, width, height } = control.getBoundingClientRect();
    const [cx, cy] = [(left + right) / 2, (top + bottom) / 2];
    const uncovered = landsOn(control, [[left + 1, cy], [right - 1, cy], [cx, top + 1], [cx, bottom - 1]]);
    const reachable = landsOn(control, [[cx - 21, cy], [cx + 21, cy], [cx, cy - 21], [cx, cy + 21]]);
    destroy();
    return { width, height, uncovered, reachable };
}

describe('DataTableComponent touch targets (browser)', () => {
    afterEach(() => emulateTouch(false));

    /*
     * WCAG 2.5.8 / CLAUDE.md §6: every interactive control is at least 44x44
     * and fully hittable on a touch screen, keeps its desktop size for a
     * mouse, and is never partly covered by a neighbour on either pointer.
     */
    it.each([
        { control: 'header column menu', render: () => renderTouchTable('flat'), label: 'Column menu for Name', fine: [24, 24] },
        { control: 'header filter', render: () => renderTouchTable('flat'), label: 'Filter Name', fine: [32, 32] },
        { control: 'header expand-all rows', render: () => renderTouchTable('flat'), label: 'Expand all rows', fine: [28, 28] },
        { control: 'header expand-all sub-rows', render: () => renderTouchTable('tree'), label: 'Expand all sub-rows', fine: [24, 24] },
        { control: 'row actions', render: () => renderTouchTable('flat'), label: 'Row actions', fine: [32, 32] },
        { control: 'virtual row actions', render: () => renderTouchTable('virtual'), label: 'Row actions', fine: [32, 32] },
        { control: 'row expander', render: () => renderTouchTable('flat'), label: 'Expand row', fine: [23, 28] },
        { control: 'sub-row expander', render: () => renderTouchTable('tree'), label: 'Expand sub-rows', fine: [24, 24] },
        { control: 'group toggle', render: () => renderTouchTable('grouped'), label: 'Collapse group', fine: [24, 24] },
        { control: 'filter-builder remove condition', render: renderFilterBuilder, label: 'Remove condition', fine: [28, 28] },
    ])('grows the $control button to 44x44 on a coarse pointer only', async ({ render, label, fine }) => {
        const find = (host: HTMLElement): HTMLElement => labelled(host, label);
        await emulateTouch(false);
        const mouse = await measure(render, find);
        await emulateTouch(true);
        const touch = await measure(render, find);

        expect([mouse.width, mouse.height]).toEqual(fine);
        expect(mouse.uncovered).toBe(true);
        expect(Math.min(touch.width, touch.height)).toBeGreaterThanOrEqual(44);
        expect(touch.reachable).toBe(true);
    });

    it.each([
        { control: 'advanced-filter toolbar', render: () => renderTouchTable('flat'), find: (h: HTMLElement) => h.querySelector<HTMLElement>('[data-slot="advanced-filter-trigger"]')!, fineHeight: 32 },
        { control: 'columns toolbar', render: () => renderTouchTable('flat'), find: byText('button', 'Columns'), fineHeight: 32 },
        { control: 'global filter input', render: () => renderTouchTable('flat'), find: (h: HTMLElement) => h.querySelector<HTMLElement>('input[placeholder="Filter..."]')!, fineHeight: 32 },
        { control: 'floating filter input', render: () => renderTouchTable('floating'), find: (h: HTMLElement) => h.querySelector<HTMLElement>('input[placeholder="Name"]')!, fineHeight: 28 },
        { control: 'column sort', render: () => renderTouchTable('flat'), find: (h: HTMLElement) => h.querySelector<HTMLElement>('ui-data-table-column-header button')!, fineHeight: 32 },
        { control: 'range chart', render: () => renderTouchTable('flat'), find: (h: HTMLElement) => h.querySelector<HTMLElement>('[data-slot="range-actions"] button')!, fineHeight: 24 },
        { control: 'filter-builder AND/OR toggle', render: renderFilterBuilder, find: byText('button', 'AND'), fineHeight: 24 },
        { control: 'filter-builder remove group', render: renderFilterBuilder, find: byText('button', 'Remove group'), fineHeight: 16 },
        { control: 'filter-builder add condition', render: renderFilterBuilder, find: byText('button', '+ Condition'), fineHeight: 32 },
        { control: 'filter-builder column select', render: renderFilterBuilder, find: (h: HTMLElement) => h.querySelector<HTMLElement>('select')!, fineHeight: 32 },
        { control: 'filter-builder value input', render: renderFilterBuilder, find: (h: HTMLElement) => h.querySelector<HTMLElement>('input')!, fineHeight: 32 },
        { control: 'date filter', render: renderFilter(DataTableDateFilterComponent), find: byText('button', 'Today'), fineHeight: 28 },
        { control: 'date-range filter preset', render: renderFilter(DataTableDateRangeFilterComponent), find: byText('button', 'Today'), fineHeight: 28 },
        { control: 'multiselect filter', render: renderFilter(DataTableMultiselectFilterComponent, { options: ['Alpha', 'Beta'] }), find: byText('button', 'Select all'), fineHeight: 28 },
    ])('makes the $control control at least 44px tall and wide on a coarse pointer only', async ({ render, find, fineHeight }) => {
        await emulateTouch(false);
        const mouse = await measure(render, find);
        await emulateTouch(true);
        const touch = await measure(render, find);

        expect(mouse.height).toBe(fineHeight);
        expect(mouse.uncovered).toBe(true);
        expect(Math.min(touch.width, touch.height)).toBeGreaterThanOrEqual(44);
        expect(touch.reachable).toBe(true);
    });
});
