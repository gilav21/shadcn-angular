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
} from '../bento-grid';
import {
    ComponentMeta,
    InputDefinition,
    InputType,
    PageBuilderViewMode,
    PageData,
    WindowWithFileSystem
} from '../../lib/page-builder.types';
import { FormsModule } from '@angular/forms';
import { PropertyEditorComponent } from './sub/property-editor.component';
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
    templateUrl: './page-builder.component.html',
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
    instanceMap = signal<Map<string, Record<string, unknown>>>(new Map());
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
    private simulationInterval?: ReturnType<typeof setInterval>;
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

    toggleSquareCells(): void {
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

    updateGridSetting(signal: WritableSignal<string>, value: string): void {
        if (value && !Number.isNaN(Number.parseFloat(value)) && Number.isFinite(Number(value))) {
            signal.set(`${value}px`);
        } else {
            signal.set(value);
        }
    }

    toggleSimulatedData(): void {
        this.simulatingData.update(v => !v);
        if (this.simulatingData()) {
            this.startSimulation();
        } else {
            this.stopSimulation();
        }
    }

    private startSimulation(): void {
        this.simulationInterval = setInterval(() => {
            this.items.update(items => items.map(item => {
                const meta = this.getComponentMeta(item);
                if (meta?.id === 'progress') {
                    const current = (item.inputs?.['value'] as number | undefined) ?? 0;
                    const next = (current + 5) % 105;
                    return { ...item, inputs: { ...item.inputs, value: next } };
                }
                return item;
            }));
        }, 1000);
    }

    private stopSimulation(): void {
        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
            this.simulationInterval = undefined;
        }
    }

    onDragStart(event: DragEvent, comp: ComponentMeta): void {
        if (event.dataTransfer) {
            event.dataTransfer.setData('application/json', JSON.stringify({
                type: 'widget',
                id: comp.id
            }));
            event.dataTransfer.effectAllowed = 'all';
        }
    }

    onExternalDrop(event: { widgetId: string, targetId: string | null, x?: number, y?: number }): void {
        const comp = this.components().find(c => c.id === event.widgetId);
        if (!comp) return;

        this.addItem(comp, event.x, event.y);
    }


    addItem(comp: ComponentMeta, x?: number, y?: number): void {
        const finalX = x ?? 0;
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

    onComponentInit(event: { id: string, ref: ComponentRef<unknown> }): void {
        this.instanceMap.update(map => {
            const newMap = new Map(map);
            newMap.set(event.id, event.ref.instance as Record<string, unknown>);
            return newMap;
        });
    }

    onSelectionChange(ids: string[]): void {
        this.selectedItemId.set(ids.length > 0 ? ids[0] : null);
    }

    onItemsChange(newItems: DashboardItem[]): void {
        this.items.set(newItems);
    }

    onItemChange(event: { id: string, prop: string, value: unknown }): void {
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

    onDeleteItem(): void {
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

    toggleViewMode(): void {
        const next: PageBuilderViewMode = this.viewMode() === 'edit' ? 'preview' : 'edit';
        this.viewMode.set(next);
        this.viewModeChange.emit(next);
    }

    /** Emits the current layout via the (save) output. */
    saveJson(): void {
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

    async exportJson(): Promise<void> {
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
            console.error('Save cancelled or failed, falling back to download:', err);
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

    async importJson(): Promise<void> {
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
            console.error('Import cancelled or failed, falling back to input:', err);
            if ((err as Error).name === 'AbortError') return;
        }

        const fileInput = document.getElementById('import-json-input') as HTMLInputElement;
        if (fileInput) {
            fileInput.value = '';
            fileInput.click();
        }
    }

    async handleFileInput(event: Event): Promise<void> {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        const text = await file.text();
        this.loadLayout(text);
    }

    private loadLayout(jsonString: string): void {
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

    private applyLayout(data: PageData): void {
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

    clearBoard(): void {
        this.items.set([]);
        this.selectedItemId.set(null);
        this.instanceMap.set(new Map());
    }

    getComponentMeta(item: DashboardItem): ComponentMeta | undefined {
        const meta = this.components().find(c => c.component === item.content);
        if (!meta) return undefined;

        const mirror = reflectComponentType(meta.component);
        if (!mirror) return meta;

        const instance = this.instanceMap().get(item.id);
        const autoInputs: InputDefinition[] = mirror.inputs.map(inp => {
            const name = inp.propName;
            const defaultValue = meta.defaultInputs?.[name];
            const type = this.resolveInputType(name, defaultValue, instance);
            return { name, type, defaultValue };
        });

        if (!meta.inputs || meta.inputs.length === 0) {
            return { ...meta, inputs: autoInputs };
        }

        return { ...meta, inputs: this.mergeInputs(autoInputs, meta.inputs) };
    }

    private resolveInputType(
        name: string,
        defaultValue: unknown,
        instance: Record<string, unknown> | undefined,
    ): InputType {
        if (instance?.[name] !== undefined) {
            const val = typeof instance[name] === 'function'
                ? (instance[name] as () => unknown)()
                : instance[name];
            if (typeof val === 'number') return 'number';
            if (typeof val === 'boolean') return 'boolean';
        }
        if (typeof defaultValue === 'number') return 'number';
        if (typeof defaultValue === 'boolean') return 'boolean';
        if (this.isBooleanByConvention(name)) return 'boolean';
        return 'string';
    }

    private isBooleanByConvention(name: string): boolean {
        const boolNames = ['disabled', 'checked', 'isOpen', 'visible', 'readonly'];
        return boolNames.includes(name) || name.startsWith('is') || name.startsWith('has');
    }

    private mergeInputs(auto: InputDefinition[], manual: InputDefinition[]): InputDefinition[] {
        const merged = [...auto];
        for (const manualInput of manual) {
            const index = merged.findIndex(i => i.name === manualInput.name);
            if (index > -1) {
                merged[index] = { ...merged[index], ...manualInput };
            } else {
                merged.push(manualInput);
            }
        }
        return merged;
    }
}
