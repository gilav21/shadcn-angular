import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  ButtonComponent,
  DropdownItem,
  DropdownMenuComponent,
  DropdownMenuContentComponent,
  DropdownMenuItemComponent,
  DropdownMenuLabelComponent,
  DropdownMenuSeparatorComponent,
  DropdownMenuSubComponent,
  DropdownMenuSubContentComponent,
  DropdownMenuSubTriggerComponent,
  DropdownMenuTriggerComponent,
} from '../../../../../packages/components/ui';

@Component({
  selector: 'app-dropdown-menu-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    DropdownMenuComponent,
    DropdownMenuContentComponent,
    DropdownMenuItemComponent,
    DropdownMenuLabelComponent,
    DropdownMenuSeparatorComponent,
    DropdownMenuSubComponent,
    DropdownMenuSubContentComponent,
    DropdownMenuSubTriggerComponent,
    DropdownMenuTriggerComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="dropdown-menu" class="text-2xl font-semibold scroll-m-20">Dropdown Menu</h2>
      <p class="text-muted-foreground">Displays a menu to the user — such as a set of actions or functions —
        triggered by a button.</p>

      <div class="flex flex-col gap-8">
        <!-- Simple Mode (Data-Driven) -->
        <div class="space-y-4">
          <h3 class="text-lg font-medium">Simple Mode (Data-Driven)</h3>
          <ui-dropdown-menu [items]="simpleDropdownItems">
            <ui-dropdown-menu-trigger>
              <ui-button variant="outline">Open Menu (Data)</ui-button>
            </ui-dropdown-menu-trigger>
          </ui-dropdown-menu>
        </div>

        <!-- Complex Mode (Template-Driven) -->
        <div class="space-y-4">
          <h3 class="text-lg font-medium">Complex Mode (Template-Driven)</h3>
          <ui-dropdown-menu>
            <ui-dropdown-menu-trigger>
              <ui-button variant="outline">Open Menu (Template)</ui-button>
            </ui-dropdown-menu-trigger>
            <ui-dropdown-menu-content class="w-56">
              <ui-dropdown-menu-label>My Account</ui-dropdown-menu-label>
              <ui-dropdown-menu-separator />
              <ui-dropdown-menu-item shortcut="\u21E7\u2318P">Profile</ui-dropdown-menu-item>
              <ui-dropdown-menu-item shortcut="\u2318B">Billing</ui-dropdown-menu-item>
              <ui-dropdown-menu-item shortcut="\u2318S">Settings</ui-dropdown-menu-item>
              <ui-dropdown-menu-item shortcut="\u2318K">Keyboard shortcuts</ui-dropdown-menu-item>
              <ui-dropdown-menu-separator />
              <ui-dropdown-menu-item>Team</ui-dropdown-menu-item>
              <ui-dropdown-menu-sub>
                <ui-dropdown-menu-sub-trigger>Invite users</ui-dropdown-menu-sub-trigger>
                <ui-dropdown-menu-sub-content>
                  <ui-dropdown-menu-item>Email</ui-dropdown-menu-item>
                  <ui-dropdown-menu-item>Message</ui-dropdown-menu-item>
                  <ui-dropdown-menu-separator />
                  <ui-dropdown-menu-item>More...</ui-dropdown-menu-item>
                </ui-dropdown-menu-sub-content>
              </ui-dropdown-menu-sub>
              <ui-dropdown-menu-item shortcut="\u2318+T">New Team</ui-dropdown-menu-item>
              <ui-dropdown-menu-separator />
              <ui-dropdown-menu-item>GitHub</ui-dropdown-menu-item>
              <ui-dropdown-menu-item>Support</ui-dropdown-menu-item>
              <ui-dropdown-menu-item [disabled]="true">API</ui-dropdown-menu-item>
              <ui-dropdown-menu-separator />
              <ui-dropdown-menu-item shortcut="\u21E7\u2318Q">Log out</ui-dropdown-menu-item>
            </ui-dropdown-menu-content>
          </ui-dropdown-menu>
        </div>
      </div>
    </section>
  `,
})
export class DropdownMenuDemoComponent {
  readonly simpleDropdownItems: DropdownItem[] = [
    { label: 'My Account', type: 'label' },
    { type: 'separator' },
    { label: 'Profile', shortcut: '\u21E7\u2318P' },
    { label: 'Billing', shortcut: '\u2318B' },
    { label: 'Settings', shortcut: '\u2318S' },
    { label: 'Keyboard shortcuts', shortcut: '\u2318K' },
    { type: 'separator' },
    { label: 'Team', type: 'label' },
    {
      label: 'Invite users', type: 'sub', children: [
        { label: 'Email', shortcut: '\u2318E' },
        { label: 'Message', shortcut: '\u2318M' },
        { type: 'separator' },
        {
          label: 'More', type: 'sub', children: [
            { label: 'Discord' },
            { label: 'Slack' },
          ],
        },
      ],
    },
    { type: 'separator' },
    { label: 'GitHub' },
    { label: 'Support' },
    { label: 'API' },
    { type: 'separator' },
    { label: 'Log out', shortcut: '\u21E7\u2318Q' },
  ];
}
