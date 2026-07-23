import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { evaluateAdvancedFilter, matchesCondition } from './data-table.utils';
import { DataTableComponent } from './data-table.component';
import { DataTableFilterBuilderComponent } from './sub/data-table-filter-builder.component';
import { ColumnDef, FilterGroup, FilterOperator } from './data-table.types';

let originalResizeObserver: typeof ResizeObserver | undefined;

beforeEach(() => {
  originalResizeObserver = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  if (originalResizeObserver) {
    globalThis.ResizeObserver = originalResizeObserver;
  } else {
    Reflect.deleteProperty(globalThis, 'ResizeObserver');
  }
});

describe('matchesCondition (A5)', () => {
  it('handles text operators case-insensitively', () => {
    expect(matchesCondition('Hello World', 'contains', 'world')).toBe(true);
    expect(matchesCondition('Hello', 'notContains', 'xyz')).toBe(true);
    expect(matchesCondition('Hello', 'startsWith', 'he')).toBe(true);
    expect(matchesCondition('Hello', 'endsWith', 'LO')).toBe(true);
    expect(matchesCondition('Hello', 'equals', 'hello')).toBe(true);
    expect(matchesCondition('Hello', 'notEquals', 'bye')).toBe(true);
  });

  it('handles numeric comparisons', () => {
    expect(matchesCondition(10, 'gt', 5)).toBe(true);
    expect(matchesCondition(10, 'gte', 10)).toBe(true);
    expect(matchesCondition(3, 'lt', 5)).toBe(true);
    expect(matchesCondition(5, 'lte', 5)).toBe(true);
    expect(matchesCondition(5, 'gt', 10)).toBe(false);
    expect(matchesCondition('500', 'equals', 500)).toBe(true); // numeric loose-equals
  });

  it('handles empty / not-empty', () => {
    expect(matchesCondition('', 'isEmpty', undefined)).toBe(true);
    expect(matchesCondition('  ', 'isEmpty', undefined)).toBe(true);
    expect(matchesCondition('x', 'isNotEmpty', undefined)).toBe(true);
    expect(matchesCondition(null, 'isEmpty', undefined)).toBe(true);
  });

  it('matches everything for an unknown operator', () => {
    expect(matchesCondition('anything', 'bogus' as FilterOperator, 'x')).toBe(true);
  });
});

describe('evaluateAdvancedFilter (A5)', () => {
  const row = { name: 'Acme', amount: 1200, status: 'active' } as Record<string, unknown>;
  const get = (col: string) => row[col];

  it('matches an empty group (no rules)', () => {
    const group: FilterGroup = { type: 'group', combinator: 'and', rules: [] };
    expect(evaluateAdvancedFilter(group, get)).toBe(true);
  });

  it('AND requires every rule', () => {
    const group: FilterGroup = {
      type: 'group',
      combinator: 'and',
      rules: [
        { type: 'condition', column: 'amount', operator: 'gt', value: 1000 },
        { type: 'condition', column: 'status', operator: 'equals', value: 'active' },
      ],
    };
    expect(evaluateAdvancedFilter(group, get)).toBe(true);
    expect(evaluateAdvancedFilter({ ...group, rules: [
      { type: 'condition', column: 'amount', operator: 'gt', value: 5000 },
      { type: 'condition', column: 'status', operator: 'equals', value: 'active' },
    ] }, get)).toBe(false);
  });

  it('OR requires any rule', () => {
    const group: FilterGroup = {
      type: 'group',
      combinator: 'or',
      rules: [
        { type: 'condition', column: 'amount', operator: 'gt', value: 5000 },
        { type: 'condition', column: 'name', operator: 'contains', value: 'acm' },
      ],
    };
    expect(evaluateAdvancedFilter(group, get)).toBe(true);
  });

  it('evaluates nested groups', () => {
    const group: FilterGroup = {
      type: 'group',
      combinator: 'and',
      rules: [
        { type: 'condition', column: 'status', operator: 'equals', value: 'active' },
        {
          type: 'group',
          combinator: 'or',
          rules: [
            { type: 'condition', column: 'amount', operator: 'lt', value: 100 },
            { type: 'condition', column: 'name', operator: 'startsWith', value: 'Ac' },
          ],
        },
      ],
    };
    expect(evaluateAdvancedFilter(group, get)).toBe(true);
  });
});

interface FRow {
  id: string;
  name: string;
  amount: number;
}

describe('DataTableComponent advanced filter integration (A5)', () => {
  let component: DataTableComponent<FRow>;
  let fixture: ComponentFixture<DataTableComponent<FRow>>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DataTableComponent] }).compileComponents();
    fixture = TestBed.createComponent(DataTableComponent<FRow>);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('data', [
      { id: '1', name: 'Acme', amount: 1200 },
      { id: '2', name: 'Globex', amount: 50 },
      { id: '3', name: 'Initech', amount: 1800 },
    ]);
    fixture.componentRef.setInput('columns', [
      { accessorKey: 'name', header: 'Name' },
      { accessorKey: 'amount', header: 'Amount' },
    ] as ColumnDef<FRow>[]);
    fixture.detectChanges();
  });

  it('filters rows by an advanced filter tree', () => {
    component.advancedFilter.set({
      type: 'group',
      combinator: 'and',
      rules: [{ type: 'condition', column: 'amount', operator: 'gt', value: 1000 }],
    });
    expect(component.filteredData().map((r) => r.id)).toEqual(['1', '3']);
  });

  it('ignores an empty advanced filter group', () => {
    component.advancedFilter.set({ type: 'group', combinator: 'and', rules: [] });
    expect(component.filteredData()).toHaveLength(3);
  });

  it('combines with OR across columns', () => {
    component.advancedFilter.set({
      type: 'group',
      combinator: 'or',
      rules: [
        { type: 'condition', column: 'amount', operator: 'lt', value: 100 },
        { type: 'condition', column: 'name', operator: 'contains', value: 'init' },
      ],
    });
    expect(component.filteredData().map((r) => r.id).sort((a, b) => a.localeCompare(b))).toEqual(['2', '3']);
  });

  it('advancedFilterGroup defaults to an empty AND group when unset', () => {
    expect(component.advancedFilterGroup()).toEqual({ type: 'group', combinator: 'and', rules: [] });
  });

  it('filterBuilderColumns lists the configured columns as {key,header}', () => {
    expect(component.filterBuilderColumns()).toEqual([
      { key: 'name', header: 'Name' },
      { key: 'amount', header: 'Amount' },
    ]);
  });

  it('filterBuilderLabels falls back to the English defaults', () => {
    expect(component.filterBuilderLabels().addCondition).toBe('+ Condition');
  });

  it('advancedFilterCount counts leaf conditions across nested groups, and clearAdvancedFilter resets it', () => {
    component.advancedFilter.set({
      type: 'group',
      combinator: 'and',
      rules: [
        { type: 'condition', column: 'amount', operator: 'gt', value: 1000 },
        {
          type: 'group',
          combinator: 'or',
          rules: [
            { type: 'condition', column: 'name', operator: 'contains', value: 'a' },
            { type: 'condition', column: 'name', operator: 'contains', value: 'b' },
          ],
        },
      ],
    });
    expect(component.advancedFilterCount()).toBe(3);

    component.clearAdvancedFilter();
    expect(component.advancedFilter()).toBeNull();
    expect(component.advancedFilterCount()).toBe(0);
  });

  it('onAdvancedFilterChange updates the advancedFilter model', () => {
    const group: FilterGroup = { type: 'group', combinator: 'or', rules: [] };
    component.onAdvancedFilterChange(group);
    expect(component.advancedFilter()).toEqual(group);
  });

  it('resolvedLoaderComponentInputs merges the loading trigger into the custom loader inputs', () => {
    fixture.componentRef.setInput('loaderComponentInputs', { color: 'blue' });
    component.setLoadingTrigger('sorting');
    expect(component.resolvedLoaderComponentInputs()).toEqual({ color: 'blue', trigger: 'sorting' });
  });
});

describe('DataTableFilterBuilderComponent (A5)', () => {
  let fixture: ComponentFixture<DataTableFilterBuilderComponent>;
  let component: DataTableFilterBuilderComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DataTableFilterBuilderComponent] }).compileComponents();
    fixture = TestBed.createComponent(DataTableFilterBuilderComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('group', { type: 'group', combinator: 'and', rules: [] });
    fixture.componentRef.setInput('columns', [{ key: 'name', header: 'Name' }]);
    fixture.detectChanges();
  });

  it('emits a new condition on addCondition', () => {
    let emitted: FilterGroup | null = null;
    component.groupChange.subscribe((g) => (emitted = g));
    component.addCondition();
    expect(emitted!.rules).toHaveLength(1);
    expect(emitted!.rules[0]).toMatchObject({ type: 'condition', column: 'name', operator: 'contains' });
  });

  it('emits a nested group on addGroup', () => {
    let emitted: FilterGroup | null = null;
    component.groupChange.subscribe((g) => (emitted = g));
    component.addGroup();
    expect(emitted!.rules[0]).toMatchObject({ type: 'group', combinator: 'and' });
  });

  it('toggles the combinator', () => {
    let emitted: FilterGroup | null = null;
    component.groupChange.subscribe((g) => (emitted = g));
    component.setCombinator('or');
    expect(emitted!.combinator).toBe('or');
  });

  it('removes a rule', () => {
    fixture.componentRef.setInput('group', {
      type: 'group', combinator: 'and',
      rules: [{ type: 'condition', column: 'name', operator: 'contains', value: 'x' }],
    });
    let emitted: FilterGroup | null = null;
    component.groupChange.subscribe((g) => (emitted = g));
    component.removeRule(0);
    expect(emitted!.rules).toHaveLength(0);
  });

  it('needsValue is false for valueless operators and true otherwise', () => {
    expect(component.needsValue('isEmpty')).toBe(false);
    expect(component.needsValue('isNotEmpty')).toBe(false);
    expect(component.needsValue('contains')).toBe(true);
  });

  it('asText stringifies the rule value for the input box', () => {
    expect(component.asText(42)).toBe('42');
    expect(component.asText('hello')).toBe('hello');
  });

  it('patch updates a condition rule column/value and ignores group rules', () => {
    fixture.componentRef.setInput('group', {
      type: 'group', combinator: 'and',
      rules: [{ type: 'condition', column: 'name', operator: 'contains', value: 'x' }],
    });
    let emitted: FilterGroup | null = null;
    component.groupChange.subscribe((g) => (emitted = g));
    component.patch(0, { column: 'age', value: 'y' });
    expect(emitted!.rules[0]).toMatchObject({ column: 'age', value: 'y' });

    fixture.componentRef.setInput('group', {
      type: 'group', combinator: 'and',
      rules: [{ type: 'group', combinator: 'or', rules: [] }],
    });
    emitted = null;
    component.patch(0, { column: 'age' });
    expect(emitted).toBeNull();
  });

  it('patchOperator updates a condition rule operator via a change event and ignores group rules', () => {
    fixture.componentRef.setInput('group', {
      type: 'group', combinator: 'and',
      rules: [{ type: 'condition', column: 'name', operator: 'contains', value: 'x' }],
    });
    let emitted: FilterGroup | null = null;
    component.groupChange.subscribe((g) => (emitted = g));
    const select = document.createElement('select');
    const option = document.createElement('option');
    option.value = 'equals';
    select.append(option);
    select.value = 'equals';
    component.patchOperator(0, { target: select } as unknown as Event);
    expect(emitted!.rules[0]).toMatchObject({ operator: 'equals' });

    fixture.componentRef.setInput('group', {
      type: 'group', combinator: 'and',
      rules: [{ type: 'group', combinator: 'or', rules: [] }],
    });
    emitted = null;
    component.patchOperator(0, { target: select } as unknown as Event);
    expect(emitted).toBeNull();
  });

  it('updateRule replaces the rule at the given index (nested group change)', () => {
    fixture.componentRef.setInput('group', {
      type: 'group', combinator: 'and',
      rules: [{ type: 'group', combinator: 'or', rules: [] }],
    });
    let emitted: FilterGroup | null = null;
    component.groupChange.subscribe((g) => (emitted = g));
    const nested: FilterGroup = { type: 'group', combinator: 'and', rules: [] };
    component.updateRule(0, nested);
    expect(emitted!.rules[0]).toEqual(nested);
  });

  it('renders a nested subgroup and a condition value input', () => {
    fixture.componentRef.setInput('group', {
      type: 'group', combinator: 'and',
      rules: [
        { type: 'condition', column: 'name', operator: 'contains', value: 'x' },
        { type: 'group', combinator: 'or', rules: [] },
      ],
    });
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[data-slot="filter-subgroup"]')).toBeTruthy();
    expect(host.querySelector('[data-slot="filter-condition"] input')).toBeTruthy();
  });
});
