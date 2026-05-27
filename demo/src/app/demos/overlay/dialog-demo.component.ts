import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  ButtonComponent,
  DialogComponent,
  DialogContentComponent,
  DialogDescriptionComponent,
  DialogFooterComponent,
  DialogHeaderComponent,
  DialogTitleComponent,
  DialogTriggerComponent,
  InputComponent,
  LabelComponent,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { DIALOG_DEMO_LOCALES } from './dialog-demo.locales';

@Component({
  selector: 'app-dialog-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    DialogComponent,
    DialogContentComponent,
    DialogDescriptionComponent,
    DialogFooterComponent,
    DialogHeaderComponent,
    DialogTitleComponent,
    DialogTriggerComponent,
    InputComponent,
    LabelComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="dialog" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <ui-dialog #uiDialog>
        <ui-dialog-trigger>
          <ui-button>{{ t().openLabel }}</ui-button>
        </ui-dialog-trigger>
        <ui-dialog-content>
          <ui-dialog-header>
            <ui-dialog-title>{{ t().dialogTitle }}</ui-dialog-title>
            <ui-dialog-description>{{ t().dialogDescription }}</ui-dialog-description>
          </ui-dialog-header>
          <div class="grid gap-4 py-4">
            <div class="grid gap-2">
              <ui-label>{{ t().nameLabel }}</ui-label>
              <ui-input [placeholder]="t().namePlaceholder" />
            </div>
            <div class="grid gap-2">
              <ui-label>{{ t().emailLabel }}</ui-label>
              <ui-input type="email" [placeholder]="t().emailPlaceholder" />
            </div>
          </div>
          <ui-dialog-footer>
            <ui-button (click)="uiDialog.hide()" (keydown.enter)="uiDialog.hide()">{{ t().saveLabel }}</ui-button>
          </ui-dialog-footer>
        </ui-dialog-content>
      </ui-dialog>
    </section>
  `,
})
export class DialogDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => DIALOG_DEMO_LOCALES[this.localeId()] ?? DIALOG_DEMO_LOCALES['en'],
  );
}
