import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PageRendererComponent } from './page-renderer.component';
import { PageData, ComponentMeta } from './page-builder.types';
import { Component, input } from '@angular/core';

// Mock component to be rendered
@Component({
    selector: 'mock-card',
    template: `<div>{{ title() }} - {{ description() }}</div>`,
    standalone: true
})
class MockCardComponent {
    title = input('');
    description = input('');
}

describe('PageRendererComponent', () => {
    let component: PageRendererComponent;
    let fixture: ComponentFixture<PageRendererComponent>;

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

    const mockPageData: PageData = {
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
                inputs: {
                    title: 'Static Title'
                },
                bindings: {
                    description: 'user.role'
                }
            }
        ]
    };

    const mockContext = {
        user: {
            name: 'Alice',
            role: 'Admin'
        }
    };

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [PageRendererComponent, MockCardComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(PageRendererComponent);
        component = fixture.componentInstance;

        // Set inputs
        fixture.componentRef.setInput('data', mockPageData);
        fixture.componentRef.setInput('components', mockComponents);
        fixture.componentRef.setInput('context', mockContext);

        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should render items', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.querySelector('ui-bento-grid')).toBeTruthy();
    });

    it('should resolve bindings correctly', () => {
        // We can't easily check the rendered content inside bento-grid because it might be async or inside shadow dom/content projection
        // But we can check the internal state if exposed, or check resolving method

        // Let's check the resolveBinding method directly if it's public or we can access it
        // It's private/protected in the implementation but let's see if we can access it via 'any' or check the processed items

        // PageRendererComponent computes 'dashboardItems' which contains the resolved inputs
        const renderItems = component.dashboardItems();
        expect(renderItems.length).toBe(1);

        const item = renderItems[0];
        expect(item).toBeDefined();
        expect(item?.inputs).toBeDefined();
        expect(item?.inputs?.['title']).toBe('Static Title');
        expect(item?.inputs?.['description']).toBe('Admin'); // Resolved from context
    });

    it('should update resolved bindings when context changes', () => {
        // Update context
        const newContext = {
            user: {
                name: 'Alice',
                role: 'SuperAdmin'
            }
        };
        fixture.componentRef.setInput('context', newContext);
        fixture.detectChanges();

        const renderItems = component.dashboardItems();
        expect(renderItems.length).toBe(1);
        expect(renderItems[0]?.inputs).toBeDefined();
        expect(renderItems[0]?.inputs?.['description']).toBe('SuperAdmin');
    });
});
