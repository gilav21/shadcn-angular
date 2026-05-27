import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { DatePickerComponent, DateRangePickerComponent } from '../../../../../packages/components/ui';
import { DATE_PICKER_DEMO_LOCALES } from './date-picker-demo.locales';

@Component({
  selector: 'app-date-picker-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePickerComponent, DateRangePickerComponent],
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
      </div>
    </section>
  `,
})
export class DatePickerDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(() => DATE_PICKER_DEMO_LOCALES[this.localeId()] ?? DATE_PICKER_DEMO_LOCALES['en']);
}
