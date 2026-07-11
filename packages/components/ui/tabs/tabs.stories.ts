import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import {
  TabsComponent,
  TabsListComponent,
  TabsTriggerComponent,
  TabsContentComponent,
} from './index';
import { ButtonComponent } from '../button';
import { CardComponent, CardHeaderComponent, CardTitleComponent, CardDescriptionComponent, CardContentComponent, CardFooterComponent } from '../card';
import { LabelComponent } from '../label';
import { InputComponent } from '../input';

const DEMO_TABS = [
  { value: 'overview', label: 'Overview', content: 'A high-level summary of your project status.' },
  { value: 'analytics', label: 'Analytics', content: 'Charts and metrics tracking usage over time.' },
  { value: 'settings', label: 'Settings', content: 'Manage preferences and integrations.', disabled: true },
];

const meta: Meta<TabsComponent> = {
  title: 'UI/Tabs',
  component: TabsComponent,
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({
      imports: [
        TabsComponent,
        TabsListComponent,
        TabsTriggerComponent,
        TabsContentComponent,
        ButtonComponent,
        CardComponent,
        CardHeaderComponent,
        CardTitleComponent,
        CardDescriptionComponent,
        CardContentComponent,
        CardFooterComponent,
        LabelComponent,
        InputComponent
      ],
    }),
  ],
  argTypes: {
    defaultValue: { control: 'text', description: 'Value of the tab selected by default.' },
    tabs: {
      control: 'object',
      description: 'Simple mode: array of { value, label, content, disabled } tabs rendered without projected content.',
    },
    class: { control: 'text', description: 'Extra classes merged onto the host.' },
  },
  args: {
    defaultValue: 'account',
    tabs: [],
    class: 'w-full sm:w-[400px]',
  },
};

export default meta;
type Story = StoryObj<TabsComponent>;

const render: NonNullable<Story['render']> = (args) => ({
  props: args,
  template: `
      <ui-tabs [defaultValue]="defaultValue" [tabs]="tabs" [class]="class">
        <ui-tabs-list class="grid w-full grid-cols-2" ariaLabel="Account options">
          <ui-tabs-trigger value="account">Account</ui-tabs-trigger>
          <ui-tabs-trigger value="password">Password</ui-tabs-trigger>
        </ui-tabs-list>
        <ui-tabs-content value="account">
          <ui-card>
            <ui-card-header>
              <ui-card-title>Account</ui-card-title>
              <ui-card-description>
                Make changes to your account here. Click save when you're done.
              </ui-card-description>
            </ui-card-header>
            <ui-card-content class="space-y-2">
              <div>
              This is the account content.
              </div>
            </ui-card-content>
            <ui-card-footer>
              <ui-button>Save changes</ui-button>
            </ui-card-footer>
          </ui-card>
        </ui-tabs-content>
        <ui-tabs-content value="password">
          <ui-card>
            <ui-card-header>
              <ui-card-title>Password</ui-card-title>
              <ui-card-description>
                Change your password here. After saving, you'll be logged out.
              </ui-card-description>
            </ui-card-header>
            <ui-card-content class="space-y-2">
              <div class="space-y-1">
                <ui-label for="current">Current password</ui-label>
                <ui-input id="current" type="password" />
              </div>
              <div class="space-y-1">
                <ui-label for="new">New password</ui-label>
                <ui-input id="new" type="password" />
              </div>
            </ui-card-content>
            <ui-card-footer>
              <ui-button>Save password</ui-button>
            </ui-card-footer>
          </ui-card>
        </ui-tabs-content>
      </ui-tabs>
    `,
});

/** Interactive playground — every input is wired to the Controls panel (template-composition mode). */
export const Playground: Story = { render };

export const Default: Story = {
  render,
};

export const SimpleMode: Story = {
  name: 'Simple Mode (tabs input)',
  render: () => ({
    props: { tabs: DEMO_TABS },
    template: `
      <div class="space-y-2 w-full sm:w-[400px]">
        <p class="text-sm text-muted-foreground">Data-driven mode: pass a <code>tabs</code> array instead of projecting <code>ui-tabs-list</code>/<code>ui-tabs-content</code>.</p>
        <ui-tabs [tabs]="tabs" defaultValue="overview"></ui-tabs>
      </div>`,
  }),
};

export const RTL: Story = {
  render: () => ({
    props: {},
    template: `
      <div dir="rtl">
        <ui-tabs defaultValue="account" class="w-full sm:w-[400px]">
          <ui-tabs-list class="grid w-full grid-cols-2" ariaLabel="خيارات الحساب">
            <ui-tabs-trigger value="account">الحساب</ui-tabs-trigger>
            <ui-tabs-trigger value="password">كلمة المرور</ui-tabs-trigger>
          </ui-tabs-list>
          <ui-tabs-content value="account">
            <p class="text-sm p-4">محتوى الحساب.</p>
          </ui-tabs-content>
          <ui-tabs-content value="password">
            <p class="text-sm p-4">محتوى كلمة المرور.</p>
          </ui-tabs-content>
        </ui-tabs>
      </div>`,
  }),
};
