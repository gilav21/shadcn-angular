
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
import { cn, isRtl } from '../lib/utils';
import {
    ContextMenuComponent,
    ContextMenuContentComponent,
    ContextMenuItemComponent,
} from './context-menu.component';
import { UiComponentOutletDirective } from './component-outlet.directive';



export interface DashboardItem {
    id: string;
    x: number;
    y: number;
    cols: number;
    rows: number;
    content: string | Type<any>;
    inputs?: Record<string, any>;
    outputs?: Record<string, (event: any) => void>;
}

@Component({
    selector: 'ui-bento-grid-item',
    standalone: true,
    imports: [CommonModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div
      [class]="classes()"
      [style.grid-column]="'span ' + span()"
      [style.grid-row]="'span ' + rowSpan()"
    >
      <ng-content />
    </div>
  `,
    host: {
        class: 'contents',
    }
})
export class BentoGridItemComponent {
    class = input<string>('');
    span = input<number>(1);
    rowSpan = input<number>(1);

    classes = computed(() => cn(
        'group/bento row-span-1 flex flex-col justify-between space-y-4 rounded-xl border bg-white p-4 shadow-input shadow-none transition duration-200 hover:shadow-xl dark:border-white/[0.2] dark:bg-black dark:shadow-none overflow-hidden',
        this.class()
    ));
}

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
    template: `
    <div [class]="classes()" 
         [ngStyle]="gridStyles()"
         [style.grid-template-columns]="columnWidth() === '1fr' ? gridTemplateColumns() : 'repeat(' + cols() + ', ' + columnWidth() + ')'"
         [style.grid-auto-rows]="rowHeight()"
         [style.grid-auto-columns]="columnWidth() === '1fr' ? 'auto' : columnWidth()"
         (contextmenu)="onContainerContextMenu($event, menu)"
         (window:mousemove)="onWindowMouseMove($event)"
         (window:mouseup)="onWindowMouseUp()"
         (dragover)="onContainerDragOver($event)"
         (drop)="onContainerDrop($event)">
         
         @if (editable()) {
             <div class="absolute inset-0 pointer-events-none overflow-hidden" 
                  [style.background-image]="gridPattern()"
                  [style.background-size]="gridBackgroundSize()">
             </div>
         }
      <ui-context-menu #menu>
          <ui-context-menu-content>
              @if (!menu.data()?.type) {
                  <ui-context-menu-item (click)="splitItem(menu.data()?.id, 'vertical')">
                      <span class="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-columns-2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 3v18"/></svg>
                        Split Vertical
                      </span>
                  </ui-context-menu-item>
                  <ui-context-menu-item (click)="splitItem(menu.data()?.id, 'horizontal')">
                      <span class="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-rows-2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 12h18"/></svg>
                        Split Horizontal
                      </span>
                  </ui-context-menu-item>
                  <ui-context-menu-item (click)="deleteItem(menu.data()?.id)" class="text-destructive focus:text-destructive">
                      <span class="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2"><path d="M3 6h18"/><path d="M19 6v14c0 1-2 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                        Delete
                      </span>
                  </ui-context-menu-item>
              }
              
              @if (menu.data()?.type === 'empty') {
                  <ui-context-menu-item (click)="addItemAt(menu.data().x, menu.data().y, 1, 1)">
                    <span class="flex items-center gap-2">
                         <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-plus-square"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>
                         Add 1x1 Item
                    </span>
                  </ui-context-menu-item>
                  <ui-context-menu-item (click)="addItemAt(menu.data().x, menu.data().y, 4, 2)">
                     <span class="flex items-center gap-2">
                         <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-grid-2x2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 12h18"/><path d="M12 3v18"/></svg>
                         Add 4x2 Item
                     </span>
                  </ui-context-menu-item>
              }
          </ui-context-menu-content>
      </ui-context-menu>

      <ng-content />
      
      <!-- Drop Placeholder -->
      @if (dropPreview()) {
          <div 
            class="be-placeholder absolute border-2 border-primary bg-primary/20 rounded-xl transition-all duration-75 z-20 pointer-events-none shadow-xl backdrop-blur-[1px]"
            [style.grid-column-start]="dropPreview()?.x"
            [style.grid-column-end]="'span ' + dropPreview()?.cols"
            [style.grid-row-start]="dropPreview()?.y"
            [style.grid-row-end]="'span ' + dropPreview()?.rows"
          >
             <!-- Dimensions Label -->
             <div class="absolute bottom-2 right-2 text-xs font-mono font-bold text-primary bg-background/80 px-1 rounded shadow-sm">
                {{ dropPreview()?.cols }}x{{ dropPreview()?.rows }}
             </div>
          </div>
      }
      
      @for (item of items(); track item.id) {
         <div 
            class="bento-item relative group bg-card text-card-foreground transition-all duration-200 overflow-hidden min-h-0"
            [class.border]="editable() || showBorders()"
            [class.shadow]="showBorders()"
            [style.border-radius]="borderRadius()"
            [style.padding]="itemPadding()"
            [class.cursor-grab]="editable()"
            [class.ring-2]="isSelected(item.id) || (resizePreview()?.id === item.id)"
            [class.ring-primary]="isSelected(item.id) || (resizePreview()?.id === item.id)"
            [class.hover:shadow-lg]="editable()"
            [class.opacity-50]="isDragging(item.id)"
            [class.z-50]="resizePreview()?.id === item.id || (isDragging(item.id) && dropPreview())"
            [style.grid-column-start]="
                resizePreview()?.id === item.id ? resizePreview()?.x : 
                (isDragging(item.id) && dropPreview() ? dropPreview()?.x : item.x)
            "
            [style.grid-column-end]="'span ' + (
                resizePreview()?.id === item.id ? resizePreview()?.cols : 
                (isDragging(item.id) && dropPreview() ? dropPreview()?.cols : item.cols)
            )"
            [style.grid-row-start]="
                resizePreview()?.id === item.id ? resizePreview()?.y : 
                (isDragging(item.id) && dropPreview() ? dropPreview()?.y : item.y)
            "
            [style.grid-row-end]="'span ' + (
                resizePreview()?.id === item.id ? resizePreview()?.rows : 
                (isDragging(item.id) && dropPreview() ? dropPreview()?.rows : item.rows)
            )"
            [attr.draggable]="editable()"
            (click)="toggleSelection(item.id, $event.ctrlKey || $event.metaKey)"
            (contextmenu)="onContextMenu($event, item, menu)"
            (dragstart)="onDragStart($event, item)"
            (dragend)="onDragEnd($event)"
            (dragover)="onDragOver($event, item)"
            (drop)="onDrop($event, item)"
         >
            <!-- Content Rendering Logic -->
            @if (isComponent(item.content)) {
                <ng-container 
                    [uiComponentOutlet]="asComponent(item.content)" 
                    [inputs]="item.inputs || {}" 
                    [outputs]="item.outputs || {}" 
                    (initialized)="componentInit.emit({ id: item.id, ref: $event })"
                />
            } @else {
                <p>{{ item.content }}</p>
            }

            <!-- Resize/Action Handles (Visible in Edit Mode) -->
            @if (editable()) {
                <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button class="p-1 hover:bg-muted rounded" (click)="onContextMenu($event, item, menu)">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-more-vertical"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                    </button>
                </div>
                
                <!-- Resize Handles -->
                <!-- Edge Handles -->
                @if (resizeHandleType() === 'edges' || resizeHandleType() === 'both') {
                     <!-- Top (N) -->
                     <div class="absolute top-0 inset-x-2 h-1 cursor-n-resize hover:bg-primary/50 transition-colors z-10" (mousedown)="onResizeStart($event, item, 'n')"></div>
                     <!-- Bottom (S) -->
                     <div class="absolute bottom-0 inset-x-2 h-1 cursor-s-resize hover:bg-primary/50 transition-colors z-10" (mousedown)="onResizeStart($event, item, 's')"></div>
                     <!-- Left (W) -->
                     <div class="absolute left-0 inset-y-2 w-1 cursor-w-resize hover:bg-primary/50 transition-colors z-10" (mousedown)="onResizeStart($event, item, 'w')"></div>
                     <!-- Right (E) -->
                     <div class="absolute right-0 inset-y-2 w-1 cursor-e-resize hover:bg-primary/50 transition-colors z-10" (mousedown)="onResizeStart($event, item, 'e')"></div>
                }

                <!-- Corner Handles -->
                @if (resizeHandleType() === 'corners' || resizeHandleType() === 'both') {
                     <!-- SE (Bottom-Right) -->
                     <div 
                        class="absolute bottom-1 right-1 cursor-se-resize p-1 opacity-0 group-hover:opacity-100 transition-opacity z-20"
                        (mousedown)="onResizeStart($event, item, 'se')"
                     >
                         <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground"><path d="M21 15v6h-6"/><path d="M21 3v6h-6"/><path d="M3 21h6v-6"/><path d="M10 14L3 21"/><path d="M14 10l7-7"/></svg>
                     </div>
                     
                     <!-- SW (Bottom-Left) -->
                     <div class="absolute bottom-1 left-1 cursor-sw-resize p-1 opacity-0 group-hover:opacity-100 transition-opacity z-20" (mousedown)="onResizeStart($event, item, 'sw')">
                        <div class="w-2 h-2 bg-muted-foreground/50 rounded-sm"></div>
                     </div>
                     
                     <!-- NE (Top-Right) -->
                     <div class="absolute top-1 right-1 cursor-ne-resize p-1 opacity-0 group-hover:opacity-100 transition-opacity z-20" (mousedown)="onResizeStart($event, item, 'ne')">
                        <div class="w-2 h-2 bg-muted-foreground/50 rounded-sm"></div>
                     </div>
                     
                     <!-- NW (Top-Left) -->
                     <div class="absolute top-1 left-1 cursor-nw-resize p-1 opacity-0 group-hover:opacity-100 transition-opacity z-20" (mousedown)="onResizeStart($event, item, 'nw')">
                        <div class="w-2 h-2 bg-muted-foreground/50 rounded-sm"></div>
                     </div>
                 }
            }
         </div>
      }

      <!-- Merge Action Bar -->
      @if (editable() && canMerge()) {
          <div class="fixed bottom-12 left-1/2 -translate-x-1/2 bg-white dark:bg-zinc-800 text-foreground shadow-lg border rounded-full px-6 py-2 z-50 animate-in fade-in slide-in-from-bottom-2 flex gap-2 items-center cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors" (click)="mergeSelected()">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-merge"><path d="m8 6 4-4 4 4"/><path d="M12 2v10.3a4 4 0 0 1-1.172 2.872L4 22"/><path d="m20 22-5-5"/></svg>
              <span class="text-sm font-medium">Merge {{ selectedItemIds().length }} Items</span>
          </div>
      }
    </div>
  `,
    styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
  `],
})
export class BentoGridComponent {
    class = input<string>('');
    // Inputs
    items = input<DashboardItem[]>([]);
    cols = input<number>(12);
    rowHeight = input<string, string | number>('120px', {
        transform: v => {
            if (typeof v === 'number') return `${v}px`;
            if (typeof v === 'string' && !isNaN(parseFloat(v)) && isFinite(Number(v))) return `${v}px`;
            return v;
        }
    });
    columnWidth = input<string, string | number>('1fr', {
        transform: v => {
            if (typeof v === 'number') return `${v}px`;
            if (typeof v === 'string' && !isNaN(parseFloat(v)) && isFinite(Number(v))) return `${v}px`;
            return v;
        }
    });
    gap = input<string, string | number>('1.5rem', {
        transform: v => {
            if (typeof v === 'number') return `${v}px`;
            if (typeof v === 'string' && !isNaN(parseFloat(v)) && isFinite(Number(v))) return `${v}px`;
            return v;
        }
    });
    showBorders = input<boolean>(true);
    borderRadius = input<string, string | number>('0.75rem', {
        transform: v => {
            if (typeof v === 'number') return `${v}px`;
            if (typeof v === 'string' && !isNaN(parseFloat(v)) && isFinite(Number(v))) return `${v}px`;
            return v;
        }
    });
    itemPadding = input<string, string | number>('1rem', {
        transform: v => {
            if (typeof v === 'number') return `${v}px`;
            if (typeof v === 'string' && !isNaN(parseFloat(v)) && isFinite(Number(v))) return `${v}px`;
            return v;
        }
    });
    editable = input<boolean>(true);

    // Outputs
    itemsChange = output<DashboardItem[]>();
    selectionChange = output<string[]>();
    externalDrop = output<{ widgetId: string, targetId: string | null, x?: number, y?: number }>();
    componentInit = output<{ id: string, ref: ComponentRef<any> }>();

    private el = inject(ElementRef);

    gridPattern = computed(() => {
        const color = 'currentColor';
        return `radial-gradient(circle at 1px 1px, ${color} 1px, transparent 0)`;
    });

    gridBackgroundSize = computed(() => {
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
        const num = parseFloat(value);
        if (isNaN(num)) return 0;

        if (value.endsWith('rem')) {
            const fontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
            return num * fontSize;
        }
        if (value.endsWith('em')) {
            const fontSize = parseFloat(getComputedStyle(this.el.nativeElement).fontSize) || 16;
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



    draggedItemId = signal<string | null>(null);
    dropTargetId = signal<string | null>(null);
    selectedItemIds = signal<string[]>([]);

    constructor() {
        effect(() => {
            if (!this.editable()) {
                this.selectedItemIds.set([]);
            }
        });
    }

    selectedIds = computed(() => new Set(this.selectedItemIds()));

    toggleSelection(id: string, multi: boolean = true) {
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

    clearSelection() {
        this.selectedItemIds.set([]);
        this.selectionChange.emit([]);
    }

    isSelected(id: string) {
        return this.selectedIds().has(id);
    }

    canMerge = computed(() => {
        const selectedIds = this.selectedItemIds();
        if (selectedIds.length < 2) return false;

        const items = this.items().filter(i => selectedIds.includes(i.id));
        if (items.length !== selectedIds.length) return false;



        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let totalArea = 0;

        for (const item of items) {
            minX = Math.min(minX, item.x);
            minY = Math.min(minY, item.y);
            maxX = Math.max(maxX, item.x + item.cols - 1);
            maxY = Math.max(maxY, item.y + item.rows - 1);
            totalArea += item.cols * item.rows;
        }

        const boundingBoxArea = (maxX - minX + 1) * (maxY - minY + 1);


        const visited = new Set<string>();
        const queue = [items[0]];
        visited.add(items[0].id);

        while (queue.length > 0) {
            const current = queue.shift()!;

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

    areAdjacent(a: DashboardItem, b: DashboardItem) {
        const aX1 = a.x, aX2 = a.x + a.cols;
        const aY1 = a.y, aY2 = a.y + a.rows;
        const bX1 = b.x, bX2 = b.x + b.cols;
        const bY1 = b.y, bY2 = b.y + b.rows;

        const horizontalTouch = (aX2 === bX1 || bX2 === aX1) && (aY1 < bY2 && aY2 > bY1);
        const verticalTouch = (aY2 === bY1 || bY2 === aY1) && (aX1 < bX2 && aX2 > bX1);

        return horizontalTouch || verticalTouch;
    }

    mergeSelected() {
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

    onContextMenu(event: MouseEvent, item: DashboardItem, menu: ContextMenuComponent) {
        if (!this.editable()) return;
        event.preventDefault();
        event.stopPropagation();
        menu.show(event.clientX, event.clientY, item);
    }

    deleteItem(id: string) {
        this.itemsChange.emit(this.items().filter(i => i.id !== id));
    }

    splitItem(id: string, direction: 'vertical' | 'horizontal') {
        const item = this.items().find(i => i.id === id);
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

    classes = computed(() => cn(
        'grid w-full relative grid-cols-12 min-h-full',
        this.class()
    ));

    gridStyles = computed(() => ({
        'grid-template-columns': this.gridTemplateColumns(),
        'grid-auto-rows': this.rowHeight(),
        'gap': this.gap()
    }));

    gridTemplateColumns = computed(() => `repeat(${this.cols()}, minmax(0, 1fr))`);

    gridGradient = computed(() => 'none');

    gridCells = computed(() => {
        if (!this.editable()) return [];

        let maxRow = 8;
        for (const item of this.items()) {
            maxRow = Math.max(maxRow, item.y + item.rows);
        }
        maxRow += 2;

        const totalCells = this.cols() * maxRow;
        return Array(totalCells).fill(0).map((_, i) => ({
            id: i,
        }));
    });

    isDragging(id: string) {
        return this.draggedItemId() === id;
    }

    isComponent(content: string | Type<any>): boolean {
        return typeof content !== 'string';
    }

    asComponent(content: string | Type<any>): Type<any> {
        return content as Type<any>;
    }



    onDragOver(event: DragEvent, targetItem: DashboardItem) {
        if (!this.editable()) return;
        event.preventDefault();



        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'move';
        }
    }

    onContainerDragOver(event: DragEvent) {
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

    onContainerDragLeave(event: DragEvent) {
    }

    onDrop(event: DragEvent, targetItem: DashboardItem) {
        if (!this.editable()) return;
        event.preventDefault();
        event.stopPropagation();

        const draggedId = this.draggedItemId();

        if (draggedId) {
            const preview = this.dropPreview();
            if (preview) {
                let currentItems = [...this.items()];
                const itemIndex = currentItems.findIndex(i => i.id === draggedId);

                if (itemIndex > -1) {
                    const updatedDraggedItem = {
                        ...currentItems[itemIndex],
                        x: preview.x,
                        y: preview.y
                    };
                    currentItems[itemIndex] = updatedDraggedItem;

                    for (let i = 0; i < currentItems.length; i++) {
                        if (currentItems[i].id === draggedId) continue;

                        const shrinking = this.shrinkItem(updatedDraggedItem, currentItems[i]);
                        if (shrinking) {
                            currentItems[i] = shrinking;
                        } else if (this.isOverlapping(updatedDraggedItem, currentItems[i])) {
                            // If we can't shrink, we remove/clip completely or handle overlap
                            // For now, based on "clipping", we might let them overlap or remove?
                            // The previous code had splicing here:
                            currentItems.splice(i, 1);
                            i--;
                        }
                    }

                    this.itemsChange.emit(currentItems);
                }
            }

            this.draggedItemId.set(null);
            this.dropPreview.set(null);
            return;
        }

        const data = event.dataTransfer?.getData('application/json');
        if (data) {
            try {
                const parsed = JSON.parse(data);
                if (parsed.type === 'widget' && parsed.id) {
                    this.externalDrop.emit({ widgetId: parsed.id, targetId: targetItem.id });
                }
            } catch (e) {
                console.error('Failed to parse drop data', e);
            }
        }
    }

    onContainerDrop(event: DragEvent) {
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
            } catch (e) {
            }
        }
    }

    private getGridCoordinates(event: DragEvent | MouseEvent) {
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
        );
    }

    private isOverlapping(rect1: { x: number, y: number, cols: number, rows: number }, rect2: { x: number, y: number, cols: number, rows: number }): boolean {
        const x1 = Math.max(rect1.x, rect2.x);
        const y1 = Math.max(rect1.y, rect2.y);
        const x2 = Math.min(rect1.x + rect1.cols, rect2.x + rect2.cols);
        const y2 = Math.min(rect1.y + rect1.rows, rect2.y + rect2.rows);
        return x1 < x2 && y1 < y2;
    }


    resizingItemId = signal<string | null>(null);
    resizeHandleType = input<'corners' | 'edges' | 'both'>('both');
    resizeDirection = signal<'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | null>(null);
    initialResizeState: {
        x: number, y: number,
        w: number, h: number,
        cols: number, rows: number,
        itemX: number, itemY: number,
        colStep: number, rowStep: number
    } | null = null;
    resizePreview = signal<{ id: string, cols: number, rows: number, x: number, y: number } | null>(null);
    dropPreview = signal<{ x: number, y: number, cols: number, rows: number } | null>(null);
    dragOffset = signal<{ x: number, y: number } | null>(null);

    onWindowMouseMove(event: MouseEvent) {
        if (!this.resizingItemId() || !this.initialResizeState || !this.resizeDirection()) return;

        const _isRtl = isRtl(this.el.nativeElement);

        let deltaX = event.clientX - this.initialResizeState.x;
        const deltaY = event.clientY - this.initialResizeState.y;

        let direction = this.resizeDirection()!;
        if (_isRtl) {
            deltaX = -deltaX;

            const rtlMap: Record<string, any> = {
                'nw': 'ne', 'ne': 'nw',
                'sw': 'se', 'se': 'sw',
                'w': 'e', 'e': 'w',
                'n': 'n', 's': 's'
            };
            direction = rtlMap[direction] || direction;
        }

        const colsDiff = Math.round(deltaX / this.initialResizeState.colStep);
        const rowsDiff = Math.round(deltaY / this.initialResizeState.rowStep);

        let newCols = this.initialResizeState.cols;
        let newRows = this.initialResizeState.rows;
        let newX = this.initialResizeState.itemX;
        let newY = this.initialResizeState.itemY;

        if (direction === 'se') {
            newCols = Math.max(1, this.initialResizeState.cols + colsDiff);
            newRows = Math.max(1, this.initialResizeState.rows + rowsDiff);
        } else if (direction === 'sw') {
            newCols = Math.max(1, this.initialResizeState.cols - colsDiff);
            newX = this.initialResizeState.itemX + (this.initialResizeState.cols - newCols);
            newRows = Math.max(1, this.initialResizeState.rows + rowsDiff);
        } else if (direction === 'ne') {
            newRows = Math.max(1, this.initialResizeState.rows - rowsDiff);
            newY = this.initialResizeState.itemY + (this.initialResizeState.rows - newRows);
            newCols = Math.max(1, this.initialResizeState.cols + colsDiff);
        } else if (direction === 'nw') {
            newCols = Math.max(1, this.initialResizeState.cols - colsDiff);
            newRows = Math.max(1, this.initialResizeState.rows - rowsDiff);
            newX = this.initialResizeState.itemX + (this.initialResizeState.cols - newCols);
            newY = this.initialResizeState.itemY + (this.initialResizeState.rows - newRows);
        } else if (direction === 'e') {
            newCols = Math.max(1, this.initialResizeState.cols + colsDiff);
        } else if (direction === 'w') {
            newCols = Math.max(1, this.initialResizeState.cols - colsDiff);
            newX = this.initialResizeState.itemX + (this.initialResizeState.cols - newCols);
        } else if (direction === 's') {
            newRows = Math.max(1, this.initialResizeState.rows + rowsDiff);
        } else if (direction === 'n') {
            newRows = Math.max(1, this.initialResizeState.rows - rowsDiff);
            newY = this.initialResizeState.itemY + (this.initialResizeState.rows - newRows);
        }

        if (newCols !== this.resizePreview()?.cols || newRows !== this.resizePreview()?.rows || newX !== this.resizePreview()?.x || newY !== this.resizePreview()?.y) {
            this.resizePreview.set({ id: this.resizingItemId()!, cols: newCols, rows: newRows, x: newX, y: newY });
        }
    }

    onWindowMouseUp() {
        if (this.resizingItemId() && this.resizePreview()) {
            this.commitResize();
        }
        this.resizingItemId.set(null);
        this.resizeDirection.set(null);
        this.initialResizeState = null;
        this.resizePreview.set(null);
    }

    private getColWidth(containerWidth: number): number {
        const gapNum = this.parseCssDimension(this.gap(), containerWidth);
        if (this.columnWidth() === '1fr') {
            return (containerWidth - (this.cols() - 1) * gapNum) / this.cols();
        }
        return this.parseCssDimension(this.columnWidth(), containerWidth);
    }

    onResizeStart(event: MouseEvent, item: DashboardItem, direction: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w') {
        if (!this.editable()) return;
        event.preventDefault();
        event.stopPropagation();

        const element = (event.target as HTMLElement).closest('.bento-item') as HTMLElement;
        const rect = element.getBoundingClientRect();



        const container = element.closest('.grid') as HTMLElement;
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
            x: event.clientX,
            y: event.clientY,
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
    }

    onDragStart(event: DragEvent, item: DashboardItem) {
        if (!this.editable()) return;

        const element = (event.target as HTMLElement).closest('.bento-item') as HTMLElement;
        const rect = element.getBoundingClientRect();

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

    onDragEnd(event: DragEvent) {
        this.draggedItemId.set(null);
        this.dropPreview.set(null);
        this.dragOffset.set(null);
    }

    private commitResize() {
        const id = this.resizingItemId();
        const preview = this.resizePreview();
        if (!id || !preview) return;

        let currentItems = [...this.items()];
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

            for (let i = 0; i < currentItems.length; i++) {
                if (currentItems[i].id === id) continue;

                const shrinking = this.shrinkItem(updatedItem, currentItems[i]);
                if (shrinking) {
                    currentItems[i] = shrinking;
                } else if (this.isOverlapping(updatedItem, currentItems[i])) {
                    currentItems.splice(i, 1);
                    i--;
                }
            }

            this.itemsChange.emit(currentItems);
        }

        this.resizingItemId.set(null);
        this.resizePreview.set(null);
        this.initialResizeState = null;
        this.resizeDirection.set(null);
    }

    onContainerContextMenu(event: MouseEvent, menu: ContextMenuComponent) {
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

    addItemAt(x: number, y: number, cols: number = 1, rows: number = 1) {
        const newItem: DashboardItem = {
            id: crypto.randomUUID(),
            x, y, cols, rows,
            content: 'New Item'
        };

        const isOverlapping = this.items().some(i => this.isOverlapping(newItem, i));

        if (isOverlapping) {
            console.warn('Cannot add item: Overlaps with existing item');
            return;
        }

        this.itemsChange.emit([...this.items(), newItem]);
    }
}