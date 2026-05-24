import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, it, expect } from 'vitest';
import { DateRange } from '../../calendar';
import {
  DataTableDateFilterComponent,
  dateFilterFn,
} from './data-table-date-filter.component';
import {
  DataTableDateRangeFilterComponent,
  dateRangeFilterFn,
} from './data-table-date-range-filter.component';

describe('DataTableDateFilterComponent', () => {
  let component: DataTableDateFilterComponent;
  let fixture: ComponentFixture<DataTableDateFilterComponent>;
  let emitted: Date | null | undefined;

  beforeEach(async () => {
    emitted = undefined;
    await TestBed.configureTestingModule({
      imports: [DataTableDateFilterComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DataTableDateFilterComponent);
    component = fixture.componentInstance;
    component.filterChange.subscribe((val: Date | null) => {
      emitted = val;
    });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit date on selection', () => {
    const date = new Date(2024, 5, 15);
    component.onDateSelect(date);
    expect(emitted).toEqual(date);
  });

  it('should ignore non-Date values on selection', () => {
    component.onDateSelect('not-a-date');
    expect(emitted).toBeUndefined();
  });

  it('should emit today on selectToday', () => {
    component.selectToday();
    expect(emitted).toBeTruthy();
    const today = new Date();
    expect(emitted!.getFullYear()).toBe(today.getFullYear());
    expect(emitted!.getMonth()).toBe(today.getMonth());
    expect(emitted!.getDate()).toBe(today.getDate());
    expect(emitted!.getHours()).toBe(0);
    expect(emitted!.getMinutes()).toBe(0);
  });

  it('should emit null on clear', () => {
    component.onDateSelect(new Date(2024, 5, 15));
    emitted = undefined;
    component.clear();
    expect(emitted).toBeNull();
  });

  it('should show title when provided', () => {
    fixture.componentRef.setInput('title', 'Filter Date');
    fixture.detectChanges();
    const titleEl = fixture.nativeElement.querySelector('[data-slot="date-filter"] .text-sm.font-medium');
    expect(titleEl?.textContent?.trim()).toBe('Filter Date');
  });

  it('should restore selected date from input', async () => {
    const date = new Date(2024, 3, 10);
    fixture.componentRef.setInput('selected', date);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.selectedValue()).toEqual(date);
  });

  it('should render English labels by default', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button');
    const texts = Array.from(buttons, (b: Element) => b.textContent?.trim());
    expect(texts).toContain('Today');
    expect(texts).toContain('Clear');
  });

  it('should render Hebrew labels when locale is "he"', () => {
    fixture.componentRef.setInput('locale', 'he');
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('button');
    const texts = Array.from(buttons, (b: Element) => b.textContent?.trim());
    expect(texts).toContain('היום');
    expect(texts).toContain('נקה');
  });

  it('should set dir="rtl" when locale is RTL', () => {
    fixture.componentRef.setInput('locale', 'he');
    fixture.detectChanges();
    const root = fixture.nativeElement.querySelector('[data-slot="date-filter"]');
    expect(root.getAttribute('dir')).toBe('rtl');
  });

  it('should set dir="ltr" for LTR locales', () => {
    fixture.componentRef.setInput('locale', 'de');
    fixture.detectChanges();
    const root = fixture.nativeElement.querySelector('[data-slot="date-filter"]');
    expect(root.getAttribute('dir')).toBe('ltr');
  });
});

describe('DataTableDateRangeFilterComponent', () => {
  let component: DataTableDateRangeFilterComponent;
  let fixture: ComponentFixture<DataTableDateRangeFilterComponent>;
  let emitted: DateRange | null | undefined;

  beforeEach(async () => {
    emitted = undefined;
    await TestBed.configureTestingModule({
      imports: [DataTableDateRangeFilterComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DataTableDateRangeFilterComponent);
    component = fixture.componentInstance;
    component.filterChange.subscribe((val: DateRange | null) => {
      emitted = val;
    });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit range when both dates are selected', () => {
    const range: DateRange = {
      start: new Date(2024, 0, 1),
      end: new Date(2024, 0, 31),
    };
    component.onRangeSelect(range);
    expect(emitted).toEqual(range);
  });

  it('should not emit when only start is selected', () => {
    const partial: DateRange = { start: new Date(2024, 0, 1), end: null };
    component.onRangeSelect(partial);
    expect(emitted).toBeUndefined();
  });

  it('should emit null on clear', () => {
    const range: DateRange = { start: new Date(2024, 0, 1), end: new Date(2024, 0, 31) };
    component.onRangeSelect(range);
    emitted = undefined;
    component.clear();
    expect(emitted).toBeNull();
  });

  it('should apply preset and emit', () => {
    const presets = component.effectivePresets();
    expect(presets.length).toBeGreaterThan(0);

    component.applyPreset(presets[0]);
    expect(emitted).toBeTruthy();
    expect(emitted!.start).toBeInstanceOf(Date);
    expect(emitted!.end).toBeInstanceOf(Date);
  });

  it('should render default presets', () => {
    const presets = component.effectivePresets();
    const labels = presets.map(p => p.label);
    expect(labels).toContain('Today');
    expect(labels).toContain('Last 7 days');
    expect(labels).toContain('Last 30 days');
    expect(labels).toContain('This month');
  });

  it('should use custom presets when provided', () => {
    const customPresets = [
      { label: 'Custom', range: { start: new Date(2024, 0, 1), end: new Date(2024, 11, 31) } },
    ];
    fixture.componentRef.setInput('presets', customPresets);
    fixture.detectChanges();
    expect(component.effectivePresets()).toEqual(customPresets);
  });

  it('should restore selected range from input', async () => {
    const range: DateRange = { start: new Date(2024, 3, 1), end: new Date(2024, 3, 30) };
    fixture.componentRef.setInput('selected', range);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.selectedValue()).toEqual(range);
  });

  it('should render localized preset labels for Hebrew', () => {
    fixture.componentRef.setInput('locale', 'he');
    fixture.detectChanges();
    const presets = component.effectivePresets();
    const labels = presets.map(p => p.label);
    expect(labels).toContain('היום');
    expect(labels).toContain('7 ימים אחרונים');
    expect(labels).toContain('30 ימים אחרונים');
    expect(labels).toContain('החודש הנוכחי');
    expect(labels).not.toContain('Today');
  });

  it('should render localized clear label for Hebrew', () => {
    fixture.componentRef.setInput('locale', 'he');
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('button');
    const texts = Array.from(buttons, (b: Element) => b.textContent?.trim());
    expect(texts).toContain('נקה');
    expect(texts).not.toContain('Clear');
  });

  it('should still use custom presets over locale defaults', () => {
    fixture.componentRef.setInput('locale', 'he');
    const custom = [{ label: 'Custom', range: { start: new Date(), end: new Date() } }];
    fixture.componentRef.setInput('presets', custom);
    fixture.detectChanges();
    expect(component.effectivePresets()).toEqual(custom);
  });

  it('should set dir="rtl" when locale is RTL', () => {
    fixture.componentRef.setInput('locale', 'ar');
    fixture.detectChanges();
    const root = fixture.nativeElement.querySelector('[data-slot="date-range-filter"]');
    expect(root.getAttribute('dir')).toBe('rtl');
  });
});

describe('dateFilterFn', () => {
  interface Row {
    id: number;
    createdAt: Date | string | number;
  }

  it('should return true when filterValue is null', () => {
    const row: Row = { id: 1, createdAt: new Date(2024, 5, 15) };
    expect(dateFilterFn(row, null, (r: Row) => r.createdAt)).toBe(true);
  });

  it('should match same-day Date objects', () => {
    const row: Row = { id: 1, createdAt: new Date(2024, 5, 15, 14, 30) };
    const filter = new Date(2024, 5, 15);
    expect(dateFilterFn(row, filter, (r: Row) => r.createdAt)).toBe(true);
  });

  it('should not match different-day Date objects', () => {
    const row: Row = { id: 1, createdAt: new Date(2024, 5, 16) };
    const filter = new Date(2024, 5, 15);
    expect(dateFilterFn(row, filter, (r: Row) => r.createdAt)).toBe(false);
  });

  it('should handle ISO string cell values', () => {
    const row: Row = { id: 1, createdAt: '2024-06-15T14:30:00.000Z' };
    const filter = new Date(2024, 5, 15);
    expect(dateFilterFn(row, filter, (r: Row) => r.createdAt)).toBe(true);
  });

  it('should handle timestamp cell values', () => {
    const date = new Date(2024, 5, 15, 10, 0);
    const row: Row = { id: 1, createdAt: date.getTime() };
    const filter = new Date(2024, 5, 15);
    expect(dateFilterFn(row, filter, (r: Row) => r.createdAt)).toBe(true);
  });

  it('should return false for invalid cell values', () => {
    const row = { id: 1, createdAt: 'not-a-date' };
    const filter = new Date(2024, 5, 15);
    expect(dateFilterFn(row, filter, (r) => r.createdAt)).toBe(false);
  });

  it('should return false for null cell values', () => {
    const row = { id: 1, createdAt: null };
    const filter = new Date(2024, 5, 15);
    expect(dateFilterFn(row, filter, (r) => r.createdAt)).toBe(false);
  });
});

describe('dateRangeFilterFn', () => {
  interface Row {
    id: number;
    date: Date | string;
  }

  it('should return true when filterValue is null', () => {
    const row: Row = { id: 1, date: new Date(2024, 5, 15) };
    expect(dateRangeFilterFn(row, null, (r: Row) => r.date)).toBe(true);
  });

  it('should return true when both start and end are null', () => {
    const row: Row = { id: 1, date: new Date(2024, 5, 15) };
    expect(dateRangeFilterFn(row, { start: null, end: null }, (r: Row) => r.date)).toBe(true);
  });

  it('should filter inclusively with both start and end', () => {
    const start = new Date(2024, 5, 10);
    const end = new Date(2024, 5, 20);
    const range: DateRange = { start, end };

    expect(dateRangeFilterFn({ id: 1, date: new Date(2024, 5, 10) }, range, (r: Row) => r.date)).toBe(true);
    expect(dateRangeFilterFn({ id: 2, date: new Date(2024, 5, 15) }, range, (r: Row) => r.date)).toBe(true);
    expect(dateRangeFilterFn({ id: 3, date: new Date(2024, 5, 20) }, range, (r: Row) => r.date)).toBe(true);
    expect(dateRangeFilterFn({ id: 4, date: new Date(2024, 5, 9) }, range, (r: Row) => r.date)).toBe(false);
    expect(dateRangeFilterFn({ id: 5, date: new Date(2024, 5, 21) }, range, (r: Row) => r.date)).toBe(false);
  });

  it('should filter with only start date', () => {
    const range: DateRange = { start: new Date(2024, 5, 15), end: null };

    expect(dateRangeFilterFn({ id: 1, date: new Date(2024, 5, 15) }, range, (r: Row) => r.date)).toBe(true);
    expect(dateRangeFilterFn({ id: 2, date: new Date(2024, 5, 20) }, range, (r: Row) => r.date)).toBe(true);
    expect(dateRangeFilterFn({ id: 3, date: new Date(2024, 5, 14) }, range, (r: Row) => r.date)).toBe(false);
  });

  it('should filter with only end date', () => {
    const range: DateRange = { start: null, end: new Date(2024, 5, 15) };

    expect(dateRangeFilterFn({ id: 1, date: new Date(2024, 5, 15) }, range, (r: Row) => r.date)).toBe(true);
    expect(dateRangeFilterFn({ id: 2, date: new Date(2024, 5, 10) }, range, (r: Row) => r.date)).toBe(true);
    expect(dateRangeFilterFn({ id: 3, date: new Date(2024, 5, 16) }, range, (r: Row) => r.date)).toBe(false);
  });

  it('should handle ISO string cell values', () => {
    const range: DateRange = { start: new Date(2024, 5, 10), end: new Date(2024, 5, 20) };
    const row: Row = { id: 1, date: '2024-06-15T14:30:00.000Z' };
    expect(dateRangeFilterFn(row, range, (r: Row) => r.date)).toBe(true);
  });

  it('should return false for invalid cell values', () => {
    const range: DateRange = { start: new Date(2024, 5, 10), end: new Date(2024, 5, 20) };
    const row = { id: 1, date: 'invalid' };
    expect(dateRangeFilterFn(row, range, (r) => r.date)).toBe(false);
  });
});
