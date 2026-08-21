import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { RadioGroupComponent, RadioGroupItemComponent } from './radio-group.component';

interface Fruit {
  id: string;
  name: string;
  locked?: boolean;
}

// Data-driven host: exercises options/displayWith/valueAttribute/disabledWith paths.
@Component({
  template: `
    <ui-radio-group
      [options]="options"
      [displayWith]="displayWith"
      [valueAttribute]="valueAttribute"
      [disabledWith]="disabledWith"
    />
  `,
  imports: [RadioGroupComponent],
})
class DataDrivenHost {
  options: Fruit[] = [
    { id: 'a', name: 'Apple' },
    { id: 'b', name: 'Banana', locked: true },
  ];
  displayWith = (f: Fruit) => f.name;
  valueAttribute: string | undefined = 'id';
  disabledWith = (f: Fruit) => !!f.locked;
}

// Data-driven host relying on all defaults (String display, no valueAttribute, default disabledWith).
@Component({
  template: `<ui-radio-group [options]="options" />`,
  imports: [RadioGroupComponent],
})
class DataDrivenDefaultsHost {
  options = ['one', 'two'];
}

// Value-input host: exercises the constructor effect that seeds internalValue.
@Component({
  template: `
    <ui-radio-group [value]="value">
      <ui-radio-group-item value="x" />
      <ui-radio-group-item value="y" />
    </ui-radio-group>
  `,
  imports: [RadioGroupComponent, RadioGroupItemComponent],
})
class ValueInputHost {
  value: string | undefined = 'y';
}

// Standalone item (no parent group) — exercises the `?? false` fallback in item.isDisabled.
@Component({
  template: `<ui-radio-group-item value="lonely" />`,
  imports: [RadioGroupItemComponent],
})
class StandaloneItemHost {}

describe('RadioGroup data-driven mode', () => {
  let fixture: ComponentFixture<DataDrivenHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DataDrivenHost] }).compileComponents();
    fixture = TestBed.createComponent(DataDrivenHost);
    fixture.detectChanges();
  });

  it('renders one item per option', () => {
    const items = fixture.debugElement.queryAll(By.css('input[type="radio"]'));
    expect(items).toHaveLength(2);
  });

  it('uses displayWith for labels', () => {
    const labels = fixture.debugElement.queryAll(By.css('label'));
    expect(labels[0].nativeElement.textContent).toContain('Apple');
    expect(labels[1].nativeElement.textContent).toContain('Banana');
  });

  it('uses valueAttribute for item values', () => {
    const group = fixture.debugElement.query(By.directive(RadioGroupComponent))
      .componentInstance as RadioGroupComponent<Fruit>;
    expect(group.getValue({ id: 'a', name: 'Apple' })).toBe('a');
  });

  it('disables options via disabledWith', () => {
    const items = fixture.debugElement.queryAll(By.css('input[type="radio"]'));
    expect(items[0].nativeElement.disabled).toBe(false);
    expect(items[1].nativeElement.disabled).toBe(true);
  });

  it('isDataDriven computes true when options provided', () => {
    const group = fixture.debugElement.query(By.directive(RadioGroupComponent))
      .componentInstance as RadioGroupComponent<Fruit>;
    expect(group.isDataDriven()).toBe(true);
  });
});

describe('RadioGroup data-driven defaults', () => {
  let fixture: ComponentFixture<DataDrivenDefaultsHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DataDrivenDefaultsHost] }).compileComponents();
    fixture = TestBed.createComponent(DataDrivenDefaultsHost);
    fixture.detectChanges();
  });

  it('falls back to String display and String value with default disabledWith', () => {
    const group = fixture.debugElement.query(By.directive(RadioGroupComponent))
      .componentInstance as RadioGroupComponent<string>;
    expect(group.getDisplayValue('one')).toBe('one');
    expect(group.getValue('two')).toBe('two');
    expect(group.isOptionDisabled('one')).toBe(false);

    const items = fixture.debugElement.queryAll(By.css('input[type="radio"]'));
    items.forEach((i) => expect(i.nativeElement.disabled).toBe(false));
  });
});

describe('RadioGroup value input effect', () => {
  it('seeds internalValue from the value input', async () => {
    await TestBed.configureTestingModule({ imports: [ValueInputHost] }).compileComponents();
    const fixture = TestBed.createComponent(ValueInputHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const group = fixture.debugElement.query(By.directive(RadioGroupComponent))
      .componentInstance as RadioGroupComponent;
    expect(group.internalValue()).toBe('y');

    const items = fixture.debugElement.queryAll(By.css('input[type="radio"]'));
    expect(items[1].nativeElement.checked).toBe(true);
  });
});

describe('RadioGroup selectValue when disabled', () => {
  it('ignores selection while disabled', () => {
    TestBed.configureTestingModule({ imports: [RadioGroupComponent] });
    const fixture = TestBed.createComponent(RadioGroupComponent);
    const group = fixture.componentInstance;
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    let emitted = false;
    group.value.subscribe(() => (emitted = true));
    group.selectValue('nope');

    expect(group.internalValue()).toBeNull();
    expect(emitted).toBe(false);
  });
});

describe('RadioGroupItem without a group', () => {
  it('falls back to its own disabled state (no parent group)', async () => {
    await TestBed.configureTestingModule({ imports: [StandaloneItemHost] }).compileComponents();
    const fixture = TestBed.createComponent(StandaloneItemHost);
    fixture.detectChanges();

    const item = fixture.debugElement.query(By.directive(RadioGroupItemComponent))
      .componentInstance as RadioGroupItemComponent;
    expect(item.isDisabled()).toBe(false);
    expect(item.isSelected()).toBe(false);

    // select() early-returns because there is no group (no throw).
    expect(() => item.select()).not.toThrow();
  });
});

describe('RadioGroupItem disabled select guard', () => {
  it('does not select when the item is disabled', async () => {
    @Component({
      template: `
        <ui-radio-group (valueChange)="changed = true">
          <ui-radio-group-item value="d" [disabled]="true" />
        </ui-radio-group>
      `,
      imports: [RadioGroupComponent, RadioGroupItemComponent],
    })
    class DisabledItemHost {
      changed = false;
    }

    await TestBed.configureTestingModule({ imports: [DisabledItemHost] }).compileComponents();
    const fixture = TestBed.createComponent(DisabledItemHost);
    fixture.detectChanges();

    const item = fixture.debugElement.query(By.directive(RadioGroupItemComponent))
      .componentInstance as RadioGroupItemComponent;
    item.select();
    fixture.detectChanges();

    expect(fixture.componentInstance.changed).toBe(false);
  });
});
