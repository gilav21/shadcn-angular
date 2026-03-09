import { Component, ChangeDetectionStrategy } from '@angular/core';
import { DatePickerComponent, DateRangePickerComponent } from '../../../../../packages/components/ui';

@Component({
  selector: 'app-date-picker-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePickerComponent, DateRangePickerComponent],
  template: `
    <section class="space-y-4">
      <h2 id="date-picker" class="text-2xl font-semibold scroll-m-20">Date Picker</h2>
      <p class="text-muted-foreground">A date picker component with popover calendar.</p>

      <div class="flex flex-wrap gap-8">
        <div class="space-y-2">
          <h3 class="text-lg font-medium">Single Date</h3>
          <ui-date-picker placeholder="Pick a date" />
        </div>

        <div class="space-y-2">
          <h3 class="text-lg font-medium">Date &amp; Time</h3>
          <ui-date-picker [showTime]="true" placeholder="Pick date & time" />
        </div>

        <div class="space-y-2">
          <h3 class="text-lg font-medium">Date Range</h3>
          <ui-date-range-picker placeholder="Select date range" />
        </div>

        <div class="space-y-2">
          <h3 class="text-lg font-medium">Date Picker RTL (Hebrew)</h3>
          <ui-date-picker [showTime]="true" locale="he" placeholder="בחר תאריך" dir="rtl" />
        </div>
      </div>
    </section>
  `,
})
export class DatePickerDemoComponent {}
