import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import {
  PaginationComponent,
  PaginationContentComponent,
  PaginationItemComponent,
  PaginationLinkComponent,
  PaginationPreviousComponent,
  PaginationNextComponent,
  PaginationEllipsisComponent,
} from './pagination.component';

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
    currentPage: { control: 'number' },
    totalPages: { control: 'number' },
    siblingCount: { control: 'number' },
  },
  args: {
    currentPage: 1,
    totalPages: 10,
    siblingCount: 1,
  },
};

export default meta;
type Story = StoryObj<PaginationComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: `
      <ui-pagination>
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

export const DataDriven: Story = {
  render: (args) => ({
    props: args,
    template: `<ui-pagination [currentPage]="currentPage" [totalPages]="totalPages" [siblingCount]="siblingCount"></ui-pagination>`,
  }),
};
