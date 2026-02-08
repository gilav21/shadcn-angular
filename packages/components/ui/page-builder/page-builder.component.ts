import {
    Component,
    ChangeDetectionStrategy,
    input,
    signal,
    computed,
    reflectComponentType,
    NgModule,
    ComponentRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
    LucideAngularModule,
    LayoutDashboard,
    Grid,
    Type as TypeIcon,
    Image as ImageIcon,
    List,
    BoxSelect,
    TextCursor,
    BarChart2,
    GripVertical,
    Eye,
    Pencil,
    PanelsTopLeft,
    ListCollapse,
    Minus,
    FileText,
    ToggleRight,
    CheckSquare,
    SlidersHorizontal,
    CircleDot,
    Star,
    Tag,
    UserCircle,
    Clock,
    ChevronRight,
    Code,
    Loader,
    RefreshCw,
    Sparkles,
    MessageSquare,
    AlertTriangle,
    Plus,
    Settings2,
    Trash2,
    Monitor,
    Smartphone,
    Tablet,
    Undo2,
    Redo2,
    Save,
    Download,
    Upload,
    MoreVertical,
    Check,
    X,
    Layers,
    LayoutTemplate,
    MousePointerClick,
    Box,
    ToggleLeft,
    CreditCard,
    Layout
} from 'lucide-angular';
import {
    BentoGridComponent,
    DashboardItem
} from '../bento-grid.component';
import {
    ComponentMeta,
    InputDefinition,
    InputType
} from './page-builder.types';
import { FormsModule } from '@angular/forms';
import { PropertyEditorComponent } from './property-editor.component';

@NgModule({
    imports: [
        LucideAngularModule.pick({
            LayoutDashboard,
            Layers,
            Grid,
            Trash2,
            Download,
            Settings2,
            LayoutTemplate,
            MousePointerClick,
            Plus,
            Box,
            Type: TypeIcon,
            ToggleLeft,
            CreditCard,
            Layout,
            AlertTriangle,
            BoxSelect,
            TextCursor,
            BarChart2,
            GripVertical,
            Eye,
            Pencil,
            PanelsTopLeft,
            ListCollapse,
            Minus,
            FileText,
            ToggleRight,
            CheckSquare,
            SlidersHorizontal,
            CircleDot,
            Star,
            Tag,
            UserCircle,
            Clock,
            ChevronRight,
            Code,
            Loader,
            RefreshCw,
            Sparkles,
            MessageSquare
        })
    ],
    exports: [LucideAngularModule]
})
export class PageBuilderIconsModule { }

@Component({
    selector: 'ui-page-builder',
    standalone: true,
    imports: [
        CommonModule,
        BentoGridComponent,
        PageBuilderIconsModule,
        FormsModule,
        PropertyEditorComponent
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="flex h-full w-full bg-background text-foreground overflow-hidden">
            <!-- LEFT PALETTE -->
            <aside class="w-64 border-r flex flex-col bg-muted/10 border-r-border">
                <div class="h-14 border-b flex items-center px-4 font-semibold text-sm gap-2 bg-background/50 backdrop-blur">
                    <lucide-icon name="layout-dashboard" class="h-4 w-4 text-muted-foreground"></lucide-icon>
                    Components
                </div>
                <div class="flex-1 overflow-y-auto p-4 space-y-6">
                    @for (category of categories(); track category) {
                        <div class="space-y-3">
                            <h3 class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">{{ category }}</h3>
                            <div class="grid grid-cols-2 gap-3">
                                @for (comp of componentsByCategory()[category]; track comp.id) {
                                    <div 
                                        class="group relative flex flex-col items-center justify-center p-4 rounded-xl border bg-card hover:bg-accent hover:text-accent-foreground hover:border-primary/50 cursor-grab active:cursor-grabbing transition-all shadow-sm hover:shadow-md gap-3 text-center"
                                        draggable="true"
                                        (dragstart)="onDragStart($event, comp)"
                                    >
                                        <div class="p-2 rounded-lg bg-muted group-hover:bg-background transition-colors">
                                            <lucide-icon [name]="comp.icon" class="h-5 w-5"></lucide-icon>
                                        </div>
                                        <span class="text-xs font-medium">{{ comp.name }}</span>
                                        
                                        <!-- Hover Effect -->
                                        <div class="absolute inset-0 rounded-xl ring-2 ring-primary/0 group-hover:ring-primary/10 transition-all"></div>
                                    </div>
                                }
                            </div>
                        </div>
                    }
                </div>
            </aside>

            <!-- CENTER STAGE -->
            <main class="flex-1 flex flex-col min-w-0 bg-background relative selection-area">
                <!-- Toolbar -->
                <header class="h-14 border-b flex items-center justify-between px-6 bg-background/50 backdrop-blur z-10">
                    <div class="flex items-center gap-4">
                        <div class="flex items-center gap-2 text-sm text-muted-foreground">
                            <lucide-icon name="layers" class="h-4 w-4"></lucide-icon>
                            <span>{{ items().length }} Items</span>
                        </div>
                    </div>

                    <div class="flex items-center gap-2">
                        <button 
                            (click)="viewMode.set(viewMode() === 'edit' ? 'preview' : 'edit')"
                            class="h-9 px-3 rounded-md hover:bg-accent hover:text-accent-foreground flex items-center gap-2 text-sm transition-colors"
                            [class.bg-accent]="viewMode() === 'preview'"
                            [title]="viewMode() === 'preview' ? 'Switch to Edit Mode' : 'Switch to Preview Mode'"
                        >
                            <lucide-icon [name]="viewMode() === 'preview' ? 'pencil' : 'eye'" class="h-4 w-4"></lucide-icon>
                            <span>{{ viewMode() === 'preview' ? 'Edit' : 'Preview' }}</span>
                        </button>
                        <div class="h-4 w-px bg-border mx-2"></div>
                        <button 
                            (click)="clearBoard()"
                            class="h-9 px-3 rounded-md hover:bg-destructive/10 hover:text-destructive flex items-center gap-2 text-sm transition-colors"
                            title="Clear Board"
                        >
                            <lucide-icon name="trash-2" class="h-4 w-4"></lucide-icon>
                            <span>Clear</span>
                        </button>
                        <button 
                            (click)="exportJson()"
                            class="h-9 px-4 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 text-sm font-medium transition-colors shadow-sm"
                        >
                            <lucide-icon name="download" class="h-4 w-4"></lucide-icon>
                            Export
                        </button>
                    </div>
                </header>

                <!-- Grid Area -->
                <div class="flex-1 overflow-auto p-8 relative">
                    <div class="max-w-[1200px] mx-auto min-h-full bg-card/30 rounded-xl border border-dashed border-border/50 relative">
                        
                        @if (items().length === 0) {
                            <div class="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground pointer-events-none">
                                <div class="bg-background/50 p-6 rounded-full mb-4 ring-1 ring-border/50">
                                    <lucide-icon name="layout-template" class="h-8 w-8 opacity-50"></lucide-icon>
                                </div>
                                <p class="text-sm font-medium">Drag components here to build your page</p>
                            </div>
                        }

                        <ui-bento-grid
                            [items]="items()"
                            (itemsChange)="onItemsChange($event)"
                            [cols]="12"
                            [editable]="viewMode() === 'edit'"
                            (selectionChange)="onSelectionChange($event)"
                            (externalDrop)="onExternalDrop($event)"
                            (componentInit)="onComponentInit($event)"
                            class="min-h-[600px] transition-all duration-300"
                        >
                        </ui-bento-grid>
                    </div>
                </div>
            </main>

            <!-- RIGHT INSPECTOR -->
            @if (viewMode() === 'edit') {
                <aside class="w-80 border-l bg-card flex flex-col border-l-border">
                    <div class="h-14 border-b flex items-center px-4 font-semibold text-sm gap-2 bg-background/50 backdrop-blur">
                        <lucide-icon name="settings-2" class="h-4 w-4 text-muted-foreground"></lucide-icon>
                        Properties
                    </div>
                    <div class="flex-1 overflow-hidden">
                        <ui-property-editor
                            [item]="selectedItem()"
                            [componentMeta]="selectedComponentMeta()"
                            [isLoading]="!!(selectedItemId() && !instanceMap().has(selectedItemId()!))"
                            (itemChange)="onItemChange($event)"
                            (delete)="onDeleteItem()"
                        />
                    </div>
                </aside>
            }
        </div>
    `,
})
export class PageBuilderComponent {
    components = input<ComponentMeta[]>([]);

    items = signal<DashboardItem[]>([]);
    selectedItemId = signal<string | null>(null);
    instanceMap = signal<Map<string, any>>(new Map());
    isSelecting = signal(false);
    viewMode = signal<'edit' | 'preview'>('edit');

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
        return Array.from(cats).sort();
    });

    componentsByCategory = computed(() => {
        const grouped: Record<string, ComponentMeta[]> = {};
        for (const comp of this.components()) {
            if (!grouped[comp.category]) grouped[comp.category] = [];
            grouped[comp.category].push(comp);
        }
        return grouped;
    });

    onDragStart(event: DragEvent, comp: ComponentMeta) {
        if (event.dataTransfer) {
            event.dataTransfer.setData('application/json', JSON.stringify({
                type: 'widget',
                id: comp.id
            }));
            event.dataTransfer.effectAllowed = 'copyMove';
        }
    }

    onExternalDrop(event: { widgetId: string, targetId: string | null, x?: number, y?: number }) {
        const compMeta = this.components().find(c => c.id === event.widgetId);
        if (!compMeta) return;

        if (event.targetId) {
            // Replace content logic
            this.items.update(items => items.map(item => {
                if (item.id === event.targetId) {
                    return {
                        ...item,
                        content: compMeta.component,
                        inputs: { ...compMeta.defaultInputs }
                    };
                }
                return item;
            }));
            return;
        }

        this.addItem(compMeta, event.x, event.y);
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

    onItemChange(event: { id: string, prop: keyof DashboardItem | string, value: any }) {
        const id = event.id;
        if (!id) return;

        this.items.update(items => items.map(item => {
            if (item.id === id) {
                if (typeof event.prop === 'string' && !['x', 'y', 'cols', 'rows'].includes(event.prop)) {
                    // This is an input change
                    const newInputs = { ...(item.inputs || {}) };
                    newInputs[event.prop] = event.value;
                    return { ...item, inputs: newInputs };
                } else {
                    // This is a property change (x, y, cols, rows)
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

    exportJson() {
        const data = {
            items: this.items().map(item => ({
                id: item.id,
                x: item.x,
                y: item.y,
                cols: item.cols,
                rows: item.rows,
                componentId: this.getComponentMeta(item)?.id,
                inputs: item.inputs
            })),
            timestamp: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `page-builder-export-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();

        // Cleanup
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 100);
    }

    clearBoard() {
        if (confirm('Are you sure you want to clear the board?')) {
            this.items.set([]);
            this.selectedItemId.set(null);
            this.instanceMap.set(new Map());
        }
    }

    getComponentMeta(item: DashboardItem): ComponentMeta | undefined {
        const meta = this.components().find(c => c.component === item.content);
        if (!meta) return undefined;

        // Auto-extract inputs using Angular reflection
        const mirror = reflectComponentType(meta.component);
        if (!mirror) return meta;

        const autoInputs: InputDefinition[] = mirror.inputs.map(input => {
            const name = input.propName;
            const defaultValue = meta.defaultInputs?.[name];
            const instance = this.instanceMap().get(item.id);

            // Heuristic Type Inference
            let type: InputType = 'string';

            // 1. Check live instance if available
            if (instance && instance[name] !== undefined) {
                const val = typeof instance[name] === 'function' ? instance[name]() : instance[name];
                if (typeof val === 'number') type = 'number';
                else if (typeof val === 'boolean') type = 'boolean';
            }
            // 2. Check default value type
            else if (typeof defaultValue === 'number') {
                type = 'number';
            } else if (typeof defaultValue === 'boolean') {
                type = 'boolean';
            }
            // 3. Check name heuristics (if type is still string)
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

        // If no manual inputs, return auto inputs
        if (!meta.inputs || meta.inputs.length === 0) {
            return { ...meta, inputs: autoInputs };
        }

        // Merge: Auto inputs are base, Manual inputs are overrides
        // We want to keep all auto inputs, but specific ones might be overridden by manual config
        // (e.g. to change type to 'select' which reflection can't guess)

        const mergedInputs = [...autoInputs];

        meta.inputs.forEach(manualInput => {
            const index = mergedInputs.findIndex(i => i.name === manualInput.name);
            if (index > -1) {
                // Override existing auto-input
                mergedInputs[index] = { ...mergedInputs[index], ...manualInput };
            } else {
                // Add new manual input (rare, but maybe for virtual inputs)
                mergedInputs.push(manualInput);
            }
        });

        return { ...meta, inputs: mergedInputs };
    }
}
