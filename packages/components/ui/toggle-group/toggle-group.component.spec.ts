import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToggleGroupComponent, ToggleGroupItem } from './toggle-group.component';
import { ToggleGroupItemComponent } from './sub/toggle-group-item.component';
import { Component, signal } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';

type ToggleValue = string | string[] | undefined;

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
    defaultValue = signal<ToggleValue>(undefined);
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
    defaultValue = signal<ToggleValue>(undefined);
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
        expect(items).toHaveLength(3);
        expect(items[0].nativeElement.textContent.trim()).toBe('B');
        expect(items[1].nativeElement.textContent.trim()).toBe('I');
        expect(items[2].nativeElement.textContent.trim()).toBe('U');
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

@Component({
    template: `
      <ui-toggle-group
        [type]="type()"
        [items]="items"
        [formControl]="control"
        [defaultValue]="defaultValue()"
        (valueChange)="emissions.push($event)"
      />
      <button type="button" data-testid="outside">outside</button>
    `,
    imports: [ToggleGroupComponent, ReactiveFormsModule],
})
class FormToggleHost {
    readonly type = signal<'single' | 'multiple'>('single');
    readonly defaultValue = signal<ToggleValue>(undefined);
    readonly items: ToggleGroupItem[] = [
        { value: 'bold', label: 'Bold' },
        { value: 'italic', label: 'Italic' },
        { value: 'underline', label: 'Underline' },
    ];
    readonly control = new FormControl<string | string[] | null>(null);
    readonly emissions: unknown[] = [];
}

@Component({
    template: `<ui-toggle-group type="single" [items]="items" [(ngModel)]="picked" />`,
    imports: [ToggleGroupComponent, FormsModule],
})
class NgModelToggleHost {
    readonly items: ToggleGroupItem[] = [{ value: 'bold', label: 'Bold' }, { value: 'italic', label: 'Italic' }];
    picked: string | null = 'italic';
}

describe('ToggleGroupComponent forms', () => {
    const setup = (init: (host: FormToggleHost) => void): { fixture: ComponentFixture<FormToggleHost>; host: FormToggleHost; formEmissions: unknown[] } => {
        const fixture = TestBed.createComponent(FormToggleHost);
        const host = fixture.componentInstance;
        init(host);
        const formEmissions: unknown[] = [];
        host.control.valueChanges.subscribe(v => formEmissions.push(v));
        fixture.detectChanges();
        return { fixture, host, formEmissions };
    };
    const buttons = (fixture: ComponentFixture<unknown>): HTMLButtonElement[] =>
        Array.from(fixture.nativeElement.querySelectorAll('[data-slot="toggle-group-item"]'));
    const pressed = (fixture: ComponentFixture<unknown>): string[] =>
        buttons(fixture).filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.textContent?.trim() ?? '');

    it('works with formControlName in single and multiple mode: renders, reports each toggle once, never echoes a write', () => {
        const single = setup(host => host.control.setValue('bold'));
        expect(pressed(single.fixture)).toEqual(['Bold']);

        buttons(single.fixture)[1].click();
        single.fixture.detectChanges();
        expect(single.host.control.value).toBe('italic');
        expect(single.formEmissions).toEqual(['italic']);

        buttons(single.fixture)[1].click();
        single.fixture.detectChanges();
        expect(single.host.control.value).toBe('');

        single.host.emissions.length = 0;
        // emitEvent:false silences the write itself, so any valueChanges emission below is an echo
        single.host.control.setValue('underline', { emitEvent: false });
        single.fixture.detectChanges();
        expect(pressed(single.fixture)).toEqual(['Underline']);
        expect(single.host.emissions).toEqual([]);
        expect(single.formEmissions).toEqual(['italic', '']);

        single.host.control.setValue(null);
        single.fixture.detectChanges();
        expect(pressed(single.fixture)).toEqual([]);

        const multiple = setup(host => {
            host.type.set('multiple');
            host.control.setValue(['bold', 'italic']);
        });
        expect(pressed(multiple.fixture)).toEqual(['Bold', 'Italic']);

        buttons(multiple.fixture)[2].click();
        multiple.fixture.detectChanges();
        expect(multiple.host.control.value).toEqual(['bold', 'italic', 'underline']);

        buttons(multiple.fixture)[0].click();
        multiple.fixture.detectChanges();
        expect(multiple.host.control.value).toEqual(['italic', 'underline']);
        expect(multiple.formEmissions).toEqual([['bold', 'italic', 'underline'], ['italic', 'underline']]);

        multiple.host.control.setValue(null);
        multiple.fixture.detectChanges();
        expect(pressed(multiple.fixture)).toEqual([]);
    });

    it('works with ngModel: renders the initial value and reports a toggle', async () => {
        const fixture = TestBed.createComponent(NgModelToggleHost);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        expect(pressed(fixture)).toEqual(['Italic']);

        buttons(fixture)[0].click();
        fixture.detectChanges();
        expect(fixture.componentInstance.picked).toBe('bold');
    });

    it('lets the form value win over defaultValue', () => {
        const { fixture } = setup(host => {
            host.defaultValue.set('bold');
            host.control.setValue('italic');
        });
        expect(pressed(fixture)).toEqual(['Italic']);
    });

    it('marks touched only when focus leaves the group', () => {
        const { fixture, host } = setup(() => undefined);
        const [first, second] = buttons(fixture);
        const outside = fixture.nativeElement.querySelector('[data-testid="outside"]') as HTMLElement;

        first.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: second }));
        expect(host.control.touched).toBe(false);

        first.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }));
        expect(host.control.touched).toBe(true);
    });

    it('form.disable() disables every item and blocks toggling', () => {
        const { fixture, host } = setup(h => h.control.setValue('bold'));

        host.control.disable();
        fixture.detectChanges();
        expect(buttons(fixture).map(b => b.disabled)).toEqual([true, true, true]);
        buttons(fixture)[1].click();
        fixture.detectChanges();
        expect(host.control.value).toBe('bold');

        // a native disabled button swallows the click above, so drive the group's own guard directly
        fixture.debugElement.query(By.directive(ToggleGroupComponent)).componentInstance.toggle('italic');
        fixture.detectChanges();
        expect(host.control.value).toBe('bold');

        host.control.enable();
        fixture.detectChanges();
        expect(buttons(fixture).map(b => b.disabled)).toEqual([false, false, false]);
    });
});
