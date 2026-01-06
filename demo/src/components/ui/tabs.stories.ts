import { Meta, StoryObj } from '@storybook/angular';
import {
  TabsComponent,
  TabsListComponent,
  TabsTriggerComponent,
  TabsContentComponent,
} from './tabs.component';
import { moduleMetadata } from '@storybook/angular';
import { ButtonComponent } from './button.component';
import { CardComponent, CardHeaderComponent, CardTitleComponent, CardDescriptionComponent, CardContentComponent, CardFooterComponent } from './card.component';
import { LabelComponent } from './label.component';
import { InputComponent } from './input.component';

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
    defaultValue: { control: 'text' },
  },
  args: {
    defaultValue: 'account',
  },
};

export default meta;
type Story = StoryObj<TabsComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: `
      <ui-tabs [defaultValue]="defaultValue" class="w-[400px]">
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
  }),
};
