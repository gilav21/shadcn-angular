import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import {
  PieChartComponent,
  PieChartDrilldownComponent,
  BarChartComponent,
  BarChartDrilldownComponent,
  StackedBarChartComponent,
  ColumnRangeChartComponent,
  BarRaceChartComponent,
} from '../../../../../packages/components/ui';
import { CHARTS_DEMO_LOCALES } from './charts-demo.locales';

@Component({
  selector: 'app-charts-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PieChartComponent,
    PieChartDrilldownComponent,
    BarChartComponent,
    BarChartDrilldownComponent,
    StackedBarChartComponent,
    ColumnRangeChartComponent,
    BarRaceChartComponent,
  ],
  template: `
    <section class="space-y-6">
      <h2 id="charts" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
      <p class="text-muted-foreground">
        {{ t().description }}
      </p>

      <div class="space-y-8">
        <div class="space-y-4">
          <h3 class="text-lg font-semibold">{{ t().pieChartHeading }}</h3>
          <p class="text-sm text-muted-foreground">{{ t().pieChartDescription }}</p>
          <ui-pie-chart [data]="t().pieChartData" [size]="280" legendPosition="right" />
        </div>

        <div class="space-y-4">
          <h3 class="text-lg font-semibold">{{ t().donutChartHeading }}</h3>
          <p class="text-sm text-muted-foreground">{{ t().donutChartDescription }}</p>
          <ui-pie-chart [data]="t().pieChartData" [size]="280" [innerRadius]="0.5" legendPosition="right" />
        </div>

        <div class="space-y-4">
          <h3 class="text-lg font-semibold">{{ t().drilldownPieHeading }}</h3>
          <p class="text-sm text-muted-foreground">{{ t().drilldownPieDescription }}</p>
          <ui-pie-chart-drilldown [data]="t().drilldownData" [drilldownSeries]="t().drilldownSeries" [size]="280"
            [innerRadius]="0" legendPosition="right" [title]="t().drilldownPieTitle" />
        </div>

        <div class="space-y-4">
          <h3 class="text-lg font-semibold">{{ t().barVerticalHeading }}</h3>
          <p class="text-sm text-muted-foreground">{{ t().barVerticalDescription }}</p>
          <ui-bar-chart [dir]="dir()" [data]="t().barChartData" [width]="500" [height]="280"
            orientation="vertical" [xAxisLabel]="t().barVerticalXLabel" [yAxisLabel]="t().barVerticalYLabel" />
        </div>

        <div class="space-y-4">
          <h3 class="text-lg font-semibold">{{ t().barHorizontalHeading }}</h3>
          <p class="text-sm text-muted-foreground">{{ t().barHorizontalDescription }}</p>
          <ui-bar-chart [dir]="dir()" [data]="t().pieChartData" [width]="500" [height]="280"
            orientation="horizontal" />
        </div>

        <div class="space-y-4">
          <h3 class="text-lg font-semibold">{{ t().barDrilldownHeading }}</h3>
          <p class="text-sm text-muted-foreground">{{ t().barDrilldownDescription }}</p>
          <ui-bar-chart-drilldown [dir]="dir()" [data]="t().drilldownData"
            [drilldownSeries]="t().drilldownSeries" [width]="500" [height]="280" [title]="t().barDrilldownTitle" />
        </div>

        <div class="space-y-4">
          <h3 class="text-lg font-semibold">{{ t().stackedHeading }}</h3>
          <p class="text-sm text-muted-foreground">{{ t().stackedDescription }}</p>
          <ui-stacked-bar-chart [dir]="dir()" [series]="t().stackedSeries"
            [categories]="t().stackedCategories" [width]="500" [height]="280" stacking="absolute" [showTotal]="true" />
        </div>

        <div class="space-y-4">
          <h3 class="text-lg font-semibold">{{ t().stackedPercentHeading }}</h3>
          <p class="text-sm text-muted-foreground">{{ t().stackedPercentDescription }}</p>
          <ui-stacked-bar-chart [dir]="dir()" [series]="t().stackedSeries"
            [categories]="t().stackedCategories" [width]="500" [height]="280" stacking="percent" />
        </div>

        <div class="space-y-4">
          <h3 class="text-lg font-semibold">{{ t().columnRangeHeading }}</h3>
          <p class="text-sm text-muted-foreground">{{ t().columnRangeDescription }}</p>
          <ui-column-range-chart [dir]="dir()" [data]="t().rangeChartData" [width]="500"
            [height]="280" unit="°C" [title]="t().columnRangeTitle" />
        </div>

        <div class="space-y-4">
          <h3 class="text-lg font-semibold">{{ t().barRaceHeading }}</h3>
          <p class="text-sm text-muted-foreground">{{ t().barRaceDescription }}</p>
          <ui-bar-race-chart [dir]="dir()" [frames]="t().barRaceFrames" [frameLabels]="t().barRaceLabels"
            [width]="600" [height]="320" [maxBars]="6" [animationDuration]="600" [title]="t().barRaceTitle" />
        </div>
      </div>
    </section>
  `,
})
export class ChartsDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => CHARTS_DEMO_LOCALES[this.localeId()] ?? CHARTS_DEMO_LOCALES['en'],
  );
  readonly dir = computed<'ltr' | 'rtl'>(() => this.t().rtl ? 'rtl' : 'ltr');
}
