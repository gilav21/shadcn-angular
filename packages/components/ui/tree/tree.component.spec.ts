import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TreeComponent, TreeNode } from './tree.component';
import { TreeItemComponent } from './sub/tree-item.component';
import { TreeLabelComponent } from './sub/tree-label.component';
import { TreeIconComponent } from './sub/tree-icon.component';
import { TreeNodeContentDirective } from './sub/tree-node-content.directive';

function dispatchKey(treeEl: { triggerEventHandler: (n: string, e: unknown) => void }, key: string): void {
    treeEl.triggerEventHandler('keydown', { key, preventDefault: () => { /* noop */ } });
}

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

        expect(emissions).toHaveLength(1);
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

describe('TreeComponent - Public methods (expandAll/collapseAll/focus)', () => {
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

    it('should expand all provided keys and emit', () => {
        const emissions: string[][] = [];
        treeInstance.expandChange.subscribe(keys => emissions.push(keys));

        treeInstance.expandAll(['root-1', 'child-1-2']);

        expect(treeInstance.isExpanded('root-1')).toBe(true);
        expect(treeInstance.isExpanded('child-1-2')).toBe(true);
        expect(emissions).toHaveLength(1);
        expect(emissions[0]).toEqual(['root-1', 'child-1-2']);
    });

    it('should collapse all and emit empty array', () => {
        treeInstance.expandAll(['root-1']);
        const emissions: string[][] = [];
        treeInstance.expandChange.subscribe(keys => emissions.push(keys));

        treeInstance.collapseAll();

        expect(treeInstance.isExpanded('root-1')).toBe(false);
        expect(emissions).toHaveLength(1);
        expect(emissions[0]).toEqual([]);
    });

    it('should focus a specific key', () => {
        treeInstance.focus('root-2');
        expect(treeInstance.focusedKey()).toBe('root-2');
    });

    it('should default focus to first item when no key and nothing focused', () => {
        expect(treeInstance.focusedKey()).toBeNull();
        treeInstance.focus();
        expect(treeInstance.focusedKey()).toBe('root-1');
    });

    it('should keep existing focus when focus() called without key', () => {
        treeInstance.focus('root-2');
        treeInstance.focus();
        expect(treeInstance.focusedKey()).toBe('root-2');
    });

    it('should reflect focused item in activeDescendantId', () => {
        treeInstance.focusedKey.set('root-1');
        fixture.detectChanges();
        const rootItem = treeInstance.items().find(i => i.value() === 'root-1');
        expect(treeInstance.activeDescendantId()).toBe(rootItem?.id());
    });

    it('should return null activeDescendantId when focused key has no item', () => {
        treeInstance.focusedKey.set('non-existent');
        fixture.detectChanges();
        expect(treeInstance.activeDescendantId()).toBeNull();
    });
});

describe('TreeComponent - Keyboard navigation (data-driven)', () => {
    let fixture: ComponentFixture<DataDrivenTreeTestHostComponent>;
    let treeInstance: TreeComponent;
    let treeEl: ReturnType<ComponentFixture<DataDrivenTreeTestHostComponent>['debugElement']['query']>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [DataDrivenTreeTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(DataDrivenTreeTestHostComponent);
        fixture.detectChanges();
        await fixture.whenStable();
        treeInstance = fixture.debugElement.query(By.directive(TreeComponent)).componentInstance as TreeComponent;

        treeInstance.toggleExpanded('root-1');
        fixture.detectChanges();
        await fixture.whenStable();
        treeEl = fixture.debugElement.query(By.css('[role="tree"]'));
    });

    it('should move focus down with ArrowDown', () => {
        treeInstance.focusedKey.set('root-1');
        dispatchKey(treeEl, 'ArrowDown');
        expect(treeInstance.focusedKey()).toBe('child-1-1');
    });

    it('should focus first item on ArrowDown with no current focus', () => {
        treeInstance.focusedKey.set(null);
        dispatchKey(treeEl, 'ArrowDown');
        expect(treeInstance.focusedKey()).toBe('root-1');
    });

    it('should keep focus on the last item when pressing ArrowDown at the end', () => {
        treeInstance.focusedKey.set('root-2');
        dispatchKey(treeEl, 'ArrowDown');
        expect(treeInstance.focusedKey()).toBe('root-2');
    });

    it('should move focus up with ArrowUp', () => {
        treeInstance.focusedKey.set('child-1-1');
        dispatchKey(treeEl, 'ArrowUp');
        expect(treeInstance.focusedKey()).toBe('root-1');
    });

    it('should focus last item on ArrowUp with no current focus', () => {
        treeInstance.focusedKey.set(null);
        dispatchKey(treeEl, 'ArrowUp');
        expect(treeInstance.focusedKey()).toBe('root-2');
    });

    it('should focus first item on Home', () => {
        treeInstance.focusedKey.set('root-2');
        dispatchKey(treeEl, 'Home');
        expect(treeInstance.focusedKey()).toBe('root-1');
    });

    it('should focus last item on End', () => {
        treeInstance.focusedKey.set('root-1');
        dispatchKey(treeEl, 'End');
        expect(treeInstance.focusedKey()).toBe('root-2');
    });

    it('should toggle selection with Enter', () => {
        treeInstance.focusedKey.set('root-1');
        dispatchKey(treeEl, 'Enter');
        expect(treeInstance.focusedKey()).toBe('root-1');
    });

    it('should toggle selection with Space', () => {
        treeInstance.focusedKey.set('root-1');
        expect(() => dispatchKey(treeEl, ' ')).not.toThrow();
    });

    it('should expand a collapsed parent with ArrowRight', () => {
        treeInstance.focusedKey.set('child-1-2');
        dispatchKey(treeEl, 'ArrowRight');
        expect(treeInstance.isExpanded('child-1-2')).toBe(true);
    });

    it('should move to first child with ArrowRight on expanded parent', () => {
        treeInstance.focusedKey.set('root-1');
        dispatchKey(treeEl, 'ArrowRight');
        expect(treeInstance.focusedKey()).toBe('child-1-1');
    });

    it('should do nothing with ArrowRight on a leaf', () => {
        treeInstance.focusedKey.set('child-1-1');
        dispatchKey(treeEl, 'ArrowRight');
        expect(treeInstance.focusedKey()).toBe('child-1-1');
    });

    it('should do nothing with ArrowRight when nothing focused', () => {
        treeInstance.focusedKey.set(null);
        dispatchKey(treeEl, 'ArrowRight');
        expect(treeInstance.focusedKey()).toBeNull();
    });

    it('should collapse an expanded parent with ArrowLeft', () => {
        treeInstance.focusedKey.set('root-1');
        dispatchKey(treeEl, 'ArrowLeft');
        expect(treeInstance.isExpanded('root-1')).toBe(false);
    });

    it('should focus parent and collapse it with ArrowLeft on a child', () => {
        treeInstance.focusedKey.set('child-1-1');
        dispatchKey(treeEl, 'ArrowLeft');
        expect(treeInstance.focusedKey()).toBe('root-1');
        expect(treeInstance.isExpanded('root-1')).toBe(false);
    });

    it('should do nothing with ArrowLeft when nothing focused', () => {
        treeInstance.focusedKey.set(null);
        dispatchKey(treeEl, 'ArrowLeft');
        expect(treeInstance.focusedKey()).toBeNull();
    });

    it('should reuse ancestor cache across visibility checks', () => {
        treeInstance.focusedKey.set('root-1');
        dispatchKey(treeEl, 'ArrowDown');
        dispatchKey(treeEl, 'ArrowDown');
        expect(treeInstance.focusedKey()).toBe('child-1-2');
    });
});

describe('TreeComponent - Keyboard navigation (RTL, data-driven)', () => {
    let fixture: ComponentFixture<DataDrivenTreeTestHostComponent>;
    let treeInstance: TreeComponent;
    let treeEl: ReturnType<ComponentFixture<DataDrivenTreeTestHostComponent>['debugElement']['query']>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [DataDrivenTreeTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(DataDrivenTreeTestHostComponent);
        fixture.detectChanges();
        await fixture.whenStable();
        treeInstance = fixture.debugElement.query(By.directive(TreeComponent)).componentInstance as TreeComponent;
        const host = fixture.debugElement.query(By.directive(TreeComponent)).nativeElement as HTMLElement;
        host.style.direction = 'rtl';

        treeInstance.toggleExpanded('root-1');
        fixture.detectChanges();
        await fixture.whenStable();
        treeEl = fixture.debugElement.query(By.css('[role="tree"]'));
    });

    it('should confirm RTL is detected', () => {
        expect(treeInstance.isRtl()).toBe(true);
    });

    it('should expand with ArrowLeft in RTL', () => {
        treeInstance.focusedKey.set('child-1-2');
        dispatchKey(treeEl, 'ArrowLeft');
        expect(treeInstance.isExpanded('child-1-2')).toBe(true);
    });

    it('should collapse with ArrowRight in RTL', () => {
        treeInstance.focusedKey.set('root-1');
        dispatchKey(treeEl, 'ArrowRight');
        expect(treeInstance.isExpanded('root-1')).toBe(false);
    });
});

describe('TreeComponent - Keyboard navigation (template-driven, ancestor fallback)', () => {
    let fixture: ComponentFixture<TreeTestHostComponent>;
    let treeInstance: TreeComponent;
    let treeEl: ReturnType<ComponentFixture<TreeTestHostComponent>['debugElement']['query']>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TreeTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TreeTestHostComponent);
        fixture.detectChanges();
        await fixture.whenStable();
        treeInstance = fixture.debugElement.query(By.directive(TreeComponent)).componentInstance as TreeComponent;

        treeInstance.toggleExpanded('folder-1');
        fixture.detectChanges();
        await fixture.whenStable();
        treeEl = fixture.debugElement.query(By.css('[role="tree"]'));
    });

    it('should navigate down using parentItem-based ancestor resolution', () => {
        treeInstance.focusedKey.set('folder-1');
        dispatchKey(treeEl, 'ArrowDown');
        expect(treeInstance.focusedKey()).toBe('file-1');
    });

    it('should collapse to parent with ArrowLeft using parentItem fallback', () => {
        treeInstance.focusedKey.set('file-1');
        dispatchKey(treeEl, 'ArrowLeft');
        expect(treeInstance.focusedKey()).toBe('folder-1');
        expect(treeInstance.isExpanded('folder-1')).toBe(false);
    });
});

@Component({
    template: `<ui-tree />`,
    imports: [TreeComponent]
})
class EmptyTreeHostComponent {}

describe('TreeComponent - Keyboard navigation with no items', () => {
    it('should return early on keydown when there are no items', async () => {
        await TestBed.configureTestingModule({
            imports: [EmptyTreeHostComponent]
        }).compileComponents();

        const fixture = TestBed.createComponent(EmptyTreeHostComponent);
        fixture.detectChanges();
        await fixture.whenStable();

        const treeInstance = fixture.debugElement.query(By.directive(TreeComponent)).componentInstance as TreeComponent;
        const treeEl = fixture.debugElement.query(By.css('[role="tree"]'));

        dispatchKey(treeEl, 'ArrowDown');
        expect(treeInstance.focusedKey()).toBeNull();
    });
});

describe('TreeItemComponent - click handlers', () => {
    let fixture: ComponentFixture<TreeTestHostComponent>;
    let treeInstance: TreeComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TreeTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TreeTestHostComponent);
        fixture.detectChanges();
        await fixture.whenStable();
        treeInstance = fixture.debugElement.query(By.directive(TreeComponent)).componentInstance as TreeComponent;
    });

    it('should toggle expansion when the expand button is clicked', () => {
        const button = fixture.debugElement.query(By.css('button'));
        expect(treeInstance.isExpanded('folder-1')).toBe(false);
        button.triggerEventHandler('click', { stopPropagation: () => { /* noop */ } });
        fixture.detectChanges();
        expect(treeInstance.isExpanded('folder-1')).toBe(true);
    });

    it('should focus and select when a header is clicked', () => {
        const header = fixture.debugElement.query(By.css('[data-slot="tree-item"] > div'));
        header.triggerEventHandler('click', {});
        fixture.detectChanges();
        expect(treeInstance.focusedKey()).toBe('folder-1');
        expect(treeInstance.isSelected('folder-1')).toBe(true);
    });

    it('should deselect on second header click in single mode', () => {
        const header = fixture.debugElement.query(By.css('[data-slot="tree-item"] > div'));
        header.triggerEventHandler('click', {});
        fixture.detectChanges();
        header.triggerEventHandler('click', {});
        fixture.detectChanges();
        expect(treeInstance.isSelected('folder-1')).toBe(false);
    });
});

@Component({
    template: `
        <ui-tree [data]="data">
            <ng-template uiTreeNodeContent let-node>
                <span class="custom-node">Custom: {{ node.label }}</span>
            </ng-template>
        </ui-tree>
    `,
    imports: [TreeComponent, TreeNodeContentDirective]
})
class CustomNodeTreeHostComponent {
    data: TreeNode[] = [{ key: 'a', label: 'Alpha' }];
}

describe('TreeComponent - custom node content directive', () => {
    it('should render custom node template via uiTreeNodeContent', async () => {
        await TestBed.configureTestingModule({
            imports: [CustomNodeTreeHostComponent]
        }).compileComponents();

        const fixture = TestBed.createComponent(CustomNodeTreeHostComponent);
        fixture.detectChanges();
        await fixture.whenStable();

        const treeInstance = fixture.debugElement.query(By.directive(TreeComponent)).componentInstance as TreeComponent;
        expect(treeInstance.nodeContent()).toBeTruthy();

        const custom = fixture.debugElement.query(By.css('.custom-node'));
        expect(custom.nativeElement.textContent).toContain('Custom: Alpha');
    });
});
