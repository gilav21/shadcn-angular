import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CalendarComponent } from '../../../../../packages/components/ui';

@Component({
  selector: 'app-calendar-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CalendarComponent],
  template: `
    <section class="space-y-4">
      <h2 id="calendar" class="text-2xl font-semibold scroll-m-20">Calendar</h2>
      <p class="text-muted-foreground">
        A date picker calendar component supporting single, range, and multi-selection modes.
      </p>

      <div class="flex flex-wrap gap-8">
        <div class="space-y-2">
          <h3 class="font-medium">Single Mode</h3>
          <ui-calendar mode="single" class="rounded-md border shadow" />
        </div>

        <div class="space-y-2">
          <h3 class="font-medium">Range Mode</h3>
          <ui-calendar mode="range" class="rounded-md border shadow" />
        </div>

        <div class="space-y-2">
          <h3 class="font-medium">Multi Mode</h3>
          <ui-calendar mode="multi" class="rounded-md border shadow" />
        </div>

        <div class="space-y-2">
          <h3 class="font-medium">With Selectors</h3>
          <ui-calendar mode="single" [showMonthSelect]="true" [showYearSelect]="true"
            class="rounded-md border shadow" />
        </div>

        <div class="space-y-2">
          <h3 class="font-medium">Date & Time</h3>
          <ui-calendar mode="single" [showTimeSelect]="true" class="rounded-md border shadow" />
        </div>

        <div class="space-y-2">
          <h3 class="font-medium">Date & Time Range</h3>
          <ui-calendar mode="single" [showTimeSelect]="true" timeMode="range" class="rounded-md border shadow" />
        </div>

        <div class="space-y-2">
          <h3 class="font-medium">Range with Time Range</h3>
          <ui-calendar mode="range" [showTimeSelect]="true" timeMode="range" class="rounded-md border shadow" />
        </div>

        <div class="space-y-2">
          <h3 class="font-medium">Start Mon (String)</h3>
          <ui-calendar mode="single" [weekStartsOn]="1" selected="2024-01-01" class="rounded-md border shadow" />
        </div>
      </div>
      <div class="flex flex-wrap gap-6">
        <div class="space-y-2">
          <p class="text-sm font-medium">Default (English)</p>
          <ui-calendar locale="en" [showMonthSelect]="true" [showYearSelect]="true"
            class="rounded-md border shadow"></ui-calendar>
        </div>

        <div class="space-y-2">
          <p class="text-sm font-medium">Hebrew (RTL)</p>
          <ui-calendar locale="he" [showMonthSelect]="true" [showYearSelect]="true" [showTimeSelect]="true"
            timeMode="range"
            class="rounded-md border shadow"></ui-calendar>
        </div>

        <div class="space-y-2">
          <p class="text-sm font-medium">Japanese</p>
          <ui-calendar locale="ja" [showMonthSelect]="true" [showYearSelect]="true"
            class="rounded-md border shadow"></ui-calendar>
        </div>
      </div>
    </section>
  `,
})
export class CalendarDemoComponent {}
