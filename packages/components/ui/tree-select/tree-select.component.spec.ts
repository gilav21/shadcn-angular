import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TreeSelectComponent } from './tree-select.component';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TreeComponent, TreeNode } from '../tree';
import { PopoverTriggerComponent, PopoverContentComponent } from '../popover';

const SAMPLE_NODES: TreeNode[] = [
    {
        key: 'documents',
        label: 'Documents',
        icon: '📁',
        children: [
            {
                key: 'work', label: 'Work', icon: '📂', children: [
                    { key: 'report', label: 'Report.docx', icon: '📄' },
                    { key: 'expenses', label: 'Expenses.xlsx', icon: '📊' }
                ]
            },
            {
                key: 'personal', label: 'Personal', icon: '📂', children: [
                    { key: 'resume', label: 'Resume.pdf', icon: '📄' }
                ]
            }
        ]
    },
    {
        key: 'images',
        label: 'Images',
        icon: '🖼️',
        children: [
            {
                key: 'vacation', label: 'Vacation', children: [
                    { key: 'beach', label: 'Beach.jpg', icon: '📷' },
                    { key: 'mountains', label: 'Mountains.jpg', icon: '📷' }
                ]
            }
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
        <ui-tree-select
            [nodes]="nodes"
            placeholder="Select..."
            [disabled]="true"
        />
    `,
    imports: [TreeSelectComponent, ReactiveFormsModule, FormsModule]
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

@Component({
    template: `
        <ui-tree-select>
            <ui-popover-trigger class="w-full">
                <button
                    type="button"
                    role="combobox"
                    class="flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                    <span>{{ selectedLabel() }}</span>
                </button>
            </ui-popover-trigger>
            <ui-popover-content class="w-[--trigger-width] p-2" align="start">
                <ui-tree
                    [data]="nodes"
                    [selectable]="'single'"
                    class="w-full"
                    (selectionChange)="onTreeSelection($event)"
                />
            </ui-popover-content>
        </ui-tree-select>
    `,
    imports: [
        TreeSelectComponent,
        PopoverTriggerComponent,
        PopoverContentComponent,
        TreeComponent,
    ]
})
class CustomModeTestHostComponent {
    nodes = SAMPLE_NODES;
    selectedLabel = signal('Pick a file...');

    onTreeSelection(selection: string[]) {
        this.selectedLabel.set(selection[0] ?? 'Pick a file...');
    }
}

describe('TreeSelectComponent', () => {
    let component: TreeSelectComponent;
    let fixture: ComponentFixture<TreeSelectComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TreeSelectComponent]
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

    it('should be data-driven when nodes are provided', () => {
        expect(component.isDataDriven()).toBe(true);
    });

    it('should not be data-driven when nodes are empty', () => {
        fixture.componentRef.setInput('nodes', []);
        fixture.detectChanges();
        expect(component.isDataDriven()).toBe(false);
    });

    it('should have data-slot attribute on popover', () => {
        const popover = fixture.debugElement.query(By.css('[data-slot="tree-select"]'));
        expect(popover).toBeTruthy();
    });

    it('should emit selectionChange when selection changes', () => {
        let emitted: string[] = [];
        component.selectionChange.subscribe((val: string[]) => emitted = val);
        component.onSelectionChange(['work']);
        expect(emitted).toEqual(['work']);
    });
});

describe('TreeSelect Integration', () => {
    let component: TestHostComponent;
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should open popover and show tree nodes', async () => {
        const trigger = fixture.debugElement.query(By.css('button[role="combobox"]'));
        trigger.nativeElement.click();

        fixture.detectChanges();
        await fixture.whenStable();

        fixture.detectChanges();

        const tree = fixture.debugElement.query(By.css('ui-tree'));
        expect(tree).toBeTruthy();
    });

    it('should update value when selection changes', async () => {
        const treeSelect = fixture.debugElement.query(By.directive(TreeSelectComponent)).componentInstance as TreeSelectComponent;

        treeSelect.onSelectionChange(['work']);
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.value).toBe('work');
        expect(treeSelect.isOpen()).toBe(false);
    });

    it('should navigate to child on Right Arrow when expanded', async () => {
        const trigger = fixture.debugElement.query(By.css('button[role="combobox"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const tree = fixture.debugElement.query(By.directive(TreeComponent));
        const treeInstance = tree.componentInstance as TreeComponent;

        treeInstance.focus('documents');
        fixture.detectChanges();

        const arrowRight = new KeyboardEvent('keydown', { key: 'ArrowRight' });
        treeInstance.onKeydown(arrowRight);
        fixture.detectChanges();

        expect(treeInstance.isExpanded('documents')).toBe(true);

        fixture.detectChanges();
        await fixture.whenStable();

        treeInstance.onKeydown(arrowRight);
        fixture.detectChanges();

        expect(treeInstance.focusedKey()).toBe('work');
    });

    it('should collapse folder on Left Arrow when expanded', async () => {
        const trigger = fixture.debugElement.query(By.css('button[role="combobox"]'));
        trigger.nativeElement.click();

        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const tree = fixture.debugElement.query(By.directive(TreeComponent));
        const treeInstance = tree.componentInstance as TreeComponent;

        treeInstance.toggleExpanded('documents');
        treeInstance.focus('documents');
        fixture.detectChanges();
        await fixture.whenStable();

        expect(treeInstance.isExpanded('documents')).toBe(true);
        expect(treeInstance.focusedKey()).toBe('documents');

        const arrowLeft = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
        treeInstance.onKeydown(arrowLeft);
        fixture.detectChanges();

        expect(treeInstance.isExpanded('documents')).toBe(false);
        expect(treeInstance.focusedKey()).toBe('documents');
    });
});

describe('TreeSelect ControlValueAccessor', () => {
    let component: CVATestHostComponent;
    let fixture: ComponentFixture<CVATestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [CVATestHostComponent]
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

describe('TreeSelect Custom Mode', () => {
    let fixture: ComponentFixture<CustomModeTestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [CustomModeTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(CustomModeTestHostComponent);
        fixture.detectChanges();
    });

    it('should render projected content when no nodes input is given', () => {
        const customButton = fixture.debugElement.query(By.css('button[role="combobox"]'));
        expect(customButton).toBeTruthy();
        expect(customButton.nativeElement.textContent).toContain('Pick a file...');
    });

    it('should not render default tree in custom mode', () => {
        const treeSelect = fixture.debugElement.query(By.directive(TreeSelectComponent)).componentInstance as TreeSelectComponent;
        expect(treeSelect.isDataDriven()).toBe(false);
    });

    it('should render projected popover trigger', () => {
        const trigger = fixture.debugElement.query(By.directive(PopoverTriggerComponent));
        expect(trigger).toBeTruthy();
    });

    it('should open popover in custom mode programmatically', async () => {
        const treeSelect = fixture.debugElement.query(By.directive(TreeSelectComponent)).componentInstance as TreeSelectComponent;
        treeSelect.isOpen.set(true);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(treeSelect.isOpen()).toBe(true);
    });

    it('should still expose TREE_SELECT injection token', () => {
        const treeSelect = fixture.debugElement.query(By.directive(TreeSelectComponent));
        expect(treeSelect).toBeTruthy();
    });
});

describe('TreeSelect select method', () => {
    let component: TreeSelectComponent;
    let fixture: ComponentFixture<TreeSelectComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TreeSelectComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TreeSelectComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('nodes', SAMPLE_NODES);
        fixture.detectChanges();
    });

    it('should set value and close when select is called', () => {
        component.isOpen.set(true);
        component.select('report');
        expect(component.internalValue()).toBe('report');
        expect(component.isOpen()).toBe(false);
    });

    it('should emit selectionChange when select is called', () => {
        let emitted: string[] = [];
        component.selectionChange.subscribe((val: string[]) => emitted = val);
        component.select('report');
        expect(emitted).toEqual(['report']);
    });

    it('should emit empty array when select is called with null', () => {
        let emitted: string[] = [];
        component.selectionChange.subscribe((val: string[]) => emitted = val);
        component.select(null);
        expect(emitted).toEqual([]);
    });
});

describe('TreeSelectComponent — i18n integration', () => {
    async function setup(locale?: string, providerLocale?: string) {
        const { provideUiLocale } = await import('../../lib/i18n');
        await TestBed.configureTestingModule({
            imports: [TreeSelectComponent],
            providers: providerLocale ? [provideUiLocale(providerLocale)] : [],
        }).compileComponents();
        const fixture = TestBed.createComponent(TreeSelectComponent);
        fixture.componentRef.setInput('nodes', SAMPLE_NODES);
        if (locale) fixture.componentRef.setInput('locale', locale);
        fixture.detectChanges();
        return fixture;
    }

    it('defaults placeholder to English "Select..."', async () => {
        const fixture = await setup();
        const placeholderEl = fixture.nativeElement.querySelector('.text-muted-foreground');
        expect(placeholderEl.textContent.trim()).toBe('Select...');
    });

    it('localises placeholder when locale="he" and applies dir="rtl" on both the trigger and the dropdown wrapper', async () => {
        const fixture = await setup('he');
        const placeholderEl = fixture.nativeElement.querySelector('.text-muted-foreground');
        expect(placeholderEl.textContent.trim()).toBe('...בחר');
        const popover = fixture.nativeElement.querySelector('[data-slot="tree-select"]');
        expect(popover.getAttribute('dir')).toBe('rtl');
        // Open the popover so the dropdown wrapper renders. The inner wrapper
        // around <ui-tree> must also carry dir="rtl" because ui-popover-content
        // may portal to document.body and lose the host's dir.
        fixture.componentInstance.isOpen.set(true);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        const dropdownWrappers = Array.from(document.querySelectorAll('div[dir="rtl"]'));
        expect(dropdownWrappers.length).toBeGreaterThan(0);
    });

    it('falls back to UI_LOCALE_ID when no locale input is set', async () => {
        const fixture = await setup(undefined, 'es');
        const placeholderEl = fixture.nativeElement.querySelector('.text-muted-foreground');
        expect(placeholderEl.textContent.trim()).toBe('Seleccionar...');
    });
});
