import { Meta, StoryObj } from '@storybook/angular';
import {
  TableComponent,
  TableHeaderComponent,
  TableBodyComponent,
  TableFooterComponent,
  TableRowComponent,
  TableHeadComponent,
  TableCellComponent,
  TableCaptionComponent,
} from './table.component';
import { moduleMetadata } from '@storybook/angular';

const meta: Meta<TableComponent & { rtl: boolean }> = {
  title: 'UI/Table',
  component: TableComponent,
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({
      imports: [
        TableComponent,
        TableHeaderComponent,
        TableBodyComponent,
        TableFooterComponent,
        TableRowComponent,
        TableHeadComponent,
        TableCellComponent,
        TableCaptionComponent
      ],
    }),
  ],
  argTypes: {
    rtl: {
      control: 'boolean',
      description: 'Enable right-to-left layout',
    },
  },
  args: {
    rtl: false,
  },
};

export default meta;
type Story = StoryObj<TableComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: `
      <div [dir]="rtl ? 'rtl' : 'ltr'">
      <ui-table>
        <ui-table-caption>A list of your recent invoices.</ui-table-caption>
        <ui-table-header>
          <ui-table-row>
            <ui-table-head class="w-[100px]">Invoice</ui-table-head>
            <ui-table-head>Status</ui-table-head>
            <ui-table-head>Method</ui-table-head>
            <ui-table-head class="text-right">Amount</ui-table-head>
          </ui-table-row>
        </ui-table-header>
        <ui-table-body>
          <ui-table-row>
            <ui-table-cell class="font-medium">INV-001</ui-table-cell>
            <ui-table-cell>Paid</ui-table-cell>
            <ui-table-cell>Credit Card</ui-table-cell>
            <ui-table-cell class="text-right">$250.00</ui-table-cell>
          </ui-table-row>
          <ui-table-row>
            <ui-table-cell class="font-medium">INV-002</ui-table-cell>
            <ui-table-cell>Pending</ui-table-cell>
            <ui-table-cell>PayPal</ui-table-cell>
            <ui-table-cell class="text-right">$150.00</ui-table-cell>
          </ui-table-row>
          <ui-table-row>
            <ui-table-cell class="font-medium">INV-003</ui-table-cell>
            <ui-table-cell>Unpaid</ui-table-cell>
            <ui-table-cell>Bank Transfer</ui-table-cell>
            <ui-table-cell class="text-right">$350.00</ui-table-cell>
          </ui-table-row>
          <ui-table-row>
            <ui-table-cell class="font-medium">INV-004</ui-table-cell>
            <ui-table-cell>Paid</ui-table-cell>
            <ui-table-cell>Credit Card</ui-table-cell>
            <ui-table-cell class="text-right">$450.00</ui-table-cell>
          </ui-table-row>
          <ui-table-row>
            <ui-table-cell class="font-medium">INV-005</ui-table-cell>
            <ui-table-cell>Paid</ui-table-cell>
            <ui-table-cell>PayPal</ui-table-cell>
            <ui-table-cell class="text-right">$550.00</ui-table-cell>
          </ui-table-row>
          <ui-table-row>
            <ui-table-cell class="font-medium">INV-006</ui-table-cell>
            <ui-table-cell>Pending</ui-table-cell>
            <ui-table-cell>Bank Transfer</ui-table-cell>
            <ui-table-cell class="text-right">$200.00</ui-table-cell>
          </ui-table-row>
          <ui-table-row>
            <ui-table-cell class="font-medium">INV-007</ui-table-cell>
            <ui-table-cell>Unpaid</ui-table-cell>
            <ui-table-cell>Credit Card</ui-table-cell>
            <ui-table-cell class="text-right">$300.00</ui-table-cell>
          </ui-table-row>
        </ui-table-body>
        <ui-table-footer>
          <ui-table-row>
            <ui-table-cell colspan="3">Total</ui-table-cell>
            <ui-table-cell class="text-right">$2,500.00</ui-table-cell>
          </ui-table-row>
        </ui-table-footer>
      </ui-table>
      </div>
    `,
  }),
};
