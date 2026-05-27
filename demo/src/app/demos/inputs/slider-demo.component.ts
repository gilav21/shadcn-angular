// demo/src/app/demos/inputs/slider-demo.component.ts
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { SliderComponent } from '../../../../../packages/components/ui';
import { SLIDER_DEMO_LOCALES } from './slider-demo.locales';

@Component({
  selector: 'app-slider-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SliderComponent],
  template: `
    <section class="space-y-4">
      <h2 id="slider" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="max-w-xs space-y-4">
        <ui-slider [defaultValue]="40" [min]="0" [max]="100" [step]="1" />
        <div class="flex justify-between text-sm text-muted-foreground">
          <span>{{ t().minLabel }}</span>
          <span>{{ t().maxLabel }}</span>
        </div>
      </div>
    </section>
  `,
})
export class SliderDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => SLIDER_DEMO_LOCALES[this.localeId()] ?? SLIDER_DEMO_LOCALES['en'],
  );
}
