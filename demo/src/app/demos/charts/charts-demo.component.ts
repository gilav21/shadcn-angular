import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  PieChartComponent,
  PieChartDrilldownComponent,
  BarChartComponent,
  BarChartDrilldownComponent,
  StackedBarChartComponent,
  ColumnRangeChartComponent,
  BarRaceChartComponent,
  ChartDataPoint,
  DrilldownDataPoint,
  DrilldownSeries,
  ChartSeries,
  RangeDataPoint,
} from '../../../../../packages/components/ui/charts';

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
      <h2 id="charts" class="text-2xl font-semibold scroll-m-20">Charts</h2>
      <p class="text-muted-foreground">
        A collection of beautiful, interactive chart components built with pure SVG.
      </p>

      <div class="space-y-8">
        <div class="space-y-4">
          <h3 class="text-lg font-semibold">Pie Chart</h3>
          <p class="text-sm text-muted-foreground">Basic pie chart with legend and hover effects.</p>
          <ui-pie-chart [data]="pieChartData" [size]="280" legendPosition="right" />
        </div>

        <div class="space-y-4">
          <h3 class="text-lg font-semibold">Donut Chart</h3>
          <p class="text-sm text-muted-foreground">Pie chart with inner radius for a donut appearance.</p>
          <ui-pie-chart [data]="pieChartData" [size]="280" [innerRadius]="0.5" legendPosition="right" />
        </div>

        <div class="space-y-4">
          <h3 class="text-lg font-semibold">Pie Chart with Drilldown</h3>
          <p class="text-sm text-muted-foreground">Click on a slice to drill down into details. Hover to see
            drilldown hints.</p>
          <ui-pie-chart-drilldown [data]="drilldownData" [drilldownSeries]="drilldownSeries" [size]="280"
            [innerRadius]="0" legendPosition="right" title="Browser Market Share" />
        </div>

        <div class="space-y-4">
          <h3 class="text-lg font-semibold">Bar Chart (Vertical)</h3>
          <p class="text-sm text-muted-foreground">Column chart showing monthly revenue data.</p>
          <ui-bar-chart [dir]="dir()" [data]="barChartData" [width]="500" [height]="280"
            orientation="vertical" xAxisLabel="Month" yAxisLabel="Revenue ($)" />
        </div>

        <div class="space-y-4">
          <h3 class="text-lg font-semibold">Bar Chart (Horizontal)</h3>
          <p class="text-sm text-muted-foreground">Horizontal bars for comparing categorical data.</p>
          <ui-bar-chart [dir]="dir()" [data]="pieChartData" [width]="500" [height]="280"
            orientation="horizontal" />
        </div>

        <div class="space-y-4">
          <h3 class="text-lg font-semibold">Column Chart with Drilldown</h3>
          <p class="text-sm text-muted-foreground">Click a column to see the breakdown.</p>
          <ui-bar-chart-drilldown [dir]="dir()" [data]="drilldownData"
            [drilldownSeries]="drilldownSeries" [width]="500" [height]="280" title="Browser Market Share" />
        </div>

        <div class="space-y-4">
          <h3 class="text-lg font-semibold">Stacked Bar Chart</h3>
          <p class="text-sm text-muted-foreground">Multi-series stacked columns showing cumulative data.</p>
          <ui-stacked-bar-chart [dir]="dir()" [series]="stackedSeries"
            [categories]="stackedCategories" [width]="500" [height]="280" stacking="absolute" [showTotal]="true" />
        </div>

        <div class="space-y-4">
          <h3 class="text-lg font-semibold">Stacked Bar Chart (Percentage)</h3>
          <p class="text-sm text-muted-foreground">100% stacked to show proportions.</p>
          <ui-stacked-bar-chart [dir]="dir()" [series]="stackedSeries"
            [categories]="stackedCategories" [width]="500" [height]="280" stacking="percent" />
        </div>

        <div class="space-y-4">
          <h3 class="text-lg font-semibold">Column Range Chart</h3>
          <p class="text-sm text-muted-foreground">Shows temperature ranges (low to high) for each month.</p>
          <ui-column-range-chart [dir]="dir()" [data]="rangeChartData" [width]="500"
            [height]="280" unit="°C" title="Monthly Temperature Range" />
        </div>

        <div class="space-y-4">
          <h3 class="text-lg font-semibold">Bar Race Chart</h3>
          <p class="text-sm text-muted-foreground">Animated ranking chart. Click play to start the animation.</p>
          <ui-bar-race-chart [dir]="dir()" [frames]="barRaceFrames" [frameLabels]="barRaceLabels"
            [width]="600" [height]="320" [maxBars]="6" [animationDuration]="600" title="Sales Leaderboard" />
        </div>
      </div>
    </section>
  `,
})
export class ChartsDemoComponent {
  readonly dir = signal<'ltr' | 'rtl'>(
    (typeof document !== 'undefined' && document.documentElement.dir === 'rtl') ? 'rtl' : 'ltr'
  );

  readonly pieChartData: ChartDataPoint[] = [
    { name: 'Chrome', value: 61.41 },
    { name: 'Safari', value: 24.43 },
    { name: 'Edge', value: 6.28 },
    { name: 'Firefox', value: 4.14 },
    { name: 'Other', value: 3.74 },
  ];

  readonly drilldownData: DrilldownDataPoint[] = [
    { name: 'Chrome', value: 61, drilldown: 'chrome' },
    { name: 'Safari', value: 24, drilldown: 'safari' },
    { name: 'Edge', value: 6, drilldown: 'edge' },
    { name: 'Firefox', value: 5 },
    { name: 'Other', value: 4 },
  ];

  readonly drilldownSeries: DrilldownSeries[] = [
    {
      id: 'chrome', name: 'Chrome Versions', data: [
        { name: 'v120', value: 35 }, { name: 'v119', value: 15 }, { name: 'v118', value: 8 }, { name: 'v117', value: 3 },
      ],
    },
    {
      id: 'safari', name: 'Safari Versions', data: [
        { name: 'v17', value: 18 }, { name: 'v16', value: 5 }, { name: 'v15', value: 1 },
      ],
    },
    {
      id: 'edge', name: 'Edge Versions', data: [
        { name: 'v120', value: 4 }, { name: 'v119', value: 1.5 }, { name: 'v118', value: 0.5 },
      ],
    },
  ];

  readonly barChartData: ChartDataPoint[] = [
    { name: 'Jan', value: 4500 },
    { name: 'Feb', value: 3800 },
    { name: 'Mar', value: 5200 },
    { name: 'Apr', value: 4800 },
    { name: 'May', value: 6100 },
    { name: 'Jun', value: 5500 },
  ];

  readonly stackedSeries: ChartSeries[] = [
    {
      name: 'Desktop', data: [
        { name: 'Q1', value: 50 }, { name: 'Q2', value: 55 }, { name: 'Q3', value: 60 }, { name: 'Q4', value: 65 },
      ],
    },
    {
      name: 'Mobile', data: [
        { name: 'Q1', value: 40 }, { name: 'Q2', value: 50 }, { name: 'Q3', value: 55 }, { name: 'Q4', value: 68 },
      ],
    },
    {
      name: 'Tablet', data: [
        { name: 'Q1', value: 10 }, { name: 'Q2', value: 12 }, { name: 'Q3', value: 8 }, { name: 'Q4', value: 10 },
      ],
    },
  ];

  readonly stackedCategories = ['Q1', 'Q2', 'Q3', 'Q4'];

  readonly rangeChartData: RangeDataPoint[] = [
    { name: 'Jan', low: -5, high: 5 },
    { name: 'Feb', low: -3, high: 8 },
    { name: 'Mar', low: 2, high: 14 },
    { name: 'Apr', low: 8, high: 20 },
    { name: 'May', low: 13, high: 25 },
    { name: 'Jun', low: 18, high: 30 },
  ];

  readonly barRaceFrames: ChartDataPoint[][] = [
    [{ name: 'Alice', value: 45 }, { name: 'Bob', value: 30 }, { name: 'Charlie', value: 55 }, { name: 'Diana', value: 40 }, { name: 'Eve', value: 25 }, { name: 'Frank', value: 10 }],
    [{ name: 'Alice', value: 82 }, { name: 'Bob', value: 68 }, { name: 'Charlie', value: 71 }, { name: 'Diana', value: 90 }, { name: 'Eve', value: 55 }, { name: 'Frank', value: 15 }],
    [{ name: 'Alice', value: 120 }, { name: 'Bob', value: 145 }, { name: 'Charlie', value: 98 }, { name: 'Diana', value: 130 }, { name: 'Eve', value: 88 }, { name: 'Frank', value: 20 }],
    [{ name: 'Alice', value: 175 }, { name: 'Bob', value: 190 }, { name: 'Charlie', value: 155 }, { name: 'Diana', value: 168 }, { name: 'Eve', value: 142 }, { name: 'Frank', value: 25 }],
    [{ name: 'Alice', value: 220 }, { name: 'Bob', value: 245 }, { name: 'Charlie', value: 200 }, { name: 'Diana', value: 230 }, { name: 'Eve', value: 212 }, { name: 'Frank', value: 30 }],
    [{ name: 'Alice', value: 265 }, { name: 'Bob', value: 290 }, { name: 'Charlie', value: 255 }, { name: 'Diana', value: 278 }, { name: 'Eve', value: 262 }, { name: 'Frank', value: 35 }],
  ];

  readonly barRaceLabels = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'];
}
