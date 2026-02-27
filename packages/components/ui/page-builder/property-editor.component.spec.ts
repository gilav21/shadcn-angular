import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PropertyEditorComponent } from './property-editor.component';
import { describe, it, expect, beforeEach } from 'vitest';
import { DashboardItem } from '../bento-grid.component';
import { ComponentMeta } from './page-builder.types';

describe('PropertyEditorComponent', () => {
    let component: PropertyEditorComponent;
    let fixture: ComponentFixture<PropertyEditorComponent>;

    const mockItem: DashboardItem = {
        id: 'item-1',
        x: 0,
        y: 0,
        cols: 2,
        rows: 3,
        content: 'test-content',
        inputs: { title: 'Hello', count: 5 },
        bindings: {},
    };

    const mockItemWithBindings: DashboardItem = {
        id: 'item-2',
        x: 1,
        y: 1,
        cols: 4,
        rows: 2,
        content: 'test-content',
        inputs: { title: 'Bound Item' },
        bindings: { title: 'user.name' },
    };

    const mockComponentMeta: ComponentMeta = {
        id: 'test-comp',
        name: 'Test Component',
        category: 'general',
        component: class { readonly _mock = true; } as any,
        icon: 'box',
        inputs: [
            { name: 'title', type: 'string', label: 'Title' },
            { name: 'count', type: 'number', label: 'Count' },
            { name: 'enabled', type: 'boolean', label: 'Enabled' },
        ],
    };

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [PropertyEditorComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(PropertyEditorComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should default item to undefined', () => {
        expect(component.item()).toBeUndefined();
    });

    it('should default componentMeta to undefined', () => {
        expect(component.componentMeta()).toBeUndefined();
    });

    it('should default isLoading to false', () => {
        expect(component.isLoading()).toBe(false);
    });

    it('should show empty state when no item is selected', () => {
        const el = fixture.nativeElement as HTMLElement;
        expect(el.textContent).toContain('No Selection');
    });

    it('should return undefined for getItemInput when no item', () => {
        expect(component.getItemInput('title')).toBeUndefined();
    });

    it('should return false for hasBinding when no item', () => {
        expect(component.hasBinding('title')).toBe(false);
    });

    it('should return empty string for getBinding when no item', () => {
        expect(component.getBinding('title')).toBe('');
    });

    it('should emit itemChange with correct payload when onPropertyChange is called', () => {
        fixture.componentRef.setInput('item', mockItem);
        fixture.detectChanges();

        let emitted: { id: string; prop: string; value: any } | undefined;
        component.itemChange.subscribe((event) => {
            emitted = event;
        });

        component.onPropertyChange('cols', 4);

        expect(emitted).toEqual({ id: 'item-1', prop: 'cols', value: 4 });
    });

    it('should emit itemChange with correct payload when onInputChange is called', () => {
        fixture.componentRef.setInput('item', mockItem);
        fixture.detectChanges();

        let emitted: { id: string; prop: string; value: any } | undefined;
        component.itemChange.subscribe((event) => {
            emitted = event;
        });

        component.onInputChange('title', 'New Title');

        expect(emitted).toEqual({ id: 'item-1', prop: 'title', value: 'New Title' });
    });

    it('should not emit itemChange when onPropertyChange is called without an item', () => {
        let emitted = false;
        component.itemChange.subscribe(() => {
            emitted = true;
        });

        component.onPropertyChange('cols', 4);

        expect(emitted).toBe(false);
    });

    it('should add a binding when toggleBinding is called on an item without that binding', () => {
        fixture.componentRef.setInput('item', { ...mockItem, bindings: {} });
        fixture.detectChanges();

        let emitted: { id: string; prop: string; value: any } | undefined;
        component.itemChange.subscribe((event) => {
            emitted = event;
        });

        component.toggleBinding('title');

        expect(emitted).toBeDefined();
        expect(emitted!.prop).toBe('bindings');
        expect(emitted!.value).toHaveProperty('title');
        expect(emitted!.value['title']).toBe('');
    });

    it('should remove a binding when toggleBinding is called on an item that already has that binding', () => {
        fixture.componentRef.setInput('item', mockItemWithBindings);
        fixture.detectChanges();

        let emitted: { id: string; prop: string; value: any } | undefined;
        component.itemChange.subscribe((event) => {
            emitted = event;
        });

        component.toggleBinding('title');

        expect(emitted).toBeDefined();
        expect(emitted!.prop).toBe('bindings');
        expect(emitted!.value).not.toHaveProperty('title');
    });

    it('should emit itemChange with updated binding value when onBindingChange is called', () => {
        fixture.componentRef.setInput('item', mockItemWithBindings);
        fixture.detectChanges();

        let emitted: { id: string; prop: string; value: any } | undefined;
        component.itemChange.subscribe((event) => {
            emitted = event;
        });

        component.onBindingChange('title', 'user.email');

        expect(emitted).toBeDefined();
        expect(emitted!.id).toBe('item-2');
        expect(emitted!.prop).toBe('bindings');
        expect(emitted!.value['title']).toBe('user.email');
    });

    it('should return correct value from getItemInput when item has inputs', () => {
        fixture.componentRef.setInput('item', mockItem);
        fixture.detectChanges();

        expect(component.getItemInput('title')).toBe('Hello');
        expect(component.getItemInput('count')).toBe(5);
    });

    it('should return undefined from getItemInput for a non-existent input name', () => {
        fixture.componentRef.setInput('item', mockItem);
        fixture.detectChanges();

        expect(component.getItemInput('nonExistent')).toBeUndefined();
    });

    it('should return true from hasBinding when item has that binding', () => {
        fixture.componentRef.setInput('item', mockItemWithBindings);
        fixture.detectChanges();

        expect(component.hasBinding('title')).toBe(true);
    });

    it('should return false from hasBinding when item does not have that binding', () => {
        fixture.componentRef.setInput('item', mockItemWithBindings);
        fixture.detectChanges();

        expect(component.hasBinding('description')).toBe(false);
    });

    it('should return binding value from getBinding when item has that binding', () => {
        fixture.componentRef.setInput('item', mockItemWithBindings);
        fixture.detectChanges();

        expect(component.getBinding('title')).toBe('user.name');
    });

    it('should return empty string from getBinding when binding does not exist', () => {
        fixture.componentRef.setInput('item', mockItem);
        fixture.detectChanges();

        expect(component.getBinding('nonExistent')).toBe('');
    });

    it('should emit delete event when the delete button is clicked', () => {
        fixture.componentRef.setInput('item', mockItem);
        fixture.componentRef.setInput('componentMeta', mockComponentMeta);
        fixture.detectChanges();

        let deleteEmitted = false;
        component.delete.subscribe(() => {
            deleteEmitted = true;
        });

        const el = fixture.nativeElement as HTMLElement;
        const allButtons = el.querySelectorAll('button');
        let foundDeleteButton: HTMLButtonElement | null = null;
        allButtons.forEach((btn) => {
            if (btn.textContent?.includes('Delete Component')) {
                foundDeleteButton = btn;
            }
        });

        expect(foundDeleteButton).not.toBeNull();
        foundDeleteButton!.click();

        expect(deleteEmitted).toBe(true);
    });

    it('should show loading skeleton when item is set and isLoading is true', () => {
        fixture.componentRef.setInput('item', mockItem);
        fixture.componentRef.setInput('isLoading', true);
        fixture.detectChanges();

        const el = fixture.nativeElement as HTMLElement;
        const skeleton = el.querySelector('.animate-pulse');
        expect(skeleton).not.toBeNull();
    });

    it('should not show loading skeleton when isLoading is false', () => {
        fixture.componentRef.setInput('item', mockItem);
        fixture.componentRef.setInput('isLoading', false);
        fixture.detectChanges();

        const el = fixture.nativeElement as HTMLElement;
        const skeleton = el.querySelector('.animate-pulse');
        expect(skeleton).toBeNull();
    });

    it('should not show loading skeleton when no item is set even if isLoading is true', () => {
        fixture.componentRef.setInput('isLoading', true);
        fixture.detectChanges();

        const el = fixture.nativeElement as HTMLElement;
        const skeleton = el.querySelector('.animate-pulse');
        expect(skeleton).toBeNull();
    });

    it('should display item id and Layout section when item is set', () => {
        fixture.componentRef.setInput('item', mockItem);
        fixture.componentRef.setInput('componentMeta', mockComponentMeta);
        fixture.detectChanges();

        const el = fixture.nativeElement as HTMLElement;
        expect(el.textContent).toContain('item-1');
        expect(el.textContent).toContain('Layout');
    });

    it('should hide No Selection when item is set', () => {
        fixture.componentRef.setInput('item', mockItem);
        fixture.detectChanges();

        const el = fixture.nativeElement as HTMLElement;
        expect(el.textContent).not.toContain('No Selection');
    });

    it('should show Settings section when componentMeta has inputs', () => {
        fixture.componentRef.setInput('item', mockItem);
        fixture.componentRef.setInput('componentMeta', mockComponentMeta);
        fixture.detectChanges();

        const el = fixture.nativeElement as HTMLElement;
        expect(el.textContent).toContain('Settings');
    });

    it('should not show Settings section when componentMeta has no inputs', () => {
        const metaWithoutInputs: ComponentMeta = {
            id: 'empty-comp',
            name: 'Empty Component',
            category: 'general',
            component: class { readonly _mock = true; } as any,
            inputs: [],
        };

        fixture.componentRef.setInput('item', mockItem);
        fixture.componentRef.setInput('componentMeta', metaWithoutInputs);
        fixture.detectChanges();

        const el = fixture.nativeElement as HTMLElement;
        expect(el.textContent).not.toContain('Settings');
    });

    it('should display the component name from componentMeta', () => {
        fixture.componentRef.setInput('item', mockItem);
        fixture.componentRef.setInput('componentMeta', mockComponentMeta);
        fixture.detectChanges();

        const el = fixture.nativeElement as HTMLElement;
        expect(el.textContent).toContain('Test Component');
    });

    it('should handle toggleBinding when item has no bindings property', () => {
        const itemWithoutBindings: DashboardItem = {
            id: 'item-no-bindings',
            x: 0,
            y: 0,
            cols: 1,
            rows: 1,
            content: 'test',
        };

        fixture.componentRef.setInput('item', itemWithoutBindings);
        fixture.detectChanges();

        let emitted: { id: string; prop: string; value: any } | undefined;
        component.itemChange.subscribe((event) => {
            emitted = event;
        });

        component.toggleBinding('title');

        expect(emitted).toBeDefined();
        expect(emitted!.id).toBe('item-no-bindings');
        expect(emitted!.prop).toBe('bindings');
        expect(emitted!.value).toEqual({ title: '' });
    });

    it('should preserve existing bindings when toggling a new one', () => {
        const itemWithMultipleBindings: DashboardItem = {
            id: 'item-multi',
            x: 0,
            y: 0,
            cols: 1,
            rows: 1,
            content: 'test',
            bindings: { description: 'item.desc' },
        };

        fixture.componentRef.setInput('item', itemWithMultipleBindings);
        fixture.detectChanges();

        let emitted: { id: string; prop: string; value: any } | undefined;
        component.itemChange.subscribe((event) => {
            emitted = event;
        });

        component.toggleBinding('title');

        expect(emitted!.value).toHaveProperty('description', 'item.desc');
        expect(emitted!.value).toHaveProperty('title', '');
    });
});
