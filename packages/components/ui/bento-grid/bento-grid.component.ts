import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    signal,
    output,
    Type,
    inject,
    ElementRef,
    effect,
    ComponentRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { cn, isRtl } from '../../lib/utils';
import {
    ContextMenuComponent,
    ContextMenuContentComponent,
    ContextMenuItemComponent,
} from '../context-menu';
import { UiComponentOutletDirective } from '../component-outlet.directive';
import { onPointerDrag } from '../../lib/touch';



export type ResizeDirection = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';

export interface DashboardItem {
    id: string;
    x: number;
    y: number;
    cols: number;
    rows: number;
    content: string | Type<unknown>;
    inputs?: Record<string, unknown>;
    outputs?: Record<string, (event: unknown) => void>;
    bindings?: Record<string, string>;
}

/** Union of all data shapes passed to the context-menu via `menu.show()`. */
export type BentoContextMenuData =
    | (DashboardItem & { type?: never })
    | { type: 'empty'; id?: never; x: number; y: number };

@Component({
    selector: 'ui-bento-grid',
    standalone: true,
    imports: [
        CommonModule,
        ContextMenuComponent,
        ContextMenuContentComponent,
        ContextMenuItemComponent,
        UiComponentOutletDirective
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './bento-grid.component.html',
    styleUrl: './bento-grid.component.css',
})
export class BentoGridComponent {
    /** Extra classes merged onto the grid container, after the built-in `grid w-full relative` utilities. */
    readonly class = input<string>('');
    // Inputs
    /**
     * The widgets to lay out. **The grid never mutates this array** — every drag,
     * resize, merge, split, add and delete emits the next array through
     * {@link itemsChange} and the consumer must store it and feed it back here.
     * Coordinates are 1-based CSS-grid line numbers, not zero-based indices.
     */
    readonly items = input<DashboardItem[]>([]);
    /**
     * Number of columns in the track. Also the divisor used to convert pointer
     * coordinates into grid cells, so changing it re-interprets existing
     * {@link DashboardItem.x} values rather than rescaling them. Fixed at all
     * viewport widths — the grid does not collapse to fewer columns on mobile.
     */
    readonly cols = input<number>(12);
    /** Height of one row, as `grid-auto-rows`. A bare number or numeric string is taken as px. Feeds the drag/resize snap step together with {@link gap}. */
    readonly rowHeight = input<string, string | number>('120px', {
        transform: v => {
            if (typeof v === 'number') return `${v}px`;
            if (typeof v === 'string' && !Number.isNaN(Number.parseFloat(v)) && Number.isFinite(Number(v))) return `${v}px`;
            return v;
        }
    });
    /**
     * Width of one column used when converting pointer position to a cell.
     * Keep the default `'1fr'` for a fluid grid; a fixed value (px/rem) is only
     * needed when the tracks are not equal fractions. Note the rendered
     * `grid-template-columns` is always `repeat(cols, minmax(0,1fr))`, so a
     * non-`1fr` value here only changes hit-testing maths, not the layout.
     */
    readonly columnWidth = input<string, string | number>('1fr', {
        transform: v => {
            if (typeof v === 'number') return `${v}px`;
            if (typeof v === 'string' && !Number.isNaN(Number.parseFloat(v)) && Number.isFinite(Number(v))) return `${v}px`;
            return v;
        }
    });
    /** Gutter between cells. Counted into the drag/resize snap step, so a wrong value here makes items land one cell off. Bare numbers are taken as px. */
    readonly gap = input<string, string | number>('1.5rem', {
        transform: v => {
            if (typeof v === 'number') return `${v}px`;
            if (typeof v === 'string' && !Number.isNaN(Number.parseFloat(v)) && Number.isFinite(Number(v))) return `${v}px`;
            return v;
        }
    });
    /** Draws the outline around each widget. Purely cosmetic — hit-testing and the drop preview are unaffected. */
    readonly showBorders = input<boolean>(true);
    /** Corner radius applied to every widget. Bare numbers are taken as px. */
    readonly borderRadius = input<string, string | number>('0.75rem', {
        transform: v => {
            if (typeof v === 'number') return `${v}px`;
            if (typeof v === 'string' && !Number.isNaN(Number.parseFloat(v)) && Number.isFinite(Number(v))) return `${v}px`;
            return v;
        }
    });
    /** Inner padding of each widget. It eats into the cell, it does not grow it — set `0` when a projected component paints edge to edge. */
    readonly itemPadding = input<string, string | number>('1rem', {
        transform: v => {
            if (typeof v === 'number') return `${v}px`;
            if (typeof v === 'string' && !Number.isNaN(Number.parseFloat(v)) && Number.isFinite(Number(v))) return `${v}px`;
            return v;
        }
    });
    /**
     * Master switch for every edit affordance: drag, resize handles, selection,
     * context menus and drops. Turning it off also clears the current selection
     * (and emits an empty {@link selectionChange}) and hides the cell grid overlay.
     */
    readonly editable = input<boolean>(true);

    // Outputs
    /**
     * The complete next layout after a drag, resize, merge, split, delete or add.
     * The grid does **not** persist it — store it and feed it back through
     * {@link items}, or the widget snaps back on the next change detection.
     * Neighbours overlapped by the moved item are shrunk (or dropped entirely when
     * they cannot shrink), so the array may be shorter than the one you passed in.
     */
    readonly itemsChange = output<DashboardItem[]>();
    /** The ids currently selected, after every {@link toggleSelection} / {@link clearSelection} and whenever {@link editable} goes false. */
    readonly selectionChange = output<string[]>();
    /**
     * A widget dragged in from outside was dropped. `x`/`y` carry the target cell
     * only when the drop landed on empty canvas; when it landed on an existing
     * widget you get `targetId` and no coordinates. The payload comes from the
     * drag source's `application/json` data (`{ type: 'widget', id }`) — the grid
     * adds nothing to {@link items} itself, the consumer must.
     */
    readonly externalDrop = output<{ widgetId: string, targetId: string | null, x?: number, y?: number }>();
    /** Fires once per dynamically rendered widget whose `content` is a component type, handing over its `ComponentRef` for imperative wiring the `inputs`/`outputs` maps cannot express. */
    readonly componentInit = output<{ id: string, ref: ComponentRef<unknown> }>();

    private readonly el = inject(ElementRef);

    readonly gridPattern = computed(() => {
        const color = 'currentColor';
        return `radial-gradient(circle at 1px 1px, ${color} 1px, transparent 0)`;
    });

    readonly gridBackgroundSize = computed(() => {
        const gap = this.gap();
        const rowHeight = this.rowHeight();
        const cols = this.cols();
        const colWidth = this.columnWidth();

        const rowSize = `calc(${rowHeight} + ${gap})`;
        const colSize = colWidth === '1fr'
            ? `calc((100% + ${gap}) / ${cols})`
            : `calc(${colWidth} + ${gap})`;

        return `${colSize} ${rowSize}`;
    });

    /**
     * Parses a CSS dimension string into a pixel value.
     * @param value The CSS dimension string (e.g., '1rem', '16px', '10%').
     * @param referenceValue The reference value for percentage calculations (e.g., container width).
     * @returns The pixel value.
     */
    private parseCssDimension(value: string, referenceValue: number = 0): number {
        if (!value) return 0;
        const num = Number.parseFloat(value);
        if (Number.isNaN(num)) return 0;

        if (value.endsWith('rem')) {
            const fontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
            return num * fontSize;
        }
        if (value.endsWith('em')) {
            const fontSize = Number.parseFloat(getComputedStyle(this.el.nativeElement).fontSize) || 16;
            return num * fontSize;
        }
        if (value.endsWith('%')) {
            return (num / 100) * referenceValue;
        }
        if (value.endsWith('px')) {
            return num;
        }
        // Default to pixels if no unit
        return num;
    }



    readonly draggedItemId = signal<string | null>(null);
    readonly dropTargetId = signal<string | null>(null);
    readonly selectedItemIds = signal<string[]>([]);

    constructor() {
        effect(() => {
            if (!this.editable()) {
                this.selectedItemIds.set([]);
            }
        });
    }

    readonly selectedIds = computed(() => new Set(this.selectedItemIds()));

    /**
     * Adds or removes a widget from the selection and emits {@link selectionChange}.
     * No-op while {@link editable} is false.
     * @param multi When true (default) the id is appended to the existing selection;
     * when false it replaces it. Either way, clicking an already-selected id deselects it.
     */
    toggleSelection(id: string, multi: boolean = true): void {
        if (!this.editable()) return;

        this.selectedItemIds.update(ids => {
            let newIds;
            if (ids.includes(id)) {
                newIds = ids.filter(i => i !== id);
            } else if (multi) {
                newIds = [...ids, id];
            } else {
                newIds = [id];
            }
            return newIds;
        });
        this.selectionChange.emit(this.selectedItemIds());
    }

    /** Drops the whole selection and emits an empty {@link selectionChange}. Unlike {@link toggleSelection} this runs even when {@link editable} is false. */
    clearSelection(): void {
        this.selectedItemIds.set([]);
        this.selectionChange.emit([]);
    }

    /** Whether the widget is in the current selection. Template helper — O(1), backed by a `Set`. */
    isSelected(id: string): boolean {
        return this.selectedIds().has(id);
    }

    readonly canMerge = computed(() => {
        const selectedIds = this.selectedItemIds();
        if (selectedIds.length < 2) return false;

        const items = this.items().filter(i => selectedIds.includes(i.id));
        if (items.length !== selectedIds.length) return false;



        const visited = new Set<string>();
        const queue = [items[0]];
        visited.add(items[0].id);

        while (queue.length > 0) {
            const current = queue.shift();
            if (!current) { break; }

            const neighbors = items.filter(other =>
                !visited.has(other.id) && this.areAdjacent(current, other)
            );

            for (const neighbor of neighbors) {
                visited.add(neighbor.id);
                queue.push(neighbor);
            }
        }

        return visited.size === items.length;
    });

    /**
     * Whether two widgets share an edge — they must touch along a side *and*
     * overlap on the perpendicular axis. Corner-to-corner contact is not
     * adjacency. Used to decide whether a selection can be merged.
     */
    areAdjacent(a: DashboardItem, b: DashboardItem): boolean {
        const aX1 = a.x, aX2 = a.x + a.cols;
        const aY1 = a.y, aY2 = a.y + a.rows;
        const bX1 = b.x, bX2 = b.x + b.cols;
        const bY1 = b.y, bY2 = b.y + b.rows;

        const horizontalTouch = (aX2 === bX1 || bX2 === aX1) && (aY1 < bY2 && aY2 > bY1);
        const verticalTouch = (aY2 === bY1 || bY2 === aY1) && (aX1 < bX2 && aX2 > bX1);

        return horizontalTouch || verticalTouch;
    }

    /**
     * Replaces the selected widgets with a single one covering their bounding box,
     * then clears the selection. Requires the selection to be edge-connected
     * (see {@link areAdjacent}) — otherwise it is a no-op. The survivor keeps the
     * id and content of the top-left member; the other widgets' content is lost.
     * Emits {@link itemsChange}; nothing is persisted.
     */
    mergeSelected(): void {
        if (!this.canMerge()) return;

        const selectedIds = this.selectedItemIds();
        const itemsToMerge = this.items().filter(i => selectedIds.includes(i.id));



        itemsToMerge.sort((a, b) => {
            if (a.y === b.y) return a.x - b.x;
            return a.y - b.y;
        });

        const primary = itemsToMerge[0];

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        itemsToMerge.forEach(item => {
            minX = Math.min(minX, item.x);
            minY = Math.min(minY, item.y);
            maxX = Math.max(maxX, item.x + item.cols - 1);
            maxY = Math.max(maxY, item.y + item.rows - 1);
        });

        const newItem: DashboardItem = {
            ...primary,
            x: minX,
            y: minY,
            cols: maxX - minX + 1,
            rows: maxY - minY + 1,
        };


        const newItems = this.items().filter(i => !selectedIds.includes(i.id));
        newItems.push(newItem);

        this.itemsChange.emit(newItems);
        this.selectedItemIds.set([]);
        this.selectionChange.emit([]);
    }

    /**
     * Template handler for right-click on a widget: suppresses the browser menu
     * and opens `menu` at the pointer with the item as its data. Right-click only —
     * there is no long-press equivalent, so the per-item menu is unreachable on
     * touch. No-op while {@link editable} is false.
     */
    onContextMenu(event: MouseEvent, item: DashboardItem, menu: ContextMenuComponent): void {
        if (!this.editable()) return;
        event.preventDefault();
        event.stopPropagation();
        menu.show(event.clientX, event.clientY, item);
    }

    /** Emits {@link itemsChange} without the given widget, leaving a hole — surviving widgets are not reflowed. Ignores an undefined id so it can be bound straight to context-menu data. */
    deleteItem(id: string | undefined): void {
        if (!id) return;
        this.itemsChange.emit(this.items().filter(i => i.id !== id));
    }

    /**
     * Halves a widget along `direction` and emits {@link itemsChange} with both
     * pieces. The first half keeps the original id and content; the second gets a
     * fresh `crypto.randomUUID()` and the placeholder content `'New Item'`, so a
     * component-backed widget is *not* duplicated. No-op when the widget is only
     * one cell across the axis being split (`cols`/`rows` < 2).
     * @param direction `'vertical'` splits the columns (side by side), `'horizontal'` the rows (stacked).
     */
    splitItem(id: string | undefined, direction: 'vertical' | 'horizontal'): void {
        const item = id ? this.items().find(i => i.id === id) : undefined;
        if (!item) return;

        if (direction === 'vertical') {
            if (item.cols < 2) return;

            const splitCol = Math.floor(item.cols / 2);
            const remainderCol = item.cols - splitCol;

            const newItem: DashboardItem = {
                ...item,
                id: crypto.randomUUID(),
                x: item.x + splitCol,
                cols: remainderCol,
                content: 'New Item'
            };

            const updatedItem = {
                ...item,
                cols: splitCol
            };

            const newItems = this.items().filter(i => i.id !== id);
            newItems.push(updatedItem, newItem);
            this.itemsChange.emit(newItems);

        } else {
            if (item.rows < 2) return;

            const splitRow = Math.floor(item.rows / 2);
            const remainderRow = item.rows - splitRow;

            const newItem: DashboardItem = {
                ...item,
                id: crypto.randomUUID(),
                y: item.y + splitRow,
                rows: remainderRow,
                content: 'New Item'
            };

            const updatedItem = {
                ...item,
                rows: splitRow
            };

            const newItems = this.items().filter(i => i.id !== id);
            newItems.push(updatedItem, newItem);
            this.itemsChange.emit(newItems);
        }
    }

    readonly classes = computed(() => cn(
        'grid w-full relative grid-cols-12 min-h-full',
        this.class()
    ));

    readonly gridStyles = computed(() => ({
        'grid-template-columns': this.gridTemplateColumns(),
        'grid-auto-rows': this.rowHeight(),
        'gap': this.gap()
    }));

    readonly gridTemplateColumns = computed(() => `repeat(${this.cols()}, minmax(0, 1fr))`);

    readonly gridGradient = computed(() => 'none');

    readonly gridCells = computed(() => {
        if (!this.editable()) return [];

        let maxRow = 8;
        for (const item of this.items()) {
            maxRow = Math.max(maxRow, item.y + item.rows);
        }
        maxRow += 2;

        const totalCells = this.cols() * maxRow;
        return new Array(totalCells).fill(0).map((_, i) => ({
            id: i,
        }));
    });

    /** Whether this widget is the one currently being dragged, for the drag-ghost styling in the template. */
    isDragging(id: string): boolean {
        return this.draggedItemId() === id;
    }

    /** Whether a widget's `content` should be rendered through the component outlet rather than as text. */
    isComponent(content: string | Type<unknown>): boolean {
        return typeof content !== 'string';
    }

    /** Narrows `content` to a component type for the outlet binding. Only call after {@link isComponent} — it asserts, it does not check. */
    asComponent(content: string | Type<unknown>): Type<unknown> {
        return content as Type<unknown>;
    }

    /** Narrows the context menu's untyped payload to {@link BentoContextMenuData} so the template can branch on `type === 'empty'`. Returns null before the menu has ever been opened. */
    castMenuData(data: unknown): BentoContextMenuData | null {
        return (data as BentoContextMenuData) ?? null;
    }



    /** Template handler that marks a widget as a valid HTML5 drop target (`dropEffect = 'move'`). The drop preview itself is computed by {@link onContainerDragOver}. */
    onDragOver(event: DragEvent, _targetItem: DashboardItem): void {
        if (!this.editable()) return;
        event.preventDefault();



        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'move';
        }
    }

    /**
     * Template handler that accepts the drag over the canvas and, for an internal
     * drag, moves the drop-preview ghost to the cell under the pointer (RTL aware,
     * corrected by the grab offset). External drags — recognised by an
     * `application/json` payload — get `dropEffect = 'copy'` and no preview.
     */
    onContainerDragOver(event: DragEvent): void {
        if (!this.editable()) return;
        event.preventDefault();
        if (event.dataTransfer) {
            const isExternal = event.dataTransfer.types.includes('application/json');
            event.dataTransfer.dropEffect = isExternal ? 'copy' : 'move';
        }

        const draggedId = this.draggedItemId();
        if (draggedId) {
            const item = this.items().find(i => i.id === draggedId);
            if (item) {
                const { x, y } = this.getGridCoordinates(event);
                this.dropPreview.set({ x, y, cols: item.cols, rows: item.rows });
            }
        }
    }

    /** Template hook for the canvas `dragleave`. Deliberately empty: the preview is kept while the pointer crosses child elements, and is cleared on drop or drag-end instead. */
    onContainerDragLeave(_event: DragEvent): void {
    }

    /**
     * Template handler for a drop **onto an existing widget**. An internal drag
     * commits the previewed position and emits {@link itemsChange} (overlapped
     * neighbours are shrunk); an external drag instead emits {@link externalDrop}
     * with `targetId` set to the widget under the pointer and no coordinates.
     * Widgets are never swapped — the drag always wins the cells.
     */
    onDrop(event: DragEvent, targetItem: DashboardItem): void {
        if (!this.editable()) return;
        event.preventDefault();
        event.stopPropagation();

        const draggedId = this.draggedItemId();

        if (draggedId) {
            this.handleInternalDrop(draggedId);
            return;
        }

        this.handleExternalDrop(event, targetItem);
    }

    private handleInternalDrop(draggedId: string): void {
        const preview = this.dropPreview();
        if (preview) {
            const currentItems = this.applyDropPreview(draggedId, preview);
            if (currentItems) {
                this.itemsChange.emit(currentItems);
            }
        }

        this.draggedItemId.set(null);
        this.dropPreview.set(null);
    }

    private applyDropPreview(draggedId: string, preview: { x: number; y: number; cols: number; rows: number }): DashboardItem[] | null {
        const currentItems = [...this.items()];
        const itemIndex = currentItems.findIndex(i => i.id === draggedId);
        if (itemIndex === -1) return null;

        const updatedDraggedItem = {
            ...currentItems[itemIndex],
            x: preview.x,
            y: preview.y
        };
        currentItems[itemIndex] = updatedDraggedItem;

        return this.resolveOverlaps(currentItems, updatedDraggedItem, draggedId);
    }

    private handleExternalDrop(event: DragEvent, targetItem: DashboardItem): void {
        const data = event.dataTransfer?.getData('application/json');
        if (!data) return;

        try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'widget' && parsed.id) {
                this.externalDrop.emit({ widgetId: parsed.id, targetId: targetItem.id });
            }
        } catch (e) {
            console.error('Failed to parse drop data', e);
        }
    }

    /**
     * Template handler for a drop on empty canvas. An internal drag moves the
     * widget to that cell, but **only if the new rectangle overlaps nothing** —
     * an overlapping drop is silently discarded and the widget stays put (unlike
     * {@link onDrop}, which shrinks the neighbours). An external drag emits
     * {@link externalDrop} with `targetId: null` plus the target `x`/`y`;
     * malformed JSON is ignored.
     */
    onContainerDrop(event: DragEvent): void {
        if (!this.editable()) return;
        event.preventDefault();
        this.dropPreview.set(null);

        const draggedId = this.draggedItemId();
        if (draggedId) {
            const { x, y } = this.getGridCoordinates(event);

            const currentItems = [...this.items()];
            const itemIndex = currentItems.findIndex(i => i.id === draggedId);
            if (itemIndex > -1) {
                const item = currentItems[itemIndex];
                const newRect = { ...item, x, y };
                const overlapping = currentItems.some(i => i.id !== draggedId && this.isOverlapping(newRect, i));

                if (!overlapping) {
                    currentItems[itemIndex] = { ...item, x, y };
                    this.itemsChange.emit(currentItems);
                }
            }

            this.draggedItemId.set(null);
            return;
        }

        const data = event.dataTransfer?.getData('application/json');
        if (data) {
            try {
                const parsed = JSON.parse(data);
                if (parsed.type === 'widget' && parsed.id) {
                    const { x, y } = this.getGridCoordinates(event);
                    this.externalDrop.emit({ widgetId: parsed.id, targetId: null, x, y });
                }
            } catch {
                // Intentionally ignored: invalid JSON from external drag source
            }
        }
    }

    private getGridCoordinates(event: DragEvent | MouseEvent): { x: number; y: number } {
        const container = (event.currentTarget as HTMLElement);
        const rect = container.getBoundingClientRect();
        const _isRtl = isRtl(this.el.nativeElement);

        // Calculate click/drag position relative to container
        let clientX = event.clientX;
        let clientY = event.clientY;

        // Apply drag offset if available to sync top-left of item with cursor
        const offset = this.dragOffset();
        if (offset) {
            clientX -= offset.x;
            clientY -= offset.y;
        }

        let x = clientX - rect.left;
        if (_isRtl) {
            x = rect.right - clientX;
        }

        const y = clientY - rect.top;

        // Use dynamic dimensions
        const gapNum = this.parseCssDimension(this.gap(), rect.width);
        const rowHeightNum = this.parseCssDimension(this.rowHeight(), rect.height);
        const colWidth = this.getColWidth(rect.width);

        const gridX = Math.floor(x / (colWidth + gapNum)) + 1;
        const gridY = Math.floor(y / (rowHeightNum + gapNum)) + 1;

        return { x: Math.max(1, gridX), y: Math.max(1, gridY) };
    }

    private shrinkItem(winner: { x: number, y: number, cols: number, rows: number }, loser: DashboardItem): DashboardItem | null {
        const x1 = Math.max(winner.x, loser.x);
        const y1 = Math.max(winner.y, loser.y);
        const x2 = Math.min(winner.x + winner.cols, loser.x + loser.cols);
        const y2 = Math.min(winner.y + winner.rows, loser.y + loser.rows);

        if (x1 >= x2 || y1 >= y2) {
            return loser;
        }

        const candidates: DashboardItem[] = [];

        if (loser.y < winner.y) {
            candidates.push({ ...loser, rows: winner.y - loser.y });
        }
        if (loser.y + loser.rows > winner.y + winner.rows) {
            const newY = winner.y + winner.rows;
            candidates.push({ ...loser, y: newY, rows: (loser.y + loser.rows) - newY });
        }
        if (loser.x < winner.x) {
            candidates.push({ ...loser, cols: winner.x - loser.x });
        }
        if (loser.x + loser.cols > winner.x + winner.cols) {
            const newX = winner.x + winner.cols;
            candidates.push({ ...loser, x: newX, cols: (loser.x + loser.cols) - newX });
        }

        if (candidates.length === 0) return null;

        return candidates.reduce((prev, current) =>
            (prev.cols * prev.rows > current.cols * current.rows) ? prev : current
        , candidates[0]);
    }

    private isOverlapping(rect1: { x: number, y: number, cols: number, rows: number }, rect2: { x: number, y: number, cols: number, rows: number }): boolean {
        const x1 = Math.max(rect1.x, rect2.x);
        const y1 = Math.max(rect1.y, rect2.y);
        const x2 = Math.min(rect1.x + rect1.cols, rect2.x + rect2.cols);
        const y2 = Math.min(rect1.y + rect1.rows, rect2.y + rect2.rows);
        return x1 < x2 && y1 < y2;
    }

    private resolveOverlaps(
        items: DashboardItem[],
        updatedItem: { x: number; y: number; cols: number; rows: number },
        excludeId: string
    ): DashboardItem[] {
        const result: DashboardItem[] = [];
        for (const item of items) {
            if (item.id === excludeId) {
                result.push(item);
                continue;
            }
            const shrunk = this.shrinkItem(updatedItem, item);
            if (shrunk) {
                result.push(shrunk);
            } else if (!this.isOverlapping(updatedItem, item)) {
                result.push(item);
            }
        }
        return result;
    }


    readonly resizingItemId = signal<string | null>(null);
    /** Which resize grips a selected widget shows: the four corners, the four edges, or (default) both. Only affects the handles rendered — {@link onResizeStart} still supports all eight directions. */
    readonly resizeHandleType = input<'corners' | 'edges' | 'both'>('both');
    readonly resizeDirection = signal<ResizeDirection | null>(null);
    private initialResizeState: {
        readonly x: number;
        readonly y: number;
        readonly w: number;
        readonly h: number;
        readonly cols: number;
        readonly rows: number;
        readonly itemX: number;
        readonly itemY: number;
        readonly colStep: number;
        readonly rowStep: number;
    } | null = null;
    readonly resizePreview = signal<{ id: string; cols: number; rows: number; x: number; y: number } | null>(null);
    readonly dropPreview = signal<{ x: number; y: number; cols: number; rows: number } | null>(null);
    readonly dragOffset = signal<{ x: number; y: number } | null>(null);

    private handleResizeMove(clientX: number, clientY: number): void {
        const rawDirection = this.resizeDirection();
        if (!this.resizingItemId() || !this.initialResizeState || !rawDirection) return;

        const { deltaX, deltaY, direction } = this.computeResizeDeltas(clientX, clientY, rawDirection);
        const { cols, rows, x, y } = this.computeResizePreview(direction, deltaX, deltaY);

        this.updateResizePreviewIfChanged(cols, rows, x, y);
    }

    private computeResizeDeltas(
        clientX: number,
        clientY: number,
        rawDirection: ResizeDirection
    ): { deltaX: number; deltaY: number; direction: ResizeDirection } {
        const state = this.initialResizeState;
        if (!state) return { deltaX: 0, deltaY: 0, direction: rawDirection };

        const _isRtl = isRtl(this.el.nativeElement);
        let deltaX = clientX - state.x;
        const deltaY = clientY - state.y;

        if (_isRtl) {
            deltaX = -deltaX;
        }
        const direction = _isRtl ? this.flipResizeDirectionForRtl(rawDirection) : rawDirection;
        return { deltaX, deltaY, direction };
    }

    private updateResizePreviewIfChanged(cols: number, rows: number, x: number, y: number): void {
        const preview = this.resizePreview();
        const resizingId = this.resizingItemId();
        if (resizingId && (cols !== preview?.cols || rows !== preview?.rows || x !== preview?.x || y !== preview?.y)) {
            this.resizePreview.set({ id: resizingId, cols, rows, x, y });
        }
    }

    private handleResizeEnd(): void {
        if (this.resizingItemId() && this.resizePreview()) {
            this.commitResize();
        }
        this.resizingItemId.set(null);
        this.resizeDirection.set(null);
        this.initialResizeState = null;
        this.resizePreview.set(null);
        this.resizeDragCleanup = null;
    }

    private readonly resizeDirectionRtlMap: Readonly<Record<string, ResizeDirection>> = {
        'nw': 'ne', 'ne': 'nw',
        'sw': 'se', 'se': 'sw',
        'w': 'e', 'e': 'w',
        'n': 'n', 's': 's'
    };

    private flipResizeDirectionForRtl(direction: ResizeDirection): ResizeDirection {
        return this.resizeDirectionRtlMap[direction] ?? direction;
    }

    private computeResizePreview(
        direction: ResizeDirection,
        deltaX: number,
        deltaY: number
    ): { cols: number; rows: number; x: number; y: number } {
        if (!this.initialResizeState) return { cols: 1, rows: 1, x: 1, y: 1 };
        const state = this.initialResizeState;
        const colsDiff = Math.round(deltaX / state.colStep);
        const rowsDiff = Math.round(deltaY / state.rowStep);

        return this.applyResizeDirection(direction, colsDiff, rowsDiff, state);
    }

    private applyResizeDirection(
        direction: ResizeDirection,
        colsDiff: number,
        rowsDiff: number,
        state: NonNullable<typeof this.initialResizeState>
    ): { cols: number; rows: number; x: number; y: number } {
        const cols = state.cols;
        const rows = state.rows;
        const itemX = state.itemX;
        const itemY = state.itemY;

        switch (direction) {
            case 'se': return this.resizeSE(cols, rows, itemX, itemY, colsDiff, rowsDiff);
            case 'sw': return this.resizeSW(cols, rows, itemX, itemY, colsDiff, rowsDiff);
            case 'ne': return this.resizeNE(cols, rows, itemX, itemY, colsDiff, rowsDiff);
            case 'nw': return this.resizeNW(cols, rows, itemX, itemY, colsDiff, rowsDiff);
            case 'e': return { cols: Math.max(1, cols + colsDiff), rows, x: itemX, y: itemY };
            case 'w': {
                const newCols = Math.max(1, cols - colsDiff);
                return { cols: newCols, rows, x: itemX + (cols - newCols), y: itemY };
            }
            case 's': return { cols, rows: Math.max(1, rows + rowsDiff), x: itemX, y: itemY };
            case 'n': {
                const newRows = Math.max(1, rows - rowsDiff);
                return { cols, rows: newRows, x: itemX, y: itemY + (rows - newRows) };
            }
        }
    }

    private resizeSE(cols: number, rows: number, x: number, y: number, colsDiff: number, rowsDiff: number): { cols: number; rows: number; x: number; y: number } {
        return { cols: Math.max(1, cols + colsDiff), rows: Math.max(1, rows + rowsDiff), x, y };
    }

    private resizeSW(cols: number, rows: number, x: number, y: number, colsDiff: number, rowsDiff: number): { cols: number; rows: number; x: number; y: number } {
        const newCols = Math.max(1, cols - colsDiff);
        return { cols: newCols, rows: Math.max(1, rows + rowsDiff), x: x + (cols - newCols), y };
    }

    private resizeNE(cols: number, rows: number, x: number, y: number, colsDiff: number, rowsDiff: number): { cols: number; rows: number; x: number; y: number } {
        const newRows = Math.max(1, rows - rowsDiff);
        return { cols: Math.max(1, cols + colsDiff), rows: newRows, x, y: y + (rows - newRows) };
    }

    private resizeNW(cols: number, rows: number, x: number, y: number, colsDiff: number, rowsDiff: number): { cols: number; rows: number; x: number; y: number } {
        const newCols = Math.max(1, cols - colsDiff);
        const newRows = Math.max(1, rows - rowsDiff);
        return { cols: newCols, rows: newRows, x: x + (cols - newCols), y: y + (rows - newRows) };
    }

    private getColWidth(containerWidth: number): number {
        const gapNum = this.parseCssDimension(this.gap(), containerWidth);
        if (this.columnWidth() === '1fr') {
            return (containerWidth - (this.cols() - 1) * gapNum) / this.cols();
        }
        return this.parseCssDimension(this.columnWidth(), containerWidth);
    }

    /**
     * Begins a resize from a grip. Works with both mouse and touch — it reads the
     * first touch point and then tracks the pointer through the shared
     * `onPointerDrag` helper, so no separate touch handler is needed. Directions
     * are mirrored automatically in RTL. While dragging only a preview moves;
     * {@link itemsChange} is emitted once on release, after shrinking any
     * neighbours the new rectangle swallowed. Widgets cannot go below 1×1.
     * No-op while {@link editable} is false.
     */
    onResizeStart(event: MouseEvent | TouchEvent, item: DashboardItem, direction: ResizeDirection): void {
        if (!this.editable()) return;
        event.preventDefault();
        event.stopPropagation();

        const startClientX = event instanceof MouseEvent ? event.clientX : event.touches[0].clientX;
        const startClientY = event instanceof MouseEvent ? event.clientY : event.touches[0].clientY;

        const element = (event.target as HTMLElement).closest<HTMLElement>('.bento-item');
        if (!element) return;
        const rect = element.getBoundingClientRect();

        const container = element.closest<HTMLElement>('.grid');
        if (!container) return;

        const containerRect = container.getBoundingClientRect();
        const gapNum = this.parseCssDimension(this.gap(), containerRect.width);
        const rowHeightNum = this.parseCssDimension(this.rowHeight(), containerRect.height);
        const colWidth = this.getColWidth(containerRect.width);

        const colStep = colWidth + gapNum;
        const rowStep = rowHeightNum + gapNum;

        this.resizingItemId.set(item.id);
        this.resizeDirection.set(direction);
        this.initialResizeState = {
            x: startClientX,
            y: startClientY,
            w: rect.width,
            h: rect.height,
            cols: item.cols,
            rows: item.rows,
            itemX: item.x,
            itemY: item.y,
            colStep,
            rowStep
        };
        this.resizePreview.set({ id: item.id, cols: item.cols, rows: item.rows, x: item.x, y: item.y });

        this.resizeDragCleanup = onPointerDrag(
            (clientX, clientY) => this.handleResizeMove(clientX, clientY),
            () => this.handleResizeEnd()
        );
    }

    private resizeDragCleanup: (() => void) | null = null;

    /**
     * Starts an HTML5 drag of a widget, recording where inside the card it was
     * grabbed so the drop lands under the card's top-left corner rather than the
     * cursor. HTML5 drag events do not fire on touch — {@link onTouchDragStart}
     * covers that. No-op while {@link editable} is false.
     */
    onDragStart(event: DragEvent, item: DashboardItem): void {
        if (!this.editable()) return;

        const element = (event.target as HTMLElement).closest<HTMLElement>('.bento-item');
        const rect = element?.getBoundingClientRect() ?? { left: 0, top: 0 };

        // Capture offset relative to the item's top-left corner
        this.dragOffset.set({
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        });

        this.draggedItemId.set(item.id);
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            // Optional: set drag image or ghost
        }
    }

    /** Clears the drag state and preview when a mouse drag ends, including a drag cancelled outside the grid — no {@link itemsChange} is emitted in that case. */
    onDragEnd(_event: DragEvent): void {
        this.draggedItemId.set(null);
        this.dropPreview.set(null);
        this.dragOffset.set(null);
    }

    private touchDragCleanup: (() => void) | null = null;

    /**
     * Touch equivalent of {@link onDragStart}: tracks the finger, moves the drop
     * preview and, on release, commits the move via {@link itemsChange} — the
     * HTML5 `drop` handlers never run on touch. Yields to an in-progress resize
     * ({@link onResizeStart}) and is a no-op while {@link editable} is false.
     * Only internal moves are supported this way; dragging a widget in from
     * outside remains mouse-only.
     */
    onTouchDragStart(event: TouchEvent, item: DashboardItem): void {
        if (!this.editable()) return;
        if (this.resizingItemId()) return;

        const touch = event.touches[0];
        const element = (event.target as HTMLElement).closest<HTMLElement>('.bento-item');
        const rect = element?.getBoundingClientRect() ?? { left: 0, top: 0 };

        this.dragOffset.set({
            x: touch.clientX - rect.left,
            y: touch.clientY - rect.top
        });

        this.draggedItemId.set(item.id);

        this.touchDragCleanup = onPointerDrag(
            (clientX, clientY) => this.handleTouchDragMove(clientX, clientY, item),
            () => this.handleTouchDragEnd()
        );
    }

    private handleTouchDragMove(clientX: number, clientY: number, item: DashboardItem): void {
        const container = this.el.nativeElement.querySelector('.grid') as HTMLElement | null;
        if (!container) return;

        const coords = this.getGridCoordinatesFromPoint(clientX, clientY, container);
        this.dropPreview.set({ x: coords.x, y: coords.y, cols: item.cols, rows: item.rows });
    }

    private handleTouchDragEnd(): void {
        const draggedId = this.draggedItemId();
        if (draggedId) {
            const preview = this.dropPreview();
            if (preview) {
                const currentItems = this.applyDropPreview(draggedId, preview);
                if (currentItems) {
                    this.itemsChange.emit(currentItems);
                }
            }
        }

        this.draggedItemId.set(null);
        this.dropPreview.set(null);
        this.dragOffset.set(null);
        this.touchDragCleanup = null;
    }

    private getGridCoordinatesFromPoint(clientX: number, clientY: number, container: HTMLElement): { x: number; y: number } {
        const rect = container.getBoundingClientRect();
        const _isRtl = isRtl(this.el.nativeElement);

        let adjustedX = clientX;
        let adjustedY = clientY;

        const offset = this.dragOffset();
        if (offset) {
            adjustedX -= offset.x;
            adjustedY -= offset.y;
        }

        let x = adjustedX - rect.left;
        if (_isRtl) {
            x = rect.right - adjustedX;
        }

        const y = adjustedY - rect.top;

        const gapNum = this.parseCssDimension(this.gap(), rect.width);
        const rowHeightNum = this.parseCssDimension(this.rowHeight(), rect.height);
        const colWidth = this.getColWidth(rect.width);

        const gridX = Math.floor(x / (colWidth + gapNum)) + 1;
        const gridY = Math.floor(y / (rowHeightNum + gapNum)) + 1;

        return { x: Math.max(1, gridX), y: Math.max(1, gridY) };
    }

    private commitResize(): void {
        const id = this.resizingItemId();
        const preview = this.resizePreview();
        if (!id || !preview) return;

        const currentItems = [...this.items()];
        const itemIndex = currentItems.findIndex(i => i.id === id);

        if (itemIndex > -1) {
            const updatedItem = {
                ...currentItems[itemIndex],
                cols: preview.cols,
                rows: preview.rows,
                x: preview.x,
                y: preview.y
            };
            currentItems[itemIndex] = updatedItem;

            this.itemsChange.emit(this.resolveOverlaps(currentItems, updatedItem, id));
        }

        this.resizingItemId.set(null);
        this.resizePreview.set(null);
        this.initialResizeState = null;
        this.resizeDirection.set(null);
    }

    /**
     * Template handler for right-click on empty canvas: opens `menu` with
     * `{ type: 'empty', x, y }` so an "add here" action can call
     * {@link addItemAt}. Bails out when the click landed on a widget (that is
     * {@link onContextMenu}'s job) or on an occupied cell, in which case the
     * native browser menu is left to appear. Right-click only — no long-press
     * fallback, so this menu is unreachable on touch.
     */
    onContainerContextMenu(event: MouseEvent, menu: ContextMenuComponent): void {
        if (!this.editable()) return;

        if ((event.target as HTMLElement).closest('.bento-item')) return;

        event.preventDefault();

        const container = (event.currentTarget as HTMLElement);
        const rect = container.getBoundingClientRect();

        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const gapNum = this.parseCssDimension(this.gap(), rect.width);
        const rowHeightNum = this.parseCssDimension(this.rowHeight(), rect.height);
        const colWidth = this.getColWidth(rect.width);

        const gridX = Math.floor(x / (colWidth + gapNum)) + 1;
        const gridY = Math.floor(y / (rowHeightNum + gapNum)) + 1;

        const tempItem: DashboardItem = { x: gridX, y: gridY, cols: 1, rows: 1, id: 'temp', content: '' };
        const isOccupied = this.items().some(i => this.isOverlapping(tempItem, i));

        if (!isOccupied) {
            menu.show(event.clientX, event.clientY, { type: 'empty', x: gridX, y: gridY });
        }
    }

    /**
     * Appends a placeholder widget (`content: 'New Item'`, `crypto.randomUUID()` id)
     * at the given 1-based cell and emits {@link itemsChange}. Silently does
     * nothing if the rectangle would overlap an existing widget — it never pushes
     * anything aside. Replace the emitted item's `content` yourself to render a
     * real component.
     */
    addItemAt(x: number, y: number, cols: number = 1, rows: number = 1): void {
        const newItem: DashboardItem = {
            id: crypto.randomUUID(),
            x, y, cols, rows,
            content: 'New Item'
        };

        const isOverlapping = this.items().some(i => this.isOverlapping(newItem, i));

        if (isOverlapping) {
            return;
        }

        this.itemsChange.emit([...this.items(), newItem]);
    }
}
