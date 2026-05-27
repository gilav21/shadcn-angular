import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  TableBodyComponent,
  TableCaptionComponent,
  TableCellComponent,
  TableComponent,
  TableHeadComponent,
  TableHeaderComponent,
  TableRowComponent,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { TABLE_DEMO_LOCALES } from './table-demo.locales';

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
      <h2 id="table" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <ui-table>
        <ui-table-caption>{{ t().caption }}</ui-table-caption>
        <ui-table-header>
          <ui-table-row>
            <ui-table-head class="w-[100px] flex-none">{{ t().colInvoice }}</ui-table-head>
            <ui-table-head>{{ t().colStatus }}</ui-table-head>
            <ui-table-head>{{ t().colMethod }}</ui-table-head>
            <ui-table-head class="text-right w-[100px] flex-none">{{ t().colAmount }}</ui-table-head>
          </ui-table-row>
        </ui-table-header>
        <ui-table-body>
          <ui-table-row>
            <ui-table-cell class="font-medium w-[100px] flex-none">INV001</ui-table-cell>
            <ui-table-cell>{{ t().statusPaid }}</ui-table-cell>
            <ui-table-cell>{{ t().methodCreditCard }}</ui-table-cell>
            <ui-table-cell class="text-right w-[100px] flex-none">$250.00</ui-table-cell>
          </ui-table-row>
          <ui-table-row>
            <ui-table-cell class="font-medium w-[100px] flex-none">INV002</ui-table-cell>
            <ui-table-cell>{{ t().statusPending }}</ui-table-cell>
            <ui-table-cell>{{ t().methodPayPal }}</ui-table-cell>
            <ui-table-cell class="text-right w-[100px] flex-none">$150.00</ui-table-cell>
          </ui-table-row>
          <ui-table-row>
            <ui-table-cell class="font-medium w-[100px] flex-none">INV003</ui-table-cell>
            <ui-table-cell>{{ t().statusUnpaid }}</ui-table-cell>
            <ui-table-cell>{{ t().methodBankTransfer }}</ui-table-cell>
            <ui-table-cell class="text-right w-[100px] flex-none">$350.00</ui-table-cell>
          </ui-table-row>
        </ui-table-body>
      </ui-table>
    </section>
  `,
})
export class TableDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  readonly t = computed(() => TABLE_DEMO_LOCALES[this.localeId()] ?? TABLE_DEMO_LOCALES['en']);
}
