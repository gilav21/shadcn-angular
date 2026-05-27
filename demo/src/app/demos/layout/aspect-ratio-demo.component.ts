import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AspectRatioComponent } from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { ASPECT_RATIO_DEMO_LOCALES } from './aspect-ratio-demo.locales';

@Component({
  selector: 'app-aspect-ratio-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AspectRatioComponent],
  template: `
    <section class="space-y-4">
      <h2 id="aspect-ratio" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="w-[300px]">
        <ui-aspect-ratio [ratio]="16 / 9">
          <div class="flex h-full w-full items-center justify-center rounded-md bg-muted text-muted-foreground">
            {{ t().label169 }}
          </div>
        </ui-aspect-ratio>
      </div>
    </section>
  `,
})
export class AspectRatioDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(() => ASPECT_RATIO_DEMO_LOCALES[this.localeId()] ?? ASPECT_RATIO_DEMO_LOCALES['en']);
}
