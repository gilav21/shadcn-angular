import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import {
  TableComponent,
  TableHeaderComponent,
  TableBodyComponent,
  TableRowComponent,
  TableHeadComponent,
  TableCellComponent,
} from './index';

/** Real-browser check: header alignment is computed style, which jsdom does not resolve. */
@Component({
  template: `
    <div [dir]="dir()">
      <ui-table>
        <ui-table-header>
          <ui-table-row>
            <ui-table-head>Invoice</ui-table-head>
          </ui-table-row>
        </ui-table-header>
      </ui-table>
    </div>
  `,
  imports: [TableComponent, TableHeaderComponent, TableRowComponent, TableHeadComponent],
})
class AlignHost {
  readonly dir = signal<'ltr' | 'rtl'>('ltr');
}

describe('Table head alignment (browser)', () => {
  it.each([
    { dir: 'ltr', align: 'left' },
    { dir: 'rtl', align: 'right' },
  ] as const)('aligns header text to the $align under dir="$dir"', ({ dir, align }) => {
    TestBed.configureTestingModule({ imports: [AlignHost] });
    const fixture = TestBed.createComponent(AlignHost);
    fixture.componentInstance.dir.set(dir);
    fixture.detectChanges();

    const head = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('[data-slot="table-head"]');
    expect(getComputedStyle(head!).textAlign).toBe(align);
  });
});

/** A standalone table narrower than its columns, with no scroll container of its own around it. */
@Component({
  template: `
    <div style="width: 320px">
      <ui-table>
        <ui-table-header>
          <ui-table-row>
            @for (col of columns; track col) {
              <ui-table-head style="width: 180px">{{ col }}</ui-table-head>
            }
          </ui-table-row>
        </ui-table-header>
        <ui-table-body>
          @for (invoice of invoices; track invoice) {
            <ui-table-row>
              @for (col of columns; track col) {
                <ui-table-cell style="width: 180px">{{ invoice }} {{ col }}</ui-table-cell>
              }
            </ui-table-row>
          }
        </ui-table-body>
      </ui-table>
    </div>
  `,
  imports: [TableComponent, TableHeaderComponent, TableBodyComponent, TableRowComponent, TableHeadComponent, TableCellComponent],
})
class WideTableHost {
  readonly columns = ['Invoice', 'Status', 'Method', 'Amount'];
  readonly invoices = ['INV001', 'INV002', 'INV003'];
}

describe('Table overflow (browser)', () => {
  it('scrolls its own columns horizontally when they are wider than the table', () => {
    TestBed.configureTestingModule({ imports: [WideTableHost] });
    const fixture = TestBed.createComponent(WideTableHost);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const table = host.querySelector<HTMLElement>('[data-slot="table"]')!;
    const cell = host.querySelector<HTMLElement>('ui-table-body ui-table-cell')!;

    const before = cell.getBoundingClientRect().left;
    table.scrollLeft = 200;

    expect(table.getBoundingClientRect().width).toBeCloseTo(320, 0);
    expect(table.scrollLeft).toBe(200);
    expect(before - cell.getBoundingClientRect().left).toBeCloseTo(200, 0);
  });
});
