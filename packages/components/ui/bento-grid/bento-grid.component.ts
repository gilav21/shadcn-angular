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
    | (DashboardItem & { type?: undefined })
    | { type: 'empty'; id?: undefined; x: number; y: number };

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
    readonly class = input<string>('');
    // Inputs
    readonly items = input<DashboardItem[]>([]);
    readonly cols = input<number>(12);
    readonly rowHeight = input<string, string | number>('120px', {
        transform: v => {
            if (typeof v === 'number') return `${v}px`;
            if (typeof v === 'string' && !Number.isNaN(Number.parseFloat(v)) && Number.isFinite(Number(v))) return `${v}px`;
            return v;
        }
    });
    readonly columnWidth = input<string, string | number>('1fr', {
        transform: v => {
            if (typeof v === 'number') return `${v}px`;
            if (typeof v === 'string' && !Number.isNaN(Number.parseFloat(v)) && Number.isFinite(Number(v))) return `${v}px`;
            return v;
        }
    });
    readonly gap = input<string, string | number>('1.5rem', {
        transform: v => {
            if (typeof v === 'number') return `${v}px`;
            if (typeof v === 'string' && !Number.isNaN(Number.parseFloat(v)) && Number.isFinite(Number(v))) return `${v}px`;
            return v;
        }
    });
    readonly showBorders = input<boolean>(true);
    readonly borderRadius = input<string, string | number>('0.75rem', {
        transform: v => {
            if (typeof v === 'number') return `${v}px`;
            if (typeof v === 'string' && !Number.isNaN(Number.parseFloat(v)) && Number.isFinite(Number(v))) return `${v}px`;
            return v;
        }
    });
    readonly itemPadding = input<string, string | number>('1rem', {
        transform: v => {
            if (typeof v === 'number') return `${v}px`;
            if (typeof v === 'string' && !Number.isNaN(Number.parseFloat(v)) && Number.isFinite(Number(v))) return `${v}px`;
            return v;
        }
    });
    readonly editable = input<boolean>(true);

    // Outputs
    readonly itemsChange = output<DashboardItem[]>();
    readonly selectionChange = output<string[]>();
    readonly externalDrop = output<{ widgetId: string, targetId: string | null, x?: number, y?: number }>();
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

    clearSelection(): void {
        this.selectedItemIds.set([]);
        this.selectionChange.emit([]);
    }

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
            if (!current) break;;

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

    areAdjacent(a: DashboardItem, b: DashboardItem): boolean {
        const aX1 = a.x, aX2 = a.x + a.cols;
        const aY1 = a.y, aY2 = a.y + a.rows;
        const bX1 = b.x, bX2 = b.x + b.cols;
        const bY1 = b.y, bY2 = b.y + b.rows;

        const horizontalTouch = (aX2 === bX1 || bX2 === aX1) && (aY1 < bY2 && aY2 > bY1);
        const verticalTouch = (aY2 === bY1 || bY2 === aY1) && (aX1 < bX2 && aX2 > bX1);

        return horizontalTouch || verticalTouch;
    }

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

    onContextMenu(event: MouseEvent, item: DashboardItem, menu: ContextMenuComponent): void {
        if (!this.editable()) return;
        event.preventDefault();
        event.stopPropagation();
        menu.show(event.clientX, event.clientY, item);
    }

    deleteItem(id: string | undefined): void {
        if (!id) return;
        this.itemsChange.emit(this.items().filter(i => i.id !== id));
    }

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

    isDragging(id: string): boolean {
        return this.draggedItemId() === id;
    }

    isComponent(content: string | Type<unknown>): boolean {
        return typeof content !== 'string';
    }

    asComponent(content: string | Type<unknown>): Type<unknown> {
        return content as Type<unknown>;
    }

    castMenuData(data: unknown): BentoContextMenuData | null {
        return (data as BentoContextMenuData) ?? null;
    }



    onDragOver(event: DragEvent, _targetItem: DashboardItem): void {
        if (!this.editable()) return;
        event.preventDefault();



        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'move';
        }
    }

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

    onContainerDragLeave(_event: DragEvent): void {
    }

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

    onDragEnd(_event: DragEvent): void {
        this.draggedItemId.set(null);
        this.dropPreview.set(null);
        this.dragOffset.set(null);
    }

    private touchDragCleanup: (() => void) | null = null;

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
