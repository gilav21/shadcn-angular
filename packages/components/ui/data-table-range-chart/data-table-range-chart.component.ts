import {
  Component,
  ChangeDetectionStrategy,
  computed,
  input,
  model,
} from '@angular/core';
import { cn } from '../../lib/utils';
import { ChartDataPoint, ChartSeries } from '../../lib/chart.types';
import { BarChartComponent } from '../bar-chart';
import { PieChartComponent } from '../pie-chart';
import { StackedBarChartComponent } from '../stacked-bar-chart';
import { ButtonComponent } from '../button';
import {
  DialogComponent,
  DialogContentComponent,
  DialogHeaderComponent,
  DialogTitleComponent,
} from '../dialog';

/**
 * The shape emitted by the data table's `rangeChartOpen` output. Declared
 * locally (not imported from the data table) so this dialog depends only on the
 * chart + dialog components — never on the data table. The two types are
 * structurally compatible, so a `RangeChartPayload` passes straight in.
 */
export interface RangeChartData {
  categories: string[];
  series: { name: string; values: number[] }[];
}

export type RangeChartType = 'bar' | 'pie' | 'stacked';

/**
 * Optional, opt-in dialog that charts a data-table range selection. Wire it to
 * the table's `(rangeChartOpen)` output:
 *
 * ```html
 * <ui-data-table (rangeChartOpen)="payload.set($event); chartOpen.set(true)" />
 * <ui-data-table-range-chart [payload]="payload()" [(open)]="chartOpen" />
 * ```
 */
@Component({
  selector: 'ui-data-table-range-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BarChartComponent,
    PieChartComponent,
    StackedBarChartComponent,
    ButtonComponent,
    DialogComponent,
    DialogContentComponent,
    DialogHeaderComponent,
    DialogTitleComponent,
  ],
  templateUrl: './data-table-range-chart.component.html',
  host: { class: 'contents' },
})
export class DataTableRangeChartComponent {
  /** Extra classes merged onto the chart body wrapper inside the dialog (not the dialog surface itself). */
  readonly class = input('');
  /** The range payload to chart; the dialog shows nothing useful when null. */
  readonly payload = input<RangeChartData | null>(null);
  /** Two-way dialog visibility. */
  readonly open = model(false);
  /** Dialog title. */
  readonly title = input('Chart');
  /** Active chart type; two-way so consumers can preset/observe it. */
  readonly chartType = model<RangeChartType>('bar');

  readonly classes = computed(() => cn('flex flex-col gap-3', this.class()));

  /** Bar/pie data — the first numeric series mapped onto the row categories. */
  readonly barData = computed<ChartDataPoint[]>(() => {
    const payload = this.payload();
    const series = payload?.series[0];
    if (!payload || !series) return [];
    return payload.categories.map((name, i) => ({ name, value: series.values[i] ?? 0 }));
  });

  /** Stacked data — every numeric series across the row categories. */
  readonly stackedSeries = computed<ChartSeries[]>(() => {
    const payload = this.payload();
    if (!payload) return [];
    return payload.series.map((series) => ({
      name: series.name,
      data: payload.categories.map((name, i) => ({ name, value: series.values[i] ?? 0 })),
    }));
  });

  readonly categories = computed<string[]>(() => this.payload()?.categories ?? []);

  /** True when the payload carries more than one series (stacked is meaningful). */
  readonly hasMultipleSeries = computed(() => (this.payload()?.series.length ?? 0) > 1);

  readonly chartTypes: readonly RangeChartType[] = ['bar', 'pie', 'stacked'];

  /**
   * Switches the visualisation by writing {@link chartType}, which propagates
   * out through the two-way binding. Bound to the type-picker buttons; `'stacked'`
   * only renders meaningfully when {@link hasMultipleSeries} is true.
   */
  selectChartType(type: RangeChartType): void {
    this.chartType.set(type);
  }
}
