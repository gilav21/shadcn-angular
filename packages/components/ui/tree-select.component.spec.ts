import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TreeSelectComponent } from './tree-select.component';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TreeNode } from './tree.component';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

const SAMPLE_NODES: TreeNode[] = [
    {
        key: 'docs',
        label: 'Documents',
        icon: 'folder',
        children: [
            { key: 'work', label: 'Work', icon: 'folder' },
            { key: 'personal', label: 'Personal', icon: 'folder' }
        ]
    },
    {
        key: 'images',
        label: 'Images',
        icon: 'image',
        children: [
            { key: 'vacation', label: 'Vacation', icon: 'image' }
        ]
    }
];

@Component({
    template: `
        <ui-tree-select 
            [nodes]="nodes" 
            [(ngModel)]="value"
            placeholder="Select item..."
        />
    `,
    imports: [TreeSelectComponent, ReactiveFormsModule]
})
class TestHostComponent {
    nodes = SAMPLE_NODES;
    value: string | null = null;
}

@Component({
    template: `
        <ui-tree-select 
            [nodes]="nodes" 
            [formControl]="control"
        />
    `,
    imports: [TreeSelectComponent, ReactiveFormsModule]
})
class CVATestHostComponent {
    nodes = SAMPLE_NODES;
    control = new FormControl<string | null>(null);
}

describe('TreeSelectComponent', () => {
    let component: TreeSelectComponent;
    let fixture: ComponentFixture<TreeSelectComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TreeSelectComponent, NoopAnimationsModule]
        }).compileComponents();

        fixture = TestBed.createComponent(TreeSelectComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('nodes', SAMPLE_NODES);
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should be closed by default', () => {
        expect(component.isOpen()).toBe(false);
    });

    it('should have correct placeholder', () => {
        fixture.componentRef.setInput('placeholder', 'Choose...');
        fixture.detectChanges();
        const placeholder = fixture.debugElement.query(By.css('.text-muted-foreground'));
        expect(placeholder.nativeElement.textContent).toContain('Choose...');
    });

    it('should toggle open state on click', () => {
        const trigger = fixture.debugElement.query(By.css('button[role="combobox"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        expect(component.isOpen()).toBe(true);

        trigger.nativeElement.click();
        fixture.detectChanges();
        expect(component.isOpen()).toBe(false);
    });
});

describe.skip('TreeSelect Integration', () => {
    let component: TestHostComponent;
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent, NoopAnimationsModule]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should open popover and show tree nodes', async () => {
        const trigger = fixture.debugElement.query(By.css('button[role="combobox"]'));
        trigger.nativeElement.click();

        // Initial detection to update isOpen signal
        fixture.detectChanges();
        await fixture.whenStable();

        // Second detection to update the view (specifically popover content @if)
        fixture.detectChanges();

        const tree = fixture.debugElement.query(By.css('ui-tree'));
        expect(tree).toBeTruthy();
    });

    it('should update value when selection changes', async () => {
        // access component directly to simulate selection event
        const treeSelect = fixture.debugElement.query(By.directive(TreeSelectComponent)).componentInstance as TreeSelectComponent;

        treeSelect.onSelectionChange(['work']);
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.value).toBe('work');
        expect(treeSelect.isOpen()).toBe(false); // Should close on select
    });
});

describe.skip('TreeSelect ControlValueAccessor', () => {
    let component: CVATestHostComponent;
    let fixture: ComponentFixture<CVATestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [CVATestHostComponent, NoopAnimationsModule]
        }).compileComponents();

        fixture = TestBed.createComponent(CVATestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should write value from model', async () => {
        component.control.setValue('personal');
        fixture.detectChanges();
        await fixture.whenStable();

        const trigger = fixture.debugElement.query(By.css('button[role="combobox"]'));
        expect(trigger.nativeElement.textContent).toContain('Personal');
    });

    it('should update model from view', () => {
        const treeSelect = fixture.debugElement.query(By.directive(TreeSelectComponent)).componentInstance as TreeSelectComponent;
        treeSelect.onSelectionChange(['vacation']);
        fixture.detectChanges();

        expect(component.control.value).toBe('vacation');
    });

    it('should handle disabled state', async () => {
        component.control.disable();
        fixture.detectChanges();

        const trigger = fixture.debugElement.query(By.css('button[role="combobox"]'));
        expect(trigger.nativeElement.disabled).toBe(true);
    });
});
