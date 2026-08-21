import {
    afterNextRender,
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    effect,
    ElementRef,
    inject,
    input,
    numberAttribute,
} from '@angular/core';
import { cn } from '../../lib/utils';

/**
 * Column count per breakpoint. Keys are Tailwind's breakpoint names and are
 * resolved against the masonry container's own width, not the viewport, so a
 * masonry inside a narrow pane behaves like a masonry on a narrow screen.
 */
export interface MasonryColumns {
    base?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
}

/** Either a fixed column count or a per-breakpoint map. */
export type MasonryColumnsInput = number | MasonryColumns;

/** Container widths, in px, at which each key of {@link MasonryColumns} takes over. */
const BREAKPOINTS: readonly (readonly [keyof MasonryColumns, number])[] = [
    ['xl', 1280],
    ['lg', 1024],
    ['md', 768],
    ['sm', 640],
    ['base', 0],
];

const DEFAULT_COLUMNS: MasonryColumns = { base: 1, sm: 2, lg: 3 };

/**
 * Column-balanced layout for items of uneven height, with the accessibility
 * guarantee CSS `columns` cannot give.
 *
 * ## Why not `column-count`
 *
 * CSS multi-column fills each column top-to-bottom before starting the next, so
 * the second item you read on screen is halfway down the first column while the
 * DOM — and therefore keyboard and screen-reader traversal — has it second. This
 * component instead keeps every item a direct child in **source order** and
 * positions it absolutely into the currently shortest column. Because placing an
 * item can only raise one column's height, the shortest column's height never
 * decreases: every item's top is therefore greater than or equal to the previous
 * item's top, so **DOM order is visual reading order**.
 *
 * Measurement is batched — all widths written, then all heights read, then all
 * offsets written — inside a single animation frame, driven by one
 * `ResizeObserver` on the container plus one `MutationObserver` for items being
 * added or removed. Items are never re-created, so adding one does not flash.
 */
@Component({
    selector: 'ui-masonry',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: '<ng-content />',
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"masonry"',
    },
})
export class MasonryComponent {
    /**
     * Column count — a fixed number, or a per-breakpoint map resolved against
     * the container's own width. Defaults to `{ base: 1, sm: 2, lg: 3 }`.
     */
    readonly columns = input<MasonryColumnsInput>(DEFAULT_COLUMNS);
    /** Gutter between columns and between stacked items, in pixels. */
    readonly gap = input(16, { transform: (value: unknown) => numberAttribute(value, 16) });
    /** Extra classes merged onto the host. */
    readonly class = input('');

    readonly classes = computed(() => cn('relative block w-full', this.class()));

    private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
    private readonly destroyRef = inject(DestroyRef);

    private frame: number | null = null;
    private observerCount = 0;

    /** How many elements the resize observer watches. One container, never one per item. */
    get observedElementCount(): number {
        return this.observerCount;
    }

    constructor() {
        effect(() => {
            this.columns();
            this.gap();
            this.scheduleLayout();
        });

        afterNextRender(() => this.startObserving());
    }

    private startObserving(): void {
        const el = this.host.nativeElement;

        const resizeObserver = new ResizeObserver(() => this.scheduleLayout());
        resizeObserver.observe(el);
        this.observerCount = 1;

        const mutationObserver = new MutationObserver(() => this.scheduleLayout());
        mutationObserver.observe(el, { childList: true });

        this.destroyRef.onDestroy(() => {
            resizeObserver.disconnect();
            mutationObserver.disconnect();
            this.observerCount = 0;
            if (this.frame !== null) globalThis.cancelAnimationFrame(this.frame);
        });

        this.layout();
    }

    /** Coalesces every trigger in a frame into a single layout pass. */
    private scheduleLayout(): void {
        if (this.frame !== null) return;
        this.frame = globalThis.requestAnimationFrame(() => {
            this.frame = null;
            this.layout();
        });
    }

    /**
     * Measures and positions every item. Public so a consumer that mutates item
     * content in a way neither observer can see (a font swap, an image decode)
     * can force a re-balance.
     */
    layout(): void {
        const container = this.host.nativeElement;
        const items = elementChildren(container);
        if (items.length === 0) {
            container.style.height = '';
            return;
        }

        const gap = this.gap();
        const columnCount = this.resolveColumnCount(container.clientWidth);
        const columnWidth = columnWidthFor(container.clientWidth, columnCount, gap);

        for (const item of items) applyItemFrame(item, columnWidth);

        const heights = items.map((item) => item.offsetHeight);

        const columnBottoms = new Array<number>(columnCount).fill(0);
        items.forEach((item, index) => {
            const column = shortestColumn(columnBottoms);
            const top = columnBottoms[column];
            item.style.top = `${top}px`;
            item.style.insetInlineStart = `${column * (columnWidth + gap)}px`;
            columnBottoms[column] = top + heights[index] + gap;
        });

        container.style.height = `${Math.max(...columnBottoms) - gap}px`;
    }

    private resolveColumnCount(width: number): number {
        const requested = this.columns();
        if (typeof requested === 'number') return Math.max(1, Math.floor(requested));

        for (const [key, minWidth] of BREAKPOINTS) {
            const value = requested[key];
            if (value !== undefined && width >= minWidth) return Math.max(1, Math.floor(value));
        }
        return 1;
    }
}

/**
 * The container's element children — text and comment nodes are not items.
 *
 * `Array.from` rather than a spread: `HTMLCollection` only gains
 * `[Symbol.iterator]` from the `dom.iterable` lib, and this file is copied
 * into consumer projects whose `tsconfig` may not include it.
 */
function elementChildren(container: HTMLElement): HTMLElement[] {
    return Array.from(container.children).filter(
        (child): child is HTMLElement => child instanceof HTMLElement
    );
}

/** Width of one column once the gutters between them are taken out. */
function columnWidthFor(containerWidth: number, columnCount: number, gap: number): number {
    return (containerWidth - gap * (columnCount - 1)) / columnCount;
}

/** Index of the column with the lowest bottom edge; ties go to the earliest column. */
function shortestColumn(bottoms: readonly number[]): number {
    let best = 0;
    for (let i = 1; i < bottoms.length; i++) {
        if (bottoms[i] < bottoms[best]) best = i;
    }
    return best;
}

/**
 * Takes an item out of flow at its column width. Written for every item before
 * any height is read, so the browser lays out once instead of once per item.
 */
function applyItemFrame(item: HTMLElement, columnWidth: number): void {
    item.style.position = 'absolute';
    item.style.width = `${columnWidth}px`;
}
