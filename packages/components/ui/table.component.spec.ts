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
} from './table.component';

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
        const table = fixture.debugElement.query(By.css('table'));
        expect(table.nativeElement.classList.contains('my-custom-table')).toBe(true);
        expect(table.nativeElement.classList.contains('w-full')).toBe(true);
    });

    it('should handle selected row state', () => {
        host.selectedRow = true;
        fixture.detectChanges();

        // Find row in body
        const body = fixture.debugElement.query(By.directive(TableBodyComponent));
        const row = body.query(By.directive(TableRowComponent));

        // Find row inside the component (host is display: contents)
        const tr = row.query(By.css('tr'));

        expect(tr.nativeElement.getAttribute('data-state')).toBe('selected');
        expect(tr.nativeElement.classList.contains('data-[state=selected]:bg-muted')).toBe(true);
    });

    it('should render correct HTML structure', () => {
        fixture.detectChanges();
        const table = fixture.nativeElement.querySelector('table');
        expect(table).toBeTruthy();
        expect(table.querySelector('caption')).toBeTruthy();
        expect(table.querySelector('thead')).toBeTruthy();
        expect(table.querySelector('tbody')).toBeTruthy();
        expect(table.querySelector('tfoot')).toBeTruthy();
        expect(table.querySelector('tr')).toBeTruthy();
        expect(table.querySelector('th')).toBeTruthy();
        expect(table.querySelector('td')).toBeTruthy();
    });

    it('should apply RTL text alignment classes to table head', async () => {
        // TableHeadComponent has 'ltr:text-left rtl:text-right'

        host.dir.set('rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const head = fixture.debugElement.query(By.directive(TableHeadComponent));
        // The component host is ui-table-head (display: contents)
        // The styles are on the <th> element inside
        const th = head.query(By.css('th'));
        const classes = th.nativeElement.className;

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
