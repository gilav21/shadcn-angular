// demo/src/app/demos/inputs/switch-demo.component.ts
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { SwitchComponent, LabelComponent } from '../../../../../packages/components/ui';
import { SWITCH_DEMO_LOCALES } from './switch-demo.locales';

@Component({
  selector: 'app-switch-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SwitchComponent, LabelComponent],
  template: `
    <section class="space-y-4">
      <h2 id="switch" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="flex flex-col gap-6">
        <div class="flex flex-col gap-2">
          <h3 class="text-lg font-medium">{{ t().basicHeading }}</h3>
          <div class="flex items-center space-x-2">
            <ui-switch id="airplane-mode"></ui-switch>
            <ui-label htmlFor="airplane-mode">{{ t().airplaneModeLabel }}</ui-label>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <h3 class="text-lg font-medium">{{ t().inlineLabelHeading }}</h3>
          <div class="flex items-center space-x-2">
            <ui-switch [label]="t().notificationsLabel"></ui-switch>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <h3 class="text-lg font-medium">{{ t().disabledHeading }}</h3>
          <div class="flex items-center space-x-2">
            <ui-switch [disabled]="true" [label]="t().disabledLabel"></ui-switch>
          </div>
        </div>
      </div>
    </section>
  `,
})
export class SwitchDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => SWITCH_DEMO_LOCALES[this.localeId()] ?? SWITCH_DEMO_LOCALES['en'],
  );
}
