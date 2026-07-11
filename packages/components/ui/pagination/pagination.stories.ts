import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import {
  PaginationComponent,
  PaginationContentComponent,
  PaginationItemComponent,
  PaginationLinkComponent,
  PaginationPreviousComponent,
  PaginationNextComponent,
  PaginationEllipsisComponent,
} from './index';

const meta: Meta<PaginationComponent> = {
  title: 'UI/Pagination',
  component: PaginationComponent,
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({
      imports: [
        PaginationComponent,
        PaginationContentComponent,
        PaginationItemComponent,
        PaginationLinkComponent,
        PaginationPreviousComponent,
        PaginationNextComponent,
        PaginationEllipsisComponent
      ],
    }),
  ],
  argTypes: {
    currentPage: { control: 'number', description: 'Currently active page (simple mode). `0` disables simple mode and renders projected content.' },
    totalPages: { control: 'number', description: 'Total number of pages (simple mode).' },
    siblingCount: { control: 'number', description: 'Number of sibling page links shown around the current page before collapsing into an ellipsis.' },
    class: { control: 'text', description: 'Extra classes merged onto the `<nav>`.' },
    locale: { control: 'text', description: 'Locale dictionary key (e.g. `\'en\'`, `\'he\'`) or an inline `PaginationLocale` object. Falls back to the app-wide locale.' },
  },
  args: {
    currentPage: 1,
    totalPages: 10,
    siblingCount: 1,
    class: '',
  },
};

export default meta;
type Story = StoryObj<PaginationComponent>;

const TEMPLATE = `<ui-pagination [currentPage]="currentPage" [totalPages]="totalPages" [siblingCount]="siblingCount" [class]="class" [locale]="locale"></ui-pagination>`;

const render: NonNullable<Story['render']> = (args) => ({
  props: args,
  template: TEMPLATE,
});

/** Interactive playground — simple/data-driven mode with every input wired to the Controls panel. */
export const Playground: Story = { render };

export const TemplateMode: Story = {
  args: { currentPage: 0, totalPages: 0 },
  render: (args) => ({
    props: args,
    template: `
      <ui-pagination [class]="class">
        <ui-pagination-content>
          <ui-pagination-item>
            <ui-pagination-previous href="#" />
          </ui-pagination-item>
          <ui-pagination-item>
            <ui-pagination-link href="#">1</ui-pagination-link>
          </ui-pagination-item>
          <ui-pagination-item>
            <ui-pagination-link href="#" isActive>2</ui-pagination-link>
          </ui-pagination-item>
          <ui-pagination-item>
            <ui-pagination-link href="#">3</ui-pagination-link>
          </ui-pagination-item>
          <ui-pagination-item>
            <ui-pagination-ellipsis />
          </ui-pagination-item>
          <ui-pagination-item>
            <ui-pagination-next href="#" />
          </ui-pagination-item>
        </ui-pagination-content>
      </ui-pagination>
    `,
  }),
};

export const DataDriven: Story = { render };

export const ManySiblings: Story = {
  args: { currentPage: 10, totalPages: 30, siblingCount: 3 },
  render,
};

export const FewPages: Story = {
  args: { currentPage: 2, totalPages: 3 },
  render,
};

export const RTLLocale: Story = {
  args: { currentPage: 3, totalPages: 10, locale: 'he' },
  render,
};
