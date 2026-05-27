import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { NumberTickerComponent } from '../../../../../packages/components/ui/number-ticker';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { NUMBER_TICKER_DEMO_LOCALES } from './number-ticker-demo.locales';

@Component({
  selector: 'app-number-ticker-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NumberTickerComponent],
  template: `
    <section class="space-y-4">
      <h2 id="number-ticker" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="space-y-4">
          <h3 class="text-lg font-semibold">{{ t().subscribersHeading }}</h3>
          <div
            class="h-[200px] w-full border rounded-lg flex flex-col items-center justify-center bg-background gap-4">
            <span class="text-4xl font-bold tracking-tighter">
              <ui-number-ticker [value]="subscribersValue()" />
            </span>
            <p class="text-sm text-muted-foreground">{{ t().subscribersLabel }}</p>
          </div>
        </div>

        <div class="space-y-4">
          <h3 class="text-lg font-semibold">{{ t().revenueHeading }}</h3>
          <div
            class="h-[200px] w-full border rounded-lg flex flex-col items-center justify-center bg-background gap-4">
            <span class="text-4xl font-bold tracking-tighter text-green-500">
              $<ui-number-ticker [value]="5432.10" [decimalPlaces]="2" />
            </span>
            <p class="text-sm text-muted-foreground">{{ t().revenueLabel }}</p>
          </div>
        </div>
      </div>
    </section>
  `,
})
export class NumberTickerDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  readonly t = computed(() => NUMBER_TICKER_DEMO_LOCALES[this.localeId()] ?? NUMBER_TICKER_DEMO_LOCALES['en']);
  readonly subscribersValue = signal(8549);

  constructor() {
    const destroyRef = inject(DestroyRef);
    const intervalId = setInterval(() => {
      this.subscribersValue.update(v => v + Math.floor(Math.random() * 3) + 1);
    }, 5000);
    destroyRef.onDestroy(() => clearInterval(intervalId));
  }
}
