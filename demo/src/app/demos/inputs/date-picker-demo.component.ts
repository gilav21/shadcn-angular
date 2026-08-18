import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import {
  ButtonComponent,
  CardComponent,
  CardContentComponent,
  DatePickerComponent,
  DateRangePickerComponent,
} from '../../../../../packages/components/ui';
import { DATE_PICKER_DEMO_LOCALES } from './date-picker-demo.locales';

@Component({
  selector: 'app-date-picker-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    CardComponent,
    CardContentComponent,
    DatePickerComponent,
    DateRangePickerComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="date-picker" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="flex flex-wrap gap-8">
        <div class="space-y-2">
          <h3 class="text-lg font-medium">{{ t().sections.singleDate }}</h3>
          <ui-date-picker [placeholder]="t().placeholders.pickDate" />
        </div>

        <div class="space-y-2">
          <h3 class="text-lg font-medium">{{ t().sections.dateTime }}</h3>
          <ui-date-picker [showTime]="true" [placeholder]="t().placeholders.pickDateTime" />
        </div>

        <div class="space-y-2">
          <h3 class="text-lg font-medium">{{ t().sections.dateRange }}</h3>
          <ui-date-range-picker [placeholder]="t().placeholders.selectDateRange" />
        </div>

        <div class="space-y-2">
          <h3 class="text-lg font-medium">{{ t().sections.rtlHebrew }}</h3>
          <ui-date-picker [showTime]="true" locale="he" [placeholder]="t().placeholders.hebrewDate" dir="rtl" />
        </div>

        <div class="space-y-2">
          <h3 class="text-lg font-medium">{{ t().sections.clearable }}</h3>
          <p class="text-sm text-muted-foreground">{{ t().captions.clearable }}</p>
          <ui-date-picker
            [date]="clearableDate()"
            (dateChange)="clearableDate.set($event)"
            [placeholder]="t().placeholders.pickDate"
          />
          <div class="flex flex-wrap items-center gap-2">
            <ui-button variant="outline" size="sm" (clicked)="clearDate()">{{ t().actions.clear }}</ui-button>
            <code class="text-sm font-mono">{{ t().labels.value }} {{ clearableLabel() }}</code>
          </div>
        </div>

        <div class="space-y-2">
          <h3 class="text-lg font-medium">{{ t().sections.insideOverflowCard }}</h3>
          <p class="text-sm text-muted-foreground">{{ t().captions.insideOverflowCard }}</p>
          <ui-card class="overflow-hidden w-full sm:w-[320px]">
            <ui-card-content class="p-4">
              <ui-date-picker [placeholder]="t().placeholders.pickDate" />
            </ui-card-content>
          </ui-card>
        </div>
      </div>
    </section>
  `,
})
export class DatePickerDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(() => DATE_PICKER_DEMO_LOCALES[this.localeId()] ?? DATE_PICKER_DEMO_LOCALES['en']);

  /** Backs the clearable example; `null` puts the trigger back on its placeholder. */
  readonly clearableDate = signal<Date | null>(new Date(2024, 0, 15));

  protected readonly clearableLabel = computed(() => {
    const value = this.clearableDate();
    return value ? value.toLocaleDateString(this.localeId()) : 'null';
  });

  /** Writes `null` into `[date]`, which drops the selection. */
  protected clearDate(): void {
    this.clearableDate.set(null);
  }
}
