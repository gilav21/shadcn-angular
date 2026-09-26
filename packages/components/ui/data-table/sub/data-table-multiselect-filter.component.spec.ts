import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, it, expect } from 'vitest';
import { By } from '@angular/platform-browser';
import {
  DataTableMultiselectFilterComponent,
  multiselectFilterFn,
} from './data-table-multiselect-filter.component';
import { DataTableLocale } from '../data-table.locales';

/** Each option row's label, in rendered order. */
function itemLabels(fixture: ComponentFixture<unknown>): string[] {
  return fixture.debugElement
    .queryAll(By.css('ui-command-item'))
    .map((item) => (item.nativeElement as HTMLElement).textContent?.trim() ?? '');
}

/** Each option row's checkbox input, in rendered order. */
function itemCheckboxes(fixture: ComponentFixture<unknown>): HTMLInputElement[] {
  return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('ui-command-item input[type="checkbox"]'));
}

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

  it('renders one checkbox row per option in order, checking only the selected ones', () => {
    expect(itemLabels(fixture)).toEqual(STRING_OPTIONS);
    expect(itemCheckboxes(fixture).map((c) => c.checked)).toEqual([false, false, false, false]);

    component.toggleOption('success');
    fixture.detectChanges();

    expect(itemCheckboxes(fixture).map((c) => c.checked)).toEqual([false, false, true, false]);
  });

  it('toggles when a command-item fires its select output (template must bind the renamed selectItem output, not native select)', () => {
    const items = fixture.debugElement.queryAll(By.css('ui-command-item'));
    // Activating the command-item emits its `selectItem` output. This only
    // reaches toggleOption if the template binds (selectItem) — a regression to
    // the old (select) binding (a native DOM event) would silently no-op.
    items[0].componentInstance.onClick();
    fixture.detectChanges();
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

  it('shows the selected count in a badge beside the title, and no badge at zero', () => {
    fixture.componentRef.setInput('title', 'Status');
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('ui-badge'))).toBeNull();

    component.toggleOption('pending');
    component.toggleOption('failed');
    fixture.detectChanges();

    const badge = fixture.debugElement.query(By.css('ui-badge'));
    expect((badge.nativeElement as HTMLElement).textContent?.trim()).toBe('2');
  });

  it('falls back to English literals when the active locale omits the labels', () => {
    const sparseLocale = { code: 'xx' } as unknown as DataTableLocale;
    fixture.componentRef.setInput('locale', sparseLocale);
    fixture.detectChanges();

    expect(component.resolvedPlaceholder()).toBe('Search...');
    expect(component.selectAllLabel()).toBe('Select all');
    expect(component.clearAllLabel()).toBe('Clear');
    expect(component.noResultsLabel()).toBe('No results.');
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

  it('keeps a selected value that has no matching option and re-emits it alongside a later toggle', async () => {
    fixture.componentRef.setInput('options', []);
    fixture.componentRef.setInput('selected', ['archived']);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.selectedCount()).toBe(1);

    fixture.componentRef.setInput('options', STRING_OPTIONS);
    fixture.detectChanges();
    await fixture.whenStable();

    component.toggleOption('pending');
    expect(emitted).toEqual(['archived', 'pending']);
  });

  it('selectAll keeps an option-less selected value', async () => {
    fixture.componentRef.setInput('selected', ['archived']);
    fixture.detectChanges();
    await fixture.whenStable();

    component.selectAll();
    expect(emitted).toEqual(['archived', ...STRING_OPTIONS]);
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

  it('labels object options and their checkboxes with displayWith', () => {
    expect(itemLabels(fixture)).toEqual(['Low', 'Medium', 'High']);
    expect(itemCheckboxes(fixture).map((c) => c.getAttribute('aria-label'))).toEqual(['Low', 'Medium', 'High']);
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
});
