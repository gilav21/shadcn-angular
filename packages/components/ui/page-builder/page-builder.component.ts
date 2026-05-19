import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    signal,
    computed,
    effect,
    WritableSignal,
    reflectComponentType,
    ComponentRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
    BentoGridComponent,
    DashboardItem
} from '../bento-grid.component';
import {
    ComponentMeta,
    InputDefinition,
    InputType,
    PageBuilderViewMode,
    PageData,
    WindowWithFileSystem
} from './page-builder.types';
import { FormsModule } from '@angular/forms';
import { PropertyEditorComponent } from './property-editor.component';
import { cn } from '../../lib/utils';
import { IconComponent } from '../icon';

@Component({
    selector: 'ui-page-builder',
    standalone: true,
    imports: [
        CommonModule,
        BentoGridComponent,
        FormsModule,
        PropertyEditorComponent,
        IconComponent
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="classes()" [attr.data-slot]="'page-builder'" class="h-screen bg-background overflow-hidden flex">
            <!-- Sidebar -->
            <aside class="w-full md:w-80 border-r bg-card flex flex-col border-r-border h-full">
                <div class="h-14 border-b flex items-center px-4 font-semibold text-sm gap-2 bg-background/50 backdrop-blur shrink-0">
                    <ui-icon name="box" class="h-4 w-4 text-muted-foreground"></ui-icon>
                    Components
                </div>
                <div class="flex-1 overflow-y-auto p-4 space-y-6 overscroll-contain">
                    @for (category of categories(); track category) {
                        <div>
                            <h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-2">
                                {{ category }}
                            </h3>
                            <div class="grid grid-cols-2 gap-2">
                                @for (comp of componentsByCategory()[category]; track comp.id) {
                                    <div 
                                        draggable="true"
                                        (dragstart)="onDragStart($event, comp)"
                                        class="flex flex-col items-center justify-center p-3 rounded-lg border bg-background hover:bg-accent hover:text-accent-foreground cursor-grab active:cursor-grabbing transition-all group border-border/50 hover:border-primary/50 shadow-sm hover:shadow-md"
                                        [title]="comp.name"
                                    >
                                        <div class="p-2 rounded-md bg-muted group-hover:bg-primary/10 transition-colors mb-2">
                                            <ui-icon [name]="comp.icon || 'box'" class="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors"></ui-icon>
                                        </div>
                                        <span class="text-[11px] font-medium truncate w-full text-center">{{ comp.name }}</span>
                                    </div>
                                }
                            </div>
                        </div>
                    }
                </div>
            </aside>

            <!-- Main Area -->
            <main class="flex-1 flex flex-col bg-muted/30 h-full overflow-hidden">
                <!-- Toolbar -->
                <header class="h-14 border-b bg-background flex items-center justify-between px-6 shrink-0 z-10">
                    <div class="flex items-center gap-4">
                        <div class="flex items-center gap-2 text-sm font-medium">
                            <ui-icon name="layers" class="h-4 w-4"></ui-icon>
                            <span>{{ items().length }} Items</span>
                        </div>
                    </div>

                    <div class="flex items-center gap-2">
                        <div class="flex items-center bg-muted/50 rounded-lg p-1 mr-2 border border-border/50">
                            <button 
                                (click)="toggleSimulatedData()"
                                class="h-7 px-3 rounded-md flex items-center gap-2 text-[11px] font-medium transition-all"
                                [class.bg-primary]="simulatingData()"
                                [class.text-primary-foreground]="simulatingData()"
                                [class.bg-transparent]="!simulatingData()"
                                title="Toggle Live Data Simulation"
                            >
                                <ui-icon [name]="simulatingData() ? 'refresh-cw' : 'loader'" [class.animate-spin]="simulatingData()" class="h-3.5 w-3.5"></ui-icon>
                                <span>{{ simulatingData() ? 'Stop Sim' : 'Live Demo' }}</span>
                            </button>
                        </div>

                        <button
                            (click)="toggleViewMode()"
                            class="h-9 px-3 rounded-md hover:bg-accent hover:text-accent-foreground flex items-center gap-2 text-sm transition-colors"
                            [class.bg-accent]="viewMode() === 'preview'"
                            [title]="viewMode() === 'preview' ? 'Switch to Edit Mode' : 'Switch to Preview Mode'"
                        >
                            <ui-icon [name]="viewMode() === 'preview' ? 'pencil' : 'eye'" class="h-4 w-4"></ui-icon>
                            <span>{{ viewMode() === 'preview' ? 'Edit' : 'Preview' }}</span>
                        </button>
                        <div class="h-4 w-px bg-border mx-2"></div>
                        <button
                            (click)="clearBoard()"
                            class="h-9 px-3 rounded-md hover:bg-destructive/10 hover:text-destructive flex items-center gap-2 text-sm transition-colors"
                            title="Clear Board"
                        >
                            <ui-icon name="trash-2" class="h-4 w-4"></ui-icon>
                            <span>Clear</span>
                        </button>
                        <button
                            (click)="importJson()"
                            class="h-9 px-3 rounded-md hover:bg-accent hover:text-accent-foreground flex items-center gap-2 text-sm transition-colors mr-2"
                            title="Import Layout"
                        >
                            <ui-icon name="upload" class="h-4 w-4"></ui-icon>
                            Import
                        </button>
                        @if (enableSave()) {
                            <button
                                (click)="saveJson()"
                                class="h-9 px-4 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 text-sm font-medium transition-colors shadow-sm"
                                title="Save Layout"
                            >
                                <ui-icon name="save" class="h-4 w-4"></ui-icon>
                                Save
                            </button>
                        }
                        @if (enableExport()) {
                            <button
                                (click)="exportJson()"
                                class="h-9 px-4 rounded-md border border-border bg-background hover:bg-accent hover:text-accent-foreground flex items-center gap-2 text-sm font-medium transition-colors shadow-sm"
                                title="Export Layout as File"
                            >
                                <ui-icon name="download" class="h-4 w-4"></ui-icon>
                                Export
                            </button>
                        }
                    </div>
                </header>

                <!-- Grid Area -->
                <div class="flex-1 overflow-auto p-8 relative overscroll-contain flex flex-col">
                    <div class="max-w-[1200px] w-full mx-auto flex-1 flex flex-col bg-card/30 rounded-xl border border-dashed border-border/50 relative">
                        
                        @if (items().length === 0) {
                            <div class="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground pointer-events-none">
                                <div class="bg-background/50 p-6 rounded-full mb-4 ring-1 ring-border/50">
                                    <ui-icon name="layout-template" class="h-8 w-8 opacity-50"></ui-icon>
                                </div>
                                <p class="text-sm font-medium">Drag components here to build your page</p>
                            </div>
                        }

                        <ui-bento-grid
                            [items]="items()"
                            (itemsChange)="onItemsChange($event)"
                            [cols]="gridCols()"
                            [rowHeight]="gridRowHeight()"
                            [columnWidth]="gridColumnWidth()"
                            [gap]="gridGap()"
                            [showBorders]="gridShowBorders()"
                            [borderRadius]="gridBorderRadius()"
                            [itemPadding]="gridItemPadding()"
                            [editable]="viewMode() === 'edit'"
                            (selectionChange)="onSelectionChange($event)"
                            (externalDrop)="onExternalDrop($event)"
                            (componentInit)="onComponentInit($event)"
                            class="flex-1 transition-all duration-300"
                        >
                        </ui-bento-grid>
                    </div>
                </div>
            </main>
            <input 
                type="file" 
                id="import-json-input" 
                accept=".json" 
                class="hidden" 
                (change)="handleFileInput($event)"
            >

            <!-- RIGHT INSPECTOR -->
            @if (viewMode() === 'edit') {
                <aside class="w-80 border-l bg-card flex flex-col border-l-border h-full">
                    <div class="h-14 border-b flex items-center px-4 font-semibold text-sm gap-2 bg-background/50 backdrop-blur shrink-0">
                        <ui-icon name="settings-2" class="h-4 w-4 text-muted-foreground"></ui-icon>
                        {{ selectedItemId() ? 'Properties' : 'Grid Settings' }}
                    </div>
                    <div class="flex-1 overflow-auto p-4">
                        @if (selectedItemId()) {
                            <ui-property-editor
                                [item]="selectedItem()"
                                [componentMeta]="selectedComponentMeta()"
                                [isLoading]="!!(selectedItemId() && !instanceMap().has(selectedItemId()!))"
                                (itemChange)="onItemChange($event)"
                                (delete)="onDeleteItem()"
                            />
                        } @else {
                            <div class="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div class="space-y-4">
                                    <div class="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        <ui-icon name="grid" class="h-3 w-3"></ui-icon>
                                        Layout Configuration
                                    </div>
                                    
                                    <div class="space-y-3 p-3 rounded-lg border bg-muted/30">
                                        <div class="space-y-1.5">
                                            <label class="text-xs font-medium">Row Height</label>
                                            <input 
                                                type="text" 
                                                [ngModel]="gridRowHeight()" 
                                                (ngModelChange)="gridRowHeight.set($event)"
                                                (blur)="updateGridSetting(gridRowHeight, gridRowHeight())"
                                                class="w-full h-8 px-2 rounded-md border bg-background text-sm focus:ring-1 focus:ring-primary outline-none"
                                                placeholder="e.g. 100px"
                                            >
                                        </div>
                                        
                                         <div class="space-y-1.5">
                                             <label class="text-xs font-medium">Gap Size</label>
                                             <input 
                                                 type="text" 
                                                 [ngModel]="gridGap()" 
                                                 (ngModelChange)="gridGap.set($event)"
                                                 (blur)="updateGridSetting(gridGap, gridGap())"
                                                 class="w-full h-8 px-2 rounded-md border bg-background text-sm focus:ring-1 focus:ring-primary outline-none"
                                                 placeholder="e.g. 1rem"
                                             >
                                         </div>

                                         <div class="space-y-3 pt-2 border-t border-border/50">
                                            <div class="flex items-center justify-between">
                                                <div class="flex items-center gap-2">
                                                    <ui-icon name="box-select" class="h-3 w-3 text-muted-foreground"></ui-icon>
                                                    <label class="text-xs font-medium">Square Cells (Symmetry)</label>
                                                </div>
                                                <button 
                                                    (click)="toggleSquareCells()"
                                                    class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                                    [class.bg-primary]="gridSquareCells()"
                                                    [class.bg-input]="!gridSquareCells()"
                                                >
                                                    <span 
                                                        class="pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform"
                                                        [style.transform]="gridSquareCells() ? 'translateX(1rem)' : 'translateX(0)'"
                                                    ></span>
                                                </button>
                                            </div>

                                            @if (!gridSquareCells()) {
                                                <div class="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                                                    <label class="text-xs font-medium text-muted-foreground">Column Configuration</label>
                                                    <div class="grid grid-cols-2 gap-2">
                                                        <div class="space-y-1">
                                                            <span class="text-[10px] text-muted-foreground">Count</span>
                                                            <input 
                                                                type="number" 
                                                                [(ngModel)]="gridCols"
                                                                class="w-full h-8 px-2 rounded-md border bg-background text-xs focus:ring-1 focus:ring-primary outline-none"
                                                            >
                                                        </div>
                                                        <div class="space-y-1">
                                                            <span class="text-[10px] text-muted-foreground">Width</span>
                                                            <input 
                                                                type="text" 
                                                                [ngModel]="gridColumnWidth()"
                                                                (ngModelChange)="gridColumnWidth.set($event)"
                                                                (blur)="updateGridSetting(gridColumnWidth, gridColumnWidth())"
                                                                class="w-full h-8 px-2 rounded-md border bg-background text-xs focus:ring-1 focus:ring-primary outline-none"
                                                                placeholder="1fr or px"
                                                            >
                                                        </div>
                                                    </div>
                                                </div>
                                            }
                                         </div>

                                        <div class="space-y-1.5 pt-2 border-t border-border/50">
                                            <div class="flex items-center justify-between">
                                                <label class="text-xs font-medium">Show Borders (Preview)</label>
                                                <button 
                                                    (click)="gridShowBorders.set(!gridShowBorders())"
                                                    class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                    [class.bg-primary]="gridShowBorders()"
                                                    [class.bg-input]="!gridShowBorders()"
                                                >
                                                    <span 
                                                        class="pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform"
                                                        [style.transform]="gridShowBorders() ? 'translateX(1rem)' : 'translateX(0)'"
                                                    ></span>
                                                </button>
                                            </div>
                                        </div>

                                         <div class="space-y-1.5">
                                             <label class="text-xs font-medium">Border Radius</label>
                                             <div class="flex items-center gap-2">
                                                 <input 
                                                     type="text" 
                                                     [ngModel]="gridBorderRadius()" 
                                                     (ngModelChange)="gridBorderRadius.set($event)"
                                                     (blur)="updateGridSetting(gridBorderRadius, gridBorderRadius())"
                                                     class="flex-1 h-8 px-2 rounded-md border bg-background text-sm focus:ring-1 focus:ring-primary outline-none"
                                                     placeholder="e.g. 0.75rem"
                                                 >
                                                 <div class="flex gap-1">
                                                     <button (click)="gridBorderRadius.set('0px')" class="h-6 w-6 rounded border text-[10px] flex items-center justify-center hover:bg-accent">0</button>
                                                     <button (click)="gridBorderRadius.set('0.75rem')" class="h-6 w-6 rounded-md border text-[10px] flex items-center justify-center hover:bg-accent">M</button>
                                                     <button (click)="gridBorderRadius.set('1.5rem')" class="h-6 w-6 rounded-lg border text-[10px] flex items-center justify-center hover:bg-accent">L</button>
                                                 </div>
                                             </div>
                                         </div>

                                         <div class="space-y-1.5 pt-2 border-t border-border/50">
                                            <label class="text-xs font-medium">Item Padding (Fix Snapping)</label>
                                            <div class="flex items-center gap-2">
                                                <input 
                                                    type="text" 
                                                    [ngModel]="gridItemPadding()" 
                                                    (ngModelChange)="gridItemPadding.set($event)"
                                                    (blur)="updateGridSetting(gridItemPadding, gridItemPadding())"
                                                    class="flex-1 h-8 px-2 rounded-md border bg-background text-sm focus:ring-1 focus:ring-primary outline-none"
                                                    placeholder="e.g. 1rem"
                                                >
                                                <button (click)="gridItemPadding.set('0px')" class="h-8 px-2 rounded border text-[10px] hover:bg-accent">None</button>
                                            </div>
                                            <p class="text-[10px] text-muted-foreground">Reduce padding to allow items to fit in very small rows (< 30px).</p>
                                         </div>
                                     </div>
                                 </div>

                                <div class="p-4 rounded-xl bg-primary/5 border border-primary/10 text-xs text-muted-foreground leading-relaxed">
                                    <p class="font-medium text-primary mb-1">Tip:</p>
                                    Use standard CSS units like px, rem, or vh to customize your grid's spacing.
                                </div>
                            </div>
                        }
                    </div>
                </aside>
            }
        </div>
    `,
})
export class PageBuilderComponent {
    class = input('');
    components = input<ComponentMeta[]>([]);

    /** Initial layout to load into the builder. Changes to this input reset the board (like `importJson()`). Omit or pass `undefined` to start empty. */
    readonly data = input<PageData | undefined>(undefined);

    /** Show the "Save" button in the toolbar. Clicking it emits the current layout via the (save) output. Default: true. */
    readonly enableSave = input<boolean>(true);
    /** Show the "Export" button in the toolbar. Clicking it downloads the current layout as a JSON file. Default: false. */
    readonly enableExport = input<boolean>(false);

    /** Emits the current layout (grid settings + items) when the user clicks the Save button. */
    readonly save = output<PageData>();
    /** Emits whenever the view mode changes between 'edit' and 'preview'. */
    readonly viewModeChange = output<PageBuilderViewMode>();

    viewMode = signal<PageBuilderViewMode>('edit');
    items = signal<DashboardItem[]>([]);
    selectedItemId = signal<string | null>(null);
    instanceMap = signal<Map<string, any>>(new Map());
    isSelecting = signal(false);



    gridRowHeight = signal<string>('20px');
    gridColumnWidth = signal<string>('1fr');
    gridCols = signal<number>(12);
    gridGap = signal<string>('1.5rem');
    gridShowBorders = signal<boolean>(true);
    gridBorderRadius = signal<string>('0.75rem');
    gridItemPadding = signal<string>('1rem');
    gridSquareCells = signal<boolean>(true);



    simulatingData = signal<boolean>(false);
    private simulationInterval?: any;
    private lastAppliedData: PageData | undefined;

    constructor() {
        effect(() => {
            if (this.gridSquareCells()) {
                const height = this.gridRowHeight();
                this.gridColumnWidth.set(height);
            }
        }, { allowSignalWrites: true });

        effect(() => {
            const incoming = this.data();
            const comps = this.components();
            if (!incoming || incoming === this.lastAppliedData || comps.length === 0) return;
            this.lastAppliedData = incoming;
            this.applyLayout(incoming);
        }, { allowSignalWrites: true });
    }

    toggleSquareCells() {
        this.gridSquareCells.update(v => !v);
        if (this.gridSquareCells()) {
            this.gridColumnWidth.set(this.gridRowHeight());
        } else {
            this.gridColumnWidth.set('1fr');
        }
    }

    classes = computed(() => cn('flex h-full w-full bg-background text-foreground overflow-hidden', this.class()));

    selectedItem = computed(() => {
        const id = this.selectedItemId();
        return this.items().find(i => i.id === id);
    });

    selectedComponentMeta = computed(() => {
        const item = this.selectedItem();
        if (!item) return undefined;
        return this.getComponentMeta(item);
    });

    categories = computed(() => {
        const cats = new Set(this.components().map(c => c.category));
        return Array.from(cats).sort((a, b) => a.localeCompare(b));
    });

    componentsByCategory = computed(() => {
        const grouped: Record<string, ComponentMeta[]> = {};
        for (const comp of this.components()) {
            if (!grouped[comp.category]) grouped[comp.category] = [];
            grouped[comp.category].push(comp);
        }
        return grouped;
    });

    updateGridSetting(signal: WritableSignal<string>, value: string) {
        if (value && !Number.isNaN(Number.parseFloat(value)) && Number.isFinite(Number(value))) {
            signal.set(`${value}px`);
        } else {
            signal.set(value);
        }
    }

    toggleSimulatedData() {
        this.simulatingData.update(v => !v);
        if (this.simulatingData()) {
            this.startSimulation();
        } else {
            this.stopSimulation();
        }
    }

    private startSimulation() {
        this.simulationInterval = setInterval(() => {
            this.items.update(items => items.map(item => {
                const meta = this.getComponentMeta(item);
                if (meta?.id === 'progress') {
                    const current = item.inputs?.['value'] || 0;
                    const next = (current + 5) % 105;
                    return { ...item, inputs: { ...item.inputs, value: next } };
                }
                return item;
            }));
        }, 1000);
    }

    private stopSimulation() {
        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
            this.simulationInterval = undefined;
        }
    }

    onDragStart(event: DragEvent, comp: ComponentMeta) {
        if (event.dataTransfer) {
            event.dataTransfer.setData('application/json', JSON.stringify({
                type: 'widget',
                id: comp.id
            }));
            event.dataTransfer.effectAllowed = 'all';
        }
    }

    onExternalDrop(event: { widgetId: string, targetId: string | null, x?: number, y?: number }) {
        const comp = this.components().find(c => c.id === event.widgetId);
        if (!comp) return;

        this.addItem(comp, event.x, event.y);
    }


    addItem(comp: ComponentMeta, x?: number, y?: number) {
        let finalX = x ?? 0;
        let finalY = y ?? 0;

        if (x === undefined || y === undefined) {
            finalY = 0;
            this.items().forEach(i => finalY = Math.max(finalY, i.y + i.rows));
        }

        const newItem: DashboardItem = {
            id: crypto.randomUUID(),
            x: finalX,
            y: finalY,
            cols: comp.defaultCols || 2,
            rows: comp.defaultRows || 2,
            content: comp.component,
            inputs: { ...comp.defaultInputs }
        };

        this.items.update(curr => [...curr, newItem]);
        this.selectedItemId.set(newItem.id);
    }

    onComponentInit(event: { id: string, ref: ComponentRef<any> }) {
        this.instanceMap.update(map => {
            const newMap = new Map(map);
            newMap.set(event.id, event.ref.instance);
            return newMap;
        });
    }

    onSelectionChange(ids: string[]) {
        this.selectedItemId.set(ids.length > 0 ? ids[0] : null);
    }

    onItemsChange(newItems: DashboardItem[]) {
        this.items.set(newItems);
    }

    onItemChange(event: { id: string, prop: string, value: any }) {
        const id = event.id;
        if (!id) return;

        this.items.update(items => items.map(item => {
            if (item.id === id) {
                if (typeof event.prop === 'string' && !['x', 'y', 'cols', 'rows', 'bindings'].includes(event.prop)) {
                    const newInputs = { ...item.inputs };
                    newInputs[event.prop] = event.value;
                    return { ...item, inputs: newInputs };
                } else {
                    return { ...item, [event.prop]: event.value };
                }
            }
            return item;
        }));
    }

    onDeleteItem() {
        const id = this.selectedItemId();
        if (id) {
            this.items.update(items => items.filter(i => i.id !== id));
            this.selectedItemId.set(null);
            this.instanceMap.update(map => {
                const newMap = new Map(map);
                newMap.delete(id);
                return newMap;
            });
        }
    }

    toggleViewMode() {
        const next: PageBuilderViewMode = this.viewMode() === 'edit' ? 'preview' : 'edit';
        this.viewMode.set(next);
        this.viewModeChange.emit(next);
    }

    /** Emits the current layout via the (save) output. */
    saveJson() {
        this.save.emit(this.buildLayout());
    }

    private buildLayout(): PageData {
        return {
            grid: {
                cols: this.gridCols(),
                rowHeight: this.gridRowHeight(),
                columnWidth: this.gridColumnWidth(),
                gap: this.gridGap(),
                showBorders: this.gridShowBorders(),
                borderRadius: this.gridBorderRadius(),
                itemPadding: this.gridItemPadding(),
                squareCells: this.gridSquareCells()
            },
            items: this.items().map(item => ({
                id: item.id,
                x: item.x,
                y: item.y,
                cols: item.cols,
                rows: item.rows,
                componentId: this.getComponentMeta(item)?.id ?? '',
                inputs: item.inputs,
                bindings: item.bindings
            })),
            timestamp: new Date().toISOString()
        };
    }

    async exportJson() {
        const data = this.buildLayout();

        const fileName = `page-builder-export.json`;
        const jsonString = JSON.stringify(data, null, 2);

        try {
            const win = globalThis as unknown as WindowWithFileSystem;
            if (win.showSaveFilePicker) {
                const handle = await win.showSaveFilePicker({
                    suggestedName: fileName,
                    types: [{
                        description: 'JSON File',
                        accept: { 'application/json': ['.json'] },
                    }],
                });
                const writable = await handle.createWritable();
                await writable.write(jsonString);
                await writable.close();
                return;
            }
        } catch (err) {
            console.log('Save cancelled or failed, falling back to download:', err);
            if ((err as Error).name === 'AbortError') return;
        }

        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = globalThis.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', fileName);
        link.style.display = 'none';
        document.body.appendChild(link);

        link.click();

        setTimeout(() => {
            link.remove();
            globalThis.URL.revokeObjectURL(url);
        }, 2000);
    }

    async importJson() {
        try {
            const win = globalThis as unknown as WindowWithFileSystem;
            if (win.showOpenFilePicker) {
                const [handle] = await win.showOpenFilePicker({
                    types: [{
                        description: 'JSON File',
                        accept: { 'application/json': ['.json'] },
                    }],
                    multiple: false
                });
                const file = await handle.getFile();
                const text = await file.text();
                this.loadLayout(text);
                return;
            }
        } catch (err) {
            console.log('Import cancelled or failed, falling back to input:', err);
            if ((err as Error).name === 'AbortError') return;
        }

        const fileInput = document.getElementById('import-json-input') as HTMLInputElement;
        if (fileInput) {
            fileInput.value = '';
            fileInput.click();
        }
    }

    async handleFileInput(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        const text = await file.text();
        this.loadLayout(text);
    }

    private loadLayout(jsonString: string) {
        try {
            const data = JSON.parse(jsonString);

            if (!data.grid || !Array.isArray(data.items)) {
                alert('Invalid layout file format');
                return;
            }

            this.lastAppliedData = data as PageData;
            this.applyLayout(data as PageData);
        } catch (err) {
            console.error('Failed to parse layout file:', err);
            alert('Failed to parse layout file');
        }
    }

    private applyLayout(data: PageData) {
        const grid = data.grid;
        if (grid.cols) this.gridCols.set(grid.cols);
        if (grid.rowHeight) this.gridRowHeight.set(grid.rowHeight);
        if (grid.columnWidth) this.gridColumnWidth.set(grid.columnWidth);
        if (grid.gap) this.gridGap.set(grid.gap);
        if (grid.showBorders !== undefined) this.gridShowBorders.set(grid.showBorders);
        if (grid.borderRadius) this.gridBorderRadius.set(grid.borderRadius);
        if (grid.itemPadding) this.gridItemPadding.set(grid.itemPadding);
        if (grid.squareCells !== undefined) this.gridSquareCells.set(grid.squareCells);

        const comps = this.components();
        const newItems: DashboardItem[] = data.items
            .map((item): DashboardItem | null => {
                const meta = comps.find(c => c.id === item.componentId);
                if (!meta) return null;
                return {
                    id: item.id,
                    x: item.x,
                    y: item.y,
                    cols: item.cols,
                    rows: item.rows,
                    content: meta.component,
                    inputs: item.inputs ?? {},
                    bindings: item.bindings ?? {},
                };
            })
            .filter((item): item is DashboardItem => item !== null);

        this.items.set(newItems);
        this.selectedItemId.set(null);
        this.instanceMap.set(new Map());
    }

    clearBoard() {
        this.items.set([]);
        this.selectedItemId.set(null);
        this.instanceMap.set(new Map());
    }

    getComponentMeta(item: DashboardItem): ComponentMeta | undefined {
        const meta = this.components().find(c => c.component === item.content);
        if (!meta) return undefined;

        const mirror = reflectComponentType(meta.component);
        if (!mirror) return meta;

        const autoInputs: InputDefinition[] = mirror.inputs.map(input => {
            const name = input.propName;
            const defaultValue = meta.defaultInputs?.[name];
            const instance = this.instanceMap().get(item.id);

            let type: InputType = 'string';

            if (instance?.[name] !== undefined) {
                const val = typeof instance[name] === 'function' ? instance[name]() : instance[name];
                if (typeof val === 'number') type = 'number';
                else if (typeof val === 'boolean') type = 'boolean';
            }
            else if (typeof defaultValue === 'number') {
                type = 'number';
            } else if (typeof defaultValue === 'boolean') {
                type = 'boolean';
            }
            else if (
                name === 'disabled' ||
                name === 'checked' ||
                name === 'isOpen' ||
                name === 'visible' ||
                name === 'readonly' ||
                name.startsWith('is') ||
                name.startsWith('has')
            ) {
                type = 'boolean';
            }

            return {
                name,
                type,
                defaultValue
            };
        });

        if (!meta.inputs || meta.inputs.length === 0) {
            return { ...meta, inputs: autoInputs };
        }

        const mergedInputs = [...autoInputs];

        meta.inputs.forEach(manualInput => {
            const index = mergedInputs.findIndex(i => i.name === manualInput.name);
            if (index > -1) {
                mergedInputs[index] = { ...mergedInputs[index], ...manualInput };
            } else {
                mergedInputs.push(manualInput);
            }
        });

        return { ...meta, inputs: mergedInputs };
    }
}
