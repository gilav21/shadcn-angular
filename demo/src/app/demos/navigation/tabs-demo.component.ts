import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
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
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { TABS_DEMO_LOCALES } from './tabs-demo.locales';

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
        <ui-card-title>{{ cardTitle() }}</ui-card-title>
        <ui-card-description>{{ cardDesc() }}</ui-card-description>
      </ui-card-header>
      <ui-card-content class="space-y-2">
        <div class="space-y-1">
          <ui-label>{{ usernameLabel() }}</ui-label>
          <ui-input [ngModel]="username()" readonly />
        </div>
        <div class="space-y-1">
          <ui-label>{{ emailLabel() }}</ui-label>
          <ui-input ngModel="user@example.com" />
        </div>
        <ui-button class="mt-4">{{ saveBtn() }}</ui-button>
      </ui-card-content>
    </ui-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabsHelperComponent {
  readonly username = input<string>('johndoe');
  readonly cardTitle = input<string>('Account Settings');
  readonly cardDesc = input<string>('Manage your account settings and preferences.');
  readonly usernameLabel = input<string>('Username');
  readonly emailLabel = input<string>('Email');
  readonly saveBtn = input<string>('Save Changes');
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
      <h2 id="tabs" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <ui-tabs defaultValue="account" class="max-w-md">
        <ui-tabs-list>
          <ui-tabs-trigger value="account">{{ t().tabAccount }}</ui-tabs-trigger>
          <ui-tabs-trigger value="password">{{ t().tabPassword }}</ui-tabs-trigger>
          <ui-tabs-trigger value="settings">{{ t().tabSettings }}</ui-tabs-trigger>
        </ui-tabs-list>
        <ui-tabs-content value="account">
          <ui-card>
            <ui-card-header>
              <ui-card-title>{{ t().accountCardTitle }}</ui-card-title>
              <ui-card-description>{{ t().accountCardDesc }}</ui-card-description>
            </ui-card-header>
            <ui-card-content>
              <ui-input [placeholder]="t().accountInputPlaceholder" />
            </ui-card-content>
          </ui-card>
        </ui-tabs-content>
        <ui-tabs-content value="password">
          <ui-card>
            <ui-card-header>
              <ui-card-title>{{ t().passwordCardTitle }}</ui-card-title>
              <ui-card-description>{{ t().passwordCardDesc }}</ui-card-description>
            </ui-card-header>
            <ui-card-content>
              <ui-input type="password" [placeholder]="t().passwordInputPlaceholder" />
            </ui-card-content>
          </ui-card>
        </ui-tabs-content>
        <ui-tabs-content value="settings">
          <ui-card>
            <ui-card-header>
              <ui-card-title>{{ t().settingsCardTitle }}</ui-card-title>
              <ui-card-description>{{ t().settingsCardDesc }}</ui-card-description>
            </ui-card-header>
          </ui-card>
        </ui-tabs-content>
      </ui-tabs>

      <h3 class="text-lg font-medium mt-8">{{ t().simpleHeading }}</h3>
      <p class="text-muted-foreground text-sm mb-4">{{ t().simpleDesc }}</p>
      <ui-tabs class="max-w-md" [tabs]="simpleTabs()" />

      <h3 class="text-lg font-medium mt-8">{{ t().complexHeading }}</h3>
      <p class="text-muted-foreground text-sm mb-4">{{ t().complexDesc }}</p>
      <ui-tabs class="max-w-md" [tabs]="complexTabs()" />
    </section>
  `,
})
export class TabsDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(() => TABS_DEMO_LOCALES[this.localeId()] ?? TABS_DEMO_LOCALES['en']);

  protected readonly simpleTabs = computed(() => [
    { value: 'overview', label: this.t().simpleTabOverview, content: this.t().simpleOverviewContent },
    { value: 'features', label: this.t().simpleTabFeatures, content: this.t().simpleFeaturesContent },
    { value: 'pricing', label: this.t().simpleTabPricing, content: this.t().simplePricingContent },
  ]);

  protected readonly complexTabs = computed(() => [
    { value: 'account', label: this.t().tabAccount, content: this.t().accountCardDesc },
    { value: 'password', label: this.t().tabPassword, content: this.t().passwordCardDesc },
    {
      value: 'settings', label: this.t().tabSettings, content: TabsHelperComponent,
      contentContext: {
        username: 'shadcn',
        cardTitle: this.t().helperCardTitle,
        cardDesc: this.t().helperCardDesc,
        usernameLabel: this.t().helperUsernameLabel,
        emailLabel: this.t().helperEmailLabel,
        saveBtn: this.t().helperSaveBtn,
      },
    },
  ]);
}
