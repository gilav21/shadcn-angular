import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    VirtualScrollComponent,
    VirtualItemDirective,
    type VirtualScrollOrientation,
    type VirtualScrollWindow2D,
} from './virtual-scroll.component';
import { VirtualAxis } from './virtual-scroll.axis';

/**
 * Feature specs for horizontal and 2D virtualization (T-15) plus the extracted
 * `VirtualAxis`. `virtual-scroll.component.spec.ts` and
 * `virtual-scroll.runway.spec.ts` are the untouched backward-compatibility gate
 * for the vertical axis.
 */

interface Cell { id: number }

const CELL_WIDTH = 100;
const CELL_HEIGHT = 50;

/**
 * jsdom-free but layout-free all the same: the browser gives the container no
 * size unless we pin one, so scroll offsets and client metrics are installed
 * as own properties on the element (own properties shadow the prototype
 * whatever the ordering, and die with the element).
 */
function installMetrics(
    el: HTMLElement,
    metrics: { clientWidth: number; clientHeight: number; scrollWidth: number; scrollHeight: number },
): () => void {
    let scrollLeft = 0;
    let scrollTop = 0;
    const props: Record<string, PropertyDescriptor> = {
        clientWidth: { get: () => metrics.clientWidth, configurable: true },
        clientHeight: { get: () => metrics.clientHeight, configurable: true },
        scrollWidth: { get: () => metrics.scrollWidth, configurable: true },
        scrollHeight: { get: () => metrics.scrollHeight, configurable: true },
        scrollLeft: {
            get: () => scrollLeft,
            set: (v: number) => { scrollLeft = v; },
            configurable: true,
        },
        scrollTop: {
            get: () => scrollTop,
            set: (v: number) => { scrollTop = v; },
            configurable: true,
        },
        scrollTo: {
            value: (options: ScrollToOptions) => {
                if (options.left !== undefined) scrollLeft = options.left;
                if (options.top !== undefined) scrollTop = options.top;
            },
            configurable: true,
        },
    };
    Object.entries(props).forEach(([name, descriptor]) => Object.defineProperty(el, name, descriptor));
    return () => Object.keys(props).forEach(name =>
        delete (el as unknown as Record<string, unknown>)[name]
    );
}

/**
 * Drives the component's private `handleResizes` with synthetic entries.
 * jsdom-free but layout-free all the same: a real `ResizeObserver` never fires
 * here, so the measurement path has to be invoked directly — the same technique
 * `virtual-scroll.runway.spec.ts` uses for the vertical axis.
 */
interface ResizeSpec {
    index?: number;
    row?: number;
    column?: number;
    blockSize?: number;
    inlineSize?: number;
}

function resize(vs: VirtualScrollComponent<Cell>, specs: ResizeSpec[]): void {
    const entries = specs.map(spec => ({
        target: {
            dataset: {
                index: spec.index === undefined ? undefined : String(spec.index),
                row: spec.row === undefined ? undefined : String(spec.row),
                column: spec.column === undefined ? undefined : String(spec.column),
            },
        },
        borderBoxSize: [{
            blockSize: spec.blockSize ?? CELL_HEIGHT,
            inlineSize: spec.inlineSize ?? CELL_WIDTH,
        }],
    })) as unknown as ResizeObserverEntry[];

    (vs as unknown as { handleResizes(e: ResizeObserverEntry[]): void }).handleResizes(entries);
}

@Component({
    imports: [VirtualScrollComponent, VirtualItemDirective],
    template: `
        <ui-virtual-scroll
            [items]="items()"
            [orientation]="orientation()"
            [columnCount]="columnCount()"
            [minItemWidth]="100"
            [minItemHeight]="50"
            [buffer]="buffer()"
            [hasMore]="false"
            (cellWindowChange)="cellWindows.push($event)"
        >
            <ng-template uiVirtualItem let-item let-i="index">
                <span class="cell">{{ $any(item).id }}#{{ i }}</span>
            </ng-template>
        </ui-virtual-scroll>
    `,
})
class AxesHostComponent {
    readonly items = signal<Cell[]>([]);
    readonly orientation = signal<VirtualScrollOrientation>('horizontal');
    readonly columnCount = signal(1);
    readonly buffer = signal(0);
    readonly cellWindows: VirtualScrollWindow2D[] = [];
}

describe('VirtualAxis', () => {
    it('estimates every unmeasured item at the supplied estimate', () => {
        const axis = new VirtualAxis(10);
        expect(axis.offsetForIndex(0, 20)).toBe(0);
        expect(axis.offsetForIndex(5, 20)).toBe(100);
        expect(axis.offsetForIndex(25, 20)).toBe(500);
    });

    it('corrects offsets once an item is measured', () => {
        const axis = new VirtualAxis(10);
        expect(axis.record(0, 60, 20)).toBe(40);
        expect(axis.offsetForIndex(1, 20)).toBe(60);
        expect(axis.offsetForIndex(5, 20)).toBe(140);
    });

    it('ignores sub-pixel measurement noise', () => {
        const axis = new VirtualAxis(10);
        expect(axis.record(0, 20.2, 20)).toBe(0);
        expect(axis.offsetForIndex(1, 20)).toBe(20);
    });

    it('maps an offset back to the covering index across chunk boundaries', () => {
        const axis = new VirtualAxis(10);
        expect(axis.indexForOffset(0, 20, 100)).toBe(0);
        expect(axis.indexForOffset(19, 20, 100)).toBe(0);
        expect(axis.indexForOffset(20, 20, 100)).toBe(1);
        expect(axis.indexForOffset(400, 20, 100)).toBe(20);
    });

    it('clamps an out-of-range offset to the last index', () => {
        const axis = new VirtualAxis(10);
        expect(axis.indexForOffset(999_999, 20, 30)).toBe(29);
    });

    it('reports the total extent including corrections', () => {
        const axis = new VirtualAxis(10);
        expect(axis.totalSize(100, 20)).toBe(2000);
        axis.record(3, 70, 20);
        expect(axis.totalSize(100, 20)).toBe(2050);
    });

    it('returns an empty window for an empty axis', () => {
        expect(new VirtualAxis(10).window(0, 500, 20, 0)).toEqual({ start: 0, end: 0 });
    });

    it('windows only the items covering the viewport', () => {
        const axis = new VirtualAxis(10);
        expect(axis.window(0, 100, 20, 100)).toEqual({ start: 0, end: 5 });
        expect(axis.window(200, 100, 20, 100)).toEqual({ start: 10, end: 15 });
    });
});

describe('VirtualScrollComponent — horizontal orientation', () => {
    let fixture: ComponentFixture<AxesHostComponent>;
    let host: AxesHostComponent;
    let vs: VirtualScrollComponent<Cell>;
    let container: HTMLElement;
    let restore: () => void;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [AxesHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(AxesHostComponent);
        host = fixture.componentInstance;
        host.items.set(Array.from({ length: 500 }, (_, id) => ({ id })));
        host.orientation.set('horizontal');
        fixture.detectChanges();

        vs = fixture.debugElement.query(By.directive(VirtualScrollComponent)).componentInstance;
        container = fixture.nativeElement.querySelector('[data-slot="virtual-scroll"]');
        restore = installMetrics(container, {
            clientWidth: 500,
            clientHeight: 200,
            scrollWidth: 500 * CELL_WIDTH,
            scrollHeight: 200,
        });
        vs.containerWidth.set(500);
        vs.containerHeight.set(200);
        fixture.detectChanges();
    });

    afterEach(() => {
        restore();
        fixture.destroy();
    });

    it('renders only the horizontal window', () => {
        expect(vs.renderRange()).toEqual({ start: 0, end: 5 });
        expect(fixture.nativeElement.querySelectorAll('.cell')).toHaveLength(5);
    });

    it('moves the window as the X axis scrolls', () => {
        container.scrollLeft = 1000;
        container.dispatchEvent(new Event('scroll'));
        fixture.detectChanges();

        expect(vs.renderRange()).toEqual({ start: 10, end: 15 });
        expect(vs.paddingStart()).toBe(1000);
    });

    it('pads both ends of the X axis so the scrollbar spans the full list', () => {
        container.scrollLeft = 1000;
        container.dispatchEvent(new Event('scroll'));
        fixture.detectChanges();

        expect(vs.paddingStart() + vs.paddingEnd() + 5 * CELL_WIDTH).toBe(500 * CELL_WIDTH);
    });

    it('leaves the Y padding at zero', () => {
        expect(vs.paddingTop()).toBe(0);
        expect(vs.paddingBottom()).toBe(0);
    });

    it('marks the container with its orientation and scrolls on X', () => {
        expect(container.dataset['orientation']).toBe('horizontal');
        expect(vs.containerClasses()).toContain('overflow-x-auto');
    });

    it('scrollToIndex moves the X axis, not the Y axis', () => {
        vs.scrollToIndex(20);
        expect(container.scrollLeft).toBe(2000);
        expect(container.scrollTop).toBe(0);
    });

    it('records a measured cell WIDTH on the column axis', () => {
        resize(vs, [{ index: 0, inlineSize: 240 }]);
        fixture.detectChanges();

        vs.scrollToIndex(1);
        expect(container.scrollLeft).toBe(240);
    });

    it('anchors the X scroll when a cell BEFORE the viewport grows', () => {
        container.scrollLeft = 1000;
        container.dispatchEvent(new Event('scroll'));
        fixture.detectChanges();
        expect(vs.renderRange().start).toBe(10);

        resize(vs, [{ index: 3, inlineSize: 180 }]);

        expect(container.scrollLeft).toBe(1000 + (180 - CELL_WIDTH));
    });

    it('scrollToBottom moves the X axis in horizontal mode', () => {
        vs.scrollToBottom();
        expect(container.scrollLeft).toBe(500 * CELL_WIDTH);
        expect(container.scrollTop).toBe(0);
    });

    it('emits no 2D window on a single axis', () => {
        expect(host.cellWindows).toHaveLength(0);
    });
});

describe('VirtualScrollComponent — 2D (both axes)', () => {
    let fixture: ComponentFixture<AxesHostComponent>;
    let host: AxesHostComponent;
    let vs: VirtualScrollComponent<Cell>;
    let container: HTMLElement;
    let restore: () => void;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [AxesHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(AxesHostComponent);
        host = fixture.componentInstance;
        host.items.set(Array.from({ length: 100 * 40 }, (_, id) => ({ id })));
        host.orientation.set('both');
        host.columnCount.set(40);
        fixture.detectChanges();

        vs = fixture.debugElement.query(By.directive(VirtualScrollComponent)).componentInstance;
        container = fixture.nativeElement.querySelector('[data-slot="virtual-scroll"]');
        restore = installMetrics(container, {
            clientWidth: 500,
            clientHeight: 200,
            scrollWidth: 40 * CELL_WIDTH,
            scrollHeight: 100 * CELL_HEIGHT,
        });
        vs.containerWidth.set(500);
        vs.containerHeight.set(200);
        fixture.detectChanges();
    });

    afterEach(() => {
        restore();
        fixture.destroy();
    });

    it('derives the row count from the column count', () => {
        expect(vs.gridColumns()).toBe(40);
        expect(vs.gridRows()).toBe(100);
    });

    it('renders the intersection of both windows, not a whole row or column', () => {
        expect(vs.renderRange()).toEqual({ start: 0, end: 4 });
        expect(vs.columnRenderRange()).toEqual({ start: 0, end: 5 });
        expect(fixture.nativeElement.querySelectorAll('.cell')).toHaveLength(4 * 5);
    });

    it('windows both axes at once after a diagonal scroll', () => {
        container.scrollTop = 500;
        container.scrollLeft = 1000;
        container.dispatchEvent(new Event('scroll'));
        fixture.detectChanges();

        expect(vs.renderRange()).toEqual({ start: 10, end: 14 });
        expect(vs.columnRenderRange()).toEqual({ start: 10, end: 15 });
        expect(vs.paddingTop()).toBe(500);
        expect(vs.paddingStart()).toBe(1000);
    });

    it('gives every rendered cell its flat index, row and column', () => {
        container.scrollTop = 500;
        container.scrollLeft = 1000;
        container.dispatchEvent(new Event('scroll'));
        fixture.detectChanges();

        const first = vs.visibleCellRows()[0].cells[0];
        expect(first).toMatchObject({ row: 10, column: 10, index: 10 * 40 + 10 });
        expect(first.item.id).toBe(410);
    });

    it('emits the 2D window whenever it moves', () => {
        host.cellWindows.length = 0;
        container.scrollTop = 500;
        container.dispatchEvent(new Event('scroll'));
        fixture.detectChanges();

        expect(host.cellWindows.at(-1)).toEqual({
            rowStart: 10, rowEnd: 14, columnStart: 0, columnEnd: 5,
        });
    });

    it('omits the holes of a ragged final row rather than rendering undefined cells', () => {
        host.items.set(Array.from({ length: 42 }, (_, id) => ({ id })));
        fixture.detectChanges();

        expect(vs.gridRows()).toBe(2);
        const lastRow = vs.visibleCellRows().at(-1);
        expect(lastRow?.row).toBe(1);
        expect(lastRow?.cells).toHaveLength(2);
    });

    it('scrollToCell moves both axes', () => {
        vs.scrollToCell(10, 20);
        expect(container.scrollTop).toBe(500);
        expect(container.scrollLeft).toBe(2000);
    });

    it('anchors the scroll when a row ABOVE the viewport grows', () => {
        container.scrollTop = 500;
        container.dispatchEvent(new Event('scroll'));
        fixture.detectChanges();
        expect(vs.renderRange().start).toBe(10);

        // Row 5 is above the viewport; growing it must push the content down so
        // what the user is reading stays put.
        resize(vs, [{ row: 5, blockSize: 150 }]);

        expect(container.scrollTop).toBe(500 + (150 - CELL_HEIGHT));
    });

    it('anchors the scroll when a column BEFORE the viewport grows', () => {
        container.scrollLeft = 1000;
        container.dispatchEvent(new Event('scroll'));
        fixture.detectChanges();
        expect(vs.columnRenderRange().start).toBe(10);

        resize(vs, [{ column: 5, inlineSize: 220 }]);

        expect(container.scrollLeft).toBe(1000 + (220 - CELL_WIDTH));
    });

    it('does not shift the scroll for a cell INSIDE the viewport', () => {
        container.scrollTop = 500;
        container.scrollLeft = 1000;
        container.dispatchEvent(new Event('scroll'));
        fixture.detectChanges();

        resize(vs, [{ row: 12, column: 12, blockSize: 150, inlineSize: 220 }]);

        expect(container.scrollTop).toBe(500);
        expect(container.scrollLeft).toBe(1000);
    });

    it('counts a row delta once, not once per column of that row', () => {
        container.scrollTop = 500;
        container.dispatchEvent(new Event('scroll'));
        fixture.detectChanges();

        // Every cell of row 5 reports the same new row height.
        resize(vs, [
            { row: 5, column: 0, blockSize: 150 },
            { row: 5, column: 1, blockSize: 150 },
            { row: 5, column: 2, blockSize: 150 },
        ]);

        expect(container.scrollTop).toBe(600);
    });

    it('feeds both axes from one measurement', () => {
        resize(vs, [{ row: 0, column: 0, blockSize: 90, inlineSize: 140 }]);
        fixture.detectChanges();

        expect(vs.paddingTop()).toBe(0);
        vs.scrollToCell(1, 1);
        expect(container.scrollTop).toBe(90);
        expect(container.scrollLeft).toBe(140);
    });

    it('anchors a BUFFERED column on the same terms as a buffered row', () => {
        // With a buffer the render window starts before the viewport, so
        // `columnRenderRange().start` and the unbuffered viewport start diverge.
        // Anchoring must key off the viewport start on BOTH axes, or a column
        // that is rendered-but-off-screen goes uncorrected while its row-axis
        // equivalent does not.
        host.buffer.set(3);
        fixture.detectChanges();

        container.scrollTop = 500;
        container.scrollLeft = 1000;
        container.dispatchEvent(new Event('scroll'));
        fixture.detectChanges();

        expect(vs.columnRenderRange().start).toBe(7);
        expect(vs.renderRange().start).toBe(7);

        // Column 8 and row 8 are both inside the buffer but before the viewport
        // (which starts at 10). Both must produce a correction.
        resize(vs, [{ row: 8, blockSize: 150 }]);
        expect(container.scrollTop).toBe(500 + (150 - CELL_HEIGHT));

        resize(vs, [{ column: 8, inlineSize: 220 }]);
        expect(container.scrollLeft).toBe(1000 + (220 - CELL_WIDTH));
    });

    it('reports no visibleItems in grid mode, since renderRange indexes rows', () => {
        expect(vs.visibleItems()).toEqual([]);
    });

    it('treats a columnCount below one as a single column instead of dividing by zero', () => {
        host.columnCount.set(0);
        fixture.detectChanges();

        expect(vs.gridColumns()).toBe(1);
        expect(vs.gridRows()).toBe(host.items().length);
    });
});
