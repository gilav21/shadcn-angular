// demo/src/app/demos/inputs/calendar-demo.component.ts
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { CalendarComponent, type DateRange } from '../../../../../packages/components/ui';
import { CALENDAR_DEMO_LOCALES } from './calendar-demo.locales';

@Component({
  selector: 'app-calendar-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CalendarComponent],
  template: `
    <section class="space-y-4">
      <h2 id="calendar" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="flex flex-wrap gap-8">
        <div class="space-y-2">
          <h3 class="font-medium">{{ t().modes.single }}</h3>
          <ui-calendar mode="single" class="rounded-md border shadow" />
        </div>
        <div class="space-y-2">
          <h3 class="font-medium">{{ t().modes.range }}</h3>
          <ui-calendar mode="range" class="rounded-md border shadow" />
        </div>
        <div class="space-y-2">
          <h3 class="font-medium">{{ t().modes.multi }}</h3>
          <ui-calendar mode="multi" class="rounded-md border shadow" />
        </div>
        <div class="space-y-2">
          <h3 class="font-medium">{{ t().modes.withSelectors }}</h3>
          <ui-calendar mode="single" [showMonthSelect]="true" [showYearSelect]="true" class="rounded-md border shadow" />
        </div>
        <div class="space-y-2">
          <h3 class="font-medium">{{ t().modes.dateTime }}</h3>
          <ui-calendar mode="single" [showTimeSelect]="true" class="rounded-md border shadow" />
        </div>
        <div class="space-y-2">
          <h3 class="font-medium">{{ t().modes.dateTimeRange }}</h3>
          <ui-calendar mode="single" [showTimeSelect]="true" timeMode="range" class="rounded-md border shadow" />
        </div>
        <div class="space-y-2">
          <h3 class="font-medium">{{ t().modes.rangeWithTimeRange }}</h3>
          <ui-calendar mode="range" [showTimeSelect]="true" timeMode="range" class="rounded-md border shadow" />
        </div>
        <div class="space-y-2">
          <h3 class="font-medium">{{ t().modes.startMonString }}</h3>
          <ui-calendar mode="single" [weekStartsOn]="1" selected="2024-01-01" class="rounded-md border shadow" />
        </div>
        <div class="space-y-2">
          <h3 class="font-medium">{{ t().modes.timeApplied }}</h3>
          <ui-calendar
            mode="single"
            [showTimeSelect]="true"
            [selected]="timedSelection()"
            (selectedChange)="timedSelection.set($event)"
            class="rounded-md border shadow"
          />
          <p class="text-sm text-muted-foreground max-w-full sm:max-w-[18rem]">{{ t().captions.timeApplied }}</p>
          <code class="text-sm font-mono">{{ t().selectedValueLabel }} {{ timedSelectionLabel() }}</code>
        </div>
      </div>
      <div class="flex flex-wrap gap-6">
        <div class="space-y-2">
          <p class="text-sm font-medium">{{ t().showcase.defaultEnglish }}</p>
          <ui-calendar locale="en" [showMonthSelect]="true" [showYearSelect]="true" class="rounded-md border shadow"></ui-calendar>
        </div>
        <div class="space-y-2">
          <p class="text-sm font-medium">{{ t().showcase.hebrewRtl }}</p>
          <ui-calendar locale="he" [showMonthSelect]="true" [showYearSelect]="true" [showTimeSelect]="true" timeMode="range" class="rounded-md border shadow"></ui-calendar>
        </div>
        <div class="space-y-2">
          <p class="text-sm font-medium">{{ t().showcase.japanese }}</p>
          <ui-calendar locale="ja" [showMonthSelect]="true" [showYearSelect]="true" class="rounded-md border shadow"></ui-calendar>
        </div>
      </div>
    </section>
  `,
})
export class CalendarDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => CALENDAR_DEMO_LOCALES[this.localeId()] ?? CALENDAR_DEMO_LOCALES['en'],
  );

  /** Selection of the single-mode calendar that carries a time of day. */
  readonly timedSelection = signal<Date | DateRange | Date[] | string | string[] | null>(null);

  /** Full date-and-time rendering of {@link timedSelection}, so the applied time is visible. */
  protected readonly timedSelectionLabel = computed(() => {
    const value = this.timedSelection();
    return value instanceof Date ? value.toLocaleString(this.localeId()) : 'null';
  });
}
