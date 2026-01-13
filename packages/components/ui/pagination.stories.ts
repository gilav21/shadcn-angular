import { Meta, StoryObj } from '@storybook/angular';
import {
  PaginationComponent,
  PaginationContentComponent,
  PaginationItemComponent,
  PaginationLinkComponent,
  PaginationPreviousComponent,
  PaginationNextComponent,
  PaginationEllipsisComponent,
} from './pagination.component';
import { moduleMetadata } from '@storybook/angular';

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
  },
  args: {},
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
