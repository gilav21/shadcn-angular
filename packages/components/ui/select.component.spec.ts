import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SelectComponent, SelectTriggerComponent, SelectContentComponent, SelectValueComponent, SelectItemComponent, SelectGroupComponent, SelectLabelComponent } from './select.component';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

// Test host for integration
@Component({
    template: `
        <ui-select (valueChange)="onValueChange($event)">
            <ui-select-trigger>
                <ui-select-value placeholder="Select option" />
            </ui-select-trigger>
            <ui-select-content>
                <ui-select-item value="option1">Option 1</ui-select-item>
                <ui-select-item value="option2">Option 2</ui-select-item>
                <ui-select-item value="option3">Option 3</ui-select-item>
            </ui-select-content>
        </ui-select>
    `,
    imports: [SelectComponent, SelectTriggerComponent, SelectContentComponent, SelectValueComponent, SelectItemComponent]
})
class TestHostComponent {
    selectedValue = '';
    onValueChange(value: string) {
        this.selectedValue = value;
    }
}

// RTL Test host
@Component({
    template: `
        <div [dir]="dir()">
            <ui-select>
                <ui-select-trigger>
                    <ui-select-value placeholder="اختر خيارًا" />
                </ui-select-trigger>
                <ui-select-content>
                    <ui-select-item value="opt1">الخيار 1</ui-select-item>
                    <ui-select-item value="opt2">الخيار 2</ui-select-item>
                </ui-select-content>
            </ui-select>
        </div>
    `,
    imports: [SelectComponent, SelectTriggerComponent, SelectContentComponent, SelectValueComponent, SelectItemComponent]
})
class RTLTestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
}

@Component({
    template: `
        <ui-select [formControl]="control">
            <ui-select-trigger>
                <ui-select-value placeholder="Select option" />
            </ui-select-trigger>
            <ui-select-content>
                <ui-select-item value="cva1">Option 1</ui-select-item>
                <ui-select-item value="cva2">Option 2</ui-select-item>
            </ui-select-content>
        </ui-select>
    `,
    imports: [
        SelectComponent,
        SelectTriggerComponent,
        SelectContentComponent,
        SelectValueComponent,
        SelectItemComponent,
        ReactiveFormsModule
    ]
})
class CVATestHostComponent {
    control = new FormControl('');
}

describe('SelectComponent', () => {
    let component: SelectComponent<string>;
    let fixture: ComponentFixture<SelectComponent<string>>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SelectComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(SelectComponent<string>);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should be closed by default', () => {
        expect(component.open()).toBe(false);
    });

    it('should have no value by default', () => {
        expect(component.value()).toBeUndefined();
    });

    it('should toggle open state', () => {
        component.toggle();
        expect(component.open()).toBe(true);

        component.toggle();
        expect(component.open()).toBe(false);
    });

    it('should select value and close', () => {
        component.open.set(true);
        component.select('test-value');

        expect(component.value()).toBe('test-value');
        expect(component.open()).toBe(false);
    });
});

describe('Select Integration', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let component: TestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should render select with trigger', () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="select-trigger"]'));
        expect(trigger).toBeTruthy();
    });

    it('should render placeholder initially', () => {
        const value = fixture.debugElement.query(By.css('[data-slot="select-value"]'));
        expect(value.nativeElement.textContent).toContain('Select option');
    });

    it('should have role="combobox" on trigger', () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="select-trigger"]'));
        expect(trigger.nativeElement.getAttribute('role')).toBe('combobox');
    });

    it('should not show content when closed', () => {
        const content = fixture.debugElement.query(By.css('[data-slot="select-content"]'));
        expect(content).toBeNull();
    });

    it('should open content on trigger click', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="select-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="select-content"]'));
        expect(content).toBeTruthy();
    });

    it('should have role="listbox" on content', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="select-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[role="listbox"]'));
        expect(content).toBeTruthy();
    });

    it('should render items with role="option"', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="select-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const items = fixture.debugElement.queryAll(By.css('[role="option"]'));
        expect(items.length).toBe(3);
    });

    it('should select item on click', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="select-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const items = fixture.debugElement.queryAll(By.css('[data-slot="select-item"]'));
        items[1].nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.selectedValue).toBe('option2');
    });
});

describe('Select RTL Support', () => {
    let fixture: ComponentFixture<RTLTestHostComponent>;
    let component: RTLTestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RTLTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(RTLTestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        document.documentElement.removeAttribute('dir');
    });

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

    it('should open dropdown in RTL', async () => {
        component.dir.set('rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const trigger = fixture.debugElement.query(By.css('[data-slot="select-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="select-content"]'));
        expect(content).toBeTruthy();
    });
});

describe('Select ControlValueAccessor', () => {
    let fixture: ComponentFixture<CVATestHostComponent>;
    let component: CVATestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [CVATestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(CVATestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        await fixture.whenStable();
    });

    it('should write value from FormControl', async () => {
        component.control.setValue('cva2');
        fixture.detectChanges();
        await fixture.whenStable();

        const value = fixture.debugElement.query(By.css('[data-slot="select-value"]'));
        // Note: Since dropdown was never opened, label is unknown. Shows value.
        expect(value.nativeElement.textContent).toContain('cva2');
    });

    it('should update FormControl on selection', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="select-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const items = fixture.debugElement.queryAll(By.css('[data-slot="select-item"]'));
        items[0].nativeElement.click(); // Select Option 1 (cva1)
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.control.value).toBe('cva1');
    });

    it('should disable trigger when FormControl is disabled', async () => {
        component.control.disable();
        fixture.detectChanges();
        await fixture.whenStable();

        const trigger = fixture.debugElement.query(By.css('[data-slot="select-trigger"]'));
        expect(trigger.nativeElement.disabled).toBe(true);
    });
});

describe('Select Keyboard Navigation', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let component: TestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        await fixture.whenStable();
    });

    it('should open on Enter key', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="select-trigger"]'));
        trigger.triggerEventHandler('keydown', { key: 'Enter', preventDefault: () => { } });
        fixture.detectChanges();

        const content = fixture.debugElement.query(By.css('[data-slot="select-content"]'));
        expect(content).toBeTruthy();
    });

    it('should open on Space key', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="select-trigger"]'));
        trigger.triggerEventHandler('keydown', { key: ' ', preventDefault: () => { } });
        fixture.detectChanges();

        const content = fixture.debugElement.query(By.css('[data-slot="select-content"]'));
        expect(content).toBeTruthy();
    });

    it('should close on Escape key', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="select-trigger"]'));
        trigger.nativeElement.click(); // Open
        fixture.detectChanges();

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        fixture.detectChanges();

        const content = fixture.debugElement.query(By.css('[data-slot="select-content"]'));
        expect(content).toBeNull();
    });

    // Note: Focus management tests require attaching to DOM or specific focus spying
    // which might be flaky in JSDOM without full interaction simulation.
    // We will verify logic invocation if possible, or check document.activeElement
    it('should focus content/option when opened', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="select-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        // Wait for potential setTimeout in component
        await new Promise(resolve => setTimeout(resolve, 0));

        const content = fixture.debugElement.query(By.css('[data-slot="select-content"]'));
        const firstItem = fixture.debugElement.query(By.css('[data-slot="select-item"]'));

        // Either the content (listbox) or the first item should be focused
        const activeElement = document.activeElement;
        const isContentFocused = activeElement === content.nativeElement;
        const isItemFocused = activeElement === firstItem?.nativeElement;

        expect(isContentFocused || isItemFocused).toBe(true);
    });

    it('should navigate items with ArrowDown key', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="select-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 0));

        const content = fixture.debugElement.query(By.css('[data-slot="select-content"]'));
        // Simulate ArrowDown on the content (listbox)
        content.triggerEventHandler('keydown', { key: 'ArrowDown', preventDefault: () => { } });
        fixture.detectChanges();

        const items = fixture.debugElement.queryAll(By.css('[data-slot="select-item"]'));
        const firstItem = items[0];

        expect(document.activeElement === firstItem.nativeElement).toBe(true);

        // Simulate ArrowDown again
        content.triggerEventHandler('keydown', { key: 'ArrowDown', preventDefault: () => { } });
        fixture.detectChanges();

        const secondItem = items[1];
        expect(document.activeElement === secondItem.nativeElement).toBe(true);
    });
});

// ============================================
// DATA-DRIVEN MODE TESTS
// ============================================

// Simple data-driven test host with string array
@Component({
    template: `
        <ui-select 
            [options]="fruits" 
            [(value)]="selected"
            (valueChange)="onValueChange($event)"
            placeholder="Select a fruit..."
        />
    `,
    imports: [SelectComponent]
})
class DataDrivenStringTestHost {
    fruits = ['Apple', 'Banana', 'Cherry', 'Date'];
    selected: string | null = null;
    onValueChange(value: string) {
        this.selected = value;
    }
}

describe('Select Data-Driven Mode (Strings)', () => {
    let fixture: ComponentFixture<DataDrivenStringTestHost>;
    let component: DataDrivenStringTestHost;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [DataDrivenStringTestHost]
        }).compileComponents();

        fixture = TestBed.createComponent(DataDrivenStringTestHost);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should render in data-driven mode', () => {
        const trigger = fixture.debugElement.query(By.css('button[role="combobox"]'));
        expect(trigger).toBeTruthy();
    });

    it('should show placeholder when no value selected', () => {
        const trigger = fixture.debugElement.query(By.css('button[role="combobox"]'));
        expect(trigger.nativeElement.textContent).toContain('Select a fruit...');
    });

    it('should open dropdown on click', async () => {
        const trigger = fixture.debugElement.query(By.css('button[role="combobox"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const listbox = fixture.debugElement.query(By.css('[role="listbox"]'));
        expect(listbox).toBeTruthy();
    });

    it('should render all options', async () => {
        const trigger = fixture.debugElement.query(By.css('button[role="combobox"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const options = fixture.debugElement.queryAll(By.css('[role="option"]'));
        expect(options.length).toBe(4);
    });

    it('should select option on click', async () => {
        const trigger = fixture.debugElement.query(By.css('button[role="combobox"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const options = fixture.debugElement.queryAll(By.css('[role="option"]'));
        options[1].nativeElement.click(); // Select "Banana"
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.selected).toBe('Banana');
    });

    it('should close dropdown after selection', async () => {
        const trigger = fixture.debugElement.query(By.css('button[role="combobox"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const options = fixture.debugElement.queryAll(By.css('[role="option"]'));
        options[0].nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const listbox = fixture.debugElement.query(By.css('[role="listbox"]'));
        expect(listbox).toBeNull();
    });

    it('should show selected value in trigger', async () => {
        const trigger = fixture.debugElement.query(By.css('button[role="combobox"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const options = fixture.debugElement.queryAll(By.css('[role="option"]'));
        options[2].nativeElement.click(); // Select "Cherry"
        fixture.detectChanges();
        await fixture.whenStable();

        expect(trigger.nativeElement.textContent).toContain('Cherry');
    });
});

// Object data-driven test host
interface Country {
    name: string;
    code: string;
}

@Component({
    template: `
        <ui-select 
            [options]="countries" 
            [displayWith]="displayFn"
            valueAttribute="code"
            [(value)]="selected"
            placeholder="Select a country..."
        />
    `,
    imports: [SelectComponent]
})
class DataDrivenObjectTestHost {
    countries: Country[] = [
        { name: 'United States', code: 'US' },
        { name: 'United Kingdom', code: 'UK' },
        { name: 'Germany', code: 'DE' },
    ];
    selected: string | null = null;
    displayFn = (country: Country) => country.name;
}

describe('Select Data-Driven Mode (Objects)', () => {
    let fixture: ComponentFixture<DataDrivenObjectTestHost>;
    let component: DataDrivenObjectTestHost;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [DataDrivenObjectTestHost]
        }).compileComponents();

        fixture = TestBed.createComponent(DataDrivenObjectTestHost);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should render options with displayWith', async () => {
        const trigger = fixture.debugElement.query(By.css('button[role="combobox"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const options = fixture.debugElement.queryAll(By.css('[role="option"]'));
        expect(options[0].nativeElement.textContent).toContain('United States');
        expect(options[1].nativeElement.textContent).toContain('United Kingdom');
    });

    it('should extract value using valueAttribute', async () => {
        const trigger = fixture.debugElement.query(By.css('button[role="combobox"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const options = fixture.debugElement.queryAll(By.css('[role="option"]'));
        options[2].nativeElement.click(); // Select Germany
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.selected).toBe('DE');
    });

    it('should display selected option label in trigger', async () => {
        const trigger = fixture.debugElement.query(By.css('button[role="combobox"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const options = fixture.debugElement.queryAll(By.css('[role="option"]'));
        options[1].nativeElement.click(); // Select UK
        fixture.detectChanges();
        await fixture.whenStable();

        expect(trigger.nativeElement.textContent).toContain('United Kingdom');
    });
});

// Data-driven CVA test host
@Component({
    template: `
        <ui-select 
            [options]="options" 
            [formControl]="control"
            placeholder="Select..."
        />
    `,
    imports: [SelectComponent, ReactiveFormsModule]
})
class DataDrivenCVATestHost {
    options = ['Option A', 'Option B', 'Option C'];
    control = new FormControl('');
}

describe('Select Data-Driven ControlValueAccessor', () => {
    let fixture: ComponentFixture<DataDrivenCVATestHost>;
    let component: DataDrivenCVATestHost;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [DataDrivenCVATestHost]
        }).compileComponents();

        fixture = TestBed.createComponent(DataDrivenCVATestHost);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should write value from FormControl', async () => {
        component.control.setValue('Option B');
        fixture.detectChanges();
        await fixture.whenStable();

        const trigger = fixture.debugElement.query(By.css('button[role="combobox"]'));
        expect(trigger.nativeElement.textContent).toContain('Option B');
    });

    it('should update FormControl on selection', async () => {
        const trigger = fixture.debugElement.query(By.css('button[role="combobox"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const options = fixture.debugElement.queryAll(By.css('[role="option"]'));
        options[2].nativeElement.click(); // Option C
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.control.value).toBe('Option C');
    });

    it('should disable select when FormControl is disabled', async () => {
        component.control.disable();
        fixture.detectChanges();
        await fixture.whenStable();

        const trigger = fixture.debugElement.query(By.css('button[role="combobox"]'));
        expect(trigger.nativeElement.disabled).toBe(true);
    });
});

// Data-driven keyboard navigation
describe('Select Data-Driven Keyboard Navigation', () => {
    let fixture: ComponentFixture<DataDrivenStringTestHost>;
    let component: DataDrivenStringTestHost;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [DataDrivenStringTestHost]
        }).compileComponents();

        fixture = TestBed.createComponent(DataDrivenStringTestHost);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should open on Enter key', async () => {
        const trigger = fixture.debugElement.query(By.css('button[role="combobox"]'));
        trigger.triggerEventHandler('keydown', { key: 'Enter', preventDefault: () => { } });
        fixture.detectChanges();
        await fixture.whenStable();

        const listbox = fixture.debugElement.query(By.css('[role="listbox"]'));
        expect(listbox).toBeTruthy();
    });

    it('should open on Space key', async () => {
        const trigger = fixture.debugElement.query(By.css('button[role="combobox"]'));
        trigger.triggerEventHandler('keydown', { key: ' ', preventDefault: () => { } });
        fixture.detectChanges();
        await fixture.whenStable();

        const listbox = fixture.debugElement.query(By.css('[role="listbox"]'));
        expect(listbox).toBeTruthy();
    });

    it('should open on ArrowDown key', async () => {
        const trigger = fixture.debugElement.query(By.css('button[role="combobox"]'));
        trigger.triggerEventHandler('keydown', { key: 'ArrowDown', preventDefault: () => { } });
        fixture.detectChanges();
        await fixture.whenStable();

        const listbox = fixture.debugElement.query(By.css('[role="listbox"]'));
        expect(listbox).toBeTruthy();
    });

    it('should close on Escape key', async () => {
        const trigger = fixture.debugElement.query(By.css('button[role="combobox"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        // Dispatch escape on document
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        fixture.detectChanges();
        await fixture.whenStable();

        const listbox = fixture.debugElement.query(By.css('[role="listbox"]'));
        expect(listbox).toBeNull();
    });

    it('should focus listbox when opened to enable keyboard navigation', async () => {
        const trigger = fixture.debugElement.query(By.css('button[role="combobox"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        // Wait for any setTimeout in focus logic
        await new Promise(resolve => setTimeout(resolve, 10));
        fixture.detectChanges();

        const listbox = fixture.debugElement.query(By.css('[role="listbox"]'));
        expect(listbox).toBeTruthy();

        // The listbox or first item should be focused for keyboard navigation to work
        const activeElement = document.activeElement;
        const options = fixture.debugElement.queryAll(By.css('[role="option"]'));

        const isListboxFocused = activeElement === listbox.nativeElement;
        const isFirstOptionFocused = options.length > 0 && activeElement === options[0].nativeElement;

        expect(isListboxFocused || isFirstOptionFocused).toBe(true);
    });
});

