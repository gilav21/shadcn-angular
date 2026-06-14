import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToggleGroupComponent, ToggleGroupItem } from './toggle-group.component';
import { ToggleGroupItemComponent } from './sub/toggle-group-item.component';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

@Component({
    template: `
    <div [dir]="dir()">
      <ui-toggle-group [type]="type()" [defaultValue]="defaultValue()" [variant]="variant()" [size]="size()">
        @for (item of items; track item.value) {
          <ui-toggle-group-item [value]="item.value">
            {{ item.label }}
          </ui-toggle-group-item>
        }
      </ui-toggle-group>
    </div>
  `,
    imports: [ToggleGroupComponent, ToggleGroupItemComponent]
})
class TestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
    type = signal<'single' | 'multiple'>('single');
    defaultValue = signal<string | string[] | undefined>(undefined);
    variant = signal<any>('default');
    size = signal<any>('default');
    items = [
        { value: 'bold', label: 'B' },
        { value: 'italic', label: 'I' },
        { value: 'underline', label: 'U' }
    ];
}

@Component({
    template: `
      <ui-toggle-group defaultValue="bold">
        <ui-toggle-group-item value="bold">B</ui-toggle-group-item>
        <ui-toggle-group-item value="italic">I</ui-toggle-group-item>
      </ui-toggle-group>
    `,
    imports: [ToggleGroupComponent, ToggleGroupItemComponent]
})
class DefaultValueTestHost { }

describe('ToggleGroupComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let component: TestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent, DefaultValueTestHost]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should show default selection', () => {
        const defaultFixture = TestBed.createComponent(DefaultValueTestHost);
        defaultFixture.detectChanges();

        const items = defaultFixture.debugElement.queryAll(By.css('[data-slot="toggle-group-item"]'));
        expect(items[0].nativeElement.getAttribute('aria-pressed')).toBe('true');
    });

    it('should handle single selection', () => {
        const items = fixture.debugElement.queryAll(By.css('[data-slot="toggle-group-item"]'));

        items[0].nativeElement.click();
        fixture.detectChanges();
        expect(items[0].nativeElement.getAttribute('aria-pressed')).toBe('true');

        items[1].nativeElement.click();
        fixture.detectChanges();
        expect(items[0].nativeElement.getAttribute('aria-pressed')).toBe('false');
        expect(items[1].nativeElement.getAttribute('aria-pressed')).toBe('true');
    });

    it('should handle multiple selection', () => {
        component.type.set('multiple');
        fixture.detectChanges();

        const items = fixture.debugElement.queryAll(By.css('[data-slot="toggle-group-item"]'));

        items[0].nativeElement.click();
        items[1].nativeElement.click();
        fixture.detectChanges();

        expect(items[0].nativeElement.getAttribute('aria-pressed')).toBe('true');
        expect(items[1].nativeElement.getAttribute('aria-pressed')).toBe('true');

        items[0].nativeElement.click(); // toggle off
        fixture.detectChanges();
        expect(items[0].nativeElement.getAttribute('aria-pressed')).toBe('false');
    });

    it('should apply variant and size to items', () => {
        component.variant.set('outline');
        component.size.set('sm');
        fixture.detectChanges();

        const item = fixture.debugElement.query(By.css('[data-slot="toggle-group-item"]'));
        expect(item.nativeElement.className).toContain('border'); // outline
        expect(item.nativeElement.getAttribute('data-size')).toBe('sm'); // sm
    });
});

@Component({
    template: `
      <ui-toggle-group
        [type]="type()"
        [items]="items()"
        [variant]="variant()"
        [size]="size()"
        [defaultValue]="defaultValue()"
        [disabled]="disabled()"
      />
    `,
    imports: [ToggleGroupComponent]
})
class DataDrivenTestHost {
    type = signal<'single' | 'multiple'>('single');
    variant = signal<'default' | 'outline'>('default');
    size = signal<'default' | 'sm' | 'lg'>('default');
    defaultValue = signal<string | string[] | undefined>(undefined);
    disabled = signal(false);
    items = signal<ToggleGroupItem[]>([
        { value: 'bold', label: 'B' },
        { value: 'italic', label: 'I' },
        { value: 'underline', label: 'U' },
    ]);
}

describe('ToggleGroup Data-Driven Mode', () => {
    let fixture: ComponentFixture<DataDrivenTestHost>;
    let component: DataDrivenTestHost;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [DataDrivenTestHost]
        }).compileComponents();

        fixture = TestBed.createComponent(DataDrivenTestHost);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should render items from the items input', () => {
        const items = fixture.debugElement.queryAll(By.css('[data-slot="toggle-group-item"]'));
        expect(items.length).toBe(3);
        expect(items[0].nativeElement.textContent.trim()).toBe('B');
        expect(items[1].nativeElement.textContent.trim()).toBe('I');
        expect(items[2].nativeElement.textContent.trim()).toBe('U');
    });

    it('should handle single selection in data-driven mode', () => {
        const items = fixture.debugElement.queryAll(By.css('[data-slot="toggle-group-item"]'));

        items[0].nativeElement.click();
        fixture.detectChanges();
        expect(items[0].nativeElement.getAttribute('aria-pressed')).toBe('true');

        items[1].nativeElement.click();
        fixture.detectChanges();
        expect(items[0].nativeElement.getAttribute('aria-pressed')).toBe('false');
        expect(items[1].nativeElement.getAttribute('aria-pressed')).toBe('true');
    });

    it('should handle multiple selection in data-driven mode', () => {
        component.type.set('multiple');
        fixture.detectChanges();

        const items = fixture.debugElement.queryAll(By.css('[data-slot="toggle-group-item"]'));

        items[0].nativeElement.click();
        items[1].nativeElement.click();
        fixture.detectChanges();

        expect(items[0].nativeElement.getAttribute('aria-pressed')).toBe('true');
        expect(items[1].nativeElement.getAttribute('aria-pressed')).toBe('true');
    });

    it('should apply variant and size in data-driven mode', () => {
        component.variant.set('outline');
        component.size.set('sm');
        fixture.detectChanges();

        const item = fixture.debugElement.query(By.css('[data-slot="toggle-group-item"]'));
        expect(item.nativeElement.className).toContain('border');
        expect(item.nativeElement.getAttribute('data-size')).toBe('sm');
    });

    it('should respect defaultValue in data-driven mode', () => {
        component.defaultValue.set('italic');
        fixture.destroy();

        fixture = TestBed.createComponent(DataDrivenTestHost);
        fixture.componentInstance.defaultValue.set('italic');
        fixture.componentInstance.items.set([
            { value: 'bold', label: 'B' },
            { value: 'italic', label: 'I' },
        ]);
        fixture.detectChanges();

        const items = fixture.debugElement.queryAll(By.css('[data-slot="toggle-group-item"]'));
        expect(items[1].nativeElement.getAttribute('aria-pressed')).toBe('true');
    });

    it('should respect disabled on individual items', () => {
        component.items.set([
            { value: 'bold', label: 'B' },
            { value: 'italic', label: 'I', disabled: true },
        ]);
        fixture.detectChanges();

        const items = fixture.debugElement.queryAll(By.css('[data-slot="toggle-group-item"]'));
        expect(items[1].nativeElement.disabled).toBe(true);
    });

    it('should use value as label when label is not provided', () => {
        component.items.set([
            { value: 'bold' },
            { value: 'italic' },
        ]);
        fixture.detectChanges();

        const items = fixture.debugElement.queryAll(By.css('[data-slot="toggle-group-item"]'));
        expect(items[0].nativeElement.textContent.trim()).toBe('bold');
        expect(items[1].nativeElement.textContent.trim()).toBe('italic');
    });

    it('should disable all items when group is disabled', () => {
        component.disabled.set(true);
        fixture.detectChanges();

        const items = fixture.debugElement.queryAll(By.css('[data-slot="toggle-group-item"]'));
        items.forEach(item => {
            expect(item.nativeElement.disabled).toBe(true);
        });
    });
});

describe('ToggleGroup RTL Support', () => {
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

    afterEach(() => {
        document.documentElement.removeAttribute('dir');
    });

    it('should apply correct rounded corners in LTR', () => {
        const items = fixture.debugElement.queryAll(By.css('[data-slot="toggle-group-item"]'));
        const classes0 = items[0].nativeElement.className;
        const classesLast = items[2].nativeElement.className;

        expect(classes0).toContain('ltr:first:rounded-l-md');
        expect(classesLast).toContain('ltr:last:rounded-r-md');
    });

    it('should reflect RTL state', async () => {
        component.dir.set('rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const items = fixture.debugElement.queryAll(By.css('[data-slot="toggle-group-item"]'));
        expect(items[0].nativeElement.className).toContain('rtl:first:rounded-r-md');
    });
});
