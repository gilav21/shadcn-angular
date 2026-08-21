import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { StatCardComponent } from '../../../../../packages/components/ui/stat-card';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { STAT_CARD_DEMO_LOCALES } from './stat-card-demo.locales';

@Component({
  selector: 'app-stat-card-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatCardComponent],
  template: `
    <section class="space-y-4">
      <h2 id="stat-card" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <h3 class="text-lg font-medium mt-8">{{ t().trendsHeading }}</h3>
      <p class="text-muted-foreground text-sm mb-4">{{ t().trendsDescription }}</p>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ui-stat-card [label]="t().revenue" value="$45,231" delta="+12.5%" trend="up" />
        <ui-stat-card [label]="t().orders" value="1,210" delta="-3.2%" trend="down" />
        <ui-stat-card [label]="t().sessions" value="18,402" delta="0.0%" trend="neutral" />
        <ui-stat-card [label]="t().churnRate" value="1.8%" delta="-0.4%" trend="up" />
      </div>

      <h3 class="text-lg font-medium mt-8">{{ t().noDeltaHeading }}</h3>
      <p class="text-muted-foreground text-sm mb-4">{{ t().noDeltaDescription }}</p>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ui-stat-card [label]="t().activeUsers" value="2,350" />
        <ui-stat-card [label]="t().openTickets" value="17" />
      </div>

      <h3 class="text-lg font-medium mt-8">{{ t().sparklineHeading }}</h3>
      <p class="text-muted-foreground text-sm mb-4">{{ t().sparklineDescription }}</p>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ui-stat-card [label]="t().activeUsers" value="2,350" delta="+8.1%" trend="up">
          <svg
            viewBox="0 0 120 32"
            class="mt-2 h-8 w-full text-primary"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M0 26 L20 22 L40 24 L60 14 L80 17 L100 8 L120 4" />
          </svg>
        </ui-stat-card>
        <ui-stat-card [label]="t().errorRate" value="0.42%" delta="-0.08%" trend="up">
          <svg
            viewBox="0 0 120 32"
            class="mt-2 h-8 w-full text-primary"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M0 6 L20 10 L40 8 L60 18 L80 15 L100 24 L120 28" />
          </svg>
        </ui-stat-card>
      </div>

      <h3 class="text-lg font-medium mt-8">{{ t().stylingHeading }}</h3>
      <p class="text-muted-foreground text-sm mb-4">{{ t().stylingDescription }}</p>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ui-stat-card
          [label]="t().revenue"
          value="$45,231"
          delta="+12.5%"
          trend="up"
          class="ring-2 ring-primary/40"
        />
        <ui-stat-card
          [label]="t().orders"
          value="1,210"
          delta="-3.2%"
          trend="down"
          [trendIcon]="false"
          class="border-dashed bg-muted/40 shadow-none"
        />
      </div>

      <h3 class="text-lg font-medium mt-8">{{ t().truncationHeading }}</h3>
      <p class="text-muted-foreground text-sm mb-4">{{ t().truncationDescription }}</p>
      <div class="w-full sm:max-w-[240px]">
        <ui-stat-card
          [label]="t().longLabel"
          value="$45,231,890.12345"
          delta="+20.1%"
          trend="up"
        />
      </div>
    </section>
  `,
})
export class StatCardDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  readonly t = computed(
    () => STAT_CARD_DEMO_LOCALES[this.localeId()] ?? STAT_CARD_DEMO_LOCALES['en'],
  );
}
