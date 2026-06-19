import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  TableComponent,
  TableHeaderComponent,
  TableBodyComponent,
  TableFooterComponent,
  TableRowComponent,
  TableHeadComponent,
  TableCellComponent,
  TableCaptionComponent
} from './index';

@Component({
  template: `
    <div [dir]="dir()">
      <ui-table [class]="customClass">
        <ui-table-caption>List of Invoices</ui-table-caption>
        <ui-table-header>
          <ui-table-row>
            <ui-table-head>Invoice</ui-table-head>
            <ui-table-head>Status</ui-table-head>
            <ui-table-head>Amount</ui-table-head>
          </ui-table-row>
        </ui-table-header>
        <ui-table-body>
          <ui-table-row [selected]="selectedRow">
            <ui-table-cell>INV001</ui-table-cell>
            <ui-table-cell>Paid</ui-table-cell>
            <ui-table-cell>$250.00</ui-table-cell>
          </ui-table-row>
        </ui-table-body>
        <ui-table-footer>
          <ui-table-row>
            <ui-table-cell>Total</ui-table-cell>
            <ui-table-cell></ui-table-cell>
            <ui-table-cell>$250.00</ui-table-cell>
          </ui-table-row>
        </ui-table-footer>
      </ui-table>
    </div>
  `,
  imports: [
    TableComponent,
    TableHeaderComponent,
    TableBodyComponent,
    TableFooterComponent,
    TableRowComponent,
    TableHeadComponent,
    TableCellComponent,
    TableCaptionComponent
  ]
})
class TestHostComponent {
  customClass = '';
  selectedRow = false;
  dir = signal<'ltr' | 'rtl'>('ltr');
}

describe('TableComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        TestHostComponent,
        TableComponent,
        TableHeaderComponent,
        TableBodyComponent,
        TableFooterComponent,
        TableRowComponent,
        TableHeadComponent,
        TableCellComponent,
        TableCaptionComponent
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    // fixture.detectChanges(); // Removed to prevent NG0100
  });

  it('should create all table parts', () => {
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.directive(TableComponent))).toBeTruthy();
    expect(fixture.debugElement.query(By.directive(TableHeaderComponent))).toBeTruthy();
    expect(fixture.debugElement.query(By.directive(TableBodyComponent))).toBeTruthy();
    expect(fixture.debugElement.query(By.directive(TableFooterComponent))).toBeTruthy();
    expect(fixture.debugElement.query(By.directive(TableRowComponent))).toBeTruthy();
    expect(fixture.debugElement.query(By.directive(TableHeadComponent))).toBeTruthy();
    expect(fixture.debugElement.query(By.directive(TableCellComponent))).toBeTruthy();
    expect(fixture.debugElement.query(By.directive(TableCaptionComponent))).toBeTruthy();
  });

  it('should apply custom classes to table', () => {
    host.customClass = 'my-custom-table';
    fixture.detectChanges();
    const table = fixture.debugElement.query(By.directive(TableComponent));
    // The classes are applied to the inner div
    const innerDiv = table.query(By.css('[data-slot="table"]'));
    expect(innerDiv.nativeElement.classList.contains('my-custom-table')).toBe(true);
    expect(innerDiv.nativeElement.classList.contains('w-full')).toBe(true);
  });

  it('should handle selected row state', () => {
    host.selectedRow = true;
    fixture.detectChanges();

    // Find row in body
    const body = fixture.debugElement.query(By.directive(TableBodyComponent));
    const row = body.query(By.directive(TableRowComponent));

    expect(row.nativeElement.dataset.state).toBe('selected');
    expect(row.nativeElement.classList.contains('data-[state=selected]:bg-muted')).toBe(true);
  });

  it('should render correct ARIA structure', () => {
    fixture.detectChanges();
    // Check for ARIA roles since it uses divs
    const header = fixture.debugElement.query(By.directive(TableHeaderComponent));
    expect(header.nativeElement.getAttribute('role')).toBe('rowgroup');

    const body = fixture.debugElement.query(By.directive(TableBodyComponent));
    expect(body.nativeElement.getAttribute('role')).toBe('rowgroup');

    const row = fixture.debugElement.query(By.directive(TableRowComponent));
    expect(row.nativeElement.getAttribute('role')).toBe('row');

    const cell = fixture.debugElement.query(By.directive(TableCellComponent));
    expect(cell.nativeElement.getAttribute('role')).toBe('cell');

    const headCell = fixture.debugElement.query(By.directive(TableHeadComponent));
    expect(headCell.nativeElement.getAttribute('role')).toBe('columnheader');
  });

  it('should apply RTL text alignment classes to table head', async () => {
    // TableHeadComponent has 'ltr:text-left rtl:text-right'

    host.dir.set('rtl');
    fixture.detectChanges();
    await fixture.whenStable();

    const head = fixture.debugElement.query(By.directive(TableHeadComponent));
    // The host element itself has the classes
    const classes = head.nativeElement.className;

    expect(classes).toContain('ltr:text-left');
    expect(classes).toContain('rtl:text-right');
  });

  it('should apply data-slot attributes', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-slot="table"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-slot="table-header"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-slot="table-body"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-slot="table-footer"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-slot="table-row"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-slot="table-head"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-slot="table-cell"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-slot="table-caption"]')).toBeTruthy();
  });
});

describe('TableBodyComponent Skeleton Mode', () => {
  let fixture: ComponentFixture<TableBodyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TableBodyComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TableBodyComponent);
    fixture.componentRef.setInput('skeleton', true);
    fixture.detectChanges();
  });

  it('should render 5 skeleton rows by default', () => {
    const rows = fixture.debugElement.queryAll(By.css('[data-slot="table-row"]'));
    expect(rows).toHaveLength(5);
    expect(fixture.debugElement.queryAll(By.css('ui-skeleton'))).toHaveLength(5);
  });

  it('should honor skeletonRows', () => {
    fixture.componentRef.setInput('skeletonRows', 2);
    fixture.detectChanges();
    expect(fixture.debugElement.queryAll(By.css('[data-slot="table-row"]'))).toHaveLength(2);
  });
});
