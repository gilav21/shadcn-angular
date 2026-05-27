// demo/src/app/demos/inputs/label-demo.component.ts
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { CheckboxComponent, LabelComponent } from '../../../../../packages/components/ui';
import { LABEL_DEMO_LOCALES } from './label-demo.locales';

@Component({
  selector: 'app-label-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CheckboxComponent, LabelComponent],
  template: `
    <section class="space-y-4">
      <h2 id="label" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="grid gap-2">
        <div class="flex items-center gap-2">
          <ui-checkbox id="terms" />
          <ui-label htmlFor="terms">{{ t().termsLabel }}</ui-label>
        </div>
      </div>
    </section>
  `,
})
export class LabelDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => LABEL_DEMO_LOCALES[this.localeId()] ?? LABEL_DEMO_LOCALES['en'],
  );
}
