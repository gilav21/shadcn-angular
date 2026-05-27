import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ProgressComponent } from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { PROGRESS_DEMO_LOCALES } from './progress-demo.locales';

@Component({
  selector: 'app-progress-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProgressComponent],
  template: `
    <section class="space-y-4">
      <h2 id="progress" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="space-y-4 max-w-md">
        <ui-progress [value]="25" />
        <ui-progress [value]="50" />
        <ui-progress [value]="75" />
        <ui-progress [value]="100" />
      </div>
    </section>
  `,
})
export class ProgressDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  readonly t = computed(() => PROGRESS_DEMO_LOCALES[this.localeId()] ?? PROGRESS_DEMO_LOCALES['en']);
}
