import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { NumberTickerComponent } from '../../../../../packages/components/ui/number-ticker.component';

@Component({
  selector: 'app-number-ticker-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NumberTickerComponent],
  template: `
    <section class="space-y-4">
      <h2 id="number-ticker" class="text-2xl font-semibold scroll-m-20">Number Ticker</h2>
      <p class="text-muted-foreground">Animate numbers with ease.</p>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="space-y-4">
          <h3 class="text-lg font-semibold">Subscribers (Live)</h3>
          <div
            class="h-[200px] w-full border rounded-lg flex flex-col items-center justify-center bg-background gap-4">
            <span class="text-4xl font-bold tracking-tighter">
              <ui-number-ticker [value]="subscribersValue()" />
            </span>
            <p class="text-sm text-muted-foreground">Active Subscribers</p>
          </div>
        </div>

        <div class="space-y-4">
          <h3 class="text-lg font-semibold">Revenue</h3>
          <div
            class="h-[200px] w-full border rounded-lg flex flex-col items-center justify-center bg-background gap-4">
            <span class="text-4xl font-bold tracking-tighter text-green-500">
              $<ui-number-ticker [value]="5432.10" [decimalPlaces]="2" />
            </span>
            <p class="text-sm text-muted-foreground">Total Revenue</p>
          </div>
        </div>
      </div>
    </section>
  `,
})
export class NumberTickerDemoComponent {
  readonly subscribersValue = signal(8549);

  constructor() {
    const destroyRef = inject(DestroyRef);
    const intervalId = setInterval(() => {
      this.subscribersValue.update(v => v + Math.floor(Math.random() * 3) + 1);
    }, 5000);
    destroyRef.onDestroy(() => clearInterval(intervalId));
  }
}
