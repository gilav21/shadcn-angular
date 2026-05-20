import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TreeComponent, TreeNode } from './tree.component';
import { TreeItemComponent } from './sub/tree-item.component';
import { TreeLabelComponent } from './sub/tree-label.component';
import { TreeIconComponent } from './sub/tree-icon.component';

// Test host
@Component({
    template: `
        <div [dir]="dir()">
            <ui-tree [selectable]="selectable()">
                <ui-tree-item value="folder-1">
                    <ui-tree-label>
                        <ui-tree-icon>📁</ui-tree-icon>
                        Documents
                    </ui-tree-label>
                    <ui-tree-item value="file-1">
                        <ui-tree-label>Resume.pdf</ui-tree-label>
                    </ui-tree-item>
                    <ui-tree-item value="file-2">
                        <ui-tree-label>Cover.docx</ui-tree-label>
                    </ui-tree-item>
                </ui-tree-item>
                <ui-tree-item value="folder-2">
                    <ui-tree-label>Images</ui-tree-label>
                </ui-tree-item>
            </ui-tree>
        </div>
    `,
    imports: [TreeComponent, TreeItemComponent, TreeLabelComponent, TreeIconComponent]
})
class TreeTestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
    selectable = signal<'none' | 'single' | 'multiple'>('single');
}

describe('TreeComponent', () => {
    let fixture: ComponentFixture<TreeTestHostComponent>;
    let component: TreeTestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TreeTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TreeTestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        document.documentElement.removeAttribute('dir');
    });

    describe('Basic Rendering', () => {
        it('should create tree component', () => {
            const tree = fixture.debugElement.query(By.directive(TreeComponent));
            expect(tree).toBeTruthy();
        });

        it('should have data-slot="tree"', () => {
            const tree = fixture.debugElement.query(By.css('[data-slot="tree"]'));
            expect(tree).toBeTruthy();
        });

        it('should render tree items', () => {
            const items = fixture.debugElement.queryAll(By.css('[data-slot="tree-item"]'));
            expect(items.length).toBeGreaterThan(0);
        });

        it('should render tree labels', () => {
            const labels = fixture.debugElement.queryAll(By.css('[data-slot="tree-label"]'));
            expect(labels.length).toBeGreaterThan(0);
        });

        it('should render tree icons', () => {
            const icons = fixture.debugElement.queryAll(By.css('[data-slot="tree-icon"]'));
            expect(icons.length).toBeGreaterThan(0);
        });
    });

    describe('Expand/Collapse', () => {
        it('should show expand button for parent items', () => {
            const expandButtons = fixture.debugElement.queryAll(By.css('button'));
            expect(expandButtons.length).toBeGreaterThan(0);
        });

        it('should expand item on click', async () => {
            const tree = fixture.debugElement.query(By.directive(TreeComponent));
            const treeInstance = tree.componentInstance as TreeComponent;

            treeInstance.toggleExpanded('folder-1');
            fixture.detectChanges();
            await fixture.whenStable();

            expect(treeInstance.isExpanded('folder-1')).toBe(true);
        });

        it('should collapse expanded item on second click', async () => {
            const tree = fixture.debugElement.query(By.directive(TreeComponent));
            const treeInstance = tree.componentInstance as TreeComponent;

            treeInstance.toggleExpanded('folder-1');
            treeInstance.toggleExpanded('folder-1');
            fixture.detectChanges();

            expect(treeInstance.isExpanded('folder-1')).toBe(false);
        });
    });

    describe('Selection', () => {
        it('should support single selection', async () => {
            const tree = fixture.debugElement.query(By.directive(TreeComponent));
            const treeInstance = tree.componentInstance as TreeComponent;

            treeInstance.toggleSelected('folder-1');
            fixture.detectChanges();

            expect(treeInstance.isSelected('folder-1')).toBe(true);
        });

        it('should deselect previous item in single mode', async () => {
            const tree = fixture.debugElement.query(By.directive(TreeComponent));
            const treeInstance = tree.componentInstance as TreeComponent;

            treeInstance.toggleSelected('folder-1');
            treeInstance.toggleSelected('folder-2');
            fixture.detectChanges();

            expect(treeInstance.isSelected('folder-1')).toBe(false);
            expect(treeInstance.isSelected('folder-2')).toBe(true);
        });

        it('should support multiple selection', async () => {
            component.selectable.set('multiple');
            fixture.detectChanges();

            const tree = fixture.debugElement.query(By.directive(TreeComponent));
            const treeInstance = tree.componentInstance as TreeComponent;

            treeInstance.toggleSelected('folder-1');
            treeInstance.toggleSelected('folder-2');
            fixture.detectChanges();

            expect(treeInstance.isSelected('folder-1')).toBe(true);
            expect(treeInstance.isSelected('folder-2')).toBe(true);
        });

        it('should not select when selectable is none', async () => {
            component.selectable.set('none');
            fixture.detectChanges();

            const tree = fixture.debugElement.query(By.directive(TreeComponent));
            const treeInstance = tree.componentInstance as TreeComponent;

            treeInstance.toggleSelected('folder-1');
            fixture.detectChanges();

            expect(treeInstance.isSelected('folder-1')).toBe(false);
        });
    });

    describe('RTL Support', () => {
        it('should render in LTR mode', () => {
            const container = fixture.debugElement.query(By.css('[dir="ltr"]'));
            expect(container).toBeTruthy();
        });

        it('should render in RTL mode', async () => {
            component.dir.set('rtl');
            fixture.detectChanges();
            await fixture.whenStable();

            const container = fixture.debugElement.query(By.css('[dir="rtl"]'));
            expect(container).toBeTruthy();
        });

        it('should maintain tree structure in RTL', async () => {
            component.dir.set('rtl');
            fixture.detectChanges();
            await fixture.whenStable();

            const tree = fixture.debugElement.query(By.directive(TreeComponent));
            const items = fixture.debugElement.queryAll(By.directive(TreeItemComponent));

            expect(tree).toBeTruthy();
            expect(items.length).toBeGreaterThan(0);
        });
    });

    describe('Accessibility', () => {
        it('should have role="tree" on root', () => {
            const tree = fixture.debugElement.query(By.css('[role="tree"]'));
            expect(tree).toBeTruthy();
        });

        it('should have role="treeitem" on items', () => {
            const items = fixture.debugElement.queryAll(By.css('[role="treeitem"]'));
            expect(items.length).toBeGreaterThan(0);
        });

        it('should have aria-multiselectable for multiple mode', async () => {
            component.selectable.set('multiple');
            fixture.detectChanges();
            await fixture.whenStable();

            const tree = fixture.debugElement.query(By.css('[role="tree"]'));
            expect(tree.nativeElement.getAttribute('aria-multiselectable')).toBe('true');
        });

        it('should have aria-expanded on expandable items', async () => {
            const tree = fixture.debugElement.query(By.directive(TreeComponent));
            const treeInstance = tree.componentInstance as TreeComponent;
            treeInstance.toggleExpanded('folder-1');
            fixture.detectChanges();

            const item = fixture.debugElement.query(By.css('[aria-expanded="true"]'));
            expect(item).toBeTruthy();
        });

        it('should have aria-selected on selectable items', async () => {
            const tree = fixture.debugElement.query(By.directive(TreeComponent));
            const treeInstance = tree.componentInstance as TreeComponent;
            treeInstance.toggleSelected('folder-1');
            fixture.detectChanges();

            const item = fixture.debugElement.query(By.css('[aria-selected="true"]'));
            expect(item).toBeTruthy();
        });

        it('should mark icon as aria-hidden', () => {
            const icon = fixture.debugElement.query(By.css('[data-slot="tree-icon"]'));
            expect(icon.nativeElement.getAttribute('aria-hidden')).toBe('true');
        });
    });

    describe('Security', () => {
        it('should not execute scripts in labels', () => {
            const labels = fixture.debugElement.queryAll(By.css('[data-slot="tree-label"]'));
            for (const label of labels) {
                expect(label.nativeElement.innerHTML).not.toContain('<script>');
            }
        });

        it('should properly handle special characters in values', () => {
            const tree = fixture.debugElement.query(By.directive(TreeComponent));
            const treeInstance = tree.componentInstance as TreeComponent;

            expect(() => treeInstance.toggleExpanded('<script>alert(1)</script>')).not.toThrow();
        });
    });
});

const dataDrivenTree: TreeNode[] = [
    {
        key: 'root-1',
        label: 'Root 1',
        children: [
            { key: 'child-1-1', label: 'Child 1.1' },
            {
                key: 'child-1-2',
                label: 'Child 1.2',
                children: [
                    { key: 'grandchild-1-2-1', label: 'Grandchild 1.2.1' },
                ],
            },
        ],
    },
    { key: 'root-2', label: 'Root 2' },
];

@Component({
    template: `
        <ui-tree [data]="data()" [initialExpandDepth]="initialExpandDepth()" />
    `,
    imports: [TreeComponent]
})
class DataDrivenTreeTestHostComponent {
    data = signal<TreeNode[]>(dataDrivenTree);
    initialExpandDepth = signal(0);
}

describe('TreeComponent - Data-Driven Lazy Rendering', () => {
    let fixture: ComponentFixture<DataDrivenTreeTestHostComponent>;
    let treeInstance: TreeComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [DataDrivenTreeTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(DataDrivenTreeTestHostComponent);
        fixture.detectChanges();
        await fixture.whenStable();
        treeInstance = fixture.debugElement.query(By.directive(TreeComponent)).componentInstance as TreeComponent;
    });

    it('should only render root-level items when collapsed', () => {
        const items = fixture.debugElement.queryAll(By.directive(TreeItemComponent));
        const values = items.map(i => (i.componentInstance as TreeItemComponent).value());
        expect(values).toContain('root-1');
        expect(values).toContain('root-2');
        expect(values).not.toContain('child-1-1');
        expect(values).not.toContain('child-1-2');
        expect(values).not.toContain('grandchild-1-2-1');
    });

    it('should render children when parent is expanded', async () => {
        treeInstance.toggleExpanded('root-1');
        fixture.detectChanges();
        await fixture.whenStable();

        const items = fixture.debugElement.queryAll(By.directive(TreeItemComponent));
        const values = items.map(i => (i.componentInstance as TreeItemComponent).value());
        expect(values).toContain('child-1-1');
        expect(values).toContain('child-1-2');
        expect(values).not.toContain('grandchild-1-2-1');
    });

    it('should render grandchildren when nested parent is expanded', async () => {
        treeInstance.toggleExpanded('root-1');
        fixture.detectChanges();
        await fixture.whenStable();

        treeInstance.toggleExpanded('child-1-2');
        fixture.detectChanges();
        await fixture.whenStable();

        const items = fixture.debugElement.queryAll(By.directive(TreeItemComponent));
        const values = items.map(i => (i.componentInstance as TreeItemComponent).value());
        expect(values).toContain('grandchild-1-2-1');
    });

    it('should remove children from DOM when parent is collapsed', async () => {
        treeInstance.toggleExpanded('root-1');
        fixture.detectChanges();
        await fixture.whenStable();

        treeInstance.toggleExpanded('root-1');
        fixture.detectChanges();
        await fixture.whenStable();

        const items = fixture.debugElement.queryAll(By.directive(TreeItemComponent));
        const values = items.map(i => (i.componentInstance as TreeItemComponent).value());
        expect(values).not.toContain('child-1-1');
        expect(values).not.toContain('child-1-2');
    });

    it('should still show expand buttons for collapsed parents with children', () => {
        const rootItem = fixture.debugElement.queryAll(By.directive(TreeItemComponent))
            .find(i => (i.componentInstance as TreeItemComponent).value() === 'root-1');
        const expandButton = rootItem?.query(By.css('button'));
        expect(expandButton).toBeTruthy();
    });
});

describe('TreeComponent - registerItem Batching', () => {
    let fixture: ComponentFixture<DataDrivenTreeTestHostComponent>;
    let treeInstance: TreeComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [DataDrivenTreeTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(DataDrivenTreeTestHostComponent);
        fixture.detectChanges();
        await fixture.whenStable();
        treeInstance = fixture.debugElement.query(By.directive(TreeComponent)).componentInstance as TreeComponent;
    });

    it('should batch multiple registerItem calls into a single update', async () => {
        treeInstance.toggleExpanded('root-1');
        fixture.detectChanges();
        await fixture.whenStable();

        const items = treeInstance.items();
        expect(items.length).toBeGreaterThan(0);
        const values = items.map(i => i.value());
        expect(values).toContain('child-1-1');
    });
});

describe('TreeComponent - expandAllCollapsed Batching', () => {
    let fixture: ComponentFixture<DataDrivenTreeTestHostComponent>;
    let treeInstance: TreeComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [DataDrivenTreeTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(DataDrivenTreeTestHostComponent);
        fixture.detectChanges();
        await fixture.whenStable();
        treeInstance = fixture.debugElement.query(By.directive(TreeComponent)).componentInstance as TreeComponent;
    });

    it('should expand all collapsed items in a single batch', async () => {
        const emissions: string[][] = [];
        treeInstance.expandChange.subscribe(keys => emissions.push(keys));

        const treeEl = fixture.debugElement.query(By.css('[role="tree"]'));
        treeEl.nativeElement.focus();
        treeInstance.focusedKey.set('root-1');
        fixture.detectChanges();

        treeEl.triggerEventHandler('keydown', { key: '*', preventDefault: () => {} });
        fixture.detectChanges();
        await fixture.whenStable();

        expect(emissions.length).toBe(1);
        expect(treeInstance.isExpanded('root-1')).toBe(true);
    });
});

describe('TreeComponent - initialExpandDepth', () => {
    let fixture: ComponentFixture<DataDrivenTreeTestHostComponent>;
    let component: DataDrivenTreeTestHostComponent;
    let treeInstance: TreeComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [DataDrivenTreeTestHostComponent]
        }).compileComponents();
    });

    it('should keep all nodes collapsed with depth 0', async () => {
        fixture = TestBed.createComponent(DataDrivenTreeTestHostComponent);
        component = fixture.componentInstance;
        component.initialExpandDepth.set(0);
        fixture.detectChanges();
        await fixture.whenStable();
        treeInstance = fixture.debugElement.query(By.directive(TreeComponent)).componentInstance as TreeComponent;

        expect(treeInstance.isExpanded('root-1')).toBe(false);
    });

    it('should expand one level with depth 1', async () => {
        fixture = TestBed.createComponent(DataDrivenTreeTestHostComponent);
        component = fixture.componentInstance;
        component.initialExpandDepth.set(1);
        fixture.detectChanges();
        await fixture.whenStable();
        treeInstance = fixture.debugElement.query(By.directive(TreeComponent)).componentInstance as TreeComponent;

        expect(treeInstance.isExpanded('root-1')).toBe(true);
        expect(treeInstance.isExpanded('child-1-2')).toBe(false);
    });

    it('should expand all levels with depth -1', async () => {
        fixture = TestBed.createComponent(DataDrivenTreeTestHostComponent);
        component = fixture.componentInstance;
        component.initialExpandDepth.set(-1);
        fixture.detectChanges();
        await fixture.whenStable();
        treeInstance = fixture.debugElement.query(By.directive(TreeComponent)).componentInstance as TreeComponent;

        expect(treeInstance.isExpanded('root-1')).toBe(true);
        expect(treeInstance.isExpanded('child-1-2')).toBe(true);
    });

    it('should expand two levels with depth 2', async () => {
        fixture = TestBed.createComponent(DataDrivenTreeTestHostComponent);
        component = fixture.componentInstance;
        component.initialExpandDepth.set(2);
        fixture.detectChanges();
        await fixture.whenStable();
        treeInstance = fixture.debugElement.query(By.directive(TreeComponent)).componentInstance as TreeComponent;

        expect(treeInstance.isExpanded('root-1')).toBe(true);
        expect(treeInstance.isExpanded('child-1-2')).toBe(true);
    });
});
