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
  LineChartComponent,
  AreaChartComponent,
  ComboChartComponent,
  ScatterChartComponent,
  BubbleChartComponent,
  GaugeChartComponent,
  RadarChartComponent,
  BulletChartComponent,
  HeatmapComponent,
  CalendarHeatmapComponent,
  ChartSeries,
  XYSeries,
  XYZSeries,
  HeatmapCell,
  CalendarDay,
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
    LineChartComponent,
    AreaChartComponent,
    ComboChartComponent,
    ScatterChartComponent,
    BubbleChartComponent,
    GaugeChartComponent,
    RadarChartComponent,
    BulletChartComponent,
    HeatmapComponent,
    CalendarHeatmapComponent,
  ],
  template: `
    <section class="space-y-6">
      <h2 id="charts" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
      <p class="text-muted-foreground">
        {{ t().description }}
      </p>

      <div class="space-y-8">
        <div class="space-y-4">
          <h3 class="text-lg font-semibold">{{ t().lineChartHeading }}</h3>
          <p class="text-sm text-muted-foreground">{{ t().lineChartDescription }}</p>
          <ui-line-chart [dir]="dir()" [series]="t().stackedSeries" [width]="560" [height]="300"
            curve="monotone" [title]="t().lineChartHeading" />
        </div>

        <div class="space-y-4">
          <h3 class="text-lg font-semibold">{{ t().areaChartHeading }}</h3>
          <p class="text-sm text-muted-foreground">{{ t().areaChartDescription }}</p>
          <ui-area-chart [dir]="dir()" [series]="t().stackedSeries" [width]="560" [height]="300"
            curve="monotone" [stacked]="true" [title]="t().areaChartHeading" />
        </div>

        <div class="space-y-4">
          <h3 class="text-lg font-semibold">{{ t().comboChartHeading }}</h3>
          <p class="text-sm text-muted-foreground">{{ t().comboChartDescription }}</p>
          <ui-combo-chart [dir]="dir()" [barSeries]="comboBars()" [showCumulative]="true"
            [width]="560" [height]="320" [title]="t().comboChartHeading" />
        </div>

        <div class="space-y-4">
          <h3 class="text-lg font-semibold">{{ t().scatterChartHeading }}</h3>
          <p class="text-sm text-muted-foreground">{{ t().scatterChartDescription }}</p>
          <ui-scatter-chart [dir]="dir()" [series]="scatterSeries" [width]="560" [height]="320"
            [title]="t().scatterChartHeading" />
        </div>

        <div class="space-y-4">
          <h3 class="text-lg font-semibold">{{ t().bubbleChartHeading }}</h3>
          <p class="text-sm text-muted-foreground">{{ t().bubbleChartDescription }}</p>
          <ui-bubble-chart [dir]="dir()" [series]="bubbleSeries" [width]="560" [height]="360"
            [title]="t().bubbleChartHeading" />
        </div>

        <div class="space-y-4">
          <h3 class="text-lg font-semibold">{{ t().gaugeChartHeading }}</h3>
          <p class="text-sm text-muted-foreground">{{ t().gaugeChartDescription }}</p>
          <ui-gauge-chart [value]="72" unit="%" label="CPU" [thresholds]="gaugeThresholds" [size]="240" />
        </div>

        <div class="space-y-4">
          <h3 class="text-lg font-semibold">{{ t().radarChartHeading }}</h3>
          <p class="text-sm text-muted-foreground">{{ t().radarChartDescription }}</p>
          <ui-radar-chart [series]="radarSeries" [size]="340" [levels]="4" />
        </div>

        <div class="space-y-4">
          <h3 class="text-lg font-semibold">{{ t().bulletChartHeading }}</h3>
          <p class="text-sm text-muted-foreground">{{ t().bulletChartDescription }}</p>
          <ui-bullet-chart [value]="70" [target]="80" [ranges]="[50, 75, 100]" [width]="420"
            [height]="44" label="Revenue" />
        </div>

        <div class="space-y-4">
          <h3 class="text-lg font-semibold">{{ t().heatmapHeading }}</h3>
          <p class="text-sm text-muted-foreground">{{ t().heatmapDescription }}</p>
          <ui-heatmap [data]="heatmapData" [width]="460" [showValues]="true" />
        </div>

        <div class="space-y-4">
          <h3 class="text-lg font-semibold">{{ t().calendarHeatmapHeading }}</h3>
          <p class="text-sm text-muted-foreground">{{ t().calendarHeatmapDescription }}</p>
          <ui-calendar-heatmap [data]="calendarData" [cellSize]="13" />
        </div>

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
  protected readonly comboBars = computed<ChartSeries[]>(
    () => [{ name: this.t().barVerticalHeading, data: this.t().barChartData }],
  );
  protected readonly scatterSeries: XYSeries[] = [
    { name: 'Group A', points: [
      { x: 12, y: 22 }, { x: 18, y: 30 }, { x: 25, y: 18 }, { x: 30, y: 40 }, { x: 36, y: 33 },
    ] },
    { name: 'Group B', points: [
      { x: 15, y: 55 }, { x: 22, y: 48 }, { x: 28, y: 62 }, { x: 35, y: 51 }, { x: 41, y: 70 },
    ] },
  ];
  protected readonly bubbleSeries: XYZSeries[] = [
    { name: 'Products', points: [
      { x: 10, y: 20, z: 30 }, { x: 22, y: 35, z: 80 }, { x: 30, y: 15, z: 50 },
      { x: 38, y: 42, z: 120 }, { x: 46, y: 28, z: 65 },
    ] },
    { name: 'Services', points: [
      { x: 14, y: 50, z: 40 }, { x: 26, y: 60, z: 95 }, { x: 34, y: 48, z: 70 },
    ] },
  ];
  protected readonly gaugeThresholds = [
    { value: 0, color: 'hsl(142, 71%, 45%)' },
    { value: 60, color: 'hsl(48, 96%, 53%)' },
    { value: 85, color: 'hsl(0, 84%, 60%)' },
  ];
  protected readonly radarSeries: ChartSeries[] = [
    { name: 'Product A', data: [
      { name: 'Speed', value: 8 }, { name: 'Power', value: 6 }, { name: 'Range', value: 9 },
      { name: 'Comfort', value: 5 }, { name: 'Price', value: 7 }, { name: 'Safety', value: 8 },
    ] },
    { name: 'Product B', data: [
      { name: 'Speed', value: 5 }, { name: 'Power', value: 9 }, { name: 'Range', value: 4 },
      { name: 'Comfort', value: 8 }, { name: 'Price', value: 6 }, { name: 'Safety', value: 7 },
    ] },
  ];
  protected readonly heatmapData: HeatmapCell[] = (() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const hours = ['9am', '12pm', '3pm', '6pm', '9pm'];
    return days.flatMap((row, ri) =>
      hours.map((col, ci) => ({ row, col, value: ((ri * 7 + ci * 3) % 10) + 1 })),
    );
  })();
  protected readonly calendarData: CalendarDay[] = (() => {
    const out: CalendarDay[] = [];
    const start = Date.UTC(2026, 0, 1);
    for (let i = 0; i < 180; i++) {
      const d = new Date(start + i * 86_400_000);
      const date = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      out.push({ date, value: (i * 13) % 11 });
    }
    return out;
  })();
}
