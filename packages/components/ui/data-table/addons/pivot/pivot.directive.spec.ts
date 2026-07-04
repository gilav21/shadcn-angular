import { beforeEach, describe, it, expect } from 'vitest';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DataTableComponent, type ColumnDef } from '../..';
import { DataTablePivotDirective } from './pivot.directive';
import { computePivot } from './pivot.utils';

interface Sale {
  region: string;
  product: string;
  sales: number;
}

const DATA: Sale[] = [
  { region: 'NA', product: 'A', sales: 100 },
  { region: 'NA', product: 'B', sales: 50 },
  { region: 'EU', product: 'A', sales: 80 },
  { region: 'NA', product: 'A', sales: 20 },
];

describe('computePivot', () => {
  it('pivots region x product summing sales, with row totals', () => {
    const result = computePivot(DATA, {
      rows: ['region'],
      column: 'product',
      value: 'sales',
      aggregate: 'sum',
      showRowTotals: true,
    });

    expect(result.columns.map((c) => c.header)).toEqual(['region', 'A', 'B', 'Total']);
    expect(result.pivotColumnKeys).toHaveLength(2);

    const [pa, pb] = result.pivotColumnKeys;
    expect(result.rows[0]).toMatchObject({ region: 'NA', [pa]: 120, [pb]: 50, __total__: 170 });
    expect(result.rows[1]).toMatchObject({ region: 'EU', [pa]: 80, [pb]: 0, __total__: 80 });
  });

  it('counts rows per cell with the count aggregate', () => {
    const result = computePivot(DATA, { rows: ['region'], column: 'product', value: 'sales', aggregate: 'count' });
    const [pa, pb] = result.pivotColumnKeys;
    expect(result.rows[0]).toMatchObject({ region: 'NA', [pa]: 2, [pb]: 1 });
    expect(result.rows[1]).toMatchObject({ region: 'EU', [pa]: 1, [pb]: 0 });
  });

  it('averages cell values', () => {
    const result = computePivot(DATA, { rows: ['region'], column: 'product', value: 'sales', aggregate: 'avg' });
    const [pa] = result.pivotColumnKeys;
    expect(result.rows[0][pa]).toBe(60);
  });

  it('supports multiple row dimensions', () => {
    const data = [
      { region: 'NA', tier: 'Gold', product: 'A', sales: 10 },
      { region: 'NA', tier: 'Gold', product: 'A', sales: 5 },
      { region: 'NA', tier: 'Silver', product: 'A', sales: 7 },
    ];
    const result = computePivot(data, { rows: ['region', 'tier'], column: 'product', value: 'sales', aggregate: 'sum' });
    expect(result.columns.slice(0, 2).map((c) => c.key)).toEqual(['region', 'tier']);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({ region: 'NA', tier: 'Gold' });
  });

  it('returns no rows for empty data', () => {
    const result = computePivot([], { rows: ['region'], column: 'product', value: 'sales', aggregate: 'sum' });
    expect(result.rows).toEqual([]);
    expect(result.pivotColumnKeys).toEqual([]);
  });
});

@Component({
  selector: 'ui-test-pivot-host',
  standalone: true,
  imports: [DataTableComponent, DataTablePivotDirective],
  template: `
    <ui-data-table uiDtPivot #pv="uiDtPivot" [data]="data()" [columns]="columns" />
  `,
})
class TestHostComponent {
  readonly data = signal<Sale[]>(DATA);
  readonly columns: ColumnDef<Sale>[] = [
    { accessorKey: 'region', header: 'Region' },
    { accessorKey: 'product', header: 'Product' },
    { accessorKey: 'sales', header: 'Sales' },
  ];
}

describe('DataTablePivotDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();
    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
  });

  it('pivots the table data via getPivot, reaching the base through the host', () => {
    const directive = fixture.debugElement
      .query(By.directive(DataTablePivotDirective))
      .injector.get<DataTablePivotDirective<Sale>>(DataTablePivotDirective);

    const result = directive.getPivot({
      rows: ['region'],
      column: 'product',
      value: 'sales',
      aggregate: 'sum',
      showRowTotals: true,
    });
    expect(result.columns.map((c) => c.header)).toEqual(['region', 'A', 'B', 'Total']);
    const [pa, pb] = result.pivotColumnKeys;
    expect(result.rows[0]).toMatchObject({ region: 'NA', [pa]: 120, [pb]: 50, __total__: 170 });
  });
});
