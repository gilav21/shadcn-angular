import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, it, expect } from 'vitest';
import { By } from '@angular/platform-browser';
import {
  DataTableMultiselectFilterComponent,
  multiselectFilterFn,
} from './data-table-multiselect-filter.component';

describe('DataTableMultiselectFilterComponent', () => {
  let component: DataTableMultiselectFilterComponent<string>;
  let fixture: ComponentFixture<DataTableMultiselectFilterComponent<string>>;
  let emitted: unknown[] | null | undefined;

  const STRING_OPTIONS = ['pending', 'processing', 'success', 'failed'];

  beforeEach(async () => {
    emitted = undefined;
    await TestBed.configureTestingModule({
      imports: [DataTableMultiselectFilterComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DataTableMultiselectFilterComponent<string>);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('options', STRING_OPTIONS);
    component.filterChange.subscribe((val: unknown[] | null) => {
      emitted = val;
    });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render all options with checkboxes', () => {
    const items = fixture.debugElement.queryAll(By.css('ui-command-item'));
    expect(items.length).toBe(STRING_OPTIONS.length);

    const checkboxes = fixture.debugElement.queryAll(By.css('ui-checkbox'));
    expect(checkboxes.length).toBe(STRING_OPTIONS.length);
  });

  it('should toggle option on and emit filterChange', () => {
    component.toggleOption('pending');
    expect(emitted).toEqual(['pending']);
  });

  it('should toggle option off and emit null when empty', () => {
    component.toggleOption('pending');
    emitted = undefined;
    component.toggleOption('pending');
    expect(emitted).toBeNull();
  });

  it('should select multiple options', () => {
    component.toggleOption('pending');
    component.toggleOption('success');
    expect(emitted).toEqual(['pending', 'success']);
  });

  it('should clear all and emit null', () => {
    component.toggleOption('pending');
    component.toggleOption('success');
    emitted = undefined;
    component.clearAll();
    expect(emitted).toBeNull();
  });

  it('should select all and emit full array', () => {
    component.selectAll();
    expect(emitted).toEqual(STRING_OPTIONS);
  });

  it('should show selected count badge when title is set', () => {
    fixture.componentRef.setInput('title', 'Status');
    fixture.detectChanges();

    component.toggleOption('pending');
    fixture.detectChanges();

    const badge = fixture.debugElement.query(By.css('ui-badge'));
    expect(badge).toBeTruthy();
  });

  it('should restore pre-selected values from input', async () => {
    fixture.componentRef.setInput('selected', ['pending', 'failed']);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.selectedCount()).toBe(2);
    expect(component.isSelected('pending')).toBe(true);
    expect(component.isSelected('failed')).toBe(true);
    expect(component.isSelected('success')).toBe(false);
  });
});

interface Priority {
  label: string;
  value: number;
}

describe('DataTableMultiselectFilterComponent with objects', () => {
  let component: DataTableMultiselectFilterComponent<Priority>;
  let fixture: ComponentFixture<DataTableMultiselectFilterComponent<Priority>>;
  let emitted: unknown[] | null | undefined;

  const PRIORITY_OPTIONS: Priority[] = [
    { label: 'Low', value: 1 },
    { label: 'Medium', value: 2 },
    { label: 'High', value: 3 },
  ];

  beforeEach(async () => {
    emitted = undefined;
    await TestBed.configureTestingModule({
      imports: [DataTableMultiselectFilterComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DataTableMultiselectFilterComponent<Priority>);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('options', PRIORITY_OPTIONS);
    fixture.componentRef.setInput('displayWith', (p: Priority) => p.label);
    fixture.componentRef.setInput('valueWith', (p: Priority) => p.value);
    component.filterChange.subscribe((val: unknown[] | null) => {
      emitted = val;
    });
    fixture.detectChanges();
  });

  it('should render object options with displayWith', () => {
    const items = fixture.debugElement.queryAll(By.css('ui-command-item'));
    expect(items.length).toBe(PRIORITY_OPTIONS.length);
  });

  it('should emit extracted values via valueWith', () => {
    component.toggleOption(PRIORITY_OPTIONS[0]);
    expect(emitted).toEqual([1]);

    component.toggleOption(PRIORITY_OPTIONS[2]);
    expect(emitted).toEqual([1, 3]);
  });

  it('should restore pre-selected with valueWith', async () => {
    fixture.componentRef.setInput('selected', [2, 3]);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.selectedCount()).toBe(2);
    expect(component.isSelected(PRIORITY_OPTIONS[1])).toBe(true);
    expect(component.isSelected(PRIORITY_OPTIONS[2])).toBe(true);
    expect(component.isSelected(PRIORITY_OPTIONS[0])).toBe(false);
  });
});

describe('multiselectFilterFn', () => {
  interface Row {
    id: number;
    status: string;
  }

  const row: Row = { id: 1, status: 'active' };

  it('should return true when filterValue is null', () => {
    expect(multiselectFilterFn(row, null, (r: Row) => r.status)).toBe(true);
  });

  it('should return true when filterValue is empty array', () => {
    expect(multiselectFilterFn(row, [], (r: Row) => r.status)).toBe(true);
  });

  it('should return true when row value is in filter array', () => {
    expect(multiselectFilterFn(row, ['active', 'inactive'], (r: Row) => r.status)).toBe(true);
  });

  it('should return false when row value is not in filter array', () => {
    expect(multiselectFilterFn(row, ['inactive', 'archived'], (r: Row) => r.status)).toBe(false);
  });

  it('should work with numeric values', () => {
    expect(multiselectFilterFn(row, [1, 2], (r: Row) => r.id)).toBe(true);
    expect(multiselectFilterFn(row, [2, 3], (r: Row) => r.id)).toBe(false);
  });
});
