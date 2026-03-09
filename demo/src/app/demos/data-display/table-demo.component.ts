import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  TableBodyComponent,
  TableCaptionComponent,
  TableCellComponent,
  TableComponent,
  TableHeadComponent,
  TableHeaderComponent,
  TableRowComponent,
} from '../../../../../packages/components/ui';

@Component({
  selector: 'app-table-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TableComponent,
    TableCaptionComponent,
    TableHeaderComponent,
    TableRowComponent,
    TableHeadComponent,
    TableBodyComponent,
    TableCellComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="table" class="text-2xl font-semibold scroll-m-20">Table</h2>
      <p class="text-muted-foreground">A responsive table component.</p>

      <ui-table>
        <ui-table-caption>A list of your recent invoices.</ui-table-caption>
        <ui-table-header>
          <ui-table-row>
            <ui-table-head class="w-[100px] flex-none">Invoice</ui-table-head>
            <ui-table-head>Status</ui-table-head>
            <ui-table-head>Method</ui-table-head>
            <ui-table-head class="text-right w-[100px] flex-none">Amount</ui-table-head>
          </ui-table-row>
        </ui-table-header>
        <ui-table-body>
          <ui-table-row>
            <ui-table-cell class="font-medium w-[100px] flex-none">INV001</ui-table-cell>
            <ui-table-cell>Paid</ui-table-cell>
            <ui-table-cell>Credit Card</ui-table-cell>
            <ui-table-cell class="text-right w-[100px] flex-none">$250.00</ui-table-cell>
          </ui-table-row>
          <ui-table-row>
            <ui-table-cell class="font-medium w-[100px] flex-none">INV002</ui-table-cell>
            <ui-table-cell>Pending</ui-table-cell>
            <ui-table-cell>PayPal</ui-table-cell>
            <ui-table-cell class="text-right w-[100px] flex-none">$150.00</ui-table-cell>
          </ui-table-row>
          <ui-table-row>
            <ui-table-cell class="font-medium w-[100px] flex-none">INV003</ui-table-cell>
            <ui-table-cell>Unpaid</ui-table-cell>
            <ui-table-cell>Bank Transfer</ui-table-cell>
            <ui-table-cell class="text-right w-[100px] flex-none">$350.00</ui-table-cell>
          </ui-table-row>
        </ui-table-body>
      </ui-table>
    </section>
  `,
})
export class TableDemoComponent {}
