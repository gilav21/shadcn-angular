import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CheckboxComponent, LabelComponent } from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { CHECKBOX_DEMO_LOCALES } from './checkbox-demo.locales';

@Component({
  selector: 'app-checkbox-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CheckboxComponent, LabelComponent],
  template: `
    <section class="space-y-4">
      <h2 id="checkbox" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="space-y-3">
        <div class="flex items-center gap-2">
          <ui-checkbox />
          <ui-label>{{ t().acceptTerms }}</ui-label>
        </div>
        <div class="flex items-center gap-2">
          <ui-checkbox />
          <ui-label>{{ t().subscribeNewsletter }}</ui-label>
        </div>
        <div class="flex items-center gap-2">
          <ui-checkbox [disabled]="true" />
          <ui-label class="opacity-50">{{ t().disabledCheckbox }}</ui-label>
        </div>
      </div>

      <h3 class="text-lg font-medium mt-8">{{ t().simpleModeHeading }}</h3>
      <p class="text-muted-foreground text-sm mb-4">{{ t().simpleModeDescription }}</p>
      <div class="space-y-3 flex flex-col gap-2">
        <ui-checkbox [label]="t().acceptTerms" />
        <ui-checkbox [label]="t().subscribeNewsletter" [checked]="true" />
        <ui-checkbox [label]="t().disabledCheckbox" [disabled]="true" />
      </div>
    </section>
  `,
})
export class CheckboxDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(() => CHECKBOX_DEMO_LOCALES[this.localeId()] ?? CHECKBOX_DEMO_LOCALES['en']);
}
