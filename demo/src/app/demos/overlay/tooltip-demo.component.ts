import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  ButtonComponent,
  TooltipComponent,
  TooltipContentComponent,
  TooltipDirective,
  TooltipTriggerComponent,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { TOOLTIP_DEMO_LOCALES } from './tooltip-demo.locales';

@Component({
  selector: 'app-tooltip-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    TooltipComponent,
    TooltipContentComponent,
    TooltipDirective,
    TooltipTriggerComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="tooltip" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="flex gap-4 items-center">
        <ui-button [uiTooltip]="t().topTooltip" tooltipSide="top">{{ t().topButtonLabel }}</ui-button>
        <ui-button [uiTooltip]="t().bottomTooltip" tooltipSide="bottom" variant="secondary">{{ t().bottomButtonLabel }}</ui-button>

        <ui-tooltip>
          <ui-tooltip-trigger>
            <ui-button variant="outline">{{ t().componentButtonLabel }}</ui-button>
          </ui-tooltip-trigger>
          <ui-tooltip-content>
            <p>{{ t().componentTooltip }}</p>
          </ui-tooltip-content>
        </ui-tooltip>
      </div>
    </section>
  `,
})
export class TooltipDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => TOOLTIP_DEMO_LOCALES[this.localeId()] ?? TOOLTIP_DEMO_LOCALES['en'],
  );
}
