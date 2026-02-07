
import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    signal,
    output,
    Type,
    TemplateRef,
    ViewEncapsulation,
    forwardRef,
    inject,
    ElementRef,
    Directive,
    ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { cn } from '../lib/utils';
import {
    ContextMenuComponent,
    ContextMenuContentComponent,
    ContextMenuItemComponent,
    ContextMenuTriggerDirective
} from './context-menu.component';

export type CollisionStrategy = 'swap' | 'replace' | 'prevent';

export interface DashboardItem {
    id: string;
    x: number;
    y: number;
    cols: number;
    rows: number;
    content: string | Type<any>;
    inputs?: Record<string, any>;
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
        ContextMenuItemComponent
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div [class]="classes()" 
         (contextmenu)="onContainerContextMenu($event, menu)"
         (window:mousemove)="onWindowMouseMove($event)"
         (window:mouseup)="onWindowMouseUp()"
         (dragover)="onContainerDragOver($event)"
         (drop)="onContainerDrop($event)">
         
         <!-- Background Grid (Real Cells) -->
         @if (editable()) {
             <div class="absolute inset-0 grid grid-cols-12 auto-rows-[100px] gap-4 -z-10 pointer-events-none overflow-hidden">
                @for (cell of gridCells(); track cell.id) {
                    <div class="relative w-full h-full">
                        <!-- Corner Dots -->
                        <div class="absolute -top-[2px] -left-[2px] w-1 h-1 bg-neutral-400 dark:bg-neutral-600 rounded-full"></div>
                        <div class="absolute -top-[2px] -right-[2px] w-1 h-1 bg-neutral-400 dark:bg-neutral-600 rounded-full"></div>
                        <div class="absolute -bottom-[2px] -left-[2px] w-1 h-1 bg-neutral-400 dark:bg-neutral-600 rounded-full"></div>
                        <div class="absolute -bottom-[2px] -right-[2px] w-1 h-1 bg-neutral-400 dark:bg-neutral-600 rounded-full"></div>
                    </div>
                }
             </div>
         }
      <ui-context-menu #menu>
          <ui-context-menu-content>
              <!-- Item Context Menu -->
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
              
              <!-- Empty Spot Context Menu -->
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
            class="bento-item relative group rounded-xl border bg-card text-card-foreground shadow p-4 transition-all duration-200 overflow-hidden"
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
                <ng-container *ngComponentOutlet="asComponent(item.content); inputs: item.inputs || {}" />
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
      display: block;
    }
  `],
    encapsulation: ViewEncapsulation.None,
})
export class BentoGridComponent {
    class = input<string>('');
    items = input<DashboardItem[]>([]);
    editable = input<boolean>(false);
    collisionStrategy = input<CollisionStrategy>('swap');
    cols = input<number>(12); // Default 12 column grid

    itemsChange = output<DashboardItem[]>();
    externalDrop = output<{ widgetId: string, targetId: string }>();

    // State
    draggedItemId = signal<string | null>(null);
    dropTargetId = signal<string | null>(null);
    selectedItemIds = signal<string[]>([]);

    selectedIds = computed(() => new Set(this.selectedItemIds()));

    toggleSelection(id: string, multi: boolean = true) {
        if (!this.editable()) return;

        this.selectedItemIds.update(ids => {
            if (ids.includes(id)) {
                return ids.filter(i => i !== id);
            }
            if (multi) {
                return [...ids, id];
            }
            return [id];
        });
    }

    isSelected(id: string) {
        return this.selectedIds().has(id);
    }

    canMerge = computed(() => {
        const selectedIds = this.selectedItemIds();
        if (selectedIds.length < 2) return false;

        const items = this.items().filter(i => selectedIds.includes(i.id));
        if (items.length !== selectedIds.length) return false;

        // Calculate bounding box
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

        // 1. Area Check: The sum of areas must equal the bounding box area (No gaps)
        if (totalArea !== boundingBoxArea) return false;

        // 2. Connectivity Check: All items must be connected
        // Simple BFS/DFS to ensure all items are reachable from the first one
        const visited = new Set<string>();
        const queue = [items[0]];
        visited.add(items[0].id);

        while (queue.length > 0) {
            const current = queue.shift()!;

            // Find neighbors in 'items' that haven't been visited
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
        // A is adjacent to B if limits touch
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

        // Determine top-left item for content and ID
        // Sort by y, then x
        itemsToMerge.sort((a, b) => {
            if (a.y === b.y) return a.x - b.x;
            return a.y - b.y;
        });

        const primary = itemsToMerge[0];

        // Calculate new dimensions
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

        // Remove old items, add new item
        const newItems = this.items().filter(i => !selectedIds.includes(i.id));
        newItems.push(newItem);

        this.itemsChange.emit(newItems);
        this.selectedItemIds.set([]); // Clear selection
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
            if (item.cols < 2) return; // Cannot split 1 column

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
            if (item.rows < 2) return; // Cannot split 1 row

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
        'grid w-full auto-rows-[100px] gap-4 relative', // Strict 100px rows
        `grid-cols-${this.cols()}`,
        this.items().length > 0 ? 'grid-cols-12' : 'grid-cols-1 md:grid-cols-3',
        this.class()
    ));

    // Grid Visuals is now real cells, not gradient
    gridGradient = computed(() => 'none');

    // Generate background cells
    gridCells = computed(() => {
        if (!this.editable()) return [];

        // Calculate needed rows based on items or min height
        let maxRow = 8; // Default min
        for (const item of this.items()) {
            maxRow = Math.max(maxRow, item.y + item.rows);
        }
        // Add some breathing room
        maxRow += 2;

        const totalCells = this.cols() * maxRow;
        return Array(totalCells).fill(0).map((_, i) => ({
            id: i,
            // optional: x/y if needed, but flex/grid repeat works for flows
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

    // Drag and Drop Logic
    onDragStart(event: DragEvent, item: DashboardItem) {
        if (!this.editable()) return;

        this.draggedItemId.set(item.id);
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', item.id);
            // Hide the default browser ghost image
            const emptyImg = new Image();
            emptyImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
            event.dataTransfer.setDragImage(emptyImg, 0, 0);
        }
    }

    onDragEnd(event: DragEvent) {
        this.draggedItemId.set(null);
        this.dropPreview.set(null);
    }

    onDragOver(event: DragEvent, targetItem: DashboardItem) {
        if (!this.editable()) return;
        event.preventDefault(); // Necessary to allow dropping
        // Stop propagation so container doesn't get it if we are over an item
        // event.stopPropagation(); // REMOVED to allow container to update drop preview

        // Visual feedback could be added here
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'move';
        }
    }

    onContainerDragOver(event: DragEvent) {
        if (!this.editable()) return;
        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'move';
        }

        // Calculate drop preview
        // Need to know what we are dragging
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
        // Optional: clear preview if leaving container?
        // But dragleave fires when entering children (items), so be careful.
        // For now, let's rely on drop/end clearing it or ensure we track it well.
    }

    onDrop(event: DragEvent, targetItem: DashboardItem) {
        if (!this.editable()) return;
        event.preventDefault();
        event.stopPropagation(); // Handled by item

        // this.dropPreview.set(null); // Keep preview for calculation!

        const draggedId = this.draggedItemId();

        // Handle internal reordering (Item to Item)
        if (draggedId) {
            if (draggedId === targetItem.id) {
                const preview = this.dropPreview();
                if (preview) {
                    // Commit the move to the preview coordinates
                    let currentItems = [...this.items()];
                    const itemIndex = currentItems.findIndex(i => i.id === draggedId);

                    if (itemIndex > -1) {
                        // 1. Valid move?
                        // Update the dragged item to new position
                        const updatedDraggedItem = {
                            ...currentItems[itemIndex],
                            x: preview.x,
                            y: preview.y
                        };
                        currentItems[itemIndex] = updatedDraggedItem;

                        // 2. Handle Collisions (Shrink/Clip others)
                        // Iterate through ALL other items to check for overlap
                        for (let i = 0; i < currentItems.length; i++) {
                            if (currentItems[i].id === draggedId) continue;

                            const shrinking = this.shrinkItem(updatedDraggedItem, currentItems[i]);
                            if (shrinking) {
                                currentItems[i] = shrinking;
                            } else if (this.isOverlapping(updatedDraggedItem, currentItems[i])) {
                                // Overlapping but shrink returned null (fully covered)
                                // We should probably remove it or keep it hidden? 
                                // User said "clip overwriting blocks", usually implies removing overwritten parts.
                                // If fully overwritten, removing seems correct for "clip".
                                // Marking as hidden or removing? Let's remove for now to avoid ghosts.
                                currentItems.splice(i, 1);
                                i--; // Adjust index
                            }
                        }

                        this.itemsChange.emit(currentItems);
                    }
                }

                this.draggedItemId.set(null);
                this.dropPreview.set(null);
                return;
            }

            this.handleDrop(draggedId, targetItem);
            this.draggedItemId.set(null);
            return;
        }

        // Handle external drops (New Widgets) -> to Item (Replace)
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
        this.dropPreview.set(null); // Clear preview

        // 1. Handle Internal Drag to Empty
        const draggedId = this.draggedItemId();
        if (draggedId) {
            const { x, y } = this.getGridCoordinates(event);

            // Check if occupied? 
            // The user wants "move to empty spots".
            // If we drop on an empty spot, we move the item there.
            // If the item itself (cols/rows) would overlap, we might need validation.
            // For now, let's just update x/y.

            const currentItems = [...this.items()];
            const itemIndex = currentItems.findIndex(i => i.id === draggedId);
            if (itemIndex > -1) {
                const item = currentItems[itemIndex];
                // Check if new position + dimensions overlaps with OTHERS (excluding self)
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

        // 2. Handle External Drag to Empty (Add New)
        // If user drags a widget to empty space, we should probably add it there?
        // User didn't strictly ask for this in "Drag to Empty" (context was moving items), 
        // but it makes sense.
        // Let's implement it for completeness.
        const data = event.dataTransfer?.getData('application/json');
        if (data) {
            try {
                const parsed = JSON.parse(data);
                if (parsed.type === 'widget' && parsed.id) {
                    const { x, y } = this.getGridCoordinates(event);
                    // We don't have the widget content here directly to add it.
                    // The parent handles "externalDrop" but that expects a targetId.
                    // We might need a new event `externalDropAt` or similar.
                    // For now, let's skip external-to-empty unless requested or easy.
                    // Actually, we can emit a special event or reuse externalDrop with a null targetId but add coords?
                    // Let's hold off on this specific external-to-empty workflow to avoid scope creep, focus on "moving items".
                }
            } catch (e) {
                // ignore
            }
        }
    }

    // Helper for grid coordinates
    private getGridCoordinates(event: DragEvent | MouseEvent) {
        const container = (event.currentTarget as HTMLElement);
        const rect = container.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const gap = 16;
        const colWidth = (rect.width - (this.cols() - 1) * gap) / this.cols();
        const rowHeight = 100; // Consistent with other calcs

        const gridX = Math.floor(x / (colWidth + gap)) + 1;
        const gridY = Math.floor(y / (rowHeight + gap)) + 1;

        return { x: gridX, y: gridY };
    }

    // Shrinks 'loser' to the largest rectangular area that doesn't overlap 'winner'
    private shrinkItem(winner: { x: number, y: number, cols: number, rows: number }, loser: DashboardItem): DashboardItem | null {
        // 1. Check Intersection
        const x1 = Math.max(winner.x, loser.x);
        const y1 = Math.max(winner.y, loser.y);
        const x2 = Math.min(winner.x + winner.cols, loser.x + loser.cols);
        const y2 = Math.min(winner.y + winner.rows, loser.y + loser.rows);

        if (x1 >= x2 || y1 >= y2) {
            return loser; // No overlap
        }

        // 2. Overlap detected. Calculate 4 possible slices.
        const candidates: DashboardItem[] = [];

        // Top Slice (Keep Top part of Loser)
        if (loser.y < winner.y) {
            candidates.push({ ...loser, rows: winner.y - loser.y });
        }
        // Bottom Slice (Keep Bottom part of Loser)
        if (loser.y + loser.rows > winner.y + winner.rows) {
            const newY = winner.y + winner.rows;
            candidates.push({ ...loser, y: newY, rows: (loser.y + loser.rows) - newY });
        }
        // Left Slice (Keep Left part of Loser)
        if (loser.x < winner.x) {
            candidates.push({ ...loser, cols: winner.x - loser.x });
        }
        // Right Slice (Keep Right part of Loser)
        if (loser.x + loser.cols > winner.x + winner.cols) {
            const newX = winner.x + winner.cols;
            candidates.push({ ...loser, x: newX, cols: (loser.x + loser.cols) - newX });
        }

        if (candidates.length === 0) return null; // Fully covered?

        // 3. Pick Max Area
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

    private handleDrop(draggedId: string, targetItem: DashboardItem) {
        const currentItems = [...this.items()];
        const draggedIndex = currentItems.findIndex(i => i.id === draggedId);
        const targetIndex = currentItems.findIndex(i => i.id === targetItem.id);

        if (draggedIndex === -1 || targetIndex === -1) return;

        const draggedItem = currentItems[draggedIndex];

        const strategy = this.collisionStrategy();

        if (strategy === 'swap') {
            // Swap positions (x, y) AND dimensions (cols, rows)
            // The dragged item takes the target's position and size
            const newDragged = {
                ...draggedItem,
                x: targetItem.x,
                y: targetItem.y,
                cols: targetItem.cols,
                rows: targetItem.rows
            };

            // The target item takes the dragged item's position and size
            const newTarget = {
                ...targetItem,
                x: draggedItem.x,
                y: draggedItem.y,
                cols: draggedItem.cols,
                rows: draggedItem.rows
            };

            // Update array
            currentItems[draggedIndex] = newDragged;
            currentItems[targetIndex] = newTarget;

            this.itemsChange.emit(currentItems);
        } else if (strategy === 'replace') {
            // Move dragged to target position, remove target
            // This implies dragging onto an existing item 'replaces' it
            const newDragged = { ...draggedItem, x: targetItem.x, y: targetItem.y };

            // Remove target, update dragged
            // Note: We need to handle where the dragged item CAME from. It leaves a hole.
            // And we remove the target item entirely? Or push it somewhere?
            // "Replace" usually means overwrite/delete the old one.

            // Remove target item
            currentItems.splice(targetIndex, 1);
            // Find dragged index again as it might have shifted if target was before it
            const newDraggedIndex = currentItems.findIndex(i => i.id === draggedId);
            currentItems[newDraggedIndex] = newDragged;

            this.itemsChange.emit(currentItems);
        } else if (strategy === 'prevent') {
            // Do nothing
            console.log('Drop prevented by collision strategy');
        }
    }

    // Resize Logic
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

    // Global event listeners for resizing
    onWindowMouseMove(event: MouseEvent) {
        if (!this.resizingItemId() || !this.initialResizeState || !this.resizeDirection()) return;

        const deltaX = event.clientX - this.initialResizeState.x;
        const deltaY = event.clientY - this.initialResizeState.y;

        const colsDiff = Math.round(deltaX / this.initialResizeState.colStep);
        const rowsDiff = Math.round(deltaY / this.initialResizeState.rowStep);

        let newCols = this.initialResizeState.cols;
        let newRows = this.initialResizeState.rows;
        let newX = this.initialResizeState.itemX;
        let newY = this.initialResizeState.itemY;

        const direction = this.resizeDirection();

        if (direction === 'se') {
            newCols = Math.max(1, this.initialResizeState.cols + colsDiff);
            newRows = Math.max(1, this.initialResizeState.rows + rowsDiff);
        } else if (direction === 'sw') {
            // Change X, Cols AND Rows (if moving down)
            newCols = Math.max(1, this.initialResizeState.cols - colsDiff);
            newX = this.initialResizeState.itemX + (this.initialResizeState.cols - newCols);
            newRows = Math.max(1, this.initialResizeState.rows + rowsDiff); // Allow height change
        } else if (direction === 'ne') {
            newRows = Math.max(1, this.initialResizeState.rows - rowsDiff);
            newY = this.initialResizeState.itemY + (this.initialResizeState.rows - newRows);
            newCols = Math.max(1, this.initialResizeState.cols + colsDiff);
        } else if (direction === 'nw') {
            newCols = Math.max(1, this.initialResizeState.cols - colsDiff);
            newRows = Math.max(1, this.initialResizeState.rows - rowsDiff);
            newX = this.initialResizeState.itemX + (this.initialResizeState.cols - newCols);
            newY = this.initialResizeState.itemY + (this.initialResizeState.rows - newRows);
        }
        // Edge Resizing
        else if (direction === 'e') {
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

    onResizeStart(event: MouseEvent, item: DashboardItem, direction: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w') {
        if (!this.editable()) return;
        event.preventDefault();
        event.stopPropagation();

        const element = (event.target as HTMLElement).closest('.bento-item') as HTMLElement;
        const rect = element.getBoundingClientRect();

        // Use container metrics for consistent sensitivity (Repeated logic from earlier fix)
        const container = element.closest('.grid') as HTMLElement;
        if (!container) return;

        const containerRect = container.getBoundingClientRect();
        const gap = 16;
        const colWidth = (containerRect.width - (this.cols() - 1) * gap) / this.cols();
        const rowHeight = 100;

        const colStep = colWidth + gap;
        const rowStep = rowHeight + gap;

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

            // Handle Collisions (Shrink/Clip others)
            for (let i = 0; i < currentItems.length; i++) {
                if (currentItems[i].id === id) continue;

                const shrinking = this.shrinkItem(updatedItem, currentItems[i]);
                if (shrinking) {
                    currentItems[i] = shrinking;
                } else if (this.isOverlapping(updatedItem, currentItems[i])) {
                    // Overlapping but shrink returned null (fully covered)
                    currentItems.splice(i, 1);
                    i--;
                }
            }

            this.itemsChange.emit(currentItems);
        }
    }

    // Container Context Menu
    onContainerContextMenu(event: MouseEvent, menu: ContextMenuComponent) {
        if (!this.editable()) return;

        // Ensure we clicked the container background, not an item
        // (items stop propagation, so this should be fine if we wire it up correctly)
        // But to be safe:
        if ((event.target as HTMLElement).closest('.bento-item')) return;

        event.preventDefault();

        // Calculate grid coordinates
        // We need the container element
        const container = (event.currentTarget as HTMLElement);
        const rect = container.getBoundingClientRect();

        // Assuming uniform grid
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Estimate cell size
        // We can get it from computed style of the grid or just divide width by cols
        const gap = 16; // 1rem = 16px (approx) - strictly checking computed style is better but complex
        // Let's use the width / cols approximation for now
        const colWidth = (rect.width - (this.cols() - 1) * gap) / this.cols();

        // Row height is tricky because of auto-rows. 
        // But defaults to minmax(100px, auto). Let's assume ~116px (100 + gap) step or just use the same logic if we can.
        // Or better: find the row based on scroll? No, use clientY.
        // Let's assume a fixed row height step for now for "empty" spots or try to reverse calc.
        const rowHeight = 100; // Base height from CSS

        // Rough calc
        const gridX = Math.floor(x / (colWidth + gap)) + 1;
        const gridY = Math.floor(y / (rowHeight + gap)) + 1;

        // Check if occupied
        // We need to check exact overlap
        const tempItem = { x: gridX, y: gridY, cols: 1, rows: 1, id: 'temp', content: '' };
        const isOccupied = this.items().some(i => this.isOverlapping(tempItem, i));

        if (!isOccupied) {
            menu.show(event.clientX, event.clientY, { type: 'empty', x: gridX, y: gridY });
        }
    }

    addItemAt(x: number, y: number, cols: number = 1, rows: number = 1) {
        // Validation: Check if the new item would overlap with anything
        const newItem: DashboardItem = {
            id: crypto.randomUUID(),
            x, y, cols, rows,
            content: 'New Item'
        };

        const isOverlapping = this.items().some(i => this.isOverlapping(newItem, i));

        if (isOverlapping) {
            // Optional: visual feedback or toast
            console.warn('Cannot add item: Overlaps with existing item');
            return;
        }

        this.itemsChange.emit([...this.items(), newItem]);
    }
}
