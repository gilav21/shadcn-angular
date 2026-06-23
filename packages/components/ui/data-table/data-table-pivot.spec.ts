import { beforeEach, describe, it, expect } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { computePivot } from './data-table.utils';
import { DataTableComponent } from './data-table.component';
import { ColumnDef } from './data-table.types';

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

describe('computePivot (A6)', () => {
  it('pivots region × product summing sales, with row totals', () => {
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
    // insertion order: NA first, then EU
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
    expect(result.rows[0][pa]).toBe(60); // (100 + 20) / 2
  });

  it('supports multiple row dimensions', () => {
    const data = [
      { region: 'NA', tier: 'Gold', product: 'A', sales: 10 },
      { region: 'NA', tier: 'Gold', product: 'A', sales: 5 },
      { region: 'NA', tier: 'Silver', product: 'A', sales: 7 },
    ];
    const result = computePivot(data, { rows: ['region', 'tier'], column: 'product', value: 'sales', aggregate: 'sum' });
    expect(result.columns.slice(0, 2).map((c) => c.key)).toEqual(['region', 'tier']);
    expect(result.rows).toHaveLength(2); // (NA,Gold) and (NA,Silver)
    expect(result.rows[0]).toMatchObject({ region: 'NA', tier: 'Gold' });
  });

  it('returns no rows for empty data', () => {
    const result = computePivot([], { rows: ['region'], column: 'product', value: 'sales', aggregate: 'sum' });
    expect(result.rows).toEqual([]);
    expect(result.pivotColumnKeys).toEqual([]);
  });
});

describe('DataTableComponent.getPivot (A6)', () => {
  let component: DataTableComponent<Sale>;
  let fixture: ComponentFixture<DataTableComponent<Sale>>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DataTableComponent] }).compileComponents();
    fixture = TestBed.createComponent(DataTableComponent<Sale>);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('data', DATA);
    fixture.componentRef.setInput('columns', [
      { accessorKey: 'region', header: 'Region' },
      { accessorKey: 'product', header: 'Product' },
      { accessorKey: 'sales', header: 'Sales' },
    ] as ColumnDef<Sale>[]);
    fixture.detectChanges();
  });

  it('pivots the table data via getPivot', () => {
    const result = component.getPivot({
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
