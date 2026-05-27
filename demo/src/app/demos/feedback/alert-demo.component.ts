import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  AlertComponent,
  AlertDescriptionComponent,
  AlertTitleComponent,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { ALERT_DEMO_LOCALES } from './alert-demo.locales';

@Component({
  selector: 'app-alert-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlertComponent, AlertTitleComponent, AlertDescriptionComponent],
  template: `
    <section class="space-y-4">
      <h2 id="alert" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="space-y-4">
        <ui-alert>
          <ui-alert-title>{{ t().infoTitle }}</ui-alert-title>
          <ui-alert-description>
            {{ t().infoDescription }}
          </ui-alert-description>
        </ui-alert>

        <ui-alert variant="destructive">
          <ui-alert-title>{{ t().errorTitle }}</ui-alert-title>
          <ui-alert-description>
            {{ t().errorDescription }}
          </ui-alert-description>
        </ui-alert>
      </div>

      <h3 class="text-lg font-medium mt-8">{{ t().simpleHeading }}</h3>
      <p class="text-muted-foreground text-sm mb-4">{{ t().simpleDescription }}</p>
      <div class="space-y-4">
        <ui-alert [title]="t().simpleNoteTitle" [description]="t().simpleNoteDescription" />
        <ui-alert variant="destructive" [title]="t().simpleCriticalTitle"
          [description]="t().simpleCriticalDescription" />
      </div>
    </section>
  `,
})
export class AlertDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  readonly t = computed(() => ALERT_DEMO_LOCALES[this.localeId()] ?? ALERT_DEMO_LOCALES['en']);
}
