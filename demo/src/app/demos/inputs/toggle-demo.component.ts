import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { IconComponent, ToggleComponent } from '../../../../../packages/components/ui';
import { TOGGLE_DEMO_LOCALES } from './toggle-demo.locales';

@Component({
  selector: 'app-toggle-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ToggleComponent, IconComponent],
  template: `
    <section class="space-y-4">
      <h2 id="toggle" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="flex flex-wrap gap-4">
        <ui-toggle>
          <ui-icon name="zap" />
        </ui-toggle>
        <ui-toggle variant="outline">
          <ui-icon name="eye" />
        </ui-toggle>
        <ui-toggle [defaultPressed]="true">{{ t().boldLabel }}</ui-toggle>
      </div>
    </section>
  `,
})
export class ToggleDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => TOGGLE_DEMO_LOCALES[this.localeId()] ?? TOGGLE_DEMO_LOCALES['en'],
  );
}
