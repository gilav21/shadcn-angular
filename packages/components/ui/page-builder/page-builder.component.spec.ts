import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PageBuilderComponent } from './page-builder.component';
import { ComponentMeta, PageBuilderViewMode, PageData } from '../../lib/page-builder.types';
import { By } from '@angular/platform-browser';
import { BentoGridComponent } from '../bento-grid';
import { Component, input } from '@angular/core';
import { vi } from 'vitest';

@Component({
    template: '<div class="mock-widget">Mock Widget</div>',
    standalone: true
})
class MockWidgetComponent { }

@Component({
    selector: 'mock-progress',
    template: '<div>{{ value() }}</div>',
    standalone: true,
})
class MockProgressComponent {
    readonly value = input<number>(0);
    readonly label = input<string>('');
    readonly disabled = input<boolean>(false);
}

describe('PageBuilderComponent', () => {
    let component: PageBuilderComponent;
    let fixture: ComponentFixture<PageBuilderComponent>;

    const mockComponents: ComponentMeta[] = [
        {
            id: 'mock-widget',
            name: 'Mock Widget',
            category: 'Test',
            icon: 'box',
            component: MockWidgetComponent,
            defaultCols: 2,
            defaultRows: 2
        }
    ];

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [PageBuilderComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(PageBuilderComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('components', mockComponents);
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should render sidebar with components', () => {
        const sidebar = fixture.debugElement.query(By.css('aside'));
        expect(sidebar).toBeTruthy();

        const category = sidebar.query(By.css('h3'));
        expect(category.nativeElement.textContent).toContain('Test');

        const widget = sidebar.query(By.css('[draggable="true"]'));
        expect(widget).toBeTruthy();
        expect(widget.nativeElement.textContent).toContain('Mock Widget');
    });

    it('should add item when calling addItem', () => {
        component.addItem(mockComponents[0]);
        fixture.detectChanges();

        expect(component.items().length).toBe(1);
        const item = component.items()[0];
        expect(item.content).toBe(MockWidgetComponent);
        expect(item.cols).toBe(2);
        expect(item.rows).toBe(2);
    });

    it('should update grid settings', () => {
        component.gridRowHeight.set('150px');
        fixture.detectChanges();

        expect(component.gridRowHeight()).toBe('150px');
        const bentoGrid = fixture.debugElement.query(By.directive(BentoGridComponent));
        expect(bentoGrid.componentInstance.rowHeight()).toBe('150px');
    });

    it('should handle selection', () => {
        component.addItem(mockComponents[0]);
        fixture.detectChanges();

        const item = component.items()[0];
        component.onSelectionChange([item.id]);
        fixture.detectChanges();

        expect(component.selectedItemId()).toBe(item.id);
    });

    it('should delete selected item', () => {
        component.addItem(mockComponents[0]);
        fixture.detectChanges();

        const item = component.items()[0];
        component.selectedItemId.set(item.id);
        fixture.detectChanges();

        component.onDeleteItem();
        fixture.detectChanges();

        expect(component.items().length).toBe(0);
        expect(component.selectedItemId()).toBeNull();
    });

    it('should default gridRowHeight to 20px and gridSquareCells to true', () => {
        expect(component.gridRowHeight()).toBe('20px');
        expect(component.gridSquareCells()).toBe(true);
    });

    it('should show the Save button by default and hide the Export button', () => {
        const saveBtn = fixture.debugElement.query(By.css('button[title="Save Layout"]'));
        const exportBtn = fixture.debugElement.query(By.css('button[title="Export Layout as File"]'));
        expect(saveBtn).toBeTruthy();
        expect(exportBtn).toBeNull();
    });

    it('should show the Export button when enableExport is true', () => {
        fixture.componentRef.setInput('enableExport', true);
        fixture.detectChanges();
        const exportBtn = fixture.debugElement.query(By.css('button[title="Export Layout as File"]'));
        expect(exportBtn).toBeTruthy();
    });

    it('should hide the Save button when enableSave is false', () => {
        fixture.componentRef.setInput('enableSave', false);
        fixture.detectChanges();
        const saveBtn = fixture.debugElement.query(By.css('button[title="Save Layout"]'));
        expect(saveBtn).toBeNull();
    });

    it('should emit (save) with the current layout when Save is clicked', () => {
        component.addItem(mockComponents[0]);
        fixture.detectChanges();

        let emitted: PageData | undefined;
        component.save.subscribe((payload: PageData) => { emitted = payload; });

        const saveBtn = fixture.debugElement.query(By.css('button[title="Save Layout"]'));
        saveBtn.nativeElement.click();

        expect(emitted).toBeDefined();
        expect(emitted!.items.length).toBe(1);
        expect(emitted!.items[0].componentId).toBe('mock-widget');
        expect(emitted!.grid.rowHeight).toBe('20px');
        expect(emitted!.grid.squareCells).toBe(true);
        expect(typeof emitted!.timestamp).toBe('string');
    });

    it('should load initial state from [data] input', () => {
        const initial: PageData = {
            grid: {
                cols: 8,
                rowHeight: '40px',
                columnWidth: '40px',
                gap: '2rem',
                showBorders: false,
                borderRadius: '1rem',
                itemPadding: '0.5rem',
                squareCells: true,
            },
            items: [
                { id: 'seed-1', x: 1, y: 2, cols: 3, rows: 3, componentId: 'mock-widget', inputs: { label: 'hello' } },
            ],
        };

        fixture.componentRef.setInput('data', initial);
        fixture.detectChanges();

        expect(component.gridCols()).toBe(8);
        expect(component.gridRowHeight()).toBe('40px');
        expect(component.gridGap()).toBe('2rem');
        expect(component.items().length).toBe(1);
        const loaded = component.items()[0];
        expect(loaded.id).toBe('seed-1');
        expect(loaded.content).toBe(MockWidgetComponent);
        expect(loaded.inputs?.['label']).toBe('hello');
    });

    it('should re-apply layout when [data] input reference changes', () => {
        const first: PageData = {
            grid: { cols: 12, rowHeight: '20px', columnWidth: '20px', gap: '1rem', showBorders: true, borderRadius: '0.5rem', itemPadding: '1rem', squareCells: true },
            items: [{ id: 'a', x: 0, y: 0, cols: 2, rows: 2, componentId: 'mock-widget' }],
        };
        fixture.componentRef.setInput('data', first);
        fixture.detectChanges();
        expect(component.items().map(i => i.id)).toEqual(['a']);

        const second: PageData = {
            ...first,
            items: [
                { id: 'b', x: 0, y: 0, cols: 2, rows: 2, componentId: 'mock-widget' },
                { id: 'c', x: 2, y: 0, cols: 2, rows: 2, componentId: 'mock-widget' },
            ],
        };
        fixture.componentRef.setInput('data', second);
        fixture.detectChanges();
        expect(component.items().map(i => i.id)).toEqual(['b', 'c']);
    });

    it('should emit (viewModeChange) when toggling view mode', () => {
        const emitted: PageBuilderViewMode[] = [];
        component.viewModeChange.subscribe((mode: PageBuilderViewMode) => emitted.push(mode));

        component.toggleViewMode();
        expect(component.viewMode()).toBe('preview');
        expect(emitted).toEqual(['preview']);

        component.toggleViewMode();
        expect(component.viewMode()).toBe('edit');
        expect(emitted).toEqual(['preview', 'edit']);
    });
});

describe('PageBuilderComponent — editor behavior', () => {
    let component: PageBuilderComponent;
    let fixture: ComponentFixture<PageBuilderComponent>;

    const progressMeta: ComponentMeta = {
        id: 'progress',
        name: 'Progress Bar',
        category: 'Data',
        icon: 'activity',
        component: MockProgressComponent,
        defaultCols: 3,
        defaultRows: 1,
        defaultInputs: { value: 40, label: 'CPU' },
    };
    const widgetMeta: ComponentMeta = {
        id: 'mock-widget',
        name: 'Mock Widget',
        category: 'Basic',
        icon: 'box',
        component: MockWidgetComponent,
        defaultCols: 2,
        defaultRows: 2,
    };
    const components = [widgetMeta, progressMeta];

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [PageBuilderComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(PageBuilderComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('components', components);
        fixture.detectChanges();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('sidebar derivation', () => {
        it('derives sorted categories and groups components by category', () => {
            expect(component.categories()).toEqual(['Basic', 'Data']);
            const grouped = component.componentsByCategory();
            expect(grouped['Basic'].map(c => c.id)).toEqual(['mock-widget']);
            expect(grouped['Data'].map(c => c.id)).toEqual(['progress']);
        });
    });

    describe('addItem placement', () => {
        it('auto-stacks items below existing ones when no coordinates given', () => {
            component.addItem(widgetMeta); // y=0, rows=2
            component.addItem(progressMeta); // should drop below -> y=2
            const [first, second] = component.items();
            expect(first.y).toBe(0);
            expect(second.y).toBe(2);
            expect(component.selectedItemId()).toBe(second.id);
        });

        it('places an item at explicit coordinates from an external drop', () => {
            component.onExternalDrop({ widgetId: 'progress', targetId: null, x: 4, y: 6 });
            const item = component.items()[0];
            expect(item.x).toBe(4);
            expect(item.y).toBe(6);
            expect(item.content).toBe(MockProgressComponent);
            expect(item.cols).toBe(3);
            expect(item.inputs).toEqual({ value: 40, label: 'CPU' });
        });

        it('ignores an external drop for an unknown widget id', () => {
            component.onExternalDrop({ widgetId: 'does-not-exist', targetId: null });
            expect(component.items().length).toBe(0);
        });
    });

    describe('onDragStart', () => {
        it('writes the widget payload onto the drag dataTransfer', () => {
            const setData = vi.fn();
            const dataTransfer = { setData, effectAllowed: '' } as unknown as DataTransfer;
            const event = { dataTransfer } as unknown as DragEvent;

            component.onDragStart(event, progressMeta);

            expect(setData).toHaveBeenCalledWith('application/json', JSON.stringify({ type: 'widget', id: 'progress' }));
            expect(dataTransfer.effectAllowed).toBe('all');
        });

        it('is a no-op when dataTransfer is missing', () => {
            expect(() => component.onDragStart({} as DragEvent, progressMeta)).not.toThrow();
        });
    });

    describe('onItemChange', () => {
        it('updates a layout property (cols) directly on the item', () => {
            component.addItem(widgetMeta);
            const id = component.items()[0].id;

            component.onItemChange({ id, prop: 'cols', value: 5 });
            expect(component.items()[0].cols).toBe(5);
            expect(component.items()[0].inputs).toEqual({});
        });

        it('updates a non-layout property into the item inputs map', () => {
            component.addItem(progressMeta);
            const id = component.items()[0].id;

            component.onItemChange({ id, prop: 'label', value: 'Memory' });
            expect(component.items()[0].inputs?.['label']).toBe('Memory');
            expect(component.items()[0].inputs?.['value']).toBe(40);
        });

        it('ignores changes for an empty id', () => {
            component.addItem(widgetMeta);
            const before = component.items()[0];
            component.onItemChange({ id: '', prop: 'cols', value: 9 });
            expect(component.items()[0]).toBe(before);
        });
    });

    describe('instanceMap', () => {
        it('records a component instance on init and drops it on delete', () => {
            component.addItem(widgetMeta);
            const id = component.items()[0].id;
            const instance = { value: () => 10 };

            component.onComponentInit({ id, ref: { instance } as never });
            expect(component.instanceMap().get(id)).toBe(instance);

            component.selectedItemId.set(id);
            component.onDeleteItem();
            expect(component.instanceMap().has(id)).toBe(false);
        });
    });

    describe('grid settings', () => {
        it('appends px to numeric grid values and leaves unit values untouched', () => {
            component.updateGridSetting(component.gridGap, '24');
            expect(component.gridGap()).toBe('24px');

            component.updateGridSetting(component.gridGap, '2rem');
            expect(component.gridGap()).toBe('2rem');
        });

        it('keeps column width mirrored to row height while square cells is on', () => {
            expect(component.gridSquareCells()).toBe(true);
            component.gridRowHeight.set('30px');
            fixture.detectChanges();
            expect(component.gridColumnWidth()).toBe('30px');
        });

        it('toggles square cells off and restores 1fr column width', () => {
            component.gridRowHeight.set('30px');
            fixture.detectChanges();
            component.toggleSquareCells();
            expect(component.gridSquareCells()).toBe(false);
            expect(component.gridColumnWidth()).toBe('1fr');

            component.toggleSquareCells();
            expect(component.gridSquareCells()).toBe(true);
            expect(component.gridColumnWidth()).toBe(component.gridRowHeight());
        });
    });

    describe('simulated data', () => {
        it('advances progress values on an interval while simulating', () => {
            vi.useFakeTimers();
            try {
                component.addItem(progressMeta);
                const id = component.items()[0].id;
                component.onItemChange({ id, prop: 'value', value: 0 });

                component.toggleSimulatedData();
                expect(component.simulatingData()).toBe(true);

                vi.advanceTimersByTime(1000);
                expect(component.items()[0].inputs?.['value']).toBe(5);
                vi.advanceTimersByTime(1000);
                expect(component.items()[0].inputs?.['value']).toBe(10);

                component.toggleSimulatedData();
                expect(component.simulatingData()).toBe(false);
                vi.advanceTimersByTime(1000);
                expect(component.items()[0].inputs?.['value']).toBe(10);
            } finally {
                vi.useRealTimers();
            }
        });
    });

    describe('getComponentMeta + input introspection', () => {
        it('synthesizes auto inputs from component metadata with resolved types', () => {
            component.addItem(progressMeta);
            const item = component.items()[0];

            const meta = component.getComponentMeta(item);
            expect(meta).toBeDefined();
            const byName = new Map(meta!.inputs!.map(i => [i.name, i]));
            expect(byName.get('value')?.type).toBe('number');
            expect(byName.get('label')?.type).toBe('string');
            expect(byName.get('disabled')?.type).toBe('boolean');
        });

        it('infers a boolean type from a live instance signal value', () => {
            component.addItem(progressMeta);
            const item = component.items()[0];
            component.onComponentInit({ id: item.id, ref: { instance: { value: () => true } } as never });

            const meta = component.getComponentMeta(item);
            const valueInput = meta!.inputs!.find(i => i.name === 'value');
            expect(valueInput?.type).toBe('boolean');
        });

        it('returns undefined for an item whose component is not registered', () => {
            const orphan = { id: 'x', x: 0, y: 0, cols: 1, rows: 1, content: MockWidgetComponent };
            const empty = TestBed.createComponent(PageBuilderComponent);
            empty.componentRef.setInput('components', []);
            empty.detectChanges();
            expect(empty.componentInstance.getComponentMeta(orphan)).toBeUndefined();
        });

        it('merges manual input definitions over the auto-derived ones', () => {
            const withManual: ComponentMeta = {
                ...progressMeta,
                inputs: [
                    { name: 'value', type: 'number', label: 'Percent' },
                    { name: 'mode', type: 'select', options: ['a', 'b'] },
                ],
            };
            const f = TestBed.createComponent(PageBuilderComponent);
            f.componentRef.setInput('components', [withManual]);
            f.detectChanges();
            const cmp = f.componentInstance;
            cmp.addItem(withManual);

            const meta = cmp.getComponentMeta(cmp.items()[0]);
            const byName = new Map(meta!.inputs!.map(i => [i.name, i]));
            expect(byName.get('value')?.label).toBe('Percent');
            expect(byName.get('mode')?.type).toBe('select');
        });
    });

    describe('selectedComponentMeta', () => {
        it('exposes meta for the selected item and undefined when nothing is selected', () => {
            expect(component.selectedComponentMeta()).toBeUndefined();
            component.addItem(progressMeta);
            component.selectedItemId.set(component.items()[0].id);
            expect(component.selectedComponentMeta()?.id).toBe('progress');
        });
    });

    describe('serialization round-trip', () => {
        it('imports a JSON layout via handleFileInput and rebuilds items', async () => {
            const layout: PageData = {
                grid: { cols: 6, rowHeight: '50px', columnWidth: '50px', gap: '1rem', showBorders: false, borderRadius: '1rem', itemPadding: '0.5rem', squareCells: true },
                items: [
                    { id: 'p1', x: 0, y: 0, cols: 3, rows: 1, componentId: 'progress', inputs: { value: 70 } },
                    { id: 'ghost', x: 0, y: 0, cols: 1, rows: 1, componentId: 'unknown-comp' },
                ],
            };
            const file = new File([JSON.stringify(layout)], 'layout.json', { type: 'application/json' });
            const event = { target: { files: [file] } } as unknown as Event;

            await component.handleFileInput(event);

            expect(component.gridCols()).toBe(6);
            expect(component.gridRowHeight()).toBe('50px');
            expect(component.items().map(i => i.id)).toEqual(['p1']);
            expect(component.items()[0].inputs?.['value']).toBe(70);
            expect(component.selectedItemId()).toBeNull();
        });

        it('alerts and does not apply a malformed layout file', async () => {
            const alertSpy = vi.spyOn(globalThis, 'alert').mockImplementation(() => undefined);
            component.addItem(widgetMeta);

            const file = new File(['{"not":"a layout"}'], 'bad.json', { type: 'application/json' });
            await component.handleFileInput({ target: { files: [file] } } as unknown as Event);

            expect(alertSpy).toHaveBeenCalledWith('Invalid layout file format');
            expect(component.items().length).toBe(1);
        });

        it('alerts on unparseable JSON', async () => {
            const alertSpy = vi.spyOn(globalThis, 'alert').mockImplementation(() => undefined);
            const file = new File(['not json at all'], 'bad.json', { type: 'application/json' });
            await component.handleFileInput({ target: { files: [file] } } as unknown as Event);
            expect(alertSpy).toHaveBeenCalledWith('Failed to parse layout file');
        });

        it('does nothing when no file is selected', async () => {
            await component.handleFileInput({ target: { files: [] } } as unknown as Event);
            expect(component.items().length).toBe(0);
        });
    });

    describe('export / import via File System Access API', () => {
        it('exportJson writes the serialized layout through showSaveFilePicker', async () => {
            component.addItem(progressMeta);

            const write = vi.fn().mockResolvedValue(undefined);
            const close = vi.fn().mockResolvedValue(undefined);
            const createWritable = vi.fn().mockResolvedValue({ write, close });
            const showSaveFilePicker = vi.fn().mockResolvedValue({ createWritable });
            (globalThis as unknown as { showSaveFilePicker: unknown }).showSaveFilePicker = showSaveFilePicker;

            try {
                await component.exportJson();
                expect(showSaveFilePicker).toHaveBeenCalled();
                expect(write).toHaveBeenCalledTimes(1);
                const payload = JSON.parse(write.mock.calls[0][0] as string) as PageData;
                expect(payload.items[0].componentId).toBe('progress');
                expect(close).toHaveBeenCalledTimes(1);
            } finally {
                delete (globalThis as unknown as Record<string, unknown>)['showSaveFilePicker'];
            }
        });

        it('importJson reads a picked file and applies the layout', async () => {
            const layout: PageData = {
                grid: { cols: 4, rowHeight: '20px', columnWidth: '20px', gap: '1rem', showBorders: true, borderRadius: '0.5rem', itemPadding: '1rem', squareCells: true },
                items: [{ id: 'imp', x: 0, y: 0, cols: 2, rows: 2, componentId: 'mock-widget' }],
            };
            const file = new File([JSON.stringify(layout)], 'layout.json', { type: 'application/json' });
            const getFile = vi.fn().mockResolvedValue(file);
            const showOpenFilePicker = vi.fn().mockResolvedValue([{ getFile }]);
            (globalThis as unknown as { showOpenFilePicker: unknown }).showOpenFilePicker = showOpenFilePicker;

            try {
                await component.importJson();
                expect(showOpenFilePicker).toHaveBeenCalled();
                expect(component.gridCols()).toBe(4);
                expect(component.items().map(i => i.id)).toEqual(['imp']);
            } finally {
                delete (globalThis as unknown as Record<string, unknown>)['showOpenFilePicker'];
            }
        });

        it('importJson falls back to the hidden file input when the picker is unavailable', async () => {
            delete (globalThis as unknown as Record<string, unknown>)['showOpenFilePicker'];
            const realInput = fixture.debugElement.query(By.css('#import-json-input')).nativeElement as HTMLInputElement;
            const clickSpy = vi.spyOn(realInput, 'click').mockImplementation(() => undefined);

            await component.importJson();

            expect(clickSpy).toHaveBeenCalled();
        });
    });

    describe('clearBoard', () => {
        it('removes all items, clears selection and instances', () => {
            component.addItem(widgetMeta);
            component.addItem(progressMeta);
            component.selectedItemId.set(component.items()[0].id);
            component.onComponentInit({ id: component.items()[0].id, ref: { instance: {} } as never });

            component.clearBoard();
            expect(component.items()).toEqual([]);
            expect(component.selectedItemId()).toBeNull();
            expect(component.instanceMap().size).toBe(0);
        });
    });

    describe('onItemsChange', () => {
        it('replaces the items signal (drag/resize persistence)', () => {
            const next = [{ id: 'm', x: 1, y: 1, cols: 4, rows: 4, content: MockWidgetComponent }];
            component.onItemsChange(next);
            expect(component.items()).toBe(next);
            expect(component.items()[0].cols).toBe(4);
        });
    });
});
