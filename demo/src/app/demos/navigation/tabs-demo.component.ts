import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ButtonComponent,
  CardComponent,
  CardContentComponent,
  CardDescriptionComponent,
  CardHeaderComponent,
  CardTitleComponent,
  InputComponent,
  LabelComponent,
  TabsComponent,
  TabsContentComponent,
  TabsListComponent,
  TabsTriggerComponent,
} from '../../../../../packages/components/ui';

@Component({
  selector: 'app-tabs-helper',
  imports: [
    CardComponent,
    CardHeaderComponent,
    CardTitleComponent,
    CardDescriptionComponent,
    CardContentComponent,
    ButtonComponent,
    InputComponent,
    LabelComponent,
    FormsModule,
  ],
  template: `
    <ui-card>
      <ui-card-header>
        <ui-card-title>Account Settings</ui-card-title>
        <ui-card-description>Manage your account settings and preferences.</ui-card-description>
      </ui-card-header>
      <ui-card-content class="space-y-2">
        <div class="space-y-1">
          <ui-label>Username</ui-label>
          <ui-input [ngModel]="username()" readonly />
        </div>
        <div class="space-y-1">
          <ui-label>Email</ui-label>
          <ui-input ngModel="user@example.com" />
        </div>
        <ui-button class="mt-4">Save Changes</ui-button>
      </ui-card-content>
    </ui-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabsHelperComponent {
  readonly username = input<string>('johndoe');
}

@Component({
  selector: 'app-tabs-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TabsComponent,
    TabsListComponent,
    TabsTriggerComponent,
    TabsContentComponent,
    CardComponent,
    CardHeaderComponent,
    CardTitleComponent,
    CardDescriptionComponent,
    CardContentComponent,
    InputComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="tabs" class="text-2xl font-semibold scroll-m-20">Tabs</h2>
      <p class="text-muted-foreground">Tab navigation component.</p>

      <ui-tabs defaultValue="account" class="max-w-md">
        <ui-tabs-list>
          <ui-tabs-trigger value="account">Account</ui-tabs-trigger>
          <ui-tabs-trigger value="password">Password</ui-tabs-trigger>
          <ui-tabs-trigger value="settings">Settings</ui-tabs-trigger>
        </ui-tabs-list>
        <ui-tabs-content value="account">
          <ui-card>
            <ui-card-header>
              <ui-card-title>Account</ui-card-title>
              <ui-card-description>Make changes to your account here.</ui-card-description>
            </ui-card-header>
            <ui-card-content>
              <ui-input placeholder="Your name" />
            </ui-card-content>
          </ui-card>
        </ui-tabs-content>
        <ui-tabs-content value="password">
          <ui-card>
            <ui-card-header>
              <ui-card-title>Password</ui-card-title>
              <ui-card-description>Change your password here.</ui-card-description>
            </ui-card-header>
            <ui-card-content>
              <ui-input type="password" placeholder="New password" />
            </ui-card-content>
          </ui-card>
        </ui-tabs-content>
        <ui-tabs-content value="settings">
          <ui-card>
            <ui-card-header>
              <ui-card-title>Settings</ui-card-title>
              <ui-card-description>Configure your preferences.</ui-card-description>
            </ui-card-header>
          </ui-card>
        </ui-tabs-content>
      </ui-tabs>

      <h3 class="text-lg font-medium mt-8">Simple Mode (Data-driven)</h3>
      <p class="text-muted-foreground text-sm mb-4">Using tabs input array instead of content projection.</p>
      <ui-tabs class="max-w-md" [tabs]="[
        { value: 'overview', label: 'Overview', content: 'This is the overview tab content.' },
        { value: 'features', label: 'Features', content: 'These are the features of the product.' },
        { value: 'pricing', label: 'Pricing', content: 'Check out our pricing plans.' }
      ]" />

      <h3 class="text-lg font-medium mt-8">Complex Mode (Components)</h3>
      <p class="text-muted-foreground text-sm mb-4">Rendering components and passing context data in tabs.</p>
      <ui-tabs class="max-w-md" [tabs]="complexTabs" />
    </section>
  `,
})
export class TabsDemoComponent {
  readonly complexTabs = [
    { value: 'account', label: 'Account', content: 'Make changes to your account here. Click save when you\'re done.' },
    { value: 'password', label: 'Password', content: 'Change your password here. After saving, you\'ll be logged out.' },
    { value: 'settings', label: 'Settings', content: TabsHelperComponent, contentContext: { username: 'shadcn' } },
  ];
}
