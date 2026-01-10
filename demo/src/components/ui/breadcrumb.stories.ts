import { Meta, StoryObj } from '@storybook/angular';
import {
  BreadcrumbComponent,
  BreadcrumbListComponent,
  BreadcrumbItemComponent,
  BreadcrumbLinkComponent,
  BreadcrumbPageComponent,
  BreadcrumbSeparatorComponent,
  BreadcrumbEllipsisComponent,
} from './breadcrumb.component';
import { moduleMetadata } from '@storybook/angular';

const meta: Meta<BreadcrumbComponent> = {
  title: 'UI/Breadcrumb',
  component: BreadcrumbComponent,
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({
      imports: [
        BreadcrumbComponent,
        BreadcrumbListComponent,
        BreadcrumbItemComponent,
        BreadcrumbLinkComponent,
        BreadcrumbPageComponent,
        BreadcrumbSeparatorComponent,
        BreadcrumbEllipsisComponent
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
type Story = StoryObj<BreadcrumbComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: `
      <ui-breadcrumb [rtl]="rtl">
        <ui-breadcrumb-list>
          <ui-breadcrumb-item>
            <ui-breadcrumb-link href="/">Home</ui-breadcrumb-link>
          </ui-breadcrumb-item>
          <ui-breadcrumb-separator />
          <ui-breadcrumb-item>
            <ui-breadcrumb-link href="/components">Components</ui-breadcrumb-link>
          </ui-breadcrumb-item>
          <ui-breadcrumb-separator />
          <ui-breadcrumb-item>
            <ui-breadcrumb-page>Breadcrumb</ui-breadcrumb-page>
          </ui-breadcrumb-item>
        </ui-breadcrumb-list>
      </ui-breadcrumb>
    `,
  }),
};

export const CustomSeparator: Story = {
  render: (args) => ({
    props: args,
    template: `
        <ui-breadcrumb [rtl]="rtl">
          <ui-breadcrumb-list>
            <ui-breadcrumb-item>
              <ui-breadcrumb-link href="/">Home</ui-breadcrumb-link>
            </ui-breadcrumb-item>
            <ui-breadcrumb-separator>/</ui-breadcrumb-separator>
            <ui-breadcrumb-item>
              <ui-breadcrumb-link href="/components">Components</ui-breadcrumb-link>
            </ui-breadcrumb-item>
            <ui-breadcrumb-separator>/</ui-breadcrumb-separator>
            <ui-breadcrumb-item>
              <ui-breadcrumb-page>Breadcrumb</ui-breadcrumb-page>
            </ui-breadcrumb-item>
          </ui-breadcrumb-list>
        </ui-breadcrumb>
      `,
  }),
};

export const WithEllipsis: Story = {
  render: (args) => ({
    props: args,
    template: `
      <ui-breadcrumb [rtl]="rtl">
        <ui-breadcrumb-list>
          <ui-breadcrumb-item>
            <ui-breadcrumb-link href="/">Home</ui-breadcrumb-link>
          </ui-breadcrumb-item>
          <ui-breadcrumb-separator />
          <ui-breadcrumb-item>
            <ui-breadcrumb-ellipsis />
          </ui-breadcrumb-item>
          <ui-breadcrumb-separator />
          <ui-breadcrumb-item>
            <ui-breadcrumb-link href="/components">Components</ui-breadcrumb-link>
          </ui-breadcrumb-item>
          <ui-breadcrumb-separator />
          <ui-breadcrumb-item>
            <ui-breadcrumb-page>Breadcrumb</ui-breadcrumb-page>
          </ui-breadcrumb-item>
        </ui-breadcrumb-list>
      </ui-breadcrumb>
    `,
  }),
};
