import { Meta, StoryObj } from '@storybook/angular';
import {
  DropdownMenuComponent,
  DropdownMenuTriggerComponent,
  DropdownMenuContentComponent,
  DropdownMenuItemComponent,
  DropdownMenuSeparatorComponent,
  DropdownMenuLabelComponent,
  DropdownMenuSubComponent,
  DropdownMenuSubTriggerComponent,
  DropdownMenuSubContentComponent,
} from './dropdown-menu.component';
import { ButtonComponent } from './button.component';
import { moduleMetadata } from '@storybook/angular';

const meta: Meta<DropdownMenuComponent> = {
  title: 'UI/DropdownMenu',
  component: DropdownMenuComponent,
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({
      imports: [
        DropdownMenuComponent,
        DropdownMenuTriggerComponent,
        DropdownMenuContentComponent,
        DropdownMenuItemComponent,
        DropdownMenuSeparatorComponent,
        DropdownMenuLabelComponent,
        DropdownMenuSubComponent,
        DropdownMenuSubTriggerComponent,
        DropdownMenuSubContentComponent,
        ButtonComponent
      ],
    }),
  ],
};

export default meta;
type Story = StoryObj<DropdownMenuComponent & { rtl: boolean }>;

export const Default: Story = {
  argTypes: {
    rtl: {
      control: 'boolean',
    },
  },
  render: (args) => ({
    props: args,
    template: `
      <ui-dropdown-menu [rtl]="rtl">
        <ui-dropdown-menu-trigger>
          <ui-button variant="outline">Open Menu</ui-button>  
        </ui-dropdown-menu-trigger>
        <ui-dropdown-menu-content class="w-56">
          <ui-dropdown-menu-label>My Account</ui-dropdown-menu-label>
          <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
          <ui-dropdown-menu-item>
            <span>Profile</span>
            <span class="ml-auto text-xs tracking-widest opacity-60">⇧⌘P</span>
          </ui-dropdown-menu-item>
          <ui-dropdown-menu-item>
            <span>Billing</span>
            <span class="ml-auto text-xs tracking-widest opacity-60">⌘B</span>
          </ui-dropdown-menu-item>
          <ui-dropdown-menu-item>
            <span>Settings</span>
            <span class="ml-auto text-xs tracking-widest opacity-60">⌘S</span>
          </ui-dropdown-menu-item>
          <ui-dropdown-menu-item>
            <span>Keyboard shortcuts</span>
            <span class="ml-auto text-xs tracking-widest opacity-60">⌘K</span>
          </ui-dropdown-menu-item>
          <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
          <ui-dropdown-menu-item>
            <span>Team</span>
          </ui-dropdown-menu-item>
          <ui-dropdown-menu-sub>
            <ui-dropdown-menu-sub-trigger>
              <span>Invite users</span>
            </ui-dropdown-menu-sub-trigger>
            <ui-dropdown-menu-sub-content>
              <ui-dropdown-menu-item>
                <span>Email</span>
              </ui-dropdown-menu-item>
              <ui-dropdown-menu-item>
                <span>Message</span>
              </ui-dropdown-menu-item>
              <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
              <ui-dropdown-menu-item>
                <span>More...</span>
              </ui-dropdown-menu-item>
            </ui-dropdown-menu-sub-content>
          </ui-dropdown-menu-sub>
          <ui-dropdown-menu-item [disabled]="true">
            <span>New Team</span>
            <span class="ml-auto text-xs tracking-widest opacity-60">⌘+T</span>
          </ui-dropdown-menu-item>
          <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
          <ui-dropdown-menu-item>
            <span>GitHub</span>
          </ui-dropdown-menu-item>
          <ui-dropdown-menu-item>
            <span>Support</span>
          </ui-dropdown-menu-item>
          <ui-dropdown-menu-item [disabled]="true">
            <span>API</span>
          </ui-dropdown-menu-item>
          <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
          <ui-dropdown-menu-item>
            <span>Log out</span>
            <span class="ml-auto text-xs tracking-widest opacity-60">⇧⌘Q</span>
          </ui-dropdown-menu-item>
        </ui-dropdown-menu-content>
      </ui-dropdown-menu>
    `,
  }),
};
