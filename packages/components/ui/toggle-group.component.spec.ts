import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToggleGroupComponent, ToggleGroupItemComponent } from './toggle-group.component';
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
        expect(item.nativeElement.className).toContain('h-8'); // sm
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
