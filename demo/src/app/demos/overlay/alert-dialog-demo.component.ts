import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  AlertDialogActionComponent,
  AlertDialogCancelComponent,
  AlertDialogComponent,
  AlertDialogContentComponent,
  AlertDialogDescriptionComponent,
  AlertDialogFooterComponent,
  AlertDialogHeaderComponent,
  AlertDialogTitleComponent,
  AlertDialogTriggerComponent,
  ButtonComponent,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { ALERT_DIALOG_DEMO_LOCALES } from './alert-dialog-demo.locales';

@Component({
  selector: 'app-alert-dialog-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertDialogActionComponent,
    AlertDialogCancelComponent,
    AlertDialogComponent,
    AlertDialogContentComponent,
    AlertDialogDescriptionComponent,
    AlertDialogFooterComponent,
    AlertDialogHeaderComponent,
    AlertDialogTitleComponent,
    AlertDialogTriggerComponent,
    ButtonComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="alert-dialog" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <ui-alert-dialog #alertDialog>
        <ui-alert-dialog-trigger>
          <ui-button variant="outline">{{ t().triggerLabel }}</ui-button>
        </ui-alert-dialog-trigger>
        <ui-alert-dialog-content>
          <ui-alert-dialog-header>
            <ui-alert-dialog-title>{{ t().dialogTitle }}</ui-alert-dialog-title>
            <ui-alert-dialog-description>{{ t().dialogDescription }}</ui-alert-dialog-description>
          </ui-alert-dialog-header>
          <ui-alert-dialog-footer>
            <ui-alert-dialog-cancel>{{ t().cancelLabel }}</ui-alert-dialog-cancel>
            <ui-alert-dialog-action>{{ t().continueLabel }}</ui-alert-dialog-action>
          </ui-alert-dialog-footer>
        </ui-alert-dialog-content>
      </ui-alert-dialog>
    </section>
  `,
})
export class AlertDialogDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => ALERT_DIALOG_DEMO_LOCALES[this.localeId()] ?? ALERT_DIALOG_DEMO_LOCALES['en'],
  );
}
