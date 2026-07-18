import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ComponentRef, input } from '@angular/core';
import { PageRendererComponent } from './page-renderer.component';
import { PageData, ComponentMeta } from '../../lib/page-builder.types';

@Component({
    selector: 'mock-card',
    template: `<div>{{ title() }} - {{ description() }}</div>`,
    standalone: true
})
class MockCardComponent {
    title = input('');
    description = input('');
}

const mockComponents: ComponentMeta[] = [
    {
        id: 'card',
        name: 'Card',
        category: 'Data Display',
        component: MockCardComponent,
        inputs: [
            { name: 'title', type: 'string' },
            { name: 'description', type: 'string' }
        ]
    }
];

function makePageData(): PageData {
    return {
        grid: {
            cols: 2,
            rowHeight: '100px',
            columnWidth: '1fr',
            gap: '1rem',
            showBorders: false,
            borderRadius: '0',
            itemPadding: '0',
            squareCells: false
        },
        items: [
            {
                id: 'item-1',
                x: 0,
                y: 0,
                cols: 1,
                rows: 1,
                componentId: 'card',
                inputs: { title: 'Static Title' },
                bindings: { description: 'user.role' }
            }
        ]
    };
}

const mockContext = { user: { name: 'Alice', role: 'Admin' } };

describe('PageRendererComponent', () => {
    let component: PageRendererComponent;
    let fixture: ComponentFixture<PageRendererComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [PageRendererComponent, MockCardComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(PageRendererComponent);
        component = fixture.componentInstance;

        fixture.componentRef.setInput('data', makePageData());
        fixture.componentRef.setInput('components', mockComponents);
        fixture.componentRef.setInput('context', mockContext);

        fixture.detectChanges();
    });

    afterEach(() => {
        fixture.destroy();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should render the bento grid host', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.querySelector('ui-bento-grid')).toBeTruthy();
    });

    it('should merge the class input into the host classes', () => {
        fixture.componentRef.setInput('class', 'custom-class');
        fixture.detectChanges();
        expect(component.classes()).toContain('custom-class');
        expect(component.classes()).toContain('w-full');
    });

    it('should expose grid config via computed signals', () => {
        expect(component.gridCols()).toBe(2);
        expect(component.gridRowHeight()).toBe('100px');
        expect(component.gridColumnWidth()).toBe('1fr');
        expect(component.gridGap()).toBe('1rem');
        expect(component.gridShowBorders()).toBe(false);
        expect(component.gridBorderRadius()).toBe('0');
        expect(component.gridItemPadding()).toBe('0');
    });

    it('should default showBorders to true when omitted', () => {
        const data = makePageData();
        delete data.grid.showBorders;
        fixture.componentRef.setInput('data', data);
        fixture.detectChanges();
        expect(component.gridShowBorders()).toBe(true);
    });

    it('should resolve static inputs and dot-path bindings', () => {
        const items = component.dashboardItems();
        expect(items).toHaveLength(1);
        expect(items[0]?.inputs?.['title']).toBe('Static Title');
        expect(items[0]?.inputs?.['description']).toBe('Admin');
    });

    it('should update resolved bindings when context changes', () => {
        fixture.componentRef.setInput('context', { user: { name: 'Alice', role: 'SuperAdmin' } });
        fixture.detectChanges();
        const items = component.dashboardItems();
        expect(items[0]?.inputs?.['description']).toBe('SuperAdmin');
    });

    it('should skip items whose componentId is not registered', () => {
        const data = makePageData();
        data.items.push({
            id: 'orphan',
            x: 1,
            y: 0,
            cols: 1,
            rows: 1,
            componentId: 'does-not-exist'
        });
        fixture.componentRef.setInput('data', data);
        fixture.detectChanges();
        const items = component.dashboardItems();
        expect(items).toHaveLength(1);
        expect(items.find(i => i.id === 'orphan')).toBeUndefined();
    });

    it('should not apply a binding whose resolved value is undefined', () => {
        const data = makePageData();
        data.items[0].bindings = { description: 'user.missing.deep' };
        fixture.componentRef.setInput('data', data);
        fixture.detectChanges();
        const item = component.dashboardItems()[0];
        expect(item?.inputs?.['description']).toBeUndefined();
        expect(item?.inputs?.['title']).toBe('Static Title');
    });

    it('should treat an empty binding path as undefined', () => {
        const data = makePageData();
        data.items[0].bindings = { description: '' };
        fixture.componentRef.setInput('data', data);
        fixture.detectChanges();
        const item = component.dashboardItems()[0];
        expect(item?.inputs?.['description']).toBeUndefined();
    });

    it('should handle items without bindings', () => {
        const data = makePageData();
        delete data.items[0].bindings;
        fixture.componentRef.setInput('data', data);
        fixture.detectChanges();
        const item = component.dashboardItems()[0];
        expect(item?.inputs?.['title']).toBe('Static Title');
        expect(item?.inputs?.['description']).toBeUndefined();
    });

    it('should register an instance and apply inputs on component init', () => {
        const instance: Record<string, unknown> = {};
        const ref = { instance } as ComponentRef<unknown>;
        component.onComponentInit({ id: 'item-1', ref });
        fixture.componentRef.setInput('context', { user: { name: 'Bob', role: 'Editor' } });
        fixture.detectChanges();
        const item = component.dashboardItems()[0];
        expect(item?.inputs?.['description']).toBe('Editor');
    });

    it('should ignore component init for an unknown item id', () => {
        const ref = { instance: {} } as ComponentRef<unknown>;
        expect(() => component.onComponentInit({ id: 'ghost', ref })).not.toThrow();
    });

    it('should apply inputs on init even when the item has none', () => {
        const data = makePageData();
        delete data.items[0].inputs;
        delete data.items[0].bindings;
        fixture.componentRef.setInput('data', data);
        fixture.detectChanges();
        const ref = { instance: {} } as ComponentRef<unknown>;
        expect(() => component.onComponentInit({ id: 'item-1', ref })).not.toThrow();
    });

    it('should clear the instance map on destroy', () => {
        const ref = { instance: {} } as ComponentRef<unknown>;
        component.onComponentInit({ id: 'item-1', ref });
        expect(() => component.ngOnDestroy()).not.toThrow();
    });
});
