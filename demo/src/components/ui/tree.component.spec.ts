import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    TreeComponent,
    TreeItemComponent,
    TreeLabelComponent,
    TreeIconComponent,
} from './tree.component';

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
            labels.forEach(label => {
                expect(label.nativeElement.innerHTML).not.toContain('<script>');
            });
        });

        it('should properly handle special characters in values', () => {
            const tree = fixture.debugElement.query(By.directive(TreeComponent));
            const treeInstance = tree.componentInstance as TreeComponent;

            // Should not throw when using special characters
            expect(() => treeInstance.toggleExpanded('<script>alert(1)</script>')).not.toThrow();
        });
    });
});
