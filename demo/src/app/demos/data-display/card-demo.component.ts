import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  ButtonComponent,
  CardComponent,
  CardContentComponent,
  CardDescriptionComponent,
  CardFooterComponent,
  CardHeaderComponent,
  CardTitleComponent,
  InputComponent,
  LabelComponent,
  SwitchComponent,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { CARD_DEMO_LOCALES } from './card-demo.locales';

@Component({
  selector: 'app-card-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CardComponent,
    CardHeaderComponent,
    CardTitleComponent,
    CardDescriptionComponent,
    CardContentComponent,
    CardFooterComponent,
    ButtonComponent,
    InputComponent,
    LabelComponent,
    SwitchComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="card" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="grid md:grid-cols-2 gap-6">
        <ui-card>
          <ui-card-header>
            <ui-card-title>{{ t().card1Title }}</ui-card-title>
            <ui-card-description>{{ t().card1Description }}</ui-card-description>
          </ui-card-header>
          <ui-card-content>
            <div class="space-y-4">
              <div class="space-y-2">
                <ui-label for="project-name">{{ t().labelName }}</ui-label>
                <ui-input id="project-name" [placeholder]="t().placeholderName" />
              </div>
              <div class="space-y-2">
                <ui-label for="project-framework">{{ t().labelFramework }}</ui-label>
                <ui-input id="project-framework" [placeholder]="t().placeholderFramework" />
              </div>
            </div>
          </ui-card-content>
          <ui-card-footer class="flex justify-between">
            <ui-button variant="outline">{{ t().buttonCancel }}</ui-button>
            <ui-button>{{ t().buttonDeploy }}</ui-button>
          </ui-card-footer>
        </ui-card>

        <ui-card>
          <ui-card-header>
            <ui-card-title>{{ t().card2Title }}</ui-card-title>
            <ui-card-description>{{ t().card2Description }}</ui-card-description>
          </ui-card-header>
          <ui-card-content>
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <ui-label>{{ t().labelPushNotifications }}</ui-label>
                <ui-switch />
              </div>
              <div class="flex items-center justify-between">
                <ui-label>{{ t().labelEmailNotifications }}</ui-label>
                <ui-switch />
              </div>
            </div>
          </ui-card-content>
        </ui-card>
      </div>

      <h3 class="text-lg font-medium mt-8">{{ t().simpleHeading }}</h3>
      <p class="text-muted-foreground text-sm mb-4">{{ t().simpleDescription }}</p>
      <div class="grid md:grid-cols-2 gap-6">
        <ui-card [title]="t().simpleCard1Title" [description]="t().simpleCard1Description"
          [content]="t().simpleCard1Content" />
        <ui-card [title]="t().simpleCard2Title" [description]="t().simpleCard2Description" />
      </div>
    </section>
  `,
})
export class CardDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(() => CARD_DEMO_LOCALES[this.localeId()] ?? CARD_DEMO_LOCALES['en']);
}
